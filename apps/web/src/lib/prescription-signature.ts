import { createHash } from 'node:crypto';

type PrescriptionSignatureInput = {
  prescriptionId: string;
  doctorId: string;
  patientId: string;
  medicalRecordId: string;
  medicationName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  quantity: number | null;
  signedAt: Date;
};

/** Creates a stable audit fingerprint without storing the doctor's password. */
export function createPrescriptionSignatureHash(input: PrescriptionSignatureInput) {
  const canonicalPayload = JSON.stringify({
    prescriptionId: input.prescriptionId,
    doctorId: input.doctorId,
    patientId: input.patientId,
    medicalRecordId: input.medicalRecordId,
    medicationName: input.medicationName,
    dosage: input.dosage,
    frequency: input.frequency,
    duration: input.duration,
    instructions: input.instructions,
    quantity: input.quantity,
    signedAt: input.signedAt.toISOString(),
  });

  return createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');
}
