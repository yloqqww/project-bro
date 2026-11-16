import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { clearMobileLoginFailures, createMobileSession, mobileLoginAllowed, recordMobileLoginFailure, requestIp } from '@/lib/mobile-auth';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({ email: z.string().email(), password: z.string().min(1), expectedRole: z.literal('PATIENT'), deviceName: z.string().trim().max(120).optional() });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Valid patient credentials are required.' }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  const attemptKey = `${requestIp(req) || 'local'}:${email}`;
  if (!await mobileLoginAllowed(attemptKey)) {
    await writeAuditLog({ actor: { email, role: 'PATIENT' }, action: 'MOBILE_LOGIN_FAILURE', targetType: 'User', summary: `Rate-limited mobile patient login for ${email}.`, request: req, metadata: { reason: 'RATE_LIMITED' } });
    return NextResponse.json({ success: false, error: 'Too many failed attempts. Try again in 15 minutes.' }, { status: 429 });
  }
  const user = await prisma.user.findUnique({ where: { email }, include: { patientProfile: true } });
  const activation = user ? await prisma.$queryRaw<Array<{ passwordActivatedAt: Date | null }>>`SELECT "passwordActivatedAt" FROM "users" WHERE "id" = ${user.id}` : [];
  const valid = Boolean(user?.isActive && user.role === 'PATIENT' && user.patientProfile && await bcrypt.compare(parsed.data.password, user.password));
  if (!valid) {
    recordMobileLoginFailure(attemptKey);
    await writeAuditLog({ actor: { id: user?.id, email, role: 'PATIENT' }, action: 'MOBILE_LOGIN_FAILURE', targetType: 'User', targetId: user?.id, summary: `Rejected mobile patient login for ${email}.`, request: req, metadata: { reason: !user ? 'ACCOUNT_NOT_FOUND' : user.role !== 'PATIENT' ? 'ROLE_MISMATCH' : !user.isActive ? 'ACCOUNT_INACTIVE' : 'INVALID_PASSWORD' } });
    return NextResponse.json({ success: false, error: 'Invalid email or password.' }, { status: 401 });
  }
  if (!activation[0]?.passwordActivatedAt) return NextResponse.json({ success: false, code: 'ACTIVATION_REQUIRED', error: 'Activate your patient account before signing in.' }, { status: 403 });
  await clearMobileLoginFailures(attemptKey);
  const session = await createMobileSession(req, user!.id, parsed.data.deviceName);
  await writeAuditLog({ actor: { id: user!.id, email: user!.email, role: 'PATIENT' }, action: 'MOBILE_LOGIN_SUCCESS', targetType: 'MobileSession', summary: `${user!.email} signed in to the patient mobile app.`, request: req, metadata: { expiresAt: session.expiresAt } });
  return NextResponse.json({ success: true, token: session.token, expiresAt: session.expiresAt, patient: { id: user!.patientProfile!.id, email: user!.email, firstName: user!.patientProfile!.firstName, lastName: user!.patientProfile!.lastName } });
}
