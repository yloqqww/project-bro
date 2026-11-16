import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { createAdminNotification } from '@/lib/notifications';

export async function GET() {
  try {
    const auth = await authorizeApi(ACCESS.prescriptionWrite);
    if (!auth.ok) return auth.response;
    const doctorId = auth.user.doctorProfileId;
    if (!doctorId) return NextResponse.json({ success: false, error: 'Doctor profile not found.' }, { status: 404 });

    const doctor = await prisma.doctorProfile.findUnique({
      where: { id: doctorId },
      include: {
        schedule: { include: { weeklyAvailability: { orderBy: { dayOfWeek: 'asc' } } } },
        scheduleExceptions: { orderBy: { date: 'asc' } },
        leaveRequests: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
    return NextResponse.json({
      success: true,
      schedule: doctor?.schedule || null,
      exceptions: doctor?.scheduleExceptions || [],
      leaveRequests: doctor?.leaveRequests || [],
    });
  } catch (error) {
    console.error('Unable to load doctor schedule:', error);
    return NextResponse.json({ success: false, error: 'Hindi makuha ang schedule sa ngayon.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeApi(ACCESS.prescriptionWrite);
    if (!auth.ok) return auth.response;
    const doctorId = auth.user.doctorProfileId;
    if (!doctorId) return NextResponse.json({ success: false, error: 'Doctor profile not found.' }, { status: 404 });

    const body = await req.json().catch(() => null);
    const date = typeof body?.date === 'string' ? body.date : '';
    const message = typeof body?.message === 'string' ? body.message.trim() : '';
    const requestedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
    const today = new Date();
    const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(today);
    if (!requestedDate || Number.isNaN(requestedDate.getTime()) || requestedDate.toISOString().slice(0, 10) !== date || date < todayKey || message.length < 5 || message.length > 500) {
      return NextResponse.json({ success: false, error: 'Pumili ng valid na petsa at maglagay ng mensahe (5–500 characters).' }, { status: 400 });
    }

    const duplicate = await prisma.doctorLeaveRequest.findFirst({ where: { doctorId, date: requestedDate, status: 'PENDING' }, select: { id: true } });
    if (duplicate) return NextResponse.json({ success: false, error: 'May pending leave request ka na sa petsang ito.' }, { status: 409 });

    const request = await prisma.doctorLeaveRequest.create({ data: { doctorId, date: requestedDate, message } });
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId }, select: { firstName: true, lastName: true } });
    await createAdminNotification({
      type: 'info',
      category: 'DOCTOR_LEAVE_REQUEST',
      title: `Leave request: Dr. ${doctor?.firstName || ''} ${doctor?.lastName || ''}`.trim(),
      message: `${date}: ${message}`,
      staffName: `Dr. ${doctor?.firstName || ''} ${doctor?.lastName || ''}`.trim(),
      staffEmail: auth.user.email,
      staffRole: 'DOCTOR',
      metadata: { requestId: request.id, doctorId, date },
    });
    return NextResponse.json({ success: true, request }, { status: 201 });
  } catch (error) {
    console.error('Unable to submit doctor leave request:', error);
    return NextResponse.json({ success: false, error: 'Hindi naipadala ang request sa ngayon.' }, { status: 500 });
  }
}
