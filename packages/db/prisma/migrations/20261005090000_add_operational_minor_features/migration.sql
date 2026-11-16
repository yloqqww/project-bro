ALTER TABLE "clinic_settings"
  ADD COLUMN "operatingDays" JSONB NOT NULL DEFAULT '[1,2,3,4,5,6]'::jsonb,
  ADD COLUMN "holidayDates" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "appointmentLeadTimeHours" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "bookingHorizonDays" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "triagePriorityRules" JSONB NOT NULL DEFAULT '{"resuscitation":{"painScore":9,"oxygenSaturationBelow":90},"urgent":{"painScore":7,"temperatureAtLeast":39,"systolicAtLeast":180},"priority":{"seniorAge":60,"painScore":5}}'::jsonb,
  ADD COLUMN "notificationRetentionDays" INTEGER NOT NULL DEFAULT 90;

ALTER TABLE "admin_notifications"
  ADD COLUMN "readAt" TIMESTAMP(3),
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE TYPE "EmailDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SIMULATED');

CREATE TABLE "email_deliveries" (
  "id" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "template" TEXT NOT NULL,
  "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT,
  "messageId" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 3,
  "nextAttemptAt" TIMESTAMP(3),
  "lastAttemptAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_audit_logs" (
  "id" TEXT NOT NULL,
  "actorId" TEXT,
  "actorEmail" TEXT,
  "actorRole" TEXT,
  "action" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT,
  "summary" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "system_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_notifications_readAt_idx" ON "admin_notifications"("readAt");
CREATE INDEX "admin_notifications_expiresAt_idx" ON "admin_notifications"("expiresAt");
CREATE INDEX "admin_notifications_archivedAt_idx" ON "admin_notifications"("archivedAt");
CREATE INDEX "email_deliveries_status_nextAttemptAt_idx" ON "email_deliveries"("status", "nextAttemptAt");
CREATE INDEX "email_deliveries_recipient_createdAt_idx" ON "email_deliveries"("recipient", "createdAt");
CREATE INDEX "email_deliveries_createdAt_idx" ON "email_deliveries"("createdAt");
CREATE INDEX "system_audit_logs_createdAt_idx" ON "system_audit_logs"("createdAt");
CREATE INDEX "system_audit_logs_action_createdAt_idx" ON "system_audit_logs"("action", "createdAt");
CREATE INDEX "system_audit_logs_actorId_createdAt_idx" ON "system_audit_logs"("actorId", "createdAt");
CREATE INDEX "system_audit_logs_targetType_targetId_idx" ON "system_audit_logs"("targetType", "targetId");
