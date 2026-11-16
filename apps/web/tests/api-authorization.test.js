const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config();
const { encode } = require('next-auth/jwt');
const { PrismaClient } = require('@prisma/client');

const baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

async function request(method, path, cookie) {
  const options = { method, headers: { 'content-type': 'application/json' } };
  if (cookie) options.headers.cookie = cookie;
  if (!['GET', 'HEAD'].includes(method)) options.body = '{}';
  return fetch(`${baseUrl}${path}`, options);
}

async function roleCookie(role) {
  const user = await prisma.user.findFirst({
    where: { role, isActive: true },
    select: { id: true, email: true },
  });
  if (!user) return null;
  const token = await encode({
    secret: process.env.NEXTAUTH_SECRET,
    maxAge: 60,
    token: { id: user.id, sub: user.id, email: user.email, role },
  });
  return `next-auth.session-token=${token}`;
}

test.after(async () => prisma.$disconnect());

const protectedCases = [
  ['GET', '/api/admin/staff'],
  ['POST', '/api/admin/staff'],
  ['GET', '/api/admin/rfid'],
  ['POST', '/api/admin/rfid'],
  ['PATCH', '/api/admin/rfid'],
  ['GET', '/api/admin/schedules?doctorId=invalid'],
  ['PUT', '/api/admin/schedules'],
  ['POST', '/api/admin/schedules/exceptions'],
  ['DELETE', '/api/admin/schedules/exceptions?id=invalid'],
  ['GET', '/api/admin/settings'],
  ['PUT', '/api/admin/settings'],
  ['GET', '/api/admin/audit-logs'],
  ['GET', '/api/admin/reports'],
  ['GET', '/api/admin/reports/pdf'],
  ['GET', '/api/admin/email-deliveries'],
  ['POST', '/api/admin/email-deliveries'],
  ['GET', '/api/admin/patients/export'],
  ['POST', '/api/admin/patients/import'],
  ['POST', '/api/auth/audit-logout'],
  ['GET', '/api/patients'],
  ['PATCH', '/api/patients'],
  ['DELETE', '/api/patients?id=invalid'],
  ['GET', '/api/medical-records'],
  ['POST', '/api/medical-records'],
  ['PATCH', '/api/medical-records/invalid'],
  ['DELETE', '/api/medical-records/invalid'],
  ['POST', '/api/medical-records/invalid/attachments'],
  ['GET', '/api/medical-records/attachments/invalid'],
  ['DELETE', '/api/medical-records/attachments/invalid'],
  ['GET', '/api/medical-records/pdf?recordId=invalid'],
  ['GET', '/api/prescriptions?patientId=invalid'],
  ['POST', '/api/prescriptions'],
  ['GET', '/api/queue'],
  ['POST', '/api/queue'],
  ['PATCH', '/api/queue/invalid'],
  ['GET', '/api/triage'],
  ['POST', '/api/triage'],
  ['PATCH', '/api/triage'],
  ['GET', '/api/appointments'],
  ['PATCH', '/api/appointments/invalid'],
  ['GET', '/api/analytics'],
  ['GET', '/api/staff-messages'],
  ['POST', '/api/staff-messages'],
  ['PATCH', '/api/staff-messages'],
  ['GET', '/api/test-config'],
];

for (const [method, path] of protectedCases) {
  test(`unauthenticated ${method} ${path} is denied`, async () => {
    const response = await request(method, path);
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'UNAUTHENTICATED');
  });
}

test('public doctor directory remains available', async () => {
  const response = await request('GET', '/api/doctors');
  assert.equal(response.status, 200);
});

test('public clinic settings expose operational display configuration', async () => {
  const response = await request('GET', '/api/settings');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.ok(body.settings.clinicName);
  assert.ok(Array.isArray(body.settings.queuePrefixes));
  assert.equal('updatedById' in body.settings, false);
});

test('public doctor availability exposes generated slots without patient data', async (t) => {
  const doctorsResponse = await request('GET', '/api/doctors');
  const doctorsBody = await doctorsResponse.json();
  const doctor = doctorsBody.doctors?.[0];
  if (!doctor) return t.skip('No active doctor fixture');
  const response = await request('GET', `/api/doctors/${doctor.id}/availability?date=2030-01-07`);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  for (const slot of body.slots || []) {
    assert.deepEqual(Object.keys(slot).sort(), ['end', 'label', 'start']);
  }
});

