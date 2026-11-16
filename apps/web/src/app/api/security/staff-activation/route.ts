import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { consumeRateLimit, clearRateLimit } from '@/lib/security-rate-limit';
import { passwordValidationError, requestIp } from '@/lib/mobile-auth';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({ email: z.string().email().transform((value) => value.trim().toLowerCase()), temporaryPassword: z.string().min(1), newPassword: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Email, temporary password, and new password are required.' }, { status: 400 });
  const passwordError = passwordValidationError(parsed.data.newPassword);
  if (passwordError) return NextResponse.json({ success: false, error: passwordError }, { status: 400 });
  const key = `${requestIp(req) || 'local'}:${parsed.data.email}`;
  const limit = await consumeRateLimit('STAFF_ACTIVATION', key, 5, 30 * 60 * 1000);
  if (!limit.allowed) return NextResponse.json({ success: false, error: 'Too many attempts. Try again later.' }, { status: 429 });
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  const valid = Boolean(user && user.role !== 'PATIENT' && user.isActive && !user.passwordActivatedAt && await bcrypt.compare(parsed.data.temporaryPassword, user.password));
  if (!valid) {
    await writeAuditLog({ actor: { email: parsed.data.email }, action: 'STAFF_ACTIVATION_FAILURE', targetType: 'User', targetId: user?.id, summary: 'Staff password activation was rejected.', request: req });
    return NextResponse.json({ success: false, error: 'Activation details are invalid or the account is already activated.' }, { status: 400 });
  }
  const now = new Date();
  await prisma.user.update({ where: { id: user!.id }, data: { password: await bcrypt.hash(parsed.data.newPassword, 12), passwordActivatedAt: now, lastPasswordChangeAt: now, passwordExpiresAt: new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000), sessionVersion: { increment: 1 } } });
  await clearRateLimit('STAFF_ACTIVATION', key);
  await writeAuditLog({ actor: { id: user!.id, email: user!.email, role: user!.role }, action: 'STAFF_PASSWORD_ACTIVATED', targetType: 'User', targetId: user!.id, summary: 'Staff temporary password replaced and activated.', request: req });
  return NextResponse.json({ success: true, message: 'Password activated. Sign in and enroll an authenticator before MFA enforcement is enabled.' });
}
