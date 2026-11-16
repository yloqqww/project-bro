import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({ doctorId: z.string().min(1).optional(), status: z.enum(['OPEN', 'PAUSED', 'CLOSED']), reason: z.string().trim().max(300).optional() });

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.queueRead);
  if (!auth.ok) return auth.response;
  const requested = new URL(req.url).searchParams.get('doctorId');
  const doctorId = auth.user.role === 'DOCTOR' ? auth.user.doctorProfileId : requested;

  if (doctorId) {
    const state = await prisma.queueServiceState.findUnique({ where: { doctorId } });
    return NextResponse.json({ success: true, state: state || { doctorId, status: 'OPEN', reason: null } });
  }

  if (auth.user.role === 'DOCTOR') {
    return NextResponse.json({ success: false, error: 'Doctor is required.' }, { status: 400 });
  }

  const doctors = await prisma.doctorProfile.findMany({
    where: { isActive: true, user: { isActive: true } },
    include: { queueServiceState: true },
    orderBy: [{ specialization: 'asc' }, { lastName: 'asc' }],
  });

  return NextResponse.json({
    success: true,
    states: doctors.map((doc) => ({
      doctorId: doc.id,
      doctorName: `Dr. ${doc.firstName} ${doc.lastName}`,
      specialization: doc.specialization,
      roomNumber: doc.roomNumber || 'Consultation Room',
      status: doc.queueServiceState?.status || 'OPEN',
      reason: doc.queueServiceState?.reason || null,
      updatedAt: doc.queueServiceState?.updatedAt ? doc.queueServiceState.updatedAt.toISOString() : null,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.queueManage);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Doctor, queue status, and a valid reason are required.' }, { status: 400 });
  const doctorId = auth.user.role === 'DOCTOR' ? auth.user.doctorProfileId : parsed.data.doctorId;
  if (!doctorId) return NextResponse.json({ success: false, error: 'Doctor is required.' }, { status: 400 });
  if (auth.user.role === 'DOCTOR' && auth.user.doctorProfileId !== doctorId) return NextResponse.json({ success: false, error: 'Doctors can only control their own queue.' }, { status: 403 });
  if (parsed.data.status !== 'OPEN' && (!parsed.data.reason || parsed.data.reason.length < 3)) return NextResponse.json({ success: false, error: 'A reason is required to pause or close a queue.' }, { status: 400 });
  const state = await prisma.queueServiceState.upsert({
    where: { doctorId },
    create: { doctorId, status: parsed.data.status, reason: parsed.data.reason || null, updatedById: auth.user.id },
    update: { status: parsed.data.status, reason: parsed.data.status === 'OPEN' ? null : parsed.data.reason || null, updatedById: auth.user.id },
  });
  await writeAuditLog({ actor: auth.user, action: 'QUEUE_CONTROL_CHANGED', targetType: 'DoctorProfile', targetId: doctorId, summary: `Queue changed to ${state.status}.`, request: req, metadata: { status: state.status, reason: state.reason } });
  return NextResponse.json({ success: true, state });
}
