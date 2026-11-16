import { z } from 'zod';

export const RfidCardStatusSchema = z.enum(['ACTIVE', 'REVOKED', 'LOST', 'EXPIRED']);

export const RfidCardSchema = z.object({
  id: z.string().cuid(),
  cardUid: z.string(),
  status: RfidCardStatusSchema,
  patientId: z.string().cuid(),
  issuedAt: z.date(),
  expiresAt: z.date().nullable(),
  revokedAt: z.date().nullable(),
  revokedReason: z.string().nullable(),
  lastScannedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const CreateRfidCardSchema = z.object({
  cardUid: z.string().regex(/^[A-F0-9]{8}$/i, 'Card UID must be 8 hexadecimal characters'),
  patientId: z.string().cuid(),
  expiresAt: z.string().or(z.date()).optional(),
});

export const RfidScanSchema = z.object({
  cardUid: z.string().regex(/^[A-F0-9]{8}$/i, 'Invalid RFID card format'),
});

export const UpdateRfidCardStatusSchema = z.object({
  status: RfidCardStatusSchema,
  revokedReason: z.string().optional(),
});

export const AssignRfidCardSchema = z.object({
  cardUid: z.string().trim().toUpperCase().regex(/^[A-F0-9]{8}$/, 'Card UID must be 8 hexadecimal characters'),
  patientId: z.string().cuid(),
  expiresAt: z.string().datetime().optional(),
  replaceExisting: z.boolean().default(false),
});

export const ChangeRfidCardStatusSchema = z.object({
  cardUid: z.string().trim().toUpperCase().regex(/^[A-F0-9]{8}$/, 'Invalid RFID card format'),
  status: RfidCardStatusSchema,
  reason: z.string().trim().max(250).optional(),
}).superRefine((value, context) => {
  if (['REVOKED', 'LOST'].includes(value.status) && !value.reason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['reason'], message: 'A reason is required.' });
  }
});

export type RfidCardStatus = z.infer<typeof RfidCardStatusSchema>;
export type RfidCard = z.infer<typeof RfidCardSchema>;
export type CreateRfidCardInput = z.infer<typeof CreateRfidCardSchema>;
export type RfidScanInput = z.infer<typeof RfidScanSchema>;
export type UpdateRfidCardStatusInput = z.infer<typeof UpdateRfidCardStatusSchema>;
export type AssignRfidCardInput = z.infer<typeof AssignRfidCardSchema>;
export type ChangeRfidCardStatusInput = z.infer<typeof ChangeRfidCardStatusSchema>;
