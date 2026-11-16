import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { APP_ROLES } from '@/lib/access-policy';
import { decryptMfaSecret, encryptMfaSecret, newTotpSecret, totpUri, verifyTotp } from '@/lib/mfa';
import { writeAuditLog } from '@/lib/audit';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('BEGIN') }),
  z.object({ action: z.literal('ENABLE'), code: z.string().regex(/^\d{6}$/) }),
  z.object({ action: z.literal('DISABLE'), code: z.string().regex(/^\d{6}$/) }),
]);

export async function GET() {
  const auth = await authorizeApi(APP_ROLES.filter((role) => role !== 'PATIENT'));
  if (!auth.ok) return auth.response;
  const user = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { mfaEnabled: true, mfaSecretEncrypted: true } });
  return NextResponse.json({ success: true, enabled: Boolean(user?.mfaEnabled), enrollmentPending: Boolean(user?.mfaSecretEncrypted && !user.mfaEnabled), enforced: process.env.REQUIRE_STAFF_MFA === 'true' });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(APP_ROLES.filter((role) => role !== 'PATIENT'));
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid MFA request.' }, { status: 400 });
  if (parsed.data.action === 'BEGIN') {
    const secret = newTotpSecret();
    await prisma.user.update({ where: { id: auth.user.id }, data: { mfaSecretEncrypted: encryptMfaSecret(secret), mfaEnabled: false } });
    await writeAuditLog({ actor: auth.user, action: 'MFA_ENROLLMENT_STARTED', targetType: 'User', targetId: auth.user.id, summary: 'Staff MFA enrollment started.', request: req });
    return NextResponse.json({ success: true, secret, provisioningUri: totpUri(auth.user.email, secret) });
  }
  const user = await prisma.user.findUnique({ where: { id: auth.user.id }, select: { mfaSecretEncrypted: true, mfaEnabled: true } });
  if (!user?.mfaSecretEncrypted) return NextResponse.json({ success: false, error: 'Start MFA enrollment first.' }, { status: 409 });
  if (!verifyTotp(decryptMfaSecret(user.mfaSecretEncrypted), parsed.data.code)) return NextResponse.json({ success: false, error: 'Authenticator code is invalid.' }, { status: 400 });
  const enabled = parsed.data.action === 'ENABLE';
  await prisma.user.update({ where: { id: auth.user.id }, data: enabled ? { mfaEnabled: true } : { mfaEnabled: false, mfaSecretEncrypted: null, mfaRecoveryCodes: undefined, sessionVersion: { increment: 1 } } });
  await writeAuditLog({ actor: auth.user, action: enabled ? 'MFA_ENABLED' : 'MFA_DISABLED', targetType: 'User', targetId: auth.user.id, summary: `Staff MFA ${enabled ? 'enabled' : 'disabled'}.`, request: req });
  return NextResponse.json({ success: true, enabled });
}
