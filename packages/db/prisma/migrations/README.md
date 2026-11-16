# Migration baseline status

The connected database predates a checked-in Prisma migration history and contains valuable data. Do not run `prisma migrate reset` or blindly apply an initial create migration to it.

Before marking a baseline as applied:

1. Complete and verify the backup/restore runbook in `docs/operations/database-backup-restore.md`.
2. Compare the live schema with `schema.prisma` using a read-only schema dump and `prisma migrate diff`.
3. Review every difference, especially the two newer tables `admin_notifications` and `triage_assessments`.
4. Generate and review an initial migration for clean installations.
5. Only after proving that the live schema represents that migration, record it with `prisma migrate resolve --applied <migration_name>` under an approved production change window.

No migration was marked as applied automatically because doing so changes live database migration state.
