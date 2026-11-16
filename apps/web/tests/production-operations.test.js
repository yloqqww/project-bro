const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('liveness, readiness, database health, and active monitoring are separate probes', () => {
  const liveness = read('apps/web/src/app/health/route.ts');
  const readiness = read('apps/web/src/app/ready/route.ts');
  const databaseHealth = read('apps/web/src/app/api/database-health/route.ts');
  const monitor = read('apps/web/src/app/api/operations/monitor/route.ts');
  assert.doesNotMatch(liveness, /prisma|checkDatabaseHealth/);
  assert.match(readiness, /checkDatabaseHealth/);
  assert.match(readiness, /status: ready \? 200 : 503/);
  assert.match(databaseHealth, /database\.status === 'ok' \? 200 : 503/);
  assert.match(monitor, /sendOperationalAlert\('database', 'down'/);
  assert.match(monitor, /sendOperationalAlert\('email', 'degraded'/);
  assert.match(monitor, /CRON_SECRET/);
});

test('central error reporting uses Next instrumentation and redacts sensitive context', () => {
  const instrumentation = read('apps/web/src/instrumentation.ts');
  const observability = read('apps/web/src/lib/observability.ts');
  assert.match(instrumentation, /Instrumentation\.onRequestError/);
  assert.match(instrumentation, /reportServerError/);
  assert.match(observability, /ERROR_MONITOR_WEBHOOK_URL/);
  assert.match(observability, /ALERT_WEBHOOK_URL/);
  assert.match(observability, /password\|secret\|token\|authorization\|cookie\|patient\|email/i);
});

test('backup automation encrypts, verifies, uploads, and records recovery evidence', () => {
  const backup = read('scripts/operations/backup-postgres.sh');
  const restore = read('scripts/operations/restore-rehearsal.sh');
  const gate = read('scripts/operations/check-release-gates.sh');
  assert.match(backup, /pg_dump --format=custom/);
  assert.match(backup, /--symmetric --cipher-algo AES256/);
  assert.match(backup, /verified_checksum/);
  assert.match(backup, /latest-success\.json/);
  assert.match(restore, /must contain rehearsal/);
  assert.match(restore, /pg_restore --clean --if-exists/);
  assert.match(restore, /expected_counts/);
  assert.match(restore, /RESTORE_REHEARSAL_RESULT_PATH/);
  assert.match(gate, /backupAgeHours > 26/);
  assert.match(gate, /restoreAgeDays > 35/);
});

test('CI, scheduled recovery, staging, and deployment pipelines are checked in', () => {
  const ci = read('.github/workflows/ci.yml');
  const backupWorkflow = read('.github/workflows/backup.yml');
  const restoreWorkflow = read('.github/workflows/restore-rehearsal.yml');
  const monitor = read('.github/workflows/monitor.yml');
  const deploy = read('.github/workflows/deploy.yml');
  const staging = read('.env.staging.example');
  for (const command of ['npm run lint', 'npm run typecheck', 'npm run test:ci', 'npm run build', 'prisma validate']) assert.ok(ci.includes(command), `CI is missing ${command}`);
  assert.match(backupWorkflow, /schedule:/);
  assert.match(restoreWorkflow, /postgres:16/);
  assert.match(restoreWorkflow, /test:medical-record-db/);
  assert.match(restoreWorkflow, /test:appointment-lifecycle-db/);
  assert.match(restoreWorkflow, /test:queue-lifecycle-db/);
  assert.match(restoreWorkflow, /latest-restore-rehearsal\.json/);
  assert.match(monitor, /cron: '\*\/5 \* \* \* \*'/);
  assert.match(monitor, /api\/operations\/monitor/);
  assert.match(deploy, /prisma migrate status/);
  assert.match(deploy, /prisma migrate deploy/);
  assert.match(deploy, /check-release-gates\.sh/);
  assert.match(deploy, /PUBLIC_BASE_URL\/ready/);
  assert.match(staging, /DEPLOYMENT_ENV="staging"/);
});