test('public queue view is available and contains no patient identity fields', async () => {
  const response = await request('GET', '/api/queue?view=public');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  for (const ticket of body.tickets || []) {
    assert.equal('patientId' in ticket, false);
    assert.equal('patientName' in ticket, false);
    assert.equal('cardUid' in ticket, false);
    assert.equal('reasonForVisit' in ticket, false);
  }
});

test('a doctor cannot escalate into staff administration', async (t) => {
  const cookie = await roleCookie('DOCTOR');
  if (!cookie) return t.skip('No active doctor fixture');
  const response = await request('GET', '/api/admin/staff', cookie);
  assert.equal(response.status, 403);
});

test('an administrator can read the staff administration endpoint', async (t) => {
  const cookie = await roleCookie('ADMIN');
  if (!cookie) return t.skip('No active administrator fixture');
  const response = await request('GET', '/api/admin/staff', cookie);
  assert.equal(response.status, 200);
});

test('a doctor cannot access the RFID registry', async (t) => {
  const cookie = await roleCookie('DOCTOR');
  if (!cookie) return t.skip('No active doctor fixture');
  const response = await request('GET', '/api/admin/rfid', cookie);
  assert.equal(response.status, 403);
});

test('RFID assignment and status changes validate input before writes', async (t) => {
  const cookie = await roleCookie('ADMIN');
  if (!cookie) return t.skip('No active administrator fixture');

  for (const method of ['POST', 'PATCH']) {
    const response = await request(method, '/api/admin/rfid', cookie);
    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'VALIDATION_ERROR');
  }
});

test('a doctor cannot edit patient demographics', async (t) => {
  const cookie = await roleCookie('DOCTOR');
  if (!cookie) return t.skip('No active doctor fixture');
  const response = await request('PATCH', '/api/patients', cookie);
  assert.equal(response.status, 403);
});

test('patients cannot access internal staff messaging', async (t) => {
  const cookie = await roleCookie('PATIENT');
  if (!cookie) return t.skip('No active patient fixture');
  const response = await request('GET', '/api/staff-messages', cookie);
  assert.equal(response.status, 403);
});

test('non-admin clinical staff cannot publish announcements', async (t) => {
  const cookie = await roleCookie('DOCTOR');
  if (!cookie) return t.skip('No active doctor fixture');
  const response = await fetch(`${baseUrl}/api/staff-messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ action: 'announce', title: 'Test', body: 'Test announcement', targetRole: 'ALL_STAFF' }),
  });
  assert.equal(response.status, 403);
});

test('administrators can load operational announcements without clinical threads', async (t) => {
  const cookie = await roleCookie('ADMIN');
  if (!cookie) return t.skip('No active administrator fixture');
  const response = await request('GET', '/api/staff-messages', cookie);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.deepEqual(body.conversations, []);
  assert.ok(Array.isArray(body.announcements));
});

test('doctors can load their role-scoped clinical handoff inbox', async (t) => {
  const cookie = await roleCookie('DOCTOR');
  if (!cookie) return t.skip('No active doctor fixture');
  const response = await request('GET', '/api/staff-messages', cookie);
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.ok(Array.isArray(body.conversations));
  assert.ok(Array.isArray(body.announcements));
});

test('clinical handoff creation validates the queue ticket before writing', async (t) => {
  const cookie = await roleCookie('NURSE');
  if (!cookie) return t.skip('No active triage nurse fixture');
  const response = await fetch(`${baseUrl}/api/staff-messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ action: 'message', queueTicketId: 'missing-ticket', body: 'Test handoff', priority: 'ROUTINE' }),
  });
  assert.equal(response.status, 404);
});

test('patient editing validates input before attempting a write', async (t) => {
  const cookie = await roleCookie('ADMIN');
  if (!cookie) return t.skip('No active administrator fixture');
  const response = await request('PATCH', '/api/patients', cookie);
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.equal(body.error.code, 'VALIDATION_ERROR');
});

test('a patient is scoped to their own profile and cannot request another id', async (t) => {
  const cookie = await roleCookie('PATIENT');
  if (!cookie) return t.skip('No active patient fixture');
  const ownResponse = await request('GET', '/api/patients', cookie);
  assert.equal(ownResponse.status, 200);
  const ownBody = await ownResponse.json();
  assert.equal(ownBody.success, true);
  assert.ok(ownBody.patient?.id);

  const crossPatientResponse = await request('GET', '/api/patients?patientId=not-the-owned-profile', cookie);
  assert.equal(crossPatientResponse.status, 403);
});
