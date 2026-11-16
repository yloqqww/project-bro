import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeApi(ACCESS.queueRead);
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const ticket = await prisma.queueTicket.findFirst({
    where: auth.user.role === 'DOCTOR' ? { id, doctor: { userId: auth.user.id } } : auth.user.role === 'PATIENT' ? { id, patientId: auth.user.patientProfileId || '__none__' } : { id },
    select: { id: true },
  });
  if (!ticket) return NextResponse.json({ success: false, error: 'Queue ticket not found.' }, { status: 404 });
  const events = await prisma.queueEvent.findMany({ where: { queueTicketId: id }, orderBy: { createdAt: 'asc' }, take: 200 });
  return NextResponse.json({ success: true, events });
}
