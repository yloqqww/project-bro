import { z } from 'zod';

export const QueueStatusSchema = z.enum([
  'WAITING',
  'CALLED',
  'IN_CONSULTATION',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

export const QueueTicketSchema = z.object({
  id: z.string().cuid(),
  queueNumber: z.number(),
  queueDate: z.date(),
  patientId: z.string().cuid(),
  doctorId: z.string().cuid(),
  appointmentId: z.string().cuid().nullable(),
  status: QueueStatusSchema,
  priority: z.number(),
  station: z.string().nullable(),
  calledAt: z.date().nullable(),
  startedAt: z.date().nullable(),
  completedAt: z.date().nullable(),
  estimatedWaitMinutes: z.number().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateQueueTicketSchema = z.object({
  patientId: z.string().cuid(),
  doctorId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  priority: z.number().min(0).max(10).default(0),
  station: z.string().optional(),
});

export const UpdateQueueStatusSchema = z.object({
  status: QueueStatusSchema,
});

export type QueueStatus = z.infer<typeof QueueStatusSchema>;
export type QueueTicket = z.infer<typeof QueueTicketSchema>;
export type CreateQueueTicketInput = z.infer<typeof CreateQueueTicketSchema>;
export type UpdateQueueStatusInput = z.infer<typeof UpdateQueueStatusSchema>;
