# Clinic Appointment and Medical Record Management System

Windows-first monorepo for an outpatient clinic workflow with a Next.js staff portal, Expo patient app, PostgreSQL/Prisma data layer, and planned Arduino RFID hardware.

## Current stack

- Next.js 16.3 with React 19 and TypeScript
- NextAuth 4 credentials authentication with server-side role checks
- Prisma 5.22 and PostgreSQL/Supabase
- Expo/React Native patient application
- npm workspaces and Turborepo

## Implemented workflow

- Patient registration, validated CSV import/export, and RFID card registry
- Triage assessment, configurable priority thresholds, and OPD handoff
- Complete appointment lifecycle with patient confirmation, policy-controlled cancellation/rescheduling, waitlist offers, reminders, automated no-shows, consultation follow-ups, and new-patient booking claims
- Appointment booking with persistent doctor availability, leave, holidays, lead time, and booking horizon
- Reception check-in, queue issuance, doctor queue, and queue display
- Priority-aware queue positions, dynamic wait estimates, SSE updates with reconnect fallback, event history, patient recall, doctor transfer, and pause/close controls
- SOAP medical records, PDF chart export, and e-signed prescriptions
- Patient portal, staff clinical messaging, admin notifications, and operational analytics
- Paginated patient, appointment, medical-record, audit, and email-delivery data
- Date-range operational reports with PDF export
- Persistent append-only audit trail with authentication, clinical-record, prescription, appointment, queue, RFID, staff, and settings events; each event stores actor/role, target, timestamp, request origin/device, and redacted before/after metadata
- Separate liveness, readiness, database-health, and dependency-monitor endpoints with structured error forwarding and database/email alerting
- Patient mobile self-service with verified account activation/reset, encrypted 30-day revocable sessions, booking/rescheduling/cancellation/history, calculated live queue position, contact updates, medical records, local appointment reminders, push-device registration, and encrypted limited offline cache
- Persistent database-backed authentication throttling, TOTP authenticator MFA, staff password activation/expiry, revoke-all-sessions controls, receptionist clinical-field redaction, date-of-birth patient verification, privacy consent records, retention/archive automation, hardened response headers, production secret validation, and audit investigation signals
- Daily encrypted and automatically verified backups, monthly isolated restore rehearsal, recovery-gated migration/deployment workflow, staging configuration, and CI for lint, type checks, tests, Prisma validation, and build

Arduino/ESP32 reader firmware and real station heartbeat telemetry remain intentionally outside the current software implementation.

## Setup

1. Install dependencies: `npm install`
2. Configure `.env` and `apps/web/.env.local`.
3. Generate Prisma client: `npm run db:generate`
4. Apply migrations in development with Prisma migrate. For production, follow `docs/operations/database-backup-restore.md`, then run `prisma migrate deploy`.
5. Seed only a development database: `npm run db:seed`
6. Start the web workspace: `npm.cmd run dev --workspace=@clinic/web`
7. Set `EXPO_PUBLIC_API_URL` to a URL reachable from the phone/emulator, set `MOBILE_ACCOUNT_URL` to the app deep-link base, then start mobile with `npm.cmd run dev --workspace=@clinic/mobile`.

Patient activation and reset links require SMTP or Resend configuration in production. When delivery is intentionally unconfigured in development, the API returns a development-only one-time token; production never returns account tokens in an API response.

Appointment no-show, reminder, and expired-waitlist processing requires a scheduler to send `POST /api/appointments/automation` with `Authorization: Bearer <CRON_SECRET>`. Run it every five minutes in production; the operation is idempotent and may also be run manually by an authenticated Admin.

Security rollout requires `RATE_LIMIT_PEPPER`, a 64-hex-character `MFA_ENCRYPTION_KEY`, and a 32+ character `CRON_SECRET`. Staff can enroll MFA and revoke their sessions at `/security`; temporary staff passwords are activated at `/activate-staff`. Keep `REQUIRE_STAFF_PASSWORD_ACTIVATION` and `REQUIRE_STAFF_MFA` disabled until existing staff have activated and enrolled, then enable them in that order. Run `POST /api/security/retention` on a controlled schedule with `Authorization: Bearer <CRON_SECRET>`; it archives eligible data and reports audit rows for cold storage without deleting audit logs.

The web portal runs on `http://localhost:3001`.

Production recovery, staging, monitoring, CI, and deployment setup is documented in `docs/operations/production-operations.md`.

## Validation commands

```powershell
npx.cmd tsc -p apps/web/tsconfig.json --noEmit
npx.cmd tsc -p apps/mobile/tsconfig.json --noEmit
npm.cmd run test:policy
npm.cmd run test:scheduling
npm.cmd run test:settings
npm.cmd run test:operations
npm.cmd run test:audit
npm.cmd run test:patient-mobile
npm.cmd run test:appointment-lifecycle
npm.cmd run test:appointment-lifecycle-db
npm.cmd run test:queue-lifecycle
npm.cmd run test:queue-lifecycle-db
npm.cmd run test:security-hardening
npm.cmd run test:production-operations
npm.cmd run test:ci
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:security
```

Database-backed authorization tests require a reachable migrated database and a running web server. Lint is a passing gate with four existing non-blocking warnings. On this protected Windows checkout, even a separate `NEXT_DIST_DIR` can stall during production build I/O; CI runs that build on Linux as the authoritative gate.

## Important routes

- `/` staff access portal
- `/book` public appointment booking
- `/patient` patient queue and records portal
- `/queue-tv` public de-identified queue board
- `/triage` nurse triage station
- `/reception/checkin` reception workflow
- `/doctor/queue` consultation workflow
- `/admin/dashboard` administrative dashboard
- `/admin/reports` date-range reports, delivery queue, and notification history
- `/admin/audit-logs` persisted audit trail
- `/security` staff MFA and session controls
- `/activate-staff` temporary-password activation
- `/health` process liveness
- `/ready` dependency readiness
- `/api/database-health` focused database probe
- `/api/health` compatibility aggregate health probe
- `/api/operations/monitor` authenticated database/email alert check

## Explicitly out of scope

- Arduino/ESP32 firmware and physical-reader integration
- Payment gateway, insurance claims, pharmacy inventory, and laboratory/radiology subsystems

Do not use `prisma db push`, reset, truncate, or seed commands against production data.
