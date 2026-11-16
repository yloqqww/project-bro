import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { APP_ROLES } from '@/lib/access-policy';
import { writeAuditLog } from '@/lib/audit';

export async function DELETE(req: NextRequest) {
  const auth = await authorizeApi(APP_ROLES);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  const targetUserId = body.userId && auth.user.role === 'ADMIN' ? String(body.userId) : auth.user.id;
  if (body.userId && auth.user.role !== 'ADMIN' && body.userId !== auth.user.id) return NextResponse.json({ success: false, error: 'Only Admin can revoke another user’s sessions.' }, { status: 403 });
  await prisma.$transaction([
    prisma.user.update({ where: { id: targetUserId }, data: { sessionVersion: { increment: 1 } } }),
    prisma.mobileSession.updateMany({ where: { userId: targetUserId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  await writeAuditLog({ actor: auth.user, action: 'SESSIONS_REVOKED_ALL', targetType: 'User', targetId: targetUserId, summary: 'All web and mobile sessions were revoked.', request: req });
  return NextResponse.json({ success: true });
}
