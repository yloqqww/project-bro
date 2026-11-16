-- Additive scheduling migration. This migration preserves all existing clinic data.
DO $$ BEGIN
  CREATE TYPE "ScheduleExceptionType" AS ENUM ('LEAVE', 'HOLIDAY', 'UNAVAILABLE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "doctor_schedules" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "slotDuration" INTEGER NOT NULL DEFAULT 30,
  "maxPatientsPerDay" INTEGER NOT NULL DEFAULT 20,
  "bufferMinutes" INTEGER NOT NULL DEFAULT 0,
  "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "doctor_schedules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "doctor_schedules_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "doctor_schedules_doctorId_key"
  ON "doctor_schedules"("doctorId");

CREATE TABLE IF NOT EXISTS "doctor_weekly_availability" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "breakStart" TEXT,
  "breakEnd" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "doctor_weekly_availability_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "doctor_weekly_availability_scheduleId_fkey"
    FOREIGN KEY ("scheduleId") REFERENCES "doctor_schedules"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "doctor_weekly_availability_day_check"
    CHECK ("dayOfWeek" BETWEEN 0 AND 6)
);

CREATE UNIQUE INDEX IF NOT EXISTS "doctor_weekly_availability_scheduleId_dayOfWeek_key"
  ON "doctor_weekly_availability"("scheduleId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "doctor_weekly_availability_scheduleId_idx"
  ON "doctor_weekly_availability"("scheduleId");

CREATE TABLE IF NOT EXISTS "doctor_schedule_exceptions" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "type" "ScheduleExceptionType" NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "doctor_schedule_exceptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "doctor_schedule_exceptions_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "doctor_schedule_exceptions_doctorId_date_idx"
  ON "doctor_schedule_exceptions"("doctorId", "date");

-- Exact-start protection complements the API transaction/advisory lock used for
-- general overlap detection and simultaneous booking requests.
CREATE UNIQUE INDEX IF NOT EXISTS "appointments_doctorId_appointmentDate_key"
  ON "appointments"("doctorId", "appointmentDate");

-- Preserve the former UI defaults for existing doctors so the booking page
-- remains usable immediately after this additive migration is applied.
INSERT INTO "doctor_schedules" (
  "id", "doctorId", "slotDuration", "maxPatientsPerDay", "bufferMinutes", "timezone", "createdAt", "updatedAt"
)
SELECT
  CONCAT('sched_', md5(dp."id" || clock_timestamp()::text)),
  dp."id", 20, 24, 5, 'Asia/Manila', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "doctor_profiles" dp
WHERE NOT EXISTS (
  SELECT 1 FROM "doctor_schedules" ds WHERE ds."doctorId" = dp."id"
);

INSERT INTO "doctor_weekly_availability" (
  "id", "scheduleId", "dayOfWeek", "enabled", "startTime", "endTime", "breakStart", "breakEnd", "createdAt", "updatedAt"
)
SELECT
  CONCAT('week_', md5(ds."id" || d.day::text || clock_timestamp()::text)),
  ds."id", d.day, d.enabled, '09:00', '17:00', '12:00', '13:00', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "doctor_schedules" ds
CROSS JOIN (VALUES
  (0, false),
  (1, true),
  (2, true),
  (3, true),
  (4, true),
  (5, true),
  (6, true)
) AS d(day, enabled)
WHERE NOT EXISTS (
  SELECT 1
  FROM "doctor_weekly_availability" dwa
  WHERE dwa."scheduleId" = ds."id" AND dwa."dayOfWeek" = d.day
);
