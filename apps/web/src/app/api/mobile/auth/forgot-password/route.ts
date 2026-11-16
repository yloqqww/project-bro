import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { accountRequestAllowed, issuePatientAccountToken, requestIp } from '@/lib/mobile-auth';
import { sendPatientAccountEmail } from '@/lib/email';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({ email: z.string().email() });
const generic = { success: true, message: 'If an activated patient account exists, password reset instructions will be sent.' };

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'A valid email is required.' }, { status: 400 });
  const email = parsed.data.email.toLowerCase();
  if (!await accountRequestAllowed(`${requestIp(req) || 'local'}:${email}:reset`)) return NextResponse.json(generic);
  const users = await prisma.$queryRaw<Array<{ id: string; email: string; firstName: string; lastName: string }>>`SELECT u."id", u."email", p."firstName", p."lastName" FROM "users" u JOIN "patient_profiles" p ON p."userId" = u."id" WHERE u."email" = ${email} AND u."role" = 'PATIENT'::"UserRole" AND u."isActive" = true AND u."passwordActivatedAt" IS NOT NULL LIMIT 1`;
  const user = users[0];
  if (!user) return NextResponse.json(generic);
  const issued = await issuePatientAccountToken(user.id, 'PASSWORD_RESET');
  const delivery = await sendPatientAccountEmail({ email: user.email, name: `${user.firstName} ${user.lastName}`, purpose: 'PASSWORD_RESET', token: issued.token });
  await writeAuditLog({ actor: { id: user.id, email: user.email, role: 'PATIENT' }, action: 'PASSWORD_RESET_REQUESTED', targetType: 'User', targetId: user.id, summary: 'Patient password reset requested.', request: req, metadata: { expiresAt: issued.expiresAt, delivery: delivery.provider } });
  return NextResponse.json({ ...generic, ...(process.env.NODE_ENV !== 'production' && !delivery.emailSent ? { developmentToken: issued.token } : {}) });
}
