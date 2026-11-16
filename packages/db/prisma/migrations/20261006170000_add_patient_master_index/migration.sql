CREATE TYPE "PatientRecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'MERGED');

CREATE SEQUENCE "patient_mrn_seq" START WITH 1 INCREMENT BY 1 NO MINVALUE NO MAXVALUE CACHE 20;

ALTER TABLE "patient_profiles"
  ADD COLUMN "mrn" TEXT,
  ADD COLUMN "normalizedFirstName" TEXT,
  ADD COLUMN "normalizedLastName" TEXT,
  ADD COLUMN "normalizedPhone" TEXT,
  ADD COLUMN "normalizedAddress" TEXT,
  ADD COLUMN "status" "PatientRecordStatus" NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedById" TEXT,
  ADD COLUMN "archiveReason" TEXT,
  ADD COLUMN "mergedIntoId" TEXT;

WITH numbered AS (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS sequence_number
  FROM "patient_profiles"
)
UPDATE "patient_profiles" AS patient
SET
  "mrn" = 'LMC-' || EXTRACT(YEAR FROM patient."createdAt")::int || '-' || LPAD(numbered.sequence_number::text, 7, '0'),
  "normalizedFirstName" = regexp_replace(lower(trim(patient."firstName")), '[^a-z0-9]', '', 'g'),
  "normalizedLastName" = regexp_replace(lower(trim(patient."lastName")), '[^a-z0-9]', '', 'g'),
  "normalizedPhone" = regexp_replace(patient."phoneNumber", '[^0-9]', '', 'g'),
  "normalizedAddress" = regexp_replace(lower(trim(patient."address" || ' ' || patient."city" || ' ' || patient."state" || ' ' || patient."zipCode")), '[^a-z0-9]', '', 'g')
FROM numbered
WHERE numbered."id" = patient."id";

SELECT setval('patient_mrn_seq', GREATEST((SELECT COUNT(*) FROM "patient_profiles"), 1), (SELECT COUNT(*) FROM "patient_profiles") > 0);

ALTER TABLE "patient_profiles"
  ALTER COLUMN "mrn" SET NOT NULL,
  ALTER COLUMN "normalizedFirstName" SET NOT NULL,
  ALTER COLUMN "normalizedLastName" SET NOT NULL,
  ALTER COLUMN "normalizedPhone" SET NOT NULL,
  ALTER COLUMN "normalizedAddress" SET NOT NULL;

CREATE UNIQUE INDEX "patient_profiles_mrn_key" ON "patient_profiles"("mrn");
CREATE INDEX "patient_profiles_status_lastName_firstName_idx" ON "patient_profiles"("status", "lastName", "firstName");
CREATE INDEX "patient_profiles_normalizedLastName_normalizedFirstName_dateOfBirth_idx" ON "patient_profiles"("normalizedLastName", "normalizedFirstName", "dateOfBirth");
CREATE INDEX "patient_profiles_normalizedPhone_idx" ON "patient_profiles"("normalizedPhone");
CREATE INDEX "patient_profiles_mergedIntoId_idx" ON "patient_profiles"("mergedIntoId");

ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_mrn_format_check" CHECK ("mrn" ~ '^LMC-[0-9]{4}-[0-9]{7}$');
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_required_demographics_check" CHECK (
  length(trim("firstName")) > 0 AND length(trim("lastName")) > 0 AND
  length(trim("address")) > 0 AND length(trim("city")) > 0 AND
  length(trim("state")) > 0 AND length(trim("zipCode")) > 0 AND
  length("normalizedPhone") BETWEEN 7 AND 15
);
ALTER TABLE "patient_profiles" ADD CONSTRAINT "patient_profiles_lifecycle_check" CHECK (
  ("status" = 'ACTIVE' AND "archivedAt" IS NULL AND "mergedIntoId" IS NULL) OR
  ("status" = 'ARCHIVED' AND "archivedAt" IS NOT NULL AND "mergedIntoId" IS NULL) OR
  ("status" = 'MERGED' AND "archivedAt" IS NOT NULL AND "mergedIntoId" IS NOT NULL)
);

CREATE TABLE "patient_demographic_changes" (
  "id" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "changedById" TEXT,
  "source" TEXT NOT NULL,
  "reason" TEXT,
  "changedFields" TEXT[] NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_demographic_changes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "patient_demographic_changes_patientId_createdAt_idx" ON "patient_demographic_changes"("patientId", "createdAt");
CREATE INDEX "patient_demographic_changes_changedById_createdAt_idx" ON "patient_demographic_changes"("changedById", "createdAt");
ALTER TABLE "patient_demographic_changes" ADD CONSTRAINT "patient_demographic_changes_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_demographic_changes" ADD CONSTRAINT "patient_demographic_changes_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "patient_merge_history" (
  "id" TEXT NOT NULL,
  "sourcePatientId" TEXT NOT NULL,
  "targetPatientId" TEXT NOT NULL,
  "mergedById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "sourceSnapshot" JSONB NOT NULL,
  "targetSnapshot" JSONB NOT NULL,
  "movedCounts" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "patient_merge_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "patient_merge_history_sourcePatientId_createdAt_idx" ON "patient_merge_history"("sourcePatientId", "createdAt");
CREATE INDEX "patient_merge_history_targetPatientId_createdAt_idx" ON "patient_merge_history"("targetPatientId", "createdAt");
CREATE INDEX "patient_merge_history_mergedById_createdAt_idx" ON "patient_merge_history"("mergedById", "createdAt");
ALTER TABLE "patient_merge_history" ADD CONSTRAINT "patient_merge_history_sourcePatientId_fkey" FOREIGN KEY ("sourcePatientId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_merge_history" ADD CONSTRAINT "patient_merge_history_targetPatientId_fkey" FOREIGN KEY ("targetPatientId") REFERENCES "patient_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "patient_merge_history" ADD CONSTRAINT "patient_merge_history_mergedById_fkey" FOREIGN KEY ("mergedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION prevent_patient_profile_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Patient master records cannot be hard deleted; archive or merge them instead.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER patient_profiles_prevent_delete
BEFORE DELETE ON "patient_profiles"
FOR EACH ROW EXECUTE FUNCTION prevent_patient_profile_delete();
