import { z } from 'zod';

const PatientNameSchema = z.string().trim().min(1).max(100).regex(/^[\p{L}\p{M} .'-]+$/u, 'Use letters, spaces, apostrophes, periods, or hyphens only');
const PatientPhoneSchema = z.string().trim().min(7).max(30).superRefine((value, context) => {
  const digits = value.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) context.addIssue({ code: z.ZodIssueCode.custom, message: 'Phone number must contain 7 to 15 digits' });
});
const PatientDateOfBirthSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must use YYYY-MM-DD').refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value && date < new Date() && date.getUTCFullYear() >= 1900;
}, 'Date of birth must be a valid past date from 1900 onward');

export const BloodTypeSchema = z.enum([
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
  'UNKNOWN',
]);

export const GenderSchema = z.enum(['MALE', 'FEMALE', 'OTHER']);

export const PatientProfileSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  mrn: z.string().regex(/^LMC-\d{4}-\d{7}$/),
  status: z.enum(['ACTIVE', 'ARCHIVED', 'MERGED']),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  dateOfBirth: z.date(),
  gender: z.string(),
  phoneNumber: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zipCode: z.string(),
  bloodType: BloodTypeSchema,
  allergies: z.string().nullable(),
  chronicConditions: z.string().nullable(),
  emergencyContactName: z.string(),
  emergencyContactPhone: z.string(),
  emergencyContactRelation: z.string(),
  archivedAt: z.date().nullable(),
  archiveReason: z.string().nullable(),
  mergedIntoId: z.string().cuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreatePatientProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  middleName: z.string().optional(),
  dateOfBirth: z.string().or(z.date()),
  gender: z.string().min(1, 'Gender is required'),
  phoneNumber: z.string().min(1, 'Phone number is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'Zip code is required'),
  bloodType: BloodTypeSchema.default('UNKNOWN'),
  allergies: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  emergencyContactName: z.string().min(1, 'Emergency contact name is required'),
  emergencyContactPhone: z.string().min(1, 'Emergency contact phone is required'),
  emergencyContactRelation: z.string().min(1, 'Emergency contact relation is required'),
});

export const UpdatePatientProfileSchema = CreatePatientProfileSchema.partial();

const PatientContactEmailSchema = z.union([
  z.string().trim().email('A valid email address is required'),
  z.literal(''),
]).optional().default('');

export const UpdatePatientAdminSchema = z.object({
  patientId: z.string().cuid('A valid patient ID is required'),
  firstName: PatientNameSchema,
  lastName: PatientNameSchema,
  dateOfBirth: PatientDateOfBirthSchema,
  gender: z.enum(['Male', 'Female', 'Other']),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown']),
  phoneNumber: PatientPhoneSchema,
  email: PatientContactEmailSchema,
  address: z.string().trim().min(3, 'Street address is required').max(250),
  city: z.string().trim().min(2, 'City is required').max(100),
  state: z.string().trim().min(2, 'Province or state is required').max(100),
  zipCode: z.string().trim().regex(/^[A-Za-z0-9 -]{3,12}$/, 'Invalid postal code'),
  changeReason: z.string().trim().min(5).max(250),
  duplicateOverrideReason: z.string().trim().min(10).max(250).optional(),
});

export const CreatePatientAdminSchema = UpdatePatientAdminSchema.omit({ patientId: true, changeReason: true }).extend({
  middleName: PatientNameSchema.optional().or(z.literal('')),
  city: z.string().trim().min(2, 'City is required').max(100).optional().default('Santa Cruz'),
  state: z.string().trim().min(2, 'Province or state is required').max(100).optional().default('Laguna'),
  zipCode: z.string().trim().regex(/^[A-Za-z0-9 -]{3,12}$/, 'Invalid postal code').optional().default('4009'),
  emergencyContactName: PatientNameSchema.optional().default('Kamag-anak'),
  emergencyContactPhone: PatientPhoneSchema,
  emergencyContactRelation: z.string().trim().min(2).max(80).optional().default('Family'),
  cardUid: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{8,32}$/).optional().or(z.literal('')),
  allergies: z.string().trim().max(1000).optional(),
  chronicConditions: z.string().trim().max(1000).optional(),
});

export type BloodType = z.infer<typeof BloodTypeSchema>;
export type Gender = z.infer<typeof GenderSchema>;
export type PatientProfile = z.infer<typeof PatientProfileSchema>;
export type CreatePatientProfileInput = z.infer<typeof CreatePatientProfileSchema>;
export type UpdatePatientProfileInput = z.infer<typeof UpdatePatientProfileSchema>;
export type UpdatePatientAdminInput = z.infer<typeof UpdatePatientAdminSchema>;
