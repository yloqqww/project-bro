CREATE TYPE "MedicalRecordStatus" AS ENUM ('DRAFT', 'FINALIZED', 'AMENDED');

ALTER TABLE "medical_records"
  ADD COLUMN "queueTicketId" TEXT,
  ADD COLUMN "status" "MedicalRecordStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "parentRecordId" TEXT,
  ADD COLUMN "amendmentReason" TEXT,
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "finalizedById" TEXT,
  ADD COLUMN "finalizedByName" TEXT,
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3),
  ADD COLUMN "archivedById" TEXT,
  ADD COLUMN "archiveReason" TEXT;

CREATE TABLE "medical_record_attachments" (
  "id" TEXT NOT NULL,
  "medicalRecordId" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "data" BYTEA NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "archivedAt" TIMESTAMP(3),
  "archiveReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "medical_record_attachments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "medical_records_contentHash_key" ON "medical_records"("contentHash");
CREATE INDEX "medical_records_queueTicketId_idx" ON "medical_records"("queueTicketId");
CREATE INDEX "medical_records_status_archivedAt_idx" ON "medical_records"("status", "archivedAt");
CREATE INDEX "medical_records_parentRecordId_idx" ON "medical_records"("parentRecordId");
CREATE INDEX "medical_records_finalizedAt_idx" ON "medical_records"("finalizedAt");
CREATE INDEX "medical_record_attachments_medicalRecordId_archivedAt_idx" ON "medical_record_attachments"("medicalRecordId", "archivedAt");
CREATE INDEX "medical_record_attachments_checksum_idx" ON "medical_record_attachments"("checksum");

ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_queueTicketId_fkey" FOREIGN KEY ("queueTicketId") REFERENCES "queue_tickets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_parentRecordId_fkey" FOREIGN KEY ("parentRecordId") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_finalizedById_fkey" FOREIGN KEY ("finalizedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medical_records" ADD CONSTRAINT "medical_records_archivedById_fkey" FOREIGN KEY ("archivedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medical_record_attachments" ADD CONSTRAINT "medical_record_attachments_medicalRecordId_fkey" FOREIGN KEY ("medicalRecordId") REFERENCES "medical_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "medical_record_attachments" ADD CONSTRAINT "medical_record_attachments_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing rows predate lifecycle enforcement. Preserve them as finalized legacy records.
UPDATE "medical_records"
SET "status" = 'FINALIZED'::"MedicalRecordStatus",
    "finalizedAt" = COALESCE("updatedAt", "createdAt"),
    "finalizedById" = "doctorId",
    "finalizedByName" = 'Legacy attending physician'
WHERE "status" = 'DRAFT'::"MedicalRecordStatus";

-- The database is the final guard against accidental mutation or deletion of official clinical content.
CREATE OR REPLACE FUNCTION prevent_finalized_medical_record_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."status" <> 'DRAFT'::"MedicalRecordStatus" THEN
      RAISE EXCEPTION 'Medical records must be created as drafts before finalization.';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Medical records cannot be hard deleted; archive them instead.';
  END IF;

  IF OLD."status" = 'DRAFT'::"MedicalRecordStatus" AND NEW."status" NOT IN ('DRAFT'::"MedicalRecordStatus", 'FINALIZED'::"MedicalRecordStatus") THEN
    RAISE EXCEPTION 'Draft medical records may only remain drafts or be finalized.';
  END IF;
  IF OLD."status" = 'DRAFT'::"MedicalRecordStatus" AND NEW."status" = 'FINALIZED'::"MedicalRecordStatus"
     AND (NEW."finalizedAt" IS NULL OR NEW."finalizedById" IS NULL OR NEW."finalizedByName" IS NULL OR NEW."contentHash" IS NULL) THEN
    RAISE EXCEPTION 'Finalization requires timestamp, signer, signer name, and content hash.';
  END IF;
  IF OLD."status" = 'FINALIZED'::"MedicalRecordStatus" AND NEW."status" NOT IN ('FINALIZED'::"MedicalRecordStatus", 'AMENDED'::"MedicalRecordStatus") THEN
    RAISE EXCEPTION 'Finalized records cannot return to draft status.';
  END IF;
  IF OLD."status" = 'AMENDED'::"MedicalRecordStatus" AND NEW."status" <> 'AMENDED'::"MedicalRecordStatus" THEN
    RAISE EXCEPTION 'Amended record versions cannot change lifecycle status.';
  END IF;

  IF OLD."status" IN ('FINALIZED'::"MedicalRecordStatus", 'AMENDED'::"MedicalRecordStatus") THEN
    IF NEW."patientId" IS DISTINCT FROM OLD."patientId"
       OR NEW."doctorId" IS DISTINCT FROM OLD."doctorId"
       OR NEW."appointmentId" IS DISTINCT FROM OLD."appointmentId"
       OR NEW."queueTicketId" IS DISTINCT FROM OLD."queueTicketId"
       OR NEW."visitDate" IS DISTINCT FROM OLD."visitDate"
       OR NEW."subjective" IS DISTINCT FROM OLD."subjective"
       OR NEW."objective" IS DISTINCT FROM OLD."objective"
       OR NEW."assessment" IS DISTINCT FROM OLD."assessment"
       OR NEW."plan" IS DISTINCT FROM OLD."plan"
       OR NEW."vitals" IS DISTINCT FROM OLD."vitals"
       OR NEW."followUpDate" IS DISTINCT FROM OLD."followUpDate"
       OR NEW."followUpNotes" IS DISTINCT FROM OLD."followUpNotes"
       OR NEW."version" IS DISTINCT FROM OLD."version"
       OR NEW."parentRecordId" IS DISTINCT FROM OLD."parentRecordId"
       OR NEW."amendmentReason" IS DISTINCT FROM OLD."amendmentReason"
       OR NEW."finalizedAt" IS DISTINCT FROM OLD."finalizedAt"
       OR NEW."finalizedById" IS DISTINCT FROM OLD."finalizedById"
       OR NEW."finalizedByName" IS DISTINCT FROM OLD."finalizedByName"
       OR NEW."contentHash" IS DISTINCT FROM OLD."contentHash" THEN
      RAISE EXCEPTION 'Finalized medical record clinical content is immutable; create an amendment.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "medical_records_integrity_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "medical_records"
FOR EACH ROW EXECUTE FUNCTION prevent_finalized_medical_record_mutation();
