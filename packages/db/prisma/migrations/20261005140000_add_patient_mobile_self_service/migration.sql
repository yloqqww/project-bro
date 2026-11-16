ALTER TABLE "users"
  ADD COLUMN "passwordActivatedAt" TIMESTAMP(3),
  ADD COLUMN "lastPasswordChangeAt" TIMESTAMP(3);

CREATE TYPE "PatientAccountTokenType" AS ENUM ('ACTIVATION', 'PASSWORD_RESET');

CREATE TABLE "patient_account_tokens" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "type" "PatientAccountTokenType" NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_account_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "patient_account_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "mobile_sessions" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "deviceName" TEXT,
  "userAgent" TEXT,
  "ipAddress" TEXT,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mobile_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "mobile_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "patient_push_devices" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expoPushToken" TEXT NOT NULL,
  "platform" TEXT,
  "deviceName" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_push_devices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "patient_push_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "patient_account_tokens_tokenHash_key" ON "patient_account_tokens"("tokenHash");
CREATE INDEX "patient_account_tokens_userId_type_createdAt_idx" ON "patient_account_tokens"("userId", "type", "createdAt");
CREATE INDEX "patient_account_tokens_expiresAt_idx" ON "patient_account_tokens"("expiresAt");
CREATE UNIQUE INDEX "mobile_sessions_tokenHash_key" ON "mobile_sessions"("tokenHash");
CREATE INDEX "mobile_sessions_userId_revokedAt_expiresAt_idx" ON "mobile_sessions"("userId", "revokedAt", "expiresAt");
CREATE INDEX "mobile_sessions_expiresAt_idx" ON "mobile_sessions"("expiresAt");
CREATE UNIQUE INDEX "patient_push_devices_expoPushToken_key" ON "patient_push_devices"("expoPushToken");
CREATE INDEX "patient_push_devices_userId_enabled_idx" ON "patient_push_devices"("userId", "enabled");
