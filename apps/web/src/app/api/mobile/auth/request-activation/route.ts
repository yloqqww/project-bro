import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { accountRequestAllowed, issuePatientAccountToken, requestIp } from '@/lib/mobile-auth';
import { sendPatientAccountEmail } from '@/lib/email';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({ email: z.string().email(), dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), phoneLast4: z.string().regex(/^\d{4}$/) });
const generic = { success: true, message: 'If the supplied information matches an eligible patient account, activation instructions will be sent.' };

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Email, date of birth, and the last four phone digits are required.' }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (!await accountRequestAllowed(`${requestIp(req) || 'local'}:${email}:activation`)) return NextResponse.json(generic);
  const user = await prisma.user.findUnique({ where: { email }, include: { patientProfile: true } });
  const patient = user?.role === 'PATIENT' ? user.patientProfile : null;
  const matches = Boolean(patient && patient.dateOfBirth.toISOString().slice(0, 10) === parsed.data.dateOfBirth && patient.phoneNumber.replace(/\D/g, '').endsWith(parsed.data.phoneLast4));
  if (!user || !patient || !matches) {
    await writeAuditLog({ actor: { email, role: 'PATIENT' }, action: 'PATIENT_ACTIVATION_REQUEST_REJECTED', targetType: 'User', summary: 'Patient activation request did not match the registered identity.', request: req });
    return NextResponse.json(generic);
  }
  const issued = await issuePatientAccountToken(user.id, 'ACTIVATION');
  const delivery = await sendPatientAccountEmail({ email: user.email, name: `${patient.firstName} ${patient.lastName}`, purpose: 'ACTIVATION', token: issued.token });
  await writeAuditLog({ actor: { id: user.id, email: user.email, role: 'PATIENT' }, action: 'PATIENT_ACTIVATION_REQUESTED', targetType: 'User', targetId: user.id, summary: 'Patient account activation instructions requested.', request: req, metadata: { expiresAt: issued.expiresAt, delivery: delivery.provider } });
  return NextResponse.json({ ...generic, ...(process.env.NODE_ENV !== 'production' && !delivery.emailSent ? { developmentToken: issued.token } : {}) });
}
