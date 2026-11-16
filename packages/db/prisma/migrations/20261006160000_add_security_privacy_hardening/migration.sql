ALTER TABLE "users"
  ADD COLUMN "passwordExpiresAt" TIMESTAMP(3),
  ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mfaSecretEncrypted" TEXT,
  ADD COLUMN "mfaRecoveryCodes" JSONB;

ALTER TABLE "clinic_settings"
  ADD COLUMN "clinicalRecordRetentionYears" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "auditRetentionYears" INTEGER NOT NULL DEFAULT 7;

CREATE TABLE "security_rate_limits" (
  "id" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "blockedUntil" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "security_rate_limits_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "security_rate_limits_keyHash_key" ON "security_rate_limits"("keyHash");
CREATE INDEX "security_rate_limits_scope_expiresAt_idx" ON "security_rate_limits"("scope", "expiresAt");

CREATE TABLE "patient_privacy_consents" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "consentType" TEXT NOT NULL,
  "policyVersion" TEXT NOT NULL,
  "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "withdrawnAt" TIMESTAMP(3),
  "source" TEXT NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "metadata" JSONB,
  CONSTRAINT "patient_privacy_consents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "patient_privacy_consents_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "patient_privacy_consents_patientId_consentType_acknowledgedAt_idx" ON "patient_privacy_consents"("patientId", "consentType", "acknowledgedAt");
CREATE INDEX "patient_privacy_consents_withdrawnAt_idx" ON "patient_privacy_consents"("withdrawnAt");
