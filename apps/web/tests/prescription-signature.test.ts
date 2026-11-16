import assert from 'node:assert/strict';
import test from 'node:test';
import { createPrescriptionSignatureHash } from '../src/lib/prescription-signature.ts';

const signedPrescription = {
  prescriptionId: 'rx-1',
  doctorId: 'doctor-1',
  patientId: 'patient-1',
  medicalRecordId: 'record-1',
  medicationName: 'Paracetamol',
  dosage: '500mg',
  frequency: 'Every 8 hours',
  duration: '3 days',
  instructions: 'After meals',
  quantity: 9,
  signedAt: new Date('2026-10-04T10:00:00.000Z'),
};

test('prescription signature hash is deterministic', () => {
  assert.equal(
    createPrescriptionSignatureHash(signedPrescription),
    createPrescriptionSignatureHash(signedPrescription)
  );
});

test('prescription signature hash changes when signed content changes', () => {
  assert.notEqual(
    createPrescriptionSignatureHash(signedPrescription),
    createPrescriptionSignatureHash({ ...signedPrescription, dosage: '250mg' })
  );
});
