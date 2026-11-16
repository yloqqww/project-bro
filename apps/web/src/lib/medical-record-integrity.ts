import { createHash } from 'node:crypto';

type ClinicalRecordContent = {
  id: string;
  patientId: string;
  doctorId: string;
  appointmentId?: string | null;
  queueTicketId?: string | null;
  visitDate: Date;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  vitals?: unknown;
  followUpDate?: Date | null;
  followUpNotes?: string | null;
  version: number;
  parentRecordId?: string | null;
  amendmentReason?: string | null;
  attachmentChecksums?: string[];
  prescriptionHashes?: string[];
};

export function createMedicalRecordContentHash(record: ClinicalRecordContent) {
  const canonical = {
    id: record.id,
    patientId: record.patientId,
    doctorId: record.doctorId,
    appointmentId: record.appointmentId || null,
    queueTicketId: record.queueTicketId || null,
    visitDate: record.visitDate.toISOString(),
    subjective: record.subjective,
    objective: record.objective,
    assessment: record.assessment,
    plan: record.plan,
    vitals: record.vitals ?? null,
    followUpDate: record.followUpDate?.toISOString() || null,
    followUpNotes: record.followUpNotes || null,
    version: record.version,
    parentRecordId: record.parentRecordId || null,
    amendmentReason: record.amendmentReason || null,
    attachmentChecksums: [...(record.attachmentChecksums || [])].sort(),
    prescriptionHashes: [...(record.prescriptionHashes || [])].sort(),
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

export function sha256Bytes(bytes: Uint8Array) {
  return createHash('sha256').update(bytes).digest('hex');
}
