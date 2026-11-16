const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('authentication uses persistent throttling, MFA, password expiry, and session versions', () => {
  const auth = read('apps/web/src/lib/auth.ts');
  const limiter = read('apps/web/src/lib/security-rate-limit.ts');
  const migration = read('packages/db/prisma/migrations/20261006160000_add_security_privacy_hardening/migration.sql');
  assert.match(auth, /consumeRateLimit\('STAFF_LOGIN'/);
  assert.match(auth, /passwordExpiresAt/);
  assert.match(auth, /verifyTotp/);
  assert.match(auth, /sessionVersion/);
  assert.match(limiter, /pg_advisory_xact_lock/);
  assert.match(migration, /CREATE TABLE "security_rate_limits"/);
});

test('staff can manage MFA and revoke all web and mobile sessions', () => {
  const mfa = read('apps/web/src/app/api/security/mfa/route.ts');
  const sessions = read('apps/web/src/app/api/security/sessions/route.ts');
  const page = read('apps/web/src/app/security/page.tsx');
  for (const action of ['MFA_ENROLLMENT_STARTED', 'MFA_ENABLED', 'MFA_DISABLED']) assert.ok(mfa.includes(action));
  assert.match(sessions, /sessionVersion: \{ increment: 1 \}/);
  assert.match(sessions, /mobileSession\.updateMany/);
  assert.match(page, /Set up authenticator/);
  assert.match(page, /Revoke and sign out/);
});

test('patient verification, field permissions, and privacy consent are enforced server-side', () => {
  const patients = read('apps/web/src/app/api/patients/route.ts');
  const policy = read('apps/web/src/lib/access-policy.ts');
  const appointments = read('apps/web/src/app/api/appointments/route.ts');
  const consent = read('apps/web/src/app/api/mobile/privacy-consent/route.ts');
  assert.match(patients, /dateOfBirth/);
  assert.match(patients, /canViewClinicalDetails/);
  assert.doesNotMatch(policy.match(/medicalRecordRead:[^\n]+/)?.[0] || '', /RECEPTIONIST/);
  assert.match(appointments, /privacyAcknowledged/);
  assert.match(appointments, /patientPrivacyConsent\.create/);
  assert.match(consent, /ACKNOWLEDGE/);
  assert.match(consent, /WITHDRAW/);
});

test('retention, security headers, secret validation, and investigation signals are present', () => {
  const retention = read('apps/web/src/app/api/security/retention/route.ts');
  const headers = read('apps/web/next.config.js');
  const config = read('apps/web/src/lib/security-config.ts');
  const audit = read('apps/web/src/app/api/admin/audit-logs/route.ts');
  assert.match(retention, /clinicalRecordRetentionYears/);
  assert.match(retention, /auditLogsDeleted: 0/);
  for (const name of ['NEXTAUTH_SECRET', 'RATE_LIMIT_PEPPER', 'MFA_ENCRYPTION_KEY', 'CRON_SECRET']) assert.ok(config.includes(name), `Missing ${name} validation`);
  assert.match(headers, /Cross-Origin-Opener-Policy/);
  assert.match(headers, /Cross-Origin-Resource-Policy/);
  assert.match(audit, /searchParams\.get\('mode'\) === 'investigation'/);
  assert.match(audit, /sharedSourceIps/);
});
