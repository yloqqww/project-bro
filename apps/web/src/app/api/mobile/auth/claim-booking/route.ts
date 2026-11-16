import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { hashMobileToken, passwordValidationError } from '@/lib/mobile-auth';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({
  appointmentId: z.string().min(1),
  claimCode: z.string().min(20),
  email: z.string().email().transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phoneLast4: z.string().regex(/^\d{4}$/),
});

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Booking claim code, appointment, email, date of birth, phone digits, and password are required.' }, { status: 400 });
  const passwordError = passwordValidationError(parsed.data.password);
  if (passwordError) return NextResponse.json({ success: false, error: passwordError }, { status: 400 });

  const claim = await prisma.appointmentBookingClaim.findFirst({
    where: { appointmentId: parsed.data.appointmentId, tokenHash: hashMobileToken(parsed.data.claimCode), claimedAt: null, expiresAt: { gt: new Date() } },
    include: { patient: { include: { user: true } }, appointment: true },
  });
  if (!claim) return NextResponse.json({ success: false, error: 'Booking claim code is invalid, expired, or already used.' }, { status: 400 });
  const birthDate = claim.patient.dateOfBirth.toISOString().slice(0, 10);
  const phoneDigits = claim.patient.phoneNumber.replace(/\D/g, '').slice(-4);
  if (birthDate !== parsed.data.dateOfBirth || phoneDigits !== parsed.data.phoneLast4) return NextResponse.json({ success: false, error: 'Patient identity details do not match the booking.' }, { status: 403 });

  const duplicate = await prisma.user.findFirst({ where: { email: { equals: parsed.data.email, mode: 'insensitive' }, id: { not: claim.patient.userId } }, select: { id: true } });
  if (duplicate) return NextResponse.json({ success: false, error: 'That email is already registered.' }, { status: 409 });
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  const now = new Date();
  await prisma.$transaction([
    prisma.user.update({ where: { id: claim.patient.userId }, data: { email: parsed.data.email, password: passwordHash, passwordActivatedAt: now, lastPasswordChangeAt: now } }),
    prisma.appointmentBookingClaim.update({ where: { id: claim.id }, data: { claimedAt: now, claimedEmail: parsed.data.email } }),
    prisma.mobileSession.updateMany({ where: { userId: claim.patient.userId, revokedAt: null }, data: { revokedAt: now } }),
  ]);
  await writeAuditLog({ actor: { id: claim.patient.userId, email: parsed.data.email, role: 'PATIENT' }, action: 'BOOKING_ACCOUNT_CLAIMED', targetType: 'Appointment', targetId: claim.appointmentId, summary: 'Patient claimed the account created by a public booking.', request: req, metadata: { patientId: claim.patientId } });
  return NextResponse.json({ success: true, message: 'Account claimed. You can now sign in to manage this appointment.' });
}
