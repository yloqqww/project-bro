import { z } from 'zod';

export const DoctorProfileSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  firstName: z.string(),
  lastName: z.string(),
  specialization: z.string(),
  licenseNumber: z.string(),
  roomNumber: z.string().nullable(),
  isActive: z.boolean(),
  availableFrom: z.string().nullable(),
  availableTo: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateDoctorProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  specialization: z.string().min(1, 'Specialization is required'),
  licenseNumber: z.string().min(1, 'License number is required'),
  roomNumber: z.string().optional(),
  availableFrom: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format').optional(),
  availableTo: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be in HH:mm format').optional(),
});

export const UpdateDoctorProfileSchema = CreateDoctorProfileSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type DoctorProfile = z.infer<typeof DoctorProfileSchema>;
export type CreateDoctorProfileInput = z.infer<typeof CreateDoctorProfileSchema>;
export type UpdateDoctorProfileInput = z.infer<typeof UpdateDoctorProfileSchema>;
