-- Add an immutable audit trail for doctor-signed prescriptions.
ALTER TABLE "prescriptions"
ADD COLUMN "eSignedAt" TIMESTAMP(3),
ADD COLUMN "eSignatureName" TEXT,
ADD COLUMN "eSignatureLicense" TEXT,
ADD COLUMN "eSignatureHash" TEXT;

CREATE UNIQUE INDEX "prescriptions_eSignatureHash_key"
ON "prescriptions"("eSignatureHash");

CREATE INDEX "prescriptions_eSignedAt_idx"
ON "prescriptions"("eSignedAt");
