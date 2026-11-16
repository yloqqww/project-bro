# PostgreSQL backup and restore runbook

This procedure must be completed before applying any production migration. Daily automation and monthly rehearsal are defined in `.github/workflows/backup.yml` and `.github/workflows/restore-rehearsal.yml`; this runbook remains the manual break-glass path.

## Backup

1. Use a database credential with read access to every application schema and store the connection string in the operator's secret manager, not in a command history or repository file.
2. Create a timestamped custom-format backup:

   ```powershell
   pg_dump --format=custom --no-owner --no-acl --file clinic-backup-YYYYMMDD-HHMM.dump $env:CLINIC_DATABASE_URL
   ```

3. Verify that `pg_restore --list clinic-backup-YYYYMMDD-HHMM.dump` completes successfully.
4. Encrypt the backup at rest, upload it to access-controlled storage, record its checksum, and apply the clinic's retention policy.

## Restore rehearsal

Never rehearse against the production database.

1. Provision an empty isolated PostgreSQL database of the same major version.
2. Restore with:

   ```powershell
   pg_restore --clean --if-exists --no-owner --no-acl --dbname $env:CLINIC_RESTORE_DATABASE_URL clinic-backup-YYYYMMDD-HHMM.dump
   ```

3. Point a non-production application instance at the restored database.
4. Run Prisma validation, row-count reconciliation, authorization tests, and representative read-only workflow checks.
5. Record restore duration, result, operator, checksum, PostgreSQL version, and any errors.

## Migration gate

A production migration may proceed only when a recent verified backup and a successful restore rehearsal are recorded. Use `prisma migrate deploy`; never use `prisma db push`, `migrate reset`, seed, cleanup, or truncate commands in production.

The automated production deployment additionally checks `latest-success.json` is no more than 26 hours old and `latest-restore-rehearsal.json` is passing and no more than 35 days old. It deliberately stops when Prisma migration history is inconsistent.
