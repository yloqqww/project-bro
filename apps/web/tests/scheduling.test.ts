import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  clinicDateTime,
  generateAvailableSlots,
  requestedSlotMatches,
  validateWeeklyAvailability,
  type WeeklyAvailability,
} from '../src/lib/scheduling.ts';

const week: WeeklyAvailability[] = Array.from({ length: 7 }, (_, dayOfWeek) => ({
  dayOfWeek,
  enabled: true,
  startTime: '09:00',
  endTime: '17:00',
  breakStart: '12:00',
  breakEnd: '13:00',
}));

const base = {
  date: '2030-01-07',
  weeklyAvailability: week,
  exceptions: [],
  appointments: [],
  slotDuration: 30,
  bufferMinutes: 0,
  maxPatientsPerDay: 20,
  now: new Date('2029-01-01T00:00:00Z'),
};

test('validates a complete weekly schedule and rejects invalid breaks', () => {
  assert.doesNotThrow(() => validateWeeklyAvailability(week));
  assert.throws(() => validateWeeklyAvailability([
    ...week.slice(0, 1),
    { ...week[1], breakStart: '18:00', breakEnd: '19:00' },
    ...week.slice(2),
  ]), /Break time/);
});

test('generates working-hour slots while excluding the break', () => {
  const labels = generateAvailableSlots(base).map((slot) => slot.label);
  assert.ok(labels.includes('09:00 AM'));
  assert.equal(labels.includes('12:00 PM'), false);
  assert.equal(labels.includes('12:30 PM'), false);
  assert.ok(labels.includes('01:00 PM'));
});

test('always excludes the clinic lunch hour even when a saved schedule has no break', () => {
  const slots = generateAvailableSlots({
    ...base,
    weeklyAvailability: week.map((day) => ({ ...day, breakStart: null, breakEnd: null })),
  });
  const labels = slots.map((slot) => slot.label);
  assert.equal(labels.includes('12:00 PM'), false);
  assert.equal(labels.includes('12:30 PM'), false);
  assert.ok(labels.includes('01:00 PM'));
});

test('removes every slot for leave or holiday dates', () => {
  const slots = generateAvailableSlots({
    ...base,
    exceptions: [{ type: 'LEAVE', reason: 'Annual leave' }],
  });
  assert.deepEqual(slots, []);
});

test('removes partial unavailable windows', () => {
  const labels = generateAvailableSlots({
    ...base,
    exceptions: [{ type: 'UNAVAILABLE', startTime: '14:00', endTime: '15:00' }],
  }).map((slot) => slot.label);
  assert.equal(labels.includes('02:00 PM'), false);
  assert.equal(labels.includes('02:30 PM'), false);
  assert.ok(labels.includes('03:00 PM'));
});

test('prevents overlapping appointments even when the existing start is off-grid', () => {
  const labels = generateAvailableSlots({
    ...base,
    appointments: [{ appointmentDate: clinicDateTime(base.date, '09:15'), duration: 30 }],
  }).map((slot) => slot.label);
  assert.equal(labels.includes('09:00 AM'), false);
  assert.equal(labels.includes('09:30 AM'), false);
  assert.ok(labels.includes('10:00 AM'));
});

test('returns no slots when the daily patient limit is reached', () => {
  const slots = generateAvailableSlots({
    ...base,
    maxPatientsPerDay: 2,
    appointments: [
      { appointmentDate: clinicDateTime(base.date, '09:00'), duration: 30 },
      { appointmentDate: clinicDateTime(base.date, '10:00'), duration: 30 },
    ],
  });
  assert.deepEqual(slots, []);
});

test('only accepts a start returned by the latest availability calculation', () => {
  const slots = generateAvailableSlots(base);
  assert.equal(requestedSlotMatches(slots, clinicDateTime(base.date, '09:00')), true);
  assert.equal(requestedSlotMatches(slots, clinicDateTime(base.date, '09:15')), false);
});

test('simultaneous bookings are guarded by a transaction lock and unique DB index', () => {
  const route = readFileSync(resolve(process.cwd(), 'apps/web/src/app/api/appointments/route.ts'), 'utf8');
  const migration = readFileSync(resolve(process.cwd(), 'packages/db/prisma/migrations/20261003090000_add_doctor_scheduling/migration.sql'), 'utf8');
  assert.match(route, /pg_advisory_xact_lock/);
  assert.match(route, /isolationLevel: 'Serializable'/);
  assert.match(migration, /appointments_doctorId_appointmentDate_key/);
});
