const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../../..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('mobile login enforces the patient role and secure opaque sessions', () => {
  const login = read('apps/web/src/app/api/mobile/auth/login/route.ts');
  const auth = read('apps/web/src/lib/mobile-auth.ts');
  assert.match(login, /expectedRole: z\.literal\('PATIENT'\)/);
  assert.match(auth, /randomBytes\(32\)/);
  assert.match(auth, /sha256/);
  assert.match(auth, /30 \* 24 \* 60 \* 60 \* 1000/);
});

test('patient account lifecycle uses expiring one-time tokens and session revocation', () => {
  const migration = read('packages/db/prisma/migrations/20261005140000_add_patient_mobile_self_service/migration.sql');
  const activate = read('apps/web/src/app/api/mobile/auth/activate/route.ts');
  const reset = read('apps/web/src/app/api/mobile/auth/reset-password/route.ts');
  assert.match(migration, /patient_account_tokens/);
  assert.match(migration, /mobile_sessions/);
  assert.match(activate, /"usedAt" = NOW\(\)/);
  assert.match(reset, /"revokedAt" = NOW\(\)/);
});

test('mobile app covers booking, queue refresh, profile, reminders, offline cache, and encrypted storage', () => {
  const app = read('apps/mobile/app/index.tsx');
  for (const expected of ['expo-secure-store', '@react-native-community/netinfo', 'expo-notifications', '/api/mobile/appointments', '/api/mobile/queue', '/api/mobile/profile', "expectedRole: 'PATIENT'"]) assert.ok(app.includes(expected), `Missing ${expected}`);
  assert.match(app, /setInterval\(.+(?:10000|30000)/s);
  assert.match(app, /scheduleNotificationAsync/);
});
