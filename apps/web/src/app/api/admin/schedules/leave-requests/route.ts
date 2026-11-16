import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { ACTIVE_APPOINTMENT_STATUSES } from '@/lib/schedule-service';

export async function GET() {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  const requests = await prisma.doctorLeaveRequest.findMany({
    include: { doctor: { select: { firstName: true, lastName: true, specialization: true } } },
    orderBy: [{ status: 'desc' }, { createdAt: 'desc' }],
    take: 100,
  });
  return NextResponse.json({ success: true, requests });
}

export async function PATCH(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => null);
  const id = typeof body?.id === 'string' ? body.id : '';
  const decision = body?.decision;
  const reply = typeof body?.reply === 'string' ? body.reply.trim() : '';
  if (!id || !['APPROVED', 'REJECTED'].includes(decision) || reply.length > 500) {
    return NextResponse.json({ success: false, error: 'Invalid leave decision.' }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.doctorLeaveRequest.updateMany({
        where: { id, status: 'PENDING' },
        data: { status: decision, adminReply: reply || null, reviewedAt: new Date() },
      });
      if (updated.count !== 1) throw new Error('Request already reviewed or not found.');
      const leaveRequest = await tx.doctorLeaveRequest.findUniqueOrThrow({ where: { id } });
      if (decision === 'APPROVED') {
        const existingException = await tx.doctorScheduleException.findFirst({
          where: { doctorId: leaveRequest.doctorId, date: leaveRequest.date },
          select: { id: true },
        });
        if (existingException) throw new Error('May leave o unavailable date na sa schedule para sa araw na ito.');
        const dayStart = new Date(`${leaveRequest.date.toISOString().slice(0, 10)}T00:00:00+08:00`);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
        const bookedCount = await tx.appointment.count({
          where: {
            doctorId: leaveRequest.doctorId,
            appointmentDate: { gte: dayStart, lt: dayEnd },
            status: { in: ACTIVE_APPOINTMENT_STATUSES },
          },
        });
        if (bookedCount > 0) {
          throw new Error(`May ${bookedCount} aktibong appointment sa petsang ito. Ayusin muna ang booking bago aprubahan ang leave.`);
        }
        const exception = await tx.doctorScheduleException.create({
          data: { doctorId: leaveRequest.doctorId, date: leaveRequest.date, type: 'LEAVE', reason: leaveRequest.message },
        });
        return tx.doctorLeaveRequest.update({ where: { id }, data: { exceptionId: exception.id } });
      }
      return leaveRequest;
    });
    return NextResponse.json({ success: true, request: result });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to review request.' }, { status: 409 });
  }
}
