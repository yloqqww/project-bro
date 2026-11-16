#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?BACKUP_ENCRYPTION_PASSPHRASE is required}"
: "${BACKUP_S3_URI:?BACKUP_S3_URI is required, for example s3://clinic-backups/production}"

for command_name in pg_dump pg_restore psql gpg sha256sum aws; do
  command -v "$command_name" >/dev/null || { echo "Missing required command: $command_name" >&2; exit 1; }
done

backup_temp_dir="$(mktemp -d)"
trap 'rm -rf -- "$backup_temp_dir"' EXIT

backup_timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
backup_name="clinic-${backup_timestamp}"
dump_path="${backup_temp_dir}/${backup_name}.dump"
encrypted_path="${dump_path}.gpg"
manifest_path="${backup_temp_dir}/${backup_name}.json"
prefix="${BACKUP_S3_URI%/}"

pg_dump --format=custom --compress=9 --no-owner --no-acl --dbname="$DATABASE_URL" --file="$dump_path"
pg_restore --list "$dump_path" >/dev/null

checksum="$(sha256sum "$dump_path" | awk '{print $1}')"
postgres_version="$(psql "$DATABASE_URL" -Atc 'SHOW server_version;' | tr -d '\r\n')"
counts="$(psql "$DATABASE_URL" -Atc "SELECT json_build_object('users',(SELECT COUNT(*) FROM users),'patients',(SELECT COUNT(*) FROM patient_profiles),'appointments',(SELECT COUNT(*) FROM appointments),'medicalRecords',(SELECT COUNT(*) FROM medical_records),'auditLogs',(SELECT COUNT(*) FROM system_audit_logs))::text;" | tr -d '\r\n')"

printf '%s' "$BACKUP_ENCRYPTION_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --symmetric --cipher-algo AES256 --output "$encrypted_path" "$dump_path"

verified_dump_path="${backup_temp_dir}/verified.dump"
printf '%s' "$BACKUP_ENCRYPTION_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --decrypt --output "$verified_dump_path" "$encrypted_path"
verified_checksum="$(sha256sum "$verified_dump_path" | awk '{print $1}')"
test "$checksum" = "$verified_checksum"
pg_restore --list "$verified_dump_path" >/dev/null

node -e "const fs=require('fs'); fs.writeFileSync(process.argv[1], JSON.stringify({createdAt:process.argv[2],object:process.argv[3],sha256:process.argv[4],postgresVersion:process.argv[5],counts:JSON.parse(process.argv[6]),verification:'pg_restore-list-and-decrypt-checksum'},null,2))" "$manifest_path" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "${backup_name}.dump.gpg" "$checksum" "$postgres_version" "$counts"

aws s3 cp "$encrypted_path" "${prefix}/${backup_name}.dump.gpg" --only-show-errors
aws s3 cp "$manifest_path" "${prefix}/${backup_name}.json" --content-type application/json --only-show-errors
aws s3 cp "$manifest_path" "${prefix}/latest-success.json" --content-type application/json --only-show-errors

echo "Encrypted and verified backup uploaded: ${prefix}/${backup_name}.dump.gpg"
