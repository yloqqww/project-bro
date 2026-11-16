import { NextRequest, NextResponse } from 'next/server';
import { prisma, QueueStatus } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { getClinicSettings, operationalQueueDate, resolveQueuePrefix } from '@/lib/clinic-settings';
import { auditChanges, writeAuditLog } from '@/lib/audit';
import { recordQueueEvent } from '@/lib/queue-service';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const publicView = searchParams.get('view') === 'public';
    const doctorId = searchParams.get('doctorId');
    const status = searchParams.get('status');

    const settings = await getClinicSettings();
    const todayStart = operationalQueueDate(new Date(), settings.queueResetTime);

    if (publicView) {
      const tickets = await prisma.queueTicket.findMany({
        where: { queueDate: todayStart },
        select: {
          id: true,
          queueNumber: true,
          priority: true,
          status: true,
          calledAt: true,
          doctor: {
            select: { id: true, firstName: true, lastName: true, specialization: true, roomNumber: true },
          },
        },
        orderBy: [{ priority: 'desc' }, { queueNumber: 'asc' }],
      });
      return NextResponse.json({
        success: true,
        tickets: tickets.map((ticket) => ({
          id: ticket.id,
          ticketNumber: `${resolveQueuePrefix(settings, ticket.doctor.specialization, ticket.priority)}-${String(ticket.queueNumber).padStart(2, '0')}`,
          department: ticket.doctor.specialization,
          doctorId: ticket.doctor.id,
          doctor: `Dr. ${ticket.doctor.firstName} ${ticket.doctor.lastName}`,
          room: ticket.doctor.roomNumber || 'Consultation Room',
          status: ticket.status,
          calledAt: ticket.calledAt,
        })),
      });
    }

    const auth = await authorizeApi(ACCESS.queueRead);
    if (!auth.ok) return auth.response;

    const whereClause: any = {
      queueDate: {
        equals: todayStart,
      },
    };

    if (doctorId) {
      whereClause.doctorId = doctorId;
    }
    if (auth.user.role === 'DOCTOR') {
      if (!auth.user.doctorProfileId) {
        return NextResponse.json({ success: false, error: 'Doctor profile not found' }, { status: 403 });
      }
      whereClause.doctorId = auth.user.doctorProfileId;
    }

    if (status) {
      whereClause.status = status as QueueStatus;
    }
    if (auth.user.role === 'PATIENT') {
      if (!auth.user.patientProfileId) {
        return NextResponse.json({ success: false, error: 'Patient profile not found' }, { status: 403 });
      }
      whereClause.patientId = auth.user.patientProfileId;
    }

    const tickets = await prisma.queueTicket.findMany({
      where: whereClause,
      include: {
        patient: {
          include: {
            rfidCards: {
              where: { status: 'ACTIVE' },
              take: 1,
            },
            medicalRecords: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
        doctor: true,
      },
      orderBy: [
        { priority: 'desc' },
        { queueNumber: 'asc' },
      ],
    });

    const formattedTickets = tickets.map((t) => {
      const prefix = resolveQueuePrefix(settings, t.doctor.specialization, t.priority);
      const ticketNumber = `${prefix}-${String(t.queueNumber).padStart(2, '0')}`;
      let priorityLabel: 'Regular' | 'Senior/PWD' | 'Urgent' = 'Regular';
      if (t.priority === 2) priorityLabel = 'Urgent';
      else if (t.priority === 1) priorityLabel = 'Senior/PWD';

      return {
        id: t.id,
        ticketNumber,
        queueNumber: t.queueNumber,
        patientId: t.patientId,
        patientName: `${t.patient.firstName} ${t.patient.lastName}`,
        cardUid: t.patient.rfidCards[0]?.cardUid || 'N/A',
        department: t.doctor.specialization,
        doctor: `Dr. ${t.doctor.firstName} ${t.doctor.lastName}`,
        doctorId: t.doctorId,
        room: t.doctor.roomNumber || 'Room 101',
        priority: priorityLabel,
        reasonForVisit: t.patient.medicalRecords[0]?.subjective || undefined,
        timeIssued: new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: t.status,
        calledAt: t.calledAt,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        recallCount: t.recallCount,
        lastRecalledAt: t.lastRecalledAt,
        transferredAt: t.transferredAt,
        transferredFromDoctorId: t.transferredFromDoctorId,
      };
    });

    return NextResponse.json({ success: true, tickets: formattedTickets });
  } catch (error) {
    console.error('Error in GET /api/queue:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch queue' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.queueIssue);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const { patientId, cardUid, doctorId, priority, reasonForVisit, vitals } = body;

    let targetPatientId = patientId;

    if (!targetPatientId && cardUid) {
      const card = await prisma.rfidCard.findFirst({
        where: {
          cardUid: cardUid.trim().toUpperCase(),
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      if (card) {
        targetPatientId = card.patientId;
      }
    }

    if (!targetPatientId) {
      return NextResponse.json(
        { success: false, error: 'Valid patient ID or RFID card is required.' },
        { status: 400 }
      );
    }

    // Verify patient exists
    const patient = await prisma.patientProfile.findUnique({
      where: { id: targetPatientId },
      include: {
        rfidCards: {
          where: { status: 'ACTIVE', OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
          take: 1,
        },
      },
    });

    if (!patient) {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }

    // Find doctor: if doctorId given use it, else pick first active doctor
    let doctor = null;
    if (doctorId) {
      doctor = await prisma.doctorProfile.findUnique({ where: { id: doctorId } });
    }
    if (!doctor) {
      doctor = await prisma.doctorProfile.findFirst({ where: { isActive: true } });
    }

    if (!doctor) {
      return NextResponse.json(
        { success: false, error: 'Walang aktibong Doctor sa database. Mag-add muna ang Admin ng Doctor.' },
        { status: 400 }
      );
    }

    let numericPriority = 0;
    if (priority === 'Urgent') numericPriority = 2;
    else if (priority === 'Senior/PWD') numericPriority = 1;
    const settings = await getClinicSettings();
    const todayStart = operationalQueueDate(new Date(), settings.queueResetTime);
    const queueDateKey = todayStart.toISOString().slice(0, 10);
    const newTicket = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${`queue:${queueDateKey}`}))`;
      const latest = await tx.queueTicket.aggregate({
        where: { queueDate: todayStart },
        _max: { queueNumber: true },
      });
      const control = await tx.queueServiceState.findUnique({ where: { doctorId: doctor.id } });
      if (control?.status === 'CLOSED') throw new Error('QUEUE_CLOSED');
      const created = await tx.queueTicket.create({
        data: {
          queueNumber: (latest._max.queueNumber || 0) + 1,
          queueDate: todayStart,
          patientId: patient.id,
          doctorId: doctor.id,
          priority: numericPriority,
          status: QueueStatus.WAITING,
          station: doctor.roomNumber || 'Room 101',
        },
        include: {
          patient: { include: { rfidCards: true } },
          doctor: true,
        },
      });
      await recordQueueEvent(tx, { queueTicketId: created.id, eventType: 'ISSUED', toStatus: created.status, actor: auth.user, metadata: { doctorId: doctor.id } });
      return created;
    }, { isolationLevel: 'Serializable' });
    const queueNumber = newTicket.queueNumber;

    const cleanReason = (reasonForVisit || '').trim() || 'General Outpatient Consultation';

    // Record triage encounter in medical records so attending physician immediately sees it in chart
    if (doctor.userId) {
      try {
        await prisma.medicalRecord.create({
          data: {
            patientId: patient.id,
            doctorId: doctor.userId,
            visitDate: new Date(),
            subjective: cleanReason,
            objective: 'Triage Intake & Queue Registration (Reception Desk)',
            assessment: `Check-in for ${doctor.specialization}`,
            plan: `Waiting for consultation call at ${doctor.roomNumber || 'Consultation Room'}`,
            vitals: vitals || undefined,
          },
        });
      } catch (err) {
        console.warn('Non-fatal error creating initial medical record:', err);
      }
    }

    const prefix = resolveQueuePrefix(settings, doctor.specialization, numericPriority);
    const ticketNumber = `${prefix}-${String(queueNumber).padStart(2, '0')}`;

    await writeAuditLog({ actor: auth.user, action: 'QUEUE_TICKET_ISSUED', targetType: 'QueueTicket', targetId: newTicket.id, summary: `Issued queue ticket ${ticketNumber} for patient ${patient.id}.`, request: req, metadata: auditChanges(null, newTicket, { reasonForVisit: cleanReason }) });

    return NextResponse.json({
      success: true,
      ticket: {
        id: newTicket.id,
        ticketNumber,
        queueNumber: newTicket.queueNumber,
        patientId: patient.id,
        patientName: `${patient.firstName} ${patient.lastName}`,
        cardUid: patient.rfidCards[0]?.cardUid || 'N/A',
        department: doctor.specialization,
        doctor: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        doctorId: doctor.id,
        room: doctor.roomNumber || 'Room 101',
        priority: priority || 'Regular',
        reasonForVisit: cleanReason,
        timeIssued: new Date(newTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: newTicket.status,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/queue:', error);
    if (error instanceof Error && error.message === 'QUEUE_CLOSED') return NextResponse.json({ success: false, error: 'This doctor queue is closed and cannot accept new tickets.' }, { status: 409 });
    return NextResponse.json({ success: false, error: 'Failed to issue queue ticket' }, { status: 500 });
  }
}
