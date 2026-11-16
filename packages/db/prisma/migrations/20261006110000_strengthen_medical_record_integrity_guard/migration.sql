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
       OR NEW."finalizedByName" IS DISTINCT FROM OLD."finalizedByName"
       OR NEW."contentHash" IS DISTINCT FROM OLD."contentHash" THEN
      RAISE EXCEPTION 'Finalized medical record clinical content is immutable; create an amendment.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "medical_records_integrity_guard" ON "medical_records";
CREATE TRIGGER "medical_records_integrity_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "medical_records"
FOR EACH ROW EXECUTE FUNCTION prevent_finalized_medical_record_mutation();
