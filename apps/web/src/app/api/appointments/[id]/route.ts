import { NextRequest, NextResponse } from 'next/server';
import { prisma, AppointmentStatus } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { auditChanges, writeAuditLog } from '@/lib/audit';
import { cancelAppointmentReminders, offerNextWaitlistEntry } from '@/lib/appointment-lifecycle';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi(ACCESS.appointmentManage);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, action } = body;
    const before = await prisma.appointment.findUnique({ where: { id } });
    if (!before) return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });

    if (action === 'ARCHIVE' || action === 'RESTORE') {
      if (auth.user.role !== 'ADMIN' && auth.user.role !== 'RECEPTIONIST') {
        return NextResponse.json({ success: false, error: 'Admin or OPD access required.' }, { status: 403 });
      }
      const cleanedNotes = (before.notes || '').replace(/\s*\[ARCHIVED:[^\]]*\]/g, '').trim();
      const reason = typeof body.reason === 'string' && body.reason.trim()
        ? body.reason.trim().replace(/[\[\]|]/g, ' ').slice(0, 200)
        : 'Archived by clinic staff';
      const nextNotes = action === 'ARCHIVE'
        ? `${cleanedNotes ? `${cleanedNotes} ` : ''}[ARCHIVED:${new Date().toISOString()}|${reason}]`
        : cleanedNotes || null;

      const updated = await prisma.appointment.update({
        where: { id },
        data: { notes: nextNotes },
        include: { patient: true, doctor: true },
      });

      await writeAuditLog({
        actor: auth.user,
        action: action === 'ARCHIVE' ? 'APPOINTMENT_ARCHIVE' : 'APPOINTMENT_RESTORE',
        targetType: 'Appointment',
        targetId: id,
        summary: action === 'ARCHIVE' ? `Appointment ${id} was archived.` : `Appointment ${id} was restored from archive.`,
        request: req,
        metadata: { reason: action === 'ARCHIVE' ? reason : null },
      });

      return NextResponse.json({ success: true, appointment: updated });
    }

    if (auth.user.role === 'NURSE' && !['Checked-In', 'Checked In', AppointmentStatus.CHECKED_IN].includes(status)) {
      return NextResponse.json({ success: false, error: 'Nurses may only check in appointments.' }, { status: 403 });
    }

    const updateData: any = {};

    if (status) {
      if (status === 'Confirmed' || status === AppointmentStatus.CONFIRMED) {
        updateData.status = AppointmentStatus.CONFIRMED;
        updateData.confirmedAt = new Date();
      } else if (status === 'Checked-In' || status === 'Checked In' || status === AppointmentStatus.CHECKED_IN) {
        updateData.status = AppointmentStatus.CHECKED_IN;
        updateData.checkedInAt = new Date();
      } else if (status === 'In-Progress' || status === AppointmentStatus.IN_PROGRESS) {
        updateData.status = AppointmentStatus.IN_PROGRESS;
      } else if (status === 'Cancelled' || status === AppointmentStatus.CANCELLED) {
        if (typeof body.reason !== 'string' || body.reason.trim().length < 3) return NextResponse.json({ success: false, error: 'A cancellation reason of at least 3 characters is required.' }, { status: 400 });
        updateData.status = AppointmentStatus.CANCELLED;
        updateData.cancelledAt = new Date();
        updateData.cancellationReason = body.reason.trim();
        updateData.cancelledByRole = auth.user.role;
        updateData.cancellationPolicyResult = 'STAFF_OVERRIDE';
      } else if (status === 'Completed' || status === AppointmentStatus.COMPLETED) {
        updateData.status = AppointmentStatus.COMPLETED;
        updateData.completedAt = new Date();
      } else if (status === 'No-Show' || status === AppointmentStatus.NO_SHOW) {
        updateData.status = AppointmentStatus.NO_SHOW;
        updateData.noShowMarkedAt = new Date();
        updateData.noShowMarkedBy = auth.user.role;
      } else if (status === 'Pending' || status === AppointmentStatus.SCHEDULED) {
        updateData.status = AppointmentStatus.SCHEDULED;
      }
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: updateData,
      include: {
        patient: true,
        doctor: true,
      },
    });
    if (([AppointmentStatus.CANCELLED, AppointmentStatus.NO_SHOW, AppointmentStatus.COMPLETED] as AppointmentStatus[]).includes(updated.status)) {
      await cancelAppointmentReminders(prisma, updated.id);
    }
    if (updated.status === AppointmentStatus.CANCELLED) await offerNextWaitlistEntry(prisma, updated.doctorId, updated.appointmentDate);

    await writeAuditLog({ actor: auth.user, action: 'APPOINTMENT_STATUS_CHANGE', targetType: 'Appointment', targetId: id, summary: `Appointment status changed from ${before.status} to ${updated.status}.`, request: req, metadata: auditChanges(before, updated, { reason: body.reason || null }) });

    return NextResponse.json({ success: true, appointment: updated });
  } catch (error) {
    console.error('Error in PATCH /api/appointments/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to update appointment' }, { status: 500 });
  }
}
