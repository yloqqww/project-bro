#!/usr/bin/env bash
set -euo pipefail

: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL is required}"
: "${BACKUP_ENCRYPTION_PASSPHRASE:?BACKUP_ENCRYPTION_PASSPHRASE is required}"
: "${BACKUP_S3_URI:?BACKUP_S3_URI is required}"
: "${ALLOW_RESTORE_REHEARSAL:?Set ALLOW_RESTORE_REHEARSAL=true only for an isolated rehearsal database}"

test "$ALLOW_RESTORE_REHEARSAL" = 'true' || { echo 'Restore rehearsal safety flag is not true.' >&2; exit 1; }
case "$RESTORE_DATABASE_URL" in
  *rehearsal*) ;;
  *) echo 'RESTORE_DATABASE_URL must contain rehearsal in the isolated database name.' >&2; exit 1 ;;
esac
if [[ -n "${DATABASE_URL:-}" && "$RESTORE_DATABASE_URL" = "$DATABASE_URL" ]]; then
  echo 'Restore target must never equal the source database.' >&2
  exit 1
fi

for command_name in pg_restore psql gpg sha256sum aws jq; do
  command -v "$command_name" >/dev/null || { echo "Missing required command: $command_name" >&2; exit 1; }
done

restore_temp_dir="$(mktemp -d)"
trap 'rm -rf -- "$restore_temp_dir"' EXIT
prefix="${BACKUP_S3_URI%/}"
manifest_path="${restore_temp_dir}/manifest.json"
aws s3 cp "${prefix}/latest-success.json" "$manifest_path" --only-show-errors

backup_object="$(jq -r '.object' "$manifest_path")"
expected_checksum="$(jq -r '.sha256' "$manifest_path")"
encrypted_path="${restore_temp_dir}/${backup_object}"
dump_path="${restore_temp_dir}/restore.dump"
aws s3 cp "${prefix}/${backup_object}" "$encrypted_path" --only-show-errors
printf '%s' "$BACKUP_ENCRYPTION_PASSPHRASE" | gpg --batch --yes --pinentry-mode loopback --passphrase-fd 0 --decrypt --output "$dump_path" "$encrypted_path"

actual_checksum="$(sha256sum "$dump_path" | awk '{print $1}')"
test "$expected_checksum" = "$actual_checksum"
pg_restore --list "$dump_path" >/dev/null

started_at="$(date +%s)"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" "$dump_path"
restored_counts="$(psql "$RESTORE_DATABASE_URL" -Atc "SELECT json_build_object('users',(SELECT COUNT(*) FROM users),'patients',(SELECT COUNT(*) FROM patient_profiles),'appointments',(SELECT COUNT(*) FROM appointments),'medicalRecords',(SELECT COUNT(*) FROM medical_records),'auditLogs',(SELECT COUNT(*) FROM system_audit_logs))::text;" | jq -c .)"
expected_counts="$(jq -c '.counts' "$manifest_path")"
test "$expected_counts" = "$restored_counts"
duration_seconds="$(( $(date +%s) - started_at ))"

result_path="${RESTORE_REHEARSAL_RESULT_PATH:-restore-rehearsal-result.json}"
node -e "const fs=require('fs'); fs.writeFileSync(process.argv[1], JSON.stringify({completedAt:process.argv[2],sourceObject:process.argv[3],sha256:process.argv[4],durationSeconds:Number(process.argv[5]),counts:JSON.parse(process.argv[6]),status:'passed'},null,2))" "$result_path" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$backup_object" "$actual_checksum" "$duration_seconds" "$restored_counts"

echo "Restore rehearsal passed in ${duration_seconds}s using ${backup_object}."
