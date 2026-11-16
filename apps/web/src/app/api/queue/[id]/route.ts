import { NextRequest, NextResponse } from 'next/server';
import { prisma, QueueStatus } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { auditChanges, writeAuditLog } from '@/lib/audit';
import { recordQueueEvent } from '@/lib/queue-service';

async function sendQueueCallPushNotification(
  ticket: {
    id: string;
    station: string | null;
    patient: { userId: string };
    doctor: { firstName: string; lastName: string; roomNumber: string | null };
  },
  isRecall: boolean
) {
  try {
    const devices = await prisma.patientPushDevice.findMany({
      where: { userId: ticket.patient.userId, enabled: true },
      select: { expoPushToken: true },
    });
    if (!devices.length) return;
    const room = ticket.station || ticket.doctor.roomNumber || 'Consultation Room';
    const doctorName = `Dr. ${ticket.doctor.firstName} ${ticket.doctor.lastName}`;
    const messages = devices.map((device) => ({
      to: device.expoPushToken,
      sound: 'default',
      title: isRecall ? 'Tinatawag po kayo ulit!' : 'Tinawag na po kayo!',
      body: `Pumasok na po sa ${room} kay ${doctorName}.`,
      data: { type: 'QUEUE_CALLED', queueTicketId: ticket.id, isRecall },
    }));
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
  } catch (err) {
    console.error('Non-blocking error sending queue call push notification:', err);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeApi(ACCESS.queueManage);
  if (!auth.ok) return auth.response;
  try {
    const { id } = await params;
    const body = await req.json();
    const { status, action } = body;

    const ownedTicket = await prisma.queueTicket.findFirst({
      where: auth.user.role === 'DOCTOR' ? { id, doctor: { userId: auth.user.id } } : { id },
    });
    if (!ownedTicket) {
      return NextResponse.json({ success: false, error: 'Queue ticket not found' }, { status: 404 });
    }

    const dataToUpdate: any = {};

    if (action === 'RECALL') {
      if (ownedTicket.status !== QueueStatus.CALLED) return NextResponse.json({ success: false, error: 'Only a called patient can be recalled.' }, { status: 409 });
      const recalled = await prisma.$transaction(async (tx) => {
        const updatedTicket = await tx.queueTicket.update({ where: { id }, data: { calledAt: new Date(), lastRecalledAt: new Date(), recallCount: { increment: 1 } }, include: { patient: true, doctor: true } });
        await recordQueueEvent(tx, { queueTicketId: id, eventType: 'RECALLED', fromStatus: ownedTicket.status, toStatus: ownedTicket.status, actor: auth.user, metadata: { recallCount: updatedTicket.recallCount } });
        return updatedTicket;
      });
      await writeAuditLog({ actor: auth.user, action: 'QUEUE_PATIENT_RECALLED', targetType: 'QueueTicket', targetId: id, summary: `Queue ticket recalled (${recalled.recallCount}).`, request: req, metadata: { recallCount: recalled.recallCount } });
      await sendQueueCallPushNotification(recalled, true);
      return NextResponse.json({ success: true, ticket: recalled });
    }

    if (action === 'TRANSFER') {
      if (!body.targetDoctorId || body.targetDoctorId === ownedTicket.doctorId) return NextResponse.json({ success: false, error: 'A different target doctor is required.' }, { status: 400 });
      const target = await prisma.doctorProfile.findFirst({ where: { id: body.targetDoctorId, isActive: true }, include: { queueServiceState: true } });
      if (!target) return NextResponse.json({ success: false, error: 'Target doctor not found.' }, { status: 404 });
      if (target.queueServiceState?.status === 'CLOSED') return NextResponse.json({ success: false, error: 'The target doctor queue is closed.' }, { status: 409 });
      const transferred = await prisma.$transaction(async (tx) => {
        const updatedTicket = await tx.queueTicket.update({ where: { id }, data: { doctorId: target.id, station: target.roomNumber || 'Consultation Room', status: QueueStatus.WAITING, calledAt: null, startedAt: null, transferredAt: new Date(), transferredFromDoctorId: ownedTicket.doctorId }, include: { patient: true, doctor: true } });
        await recordQueueEvent(tx, { queueTicketId: id, eventType: 'TRANSFERRED', fromStatus: ownedTicket.status, toStatus: QueueStatus.WAITING, actor: auth.user, metadata: { fromDoctorId: ownedTicket.doctorId, toDoctorId: target.id, reason: body.reason || null } });
        return updatedTicket;
      });
      await writeAuditLog({ actor: auth.user, action: 'QUEUE_TICKET_TRANSFERRED', targetType: 'QueueTicket', targetId: id, summary: `Queue ticket transferred to Dr. ${target.firstName} ${target.lastName}.`, request: req, metadata: { fromDoctorId: ownedTicket.doctorId, toDoctorId: target.id, reason: body.reason || null } });
      return NextResponse.json({ success: true, ticket: transferred });
    }

    if (status) {
      const allowedTransitions: Record<string, string[]> = { WAITING: ['CALLED', 'CANCELLED', 'NO_SHOW'], CALLED: ['IN_CONSULTATION', 'WAITING', 'NO_SHOW', 'CANCELLED'], IN_CONSULTATION: ['COMPLETED'], COMPLETED: [], CANCELLED: [], NO_SHOW: ['WAITING'] };
      if (!allowedTransitions[ownedTicket.status]?.includes(status)) return NextResponse.json({ success: false, error: `Invalid queue transition from ${ownedTicket.status} to ${status}.` }, { status: 409 });
      if (status === QueueStatus.CALLED) {
        const control = await prisma.queueServiceState.findUnique({ where: { doctorId: ownedTicket.doctorId } });
        if (control && control.status !== 'OPEN') return NextResponse.json({ success: false, error: `Queue is ${control.status.toLowerCase()}. Reopen it before calling another patient.` }, { status: 409 });
      }
      dataToUpdate.status = status as QueueStatus;
      if (status === QueueStatus.CALLED) {
        dataToUpdate.calledAt = body.calledAt ? new Date(body.calledAt) : new Date();
      } else if (status === QueueStatus.IN_CONSULTATION) {
        dataToUpdate.startedAt = body.startedAt ? new Date(body.startedAt) : new Date();
      } else if (status === QueueStatus.COMPLETED) {
        dataToUpdate.completedAt = body.completedAt ? new Date(body.completedAt) : new Date();
      }
    }

    if (body.startedAt && !dataToUpdate.startedAt) {
      dataToUpdate.startedAt = new Date(body.startedAt);
    }
    if (body.completedAt && !dataToUpdate.completedAt) {
      dataToUpdate.completedAt = new Date(body.completedAt);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedTicket = await tx.queueTicket.update({ where: { id }, data: dataToUpdate, include: { patient: true, doctor: true } });
      await recordQueueEvent(tx, { queueTicketId: id, eventType: 'STATUS_CHANGED', fromStatus: ownedTicket.status, toStatus: updatedTicket.status, actor: auth.user });
      return updatedTicket;
    });

    // If completing consultation and clinical summary provided, record SOAP medical record
    let medicalRecordId: string | null = null;
    if (status === QueueStatus.COMPLETED && (body.diagnosis || body.plan || body.notes)) {
      try {
        const medicalRecord = await prisma.medicalRecord.create({
          data: {
            patientId: updated.patientId,
            doctorId: updated.doctor.userId,
            appointmentId: updated.appointmentId,
            queueTicketId: updated.id,
            visitDate: dataToUpdate.completedAt || new Date(),
            subjective: body.subjective || body.chiefComplaint || 'Consultation Encounter',
            objective: body.objective || `Physical Examination & Vitals: Room ${updated.doctor.roomNumber || 'Consultation Room'}`,
            assessment: body.diagnosis || 'Clinical Consultation Complete',
            plan: body.plan || body.notes || 'Advised follow-up if symptoms persist',
            vitals: body.vitals || undefined,
            followUpNotes: body.prescriptions ? `Prescriptions / Rx: ${body.prescriptions}` : undefined,
            status: 'DRAFT',
          },
        });
        medicalRecordId = medicalRecord.id;
      } catch (recErr) {
        console.error('Non-blocking error creating medical record:', recErr);
      }
    }

    await writeAuditLog({ actor: auth.user, action: 'QUEUE_STATUS_CHANGE', targetType: 'QueueTicket', targetId: id, summary: `Queue ticket status changed from ${ownedTicket.status} to ${updated.status}.`, request: req, metadata: auditChanges(ownedTicket, updated, { medicalRecordId }) });
    if (status === QueueStatus.CALLED) {
      await sendQueueCallPushNotification(updated, false);
    }

    return NextResponse.json({ success: true, ticket: updated });
  } catch (error) {
    console.error('Error in PATCH /api/queue/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to update queue ticket' }, { status: 500 });
  }
}
