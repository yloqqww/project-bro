# Production operations

This repository contains provider-neutral operational automation. It does not provision a cloud database, object-storage bucket, monitoring vendor, or hosting account. Those external resources and their secrets must be configured separately.

## Health and monitoring

- `GET /health` is a process liveness probe and never depends on PostgreSQL.
- `GET /ready` is a traffic-readiness probe. It returns `503` when PostgreSQL is unavailable and includes non-secret email-delivery status.
- `GET /api/database-health` is the focused PostgreSQL dependency probe.
- `GET /api/health` remains as the compatibility aggregate for existing dashboards.
- `POST /api/operations/monitor` runs active database and email checks. Call it every five minutes with `Authorization: Bearer <CRON_SECRET>`.

`.github/workflows/monitor.yml` performs that check every five minutes. If the application itself cannot answer, the workflow sends an out-of-band alert directly to `ALERT_WEBHOOK_URL`.

Unhandled Next.js server errors are emitted as structured JSON and forwarded to `ERROR_MONITOR_WEBHOOK_URL`. Operational database/email alerts are forwarded to `ALERT_WEBHOOK_URL`. Configure the log collector to ingest process stdout as well so webhook outages do not erase error evidence. Monitoring payloads intentionally exclude authorization headers, cookies, passwords, tokens, patient identifiers, and email addresses.

Alert rules should treat two consecutive `/ready` failures as database downtime, any `503` from the operations monitor as degraded service, and a failed GitHub backup or restore workflow as critical. The receiver should deduplicate on the supplied `fingerprint`.

## Encrypted backups

`.github/workflows/backup.yml` runs daily at 02:17 Asia/Manila (18:17 UTC). It:

1. creates a PostgreSQL custom-format dump;
2. verifies the archive with `pg_restore --list`;
3. records non-sensitive critical-table row counts and SHA-256;
4. encrypts with GnuPG AES-256 using the protected passphrase;
5. decrypts the artifact and verifies its checksum again; and
6. uploads the encrypted dump and manifest to the configured S3-compatible prefix.

Configure an object-lock/versioning policy and lifecycle retention on the bucket. Use credentials restricted to the backup prefix. Required production environment secrets are `DATABASE_URL`, `BACKUP_ENCRYPTION_PASSPHRASE`, `BACKUP_S3_URI`, `BACKUP_AWS_ACCESS_KEY_ID`, and `BACKUP_AWS_SECRET_ACCESS_KEY`.

## Restore rehearsal

`.github/workflows/restore-rehearsal.yml` runs monthly against an ephemeral PostgreSQL 16 service. It decrypts the latest successful backup, verifies checksum and archive readability, restores only into a database whose name contains `rehearsal`, reconciles critical row counts, measures duration, and uploads `latest-restore-rehearsal.json`.

The production deployment gate rejects backups older than 26 hours and restore rehearsals older than 35 days. A rehearsal is useful evidence, but a clinic operator must still review its workflow log and record the result in the change ticket.

## Staging

Create a protected GitHub environment named `staging` with a separate database, email sandbox/domain, object-storage prefix, monitoring destination, deploy hook, and `PUBLIC_BASE_URL`. Start from `.env.staging.example`. Never reuse production database credentials, encryption keys, patient data, email recipients, or mobile deep links. If realistic data is required, use an approved de-identified dataset.

Run the deploy workflow with `environment=staging`, complete workflow smoke tests against `/health`, `/ready`, and representative role-based flows, then promote the exact reviewed commit to production.

## Migration and deployment

`.github/workflows/deploy.yml` is manual and protected by the selected GitHub environment. It validates migration history, runs `prisma migrate deploy`, calls the hosting provider's `DEPLOY_HOOK_URL`, and waits for `/ready`.

Production additionally requires the backup and restore-rehearsal gates. Configure required reviewers for the production GitHub environment. Existing migration-history drift must be reconciled before the first automated deployment; the workflow intentionally stops at `prisma migrate status` rather than bypassing drift with `db push`, reset, truncate, or ad-hoc destructive SQL.

## CI

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`: dependency installation, Prisma client generation, schema validation, web/mobile lint, TypeScript checks, non-database test suites, and the production build. Database integration tests remain a deployment/staging gate because they require a migrated PostgreSQL instance and running application.
