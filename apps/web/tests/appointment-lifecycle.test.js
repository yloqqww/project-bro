const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('schema persists appointment confirmation, policy, history, waitlist, reminders, follow-up, and booking claims', () => {
  const schema = read('packages/db/prisma/schema.prisma');
  for (const field of ['patientConfirmedAt', 'cancellationPolicyResult', 'rescheduledFromId', 'followUpFromRecordId', 'noShowMarkedAt']) assert.ok(schema.includes(field), `Missing ${field}`);
  for (const model of ['AppointmentWaitlistEntry', 'AppointmentReminder', 'AppointmentBookingClaim']) assert.ok(schema.includes(`model ${model}`), `Missing ${model}`);
});

test('patient changes enforce cancellation policy and preserve reschedule history', () => {
  const route = read('apps/web/src/app/api/mobile/appointments/route.ts');
  assert.match(route, /action: z\.literal\('CONFIRM'\)/);
  assert.match(route, /evaluatePatientChangePolicy/);
  assert.match(route, /rescheduledFromId: current\.id/);
  assert.match(route, /cancellationReason: `Rescheduled by patient/);
  assert.match(route, /offerNextWaitlistEntry/);
});

test('automation marks no-shows after duration and grace and processes durable reminder jobs', () => {
  const lifecycle = read('apps/web/src/lib/appointment-lifecycle.ts');
  const route = read('apps/web/src/app/api/appointments/automation/route.ts');
  assert.match(lifecycle, /item\.duration \+ settings\.appointmentNoShowGraceMinutes/);
  assert.match(lifecycle, /noShowMarkedBy: 'AUTOMATION'/);
  assert.match(lifecycle, /appointmentReminder\.findMany/);
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /api\/v2\/push\/send/);
});

test('waitlist offers are transactional and can create an appointment', () => {
  const route = read('apps/web/src/app/api/mobile/waitlist/route.ts');
  const lifecycle = read('apps/web/src/lib/appointment-lifecycle.ts');
  assert.match(route, /pg_advisory_xact_lock/);
  assert.match(route, /status: 'OFFERED'/);
  assert.match(route, /status: 'BOOKED'/);
  assert.match(route, /scheduleAppointmentReminders/);
  assert.match(route, /current\.status === 'OFFERED'.*offerNextWaitlistEntry/s);
  assert.match(lifecycle, /offerExpiresAt: \{ lt: now \}.*offerNextWaitlistEntry/s);
});

test('public new-patient bookings issue a secure claim and claim flow verifies identity', () => {
  const booking = read('apps/web/src/app/api/appointments/route.ts');
  const claim = read('apps/web/src/app/api/mobile/auth/claim-booking/route.ts');
  assert.match(booking, /newOpaqueToken\(\)/);
  assert.match(booking, /hashMobileToken\(claimCode\)/);
  assert.match(claim, /dateOfBirth/);
  assert.match(claim, /phoneLast4/);
  assert.match(claim, /claimedAt: now/);
  assert.match(booking, /Invalid date of birth/);
});

test('mobile appointment changes collect explicit cancellation and reschedule reasons', () => {
  const app = read('apps/mobile/app/index.tsx');
  assert.match(app, /Reason for cancellation/);
  assert.match(app, /Reason for rescheduling/);
  assert.doesNotMatch(app, /Cancelled by patient through the mobile app\./);
});

test('doctor can schedule linked follow-up from a finalized consultation', () => {
  const route = read('apps/web/src/app/api/medical-records/[id]/follow-up/route.ts');
  const workspace = read('apps/web/src/components/MedicalRecordsWorkspace.tsx');
  assert.match(route, /status: 'FINALIZED'/);
  assert.match(route, /followUpFromRecordId: record\.id/);
  assert.match(workspace, /Schedule Follow-up/);
});
