import test from 'node:test';
import assert from 'node:assert/strict';
import { paginationMeta, paginationParams } from '../src/lib/pagination.ts';
import { reportRange, zonedDateKey } from '../src/lib/clinic-time.ts';
import { createTextPdf } from '../src/lib/simple-pdf.ts';

test('pagination clamps unsafe values and returns stable metadata', () => {
  const params = paginationParams(new URLSearchParams('page=-3&pageSize=999'), 25, 100);
  assert.deepEqual(params, { page: 1, pageSize: 100, skip: 0 });
  assert.deepEqual(paginationMeta(2, 25, 60), { page: 2, pageSize: 25, total: 60, totalPages: 3, hasNextPage: true, hasPreviousPage: true });
});

test('report range uses clinic timezone date boundaries', () => {
  assert.equal(zonedDateKey(new Date('2026-10-04T16:30:00Z'), 'Asia/Manila'), '2026-10-05');
  const range = reportRange(new URLSearchParams('from=2026-10-01&to=2026-10-31'), 'Asia/Manila');
  assert.equal(range.from.toISOString(), '2026-09-30T16:00:00.000Z');
  assert.equal(range.to.toISOString(), '2026-10-31T15:59:59.999Z');
});

test('PDF generator returns a valid PDF payload', () => {
  const pdf = createTextPdf('Clinic Report', ['Patients: 10']);
  assert.equal(pdf.subarray(0, 8).toString(), '%PDF-1.4');
  assert.match(pdf.toString('latin1'), /%%EOF$/);
});

test('PDF generator paginates long exports without truncating records', () => {
  const lines = Array.from({ length: 120 }, (_, index) => `Daily row ${index + 1}`);
  const pdf = createTextPdf('Annual Report', lines).toString('latin1');
  assert.match(pdf, /\/Count 3/);
  assert.match(pdf, /Daily row 120/);
  assert.match(pdf, /Page 3 of 3/);
});
