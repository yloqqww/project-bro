-- Complete appointment lifecycle: patient actions, waitlist, reminders,
-- automated no-shows, follow-up linkage, and booking-account claims.
CREATE TYPE "AppointmentWaitlistStatus" AS ENUM ('WAITING', 'OFFERED', 'BOOKED', 'CANCELLED', 'EXPIRED');
CREATE TYPE "AppointmentReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

ALTER TABLE "appointments"
  ADD COLUMN "patientConfirmedAt" TIMESTAMP(3),
  ADD COLUMN "patientConfirmationSource" TEXT,
  ADD COLUMN "cancelledByRole" TEXT,
  ADD COLUMN "cancellationPolicyResult" TEXT,
  ADD COLUMN "noShowMarkedAt" TIMESTAMP(3),
  ADD COLUMN "noShowMarkedBy" TEXT,
  ADD COLUMN "rescheduledFromId" TEXT,
  ADD COLUMN "followUpFromRecordId" TEXT;

ALTER TABLE "clinic_settings"
  ADD COLUMN "appointmentCancellationNoticeHours" INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN "appointmentNoShowGraceMinutes" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "appointmentReminderLeadHours" JSONB NOT NULL DEFAULT '[24,2]'::jsonb;

CREATE UNIQUE INDEX "appointments_rescheduledFromId_key" ON "appointments"("rescheduledFromId");
CREATE INDEX "appointments_rescheduledFromId_idx" ON "appointments"("rescheduledFromId");
CREATE INDEX "appointments_followUpFromRecordId_idx" ON "appointments"("followUpFromRecordId");

ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_rescheduledFromId_fkey"
  FOREIGN KEY ("rescheduledFromId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "appointments_followUpFromRecordId_fkey"
  FOREIGN KEY ("followUpFromRecordId") REFERENCES "medical_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "appointment_reminders" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "reminderType" TEXT NOT NULL,
  "scheduledFor" TIMESTAMP(3) NOT NULL,
  "status" "AppointmentReminderStatus" NOT NULL DEFAULT 'PENDING',
  "deliveryChannel" TEXT NOT NULL DEFAULT 'IN_APP',
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "dedupeKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointment_reminders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointment_reminders_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "appointment_reminders_dedupeKey_key" ON "appointment_reminders"("dedupeKey");
CREATE INDEX "appointment_reminders_status_scheduledFor_idx" ON "appointment_reminders"("status", "scheduledFor");
CREATE INDEX "appointment_reminders_appointmentId_idx" ON "appointment_reminders"("appointmentId");

CREATE TABLE "appointment_booking_claims" (
  "id" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "claimedAt" TIMESTAMP(3),
  "claimedEmail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "appointment_booking_claims_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointment_booking_claims_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "appointment_booking_claims_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "appointment_booking_claims_appointmentId_key" ON "appointment_booking_claims"("appointmentId");
CREATE UNIQUE INDEX "appointment_booking_claims_tokenHash_key" ON "appointment_booking_claims"("tokenHash");
CREATE INDEX "appointment_booking_claims_patientId_claimedAt_idx" ON "appointment_booking_claims"("patientId", "claimedAt");
CREATE INDEX "appointment_booking_claims_expiresAt_idx" ON "appointment_booking_claims"("expiresAt");

CREATE TABLE "appointment_waitlist_entries" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "requestedDate" DATE NOT NULL,
  "reasonForVisit" TEXT NOT NULL,
  "notes" TEXT,
  "status" "AppointmentWaitlistStatus" NOT NULL DEFAULT 'WAITING',
  "offeredAt" TIMESTAMP(3),
  "offerExpiresAt" TIMESTAMP(3),
  "offeredSlot" TIMESTAMP(3),
  "bookedAppointmentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "appointment_waitlist_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "appointment_waitlist_entries_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "appointment_waitlist_entries_doctorId_fkey"
    FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "appointment_waitlist_entries_bookedAppointmentId_fkey"
    FOREIGN KEY ("bookedAppointmentId") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "appointment_waitlist_entries_bookedAppointmentId_key" ON "appointment_waitlist_entries"("bookedAppointmentId");
CREATE INDEX "appointment_waitlist_entries_doctorId_requestedDate_status_idx" ON "appointment_waitlist_entries"("doctorId", "requestedDate", "status");
CREATE INDEX "appointment_waitlist_entries_patientId_status_idx" ON "appointment_waitlist_entries"("patientId", "status");
CREATE UNIQUE INDEX "appointment_waitlist_one_active_request"
  ON "appointment_waitlist_entries"("patientId", "doctorId", "requestedDate")
  WHERE "status" IN ('WAITING', 'OFFERED');
