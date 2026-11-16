const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

test('patient schema and migration establish permanent MRNs and lifecycle history', () => {
  const schema = read('../../packages/db/prisma/schema.prisma');
  const migration = read('../../packages/db/prisma/migrations/20261006170000_add_patient_master_index/migration.sql');
  assert.match(schema, /mrn\s+String\s+@unique/);
  assert.match(schema, /model PatientDemographicChange/);
  assert.match(schema, /model PatientMergeHistory/);
  assert.match(migration, /patient_mrn_seq/);
  assert.match(migration, /patient_profiles_prevent_delete/);
  assert.match(migration, /patient_profiles_lifecycle_check/);
});

test('duplicate detection uses multiple demographic identifiers', () => {
  const source = read('src/lib/patient-master-index.ts');
  for (const field of ['normalizedFirstName', 'normalizedLastName', 'dateOfBirth', 'normalizedPhone', 'normalizedAddress']) assert.match(source, new RegExp(field));
  assert.match(source, /score >= 80 \? 'HIGH' : 'REVIEW'/);
});

test('patient mutations archive, merge, and record demographic changes', () => {
  const patients = read('src/app/api/patients/route.ts');
  const master = read('src/app/api/admin/patients/master-index/route.ts');
  assert.match(patients, /recordDemographicChange/);
  assert.match(patients, /status: 'ARCHIVED'/);
  assert.match(master, /action: z\.literal\('MERGE'\)/);
  assert.match(master, /patientMergeHistory\.create/);
  assert.match(master, /PATIENT_RECORD_RESTORE/);
});

test('admin master-index page exposes review, merge, restore, and history', () => {
  const page = read('src/app/admin/patients/master-index/page.tsx');
  assert.match(page, /Probable duplicate records|Ayusin ang Duplicate/);
  assert.match(page, /mergePatient|confirmMerge/);
  assert.match(page, /restorePatient|restore/);
  assert.match(page, /Demographic history|History ng Pagbabago/);
});
