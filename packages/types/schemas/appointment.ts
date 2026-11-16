import { z } from 'zod';

export const AppointmentStatusSchema = z.enum([
  'SCHEDULED',
  'CONFIRMED',
  'CHECKED_IN',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

export const AppointmentSchema = z.object({
  id: z.string().cuid(),
  patientId: z.string().cuid(),
  doctorId: z.string().cuid(),
  appointmentDate: z.date(),
  duration: z.number(),
  status: AppointmentStatusSchema,
  reasonForVisit: z.string(),
  notes: z.string().nullable(),
  createdById: z.string().cuid(),
  confirmedAt: z.date().nullable(),
  checkedInAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  cancelledAt: z.date().nullable(),
  cancellationReason: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateAppointmentSchema = z.object({
  patientId: z.string().cuid(),
  doctorId: z.string().cuid(),
  appointmentDate: z.string().or(z.date()),
  duration: z.number().min(15).max(120).default(30),
  reasonForVisit: z.string().min(1, 'Reason for visit is required'),
  notes: z.string().optional(),
});

export const UpdateAppointmentStatusSchema = z.object({
  status: AppointmentStatusSchema,
  cancellationReason: z.string().optional(),
});

export type AppointmentStatus = z.infer<typeof AppointmentStatusSchema>;
export type Appointment = z.infer<typeof AppointmentSchema>;
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentSchema>;
export type UpdateAppointmentStatusInput = z.infer<typeof UpdateAppointmentStatusSchema>;
