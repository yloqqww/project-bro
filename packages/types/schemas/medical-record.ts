import { z } from 'zod';

export const VitalsSchema = z.object({
  temperature: z.number().optional(),
  bloodPressure: z.string().optional(),
  heartRate: z.number().optional(),
  respiratoryRate: z.number().optional(),
  weight: z.number().optional(),
  height: z.number().optional(),
  oxygenSaturation: z.number().optional(),
  bmi: z.number().optional(),
});

export const MedicalRecordSchema = z.object({
  id: z.string().cuid(),
  patientId: z.string().cuid(),
  doctorId: z.string().cuid(),
  appointmentId: z.string().cuid().nullable(),
  visitDate: z.date(),
  subjective: z.string(),
  objective: z.string(),
  assessment: z.string(),
  plan: z.string(),
  vitals: z.any().nullable(), // JSONB field
  followUpDate: z.date().nullable(),
  followUpNotes: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateMedicalRecordSchema = z.object({
  patientId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  subjective: z.string().min(1, 'Subjective notes are required'),
  objective: z.string().min(1, 'Objective findings are required'),
  assessment: z.string().min(1, 'Assessment is required'),
  plan: z.string().min(1, 'Treatment plan is required'),
  vitals: VitalsSchema.optional(),
  followUpDate: z.string().or(z.date()).optional(),
  followUpNotes: z.string().optional(),
});

export const PrescriptionSchema = z.object({
  id: z.string().cuid(),
  medicalRecordId: z.string().cuid(),
  doctorId: z.string().cuid(),
  medicationName: z.string(),
  dosage: z.string(),
  frequency: z.string(),
  duration: z.string(),
  instructions: z.string().nullable(),
  quantity: z.number().nullable(),
  prescribedDate: z.date(),
  startDate: z.date(),
  endDate: z.date().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreatePrescriptionSchema = z.object({
  medicalRecordId: z.string().cuid(),
  medicationName: z.string().min(1, 'Medication name is required'),
  dosage: z.string().min(1, 'Dosage is required'),
  frequency: z.string().min(1, 'Frequency is required'),
  duration: z.string().min(1, 'Duration is required'),
  instructions: z.string().optional(),
  quantity: z.number().positive().optional(),
  startDate: z.string().or(z.date()).optional(),
  endDate: z.string().or(z.date()).optional(),
});

export type Vitals = z.infer<typeof VitalsSchema>;
export type MedicalRecord = z.infer<typeof MedicalRecordSchema>;
export type CreateMedicalRecordInput = z.infer<typeof CreateMedicalRecordSchema>;
export type Prescription = z.infer<typeof PrescriptionSchema>;
export type CreatePrescriptionInput = z.infer<typeof CreatePrescriptionSchema>;
