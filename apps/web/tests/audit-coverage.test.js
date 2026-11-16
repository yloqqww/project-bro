const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('critical clinical and administrative actions have server audit hooks', () => {
  const expectations = {
    'apps/web/src/lib/auth.ts': ['LOGIN_SUCCESS', 'LOGIN_FAILURE'],
    'apps/web/src/app/api/auth/audit-logout/route.ts': ['LOGOUT'],
    'apps/web/src/app/api/patients/route.ts': ['PATIENT_RECORD_VIEW', 'PATIENT_RECORD_CREATE', 'PATIENT_RECORD_UPDATE', 'PATIENT_RECORD_ARCHIVE', 'RFID_ASSIGNED'],
    'apps/web/src/app/api/admin/patients/master-index/route.ts': ['PATIENT_RECORD_MERGE', 'PATIENT_RECORD_RESTORE'],
    'apps/web/src/app/api/prescriptions/route.ts': ['PRESCRIPTION_ISSUED', 'PRESCRIPTION_CANCELLED'],
    'apps/web/src/app/api/appointments/[id]/route.ts': ['APPOINTMENT_STATUS_CHANGE'],
    'apps/web/src/app/api/queue/[id]/route.ts': ['QUEUE_STATUS_CHANGE'],
    'apps/web/src/app/api/admin/rfid/route.ts': ['RFID_ASSIGNED', 'RFID_REVOKED'],
    'apps/web/src/app/api/admin/staff/route.ts': ['STAFF_CREATE'],
    'apps/web/src/app/api/admin/staff/[id]/route.ts': ['STAFF_UPDATE', 'STAFF_DELETE'],
    'apps/web/src/app/api/admin/settings/route.ts': ['SETTINGS_UPDATE'],
  };
  for (const [file, actions] of Object.entries(expectations)) {
    const source = read(file);
    assert.match(source, /writeAuditLog/);
    for (const action of actions) assert.ok(source.includes(action), `${file} is missing ${action}`);
  }
});

test('audit metadata redacts secrets and stores request context', () => {
  const source = read('apps/web/src/lib/audit.ts');
  assert.match(source, /password\|secret\|token\|signaturehash\|authorization\|cookie/i);
  assert.match(source, /x-forwarded-for/);
  assert.match(source, /user-agent/);
  assert.match(source, /before, after/);
});

test('database migration makes audit rows append-only', () => {
  const migration = read('packages/db/prisma/migrations/20261005130000_make_audit_logs_append_only/migration.sql');
  assert.match(migration, /BEFORE UPDATE OR DELETE ON "system_audit_logs"/);
  assert.match(migration, /System audit logs are append-only/);
});
