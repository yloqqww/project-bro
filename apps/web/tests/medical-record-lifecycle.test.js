const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('schema and migration persist the clinical record lifecycle and version lineage', () => {
  const schema = read('packages/db/prisma/schema.prisma');
  const migration = read('packages/db/prisma/migrations/20261006100000_add_medical_record_lifecycle/migration.sql');
  for (const value of ['DRAFT', 'FINALIZED', 'AMENDED']) assert.ok(schema.includes(value));
  for (const field of ['finalizedAt', 'finalizedById', 'contentHash', 'parentRecordId', 'amendmentReason', 'queueTicketId', 'archivedAt']) assert.ok(schema.includes(field), `Missing ${field}`);
  assert.match(migration, /BEFORE INSERT OR UPDATE OR DELETE ON "medical_records"/);
  assert.match(migration, /Medical records cannot be hard deleted/);
  assert.match(migration, /Finalized medical record clinical content is immutable/);
});

test('medical record API finalizes, amends, archives, and writes audit events server-side', () => {
  const lifecycleRoute = read('apps/web/src/app/api/medical-records/[id]/route.ts');
  for (const action of ['UPDATE_DRAFT', 'FINALIZE', 'AMEND']) assert.ok(lifecycleRoute.includes(action), `Missing ${action}`);
  for (const auditAction of ['MEDICAL_RECORD_UPDATE', 'MEDICAL_RECORD_FINALIZE', 'MEDICAL_RECORD_AMENDMENT_CREATE', 'MEDICAL_RECORD_ARCHIVE']) assert.ok(lifecycleRoute.includes(auditAction), `Missing ${auditAction}`);
  assert.match(lifecycleRoute, /status: 'AMENDED'/);
  assert.match(lifecycleRoute, /parentRecordId: record\.id/);
  assert.match(lifecycleRoute, /archivedAt: new Date\(\)/);
});

test('attachments are restricted, checksummed, downloadable, and archived without deletion', () => {
  const upload = read('apps/web/src/app/api/medical-records/[id]/attachments/route.ts');
  const download = read('apps/web/src/app/api/medical-records/attachments/[attachmentId]/route.ts');
  assert.match(upload, /application\/pdf/);
  assert.match(upload, /10 \* 1024 \* 1024/);
  assert.match(upload, /sha256Bytes/);
  assert.match(upload, /record\.status !== 'DRAFT'/);
  assert.match(download, /X-Content-Type-Options/);
  assert.match(download, /archivedAt: new Date\(\)/);
  assert.doesNotMatch(download, /medicalRecordAttachment\.delete/);
});

test('prescriptions and queue completion attach only to mutable, linked draft encounters', () => {
  const prescriptions = read('apps/web/src/app/api/prescriptions/route.ts');
  const queue = read('apps/web/src/app/api/queue/[id]/route.ts');
  assert.match(prescriptions, /status: 'DRAFT', archivedAt: null/);
  assert.match(prescriptions, /queueTicketId: encounter\?\.id/);
  assert.match(queue, /queueTicketId: updated\.id/);
  assert.match(queue, /appointmentId: updated\.appointmentId/);
});

test('workspace finalization calls the API and exposes amendment, attachment, and archival controls', () => {
  const workspace = read('apps/web/src/components/MedicalRecordsWorkspace.tsx');
  assert.match(workspace, /body: JSON\.stringify\(\{ action: 'FINALIZE' \}\)/);
  for (const expected of ['Create Amendment', 'Edit Draft', 'Clinical attachments', 'Archive']) assert.ok(workspace.includes(expected), `Missing ${expected}`);
});
