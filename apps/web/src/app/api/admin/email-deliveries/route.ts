import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { paginationMeta, paginationParams } from '@/lib/pagination';
import { sendStaffWelcomeEmail } from '@/lib/email';
import { writeAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const { page, pageSize, skip } = paginationParams(searchParams, 25);
    const status = searchParams.get('status');
    const hasStatus = Boolean(status && status !== 'ALL' && ['PENDING','SENT','FAILED','SIMULATED'].includes(status));
    const deliveries = hasStatus
      ? await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "email_deliveries" WHERE "status" = $1::"EmailDeliveryStatus" ORDER BY "createdAt" DESC OFFSET $2 LIMIT $3`, status, skip, pageSize)
      : await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "email_deliveries" ORDER BY "createdAt" DESC OFFSET $1 LIMIT $2`, skip, pageSize);
    const countRows = hasStatus
      ? await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "email_deliveries" WHERE "status" = $1::"EmailDeliveryStatus"`, status)
      : await prisma.$queryRaw<Array<{ count: number }>>`SELECT COUNT(*)::int AS count FROM "email_deliveries"`;
    const total = Number(countRows[0]?.count || 0);
    return NextResponse.json({ success: true, deliveries, pagination: paginationMeta(page, pageSize, total) });
  } catch (error) {
    console.error('Error fetching email deliveries:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch email deliveries.', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    if (!body.id || typeof body.temporaryPassword !== 'string' || body.temporaryPassword.length < 12) {
      return NextResponse.json({ success: false, error: 'Delivery ID and a valid temporary password are required for a secure retry.' }, { status: 400 });
    }
    const deliveries = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "email_deliveries" WHERE "id" = $1 LIMIT 1`, body.id);
    const delivery = deliveries[0];
    if (!delivery || delivery.template !== 'STAFF_WELCOME') return NextResponse.json({ success: false, error: 'Retryable delivery not found.' }, { status: 404 });
    if (delivery.attempts >= delivery.maxAttempts) return NextResponse.json({ success: false, error: 'Maximum retry attempts reached.' }, { status: 409 });
    const payload = (delivery.payload || {}) as any;
    const result = await sendStaffWelcomeEmail({ email: delivery.recipient, name: payload.name || delivery.recipient, role: payload.role || 'Staff', room: payload.room || undefined, specialty: payload.specialty || undefined, temporaryPassword: body.temporaryPassword, existingDeliveryId: delivery.id });
    await writeAuditLog({ actor: auth.user, action: 'EMAIL_RETRY', targetType: 'EmailDelivery', targetId: delivery.id, summary: `Retried ${delivery.template} email to ${delivery.recipient}.`, request: req, metadata: { delivered: result.emailSent, provider: result.provider } });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Error retrying email delivery:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retry email delivery.', details: error instanceof Error ? error.message : undefined },
      { status: 500 }
    );
  }
}
