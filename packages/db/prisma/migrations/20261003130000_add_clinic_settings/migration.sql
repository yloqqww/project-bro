-- Additive singleton clinic settings migration. Existing operational data is preserved.
CREATE TABLE IF NOT EXISTS "clinic_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "clinicName" TEXT NOT NULL DEFAULT 'Laguna Medical Center',
  "shortName" TEXT NOT NULL DEFAULT 'LMC',
  "hotline" TEXT NOT NULL DEFAULT '(049) 545-8888',
  "address" TEXT NOT NULL DEFAULT 'Santa Cruz, Laguna, Philippines',
  "emergencyNotice" TEXT NOT NULL DEFAULT 'For emergencies, call 911 or visit the nearest hospital.',
  "queueResetTime" TEXT NOT NULL DEFAULT '00:00',
  "queuePrefixes" JSONB NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinic_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "clinic_settings_reset_time_check"
    CHECK ("queueResetTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);

INSERT INTO "clinic_settings" (
  "id", "clinicName", "shortName", "hotline", "address", "emergencyNotice",
  "queueResetTime", "queuePrefixes", "timezone", "createdAt", "updatedAt"
)
VALUES (
  'default',
  'Laguna Medical Center',
  'LMC',
  '(049) 545-8888',
  'Santa Cruz, Laguna, Philippines',
  'For emergencies, call 911 or visit the nearest hospital.',
  '00:00',
  '[
    {"id":"general","department":"General","prefix":"A"},
    {"id":"cardiology","department":"Cardiology","prefix":"C"},
    {"id":"pediatrics","department":"Pediatrics","prefix":"P"},
    {"id":"priority","department":"Senior/PWD Priority","prefix":"PRIO"}
  ]'::jsonb,
  'Asia/Manila',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;
