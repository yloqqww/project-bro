import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CLINIC_SETTINGS,
  normalizeQueuePrefixes,
  operationalQueueDate,
  resolveQueuePrefix,
} from '../src/lib/clinic-settings.ts';

test('normalizes queue prefixes and rejects invalid entries', () => {
  const prefixes = normalizeQueuePrefixes([
    { id: 'cardio', department: ' Cardiology ', prefix: ' c ' },
    { id: 'bad', department: '', prefix: '***' },
  ]);
  assert.deepEqual(prefixes, [{ id: 'cardio', department: 'Cardiology', prefix: 'C' }]);
});

test('uses department, priority, and general fallback prefixes', () => {
  assert.equal(resolveQueuePrefix(DEFAULT_CLINIC_SETTINGS, 'Cardiology'), 'C');
  assert.equal(resolveQueuePrefix(DEFAULT_CLINIC_SETTINGS, 'Pediatrics', 1), 'PRIO');
  assert.equal(resolveQueuePrefix(DEFAULT_CLINIC_SETTINGS, 'Dermatology'), 'A');
});

test('queue day remains on the previous date before configured reset time', () => {
  const beforeReset = operationalQueueDate(new Date('2026-10-03T21:00:00.000Z'), '06:00');
  const atReset = operationalQueueDate(new Date('2026-10-03T22:00:00.000Z'), '06:00');
  assert.equal(beforeReset.toISOString().slice(0, 10), '2026-10-03');
  assert.equal(atReset.toISOString().slice(0, 10), '2026-10-04');
});

test('midnight reset uses the current Manila calendar date', () => {
  const queueDate = operationalQueueDate(new Date('2026-10-03T03:00:00.000Z'), '00:00');
  assert.equal(queueDate.toISOString().slice(0, 10), '2026-10-03');
});
