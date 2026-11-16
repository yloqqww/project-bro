import { NextRequest, NextResponse } from 'next/server';
import { prisma, AppointmentStatus } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { createAdminNotification } from '@/lib/notifications';
import { getDoctorAvailability } from '@/lib/schedule-service';
import { clinicDateKey, requestedSlotMatches } from '@/lib/scheduling';
import { getClinicSettings, resolveQueuePrefix } from '@/lib/clinic-settings';
import { paginationMeta, paginationParams } from '@/lib/pagination';
import { auditChanges, writeAuditLog } from '@/lib/audit';
import { scheduleAppointmentReminders } from '@/lib/appointment-lifecycle';
import { hashMobileToken, newOpaqueToken } from '@/lib/mobile-auth';
import { nextPatientMrn, normalizePatientIdentity } from '@/lib/patient-master-index';

function mapPrismaStatusToDisplay(status: AppointmentStatus): 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled' | 'No-Show' | 'Checked-In' {
  switch (status) {
    case AppointmentStatus.CHECKED_IN:
      return 'Checked-In';
    case AppointmentStatus.CONFIRMED:
    case AppointmentStatus.IN_PROGRESS:
      return 'Confirmed';
    case AppointmentStatus.COMPLETED:
      return 'Completed';
    case AppointmentStatus.CANCELLED:
      return 'Cancelled';
    case AppointmentStatus.NO_SHOW:
      return 'No-Show';
    case AppointmentStatus.SCHEDULED:
    default:
      return 'Pending';
  }
}

function parseArchivedFromNotes(notes: string | null | undefined): { archivedAt: string | null; archiveReason: string | null } {
  if (!notes) return { archivedAt: null, archiveReason: null };
  const match = notes.match(/\[ARCHIVED:([^|\]]+)\|([^\]]*)\]/);
  if (!match) return { archivedAt: null, archiveReason: null };
  return {
    archivedAt: match[1] || null,
    archiveReason: match[2] || null,
  };
}

function mapDisplayStatusToPrisma(status: string): AppointmentStatus {
  switch (status) {
    case 'Checked-In':
      return AppointmentStatus.CHECKED_IN;
    case 'Confirmed':
      return AppointmentStatus.CONFIRMED;
    case 'Completed':
      return AppointmentStatus.COMPLETED;
    case 'Cancelled':
      return AppointmentStatus.CANCELLED;
    case 'No-Show':
      return AppointmentStatus.NO_SHOW;
    case 'Pending':
    default:
      return AppointmentStatus.SCHEDULED;
  }
}

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.appointmentRead);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const doctorId = searchParams.get('doctorId');
    const statusParam = searchParams.get('status');
    const search = searchParams.get('search')?.trim();
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const includeArchived = searchParams.get('includeArchived') === 'true' && auth.user.role === 'ADMIN';
    const { page, pageSize, skip } = paginationParams(searchParams);
    const settings = await getClinicSettings();

    const where: any = {
      AND: [{ patient: { status: 'ACTIVE' } }],
    };
    if (!includeArchived) {
      where.AND.push({
        OR: [{ notes: null }, { NOT: { notes: { contains: '[ARCHIVED:' } } }],
      });
    }
    if (doctorId) where.doctorId = doctorId;
    if (statusParam) where.status = mapDisplayStatusToPrisma(statusParam);
    if (search) {
      where.OR = [
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: search, mode: 'insensitive' } } },
        { doctor: { firstName: { contains: search, mode: 'insensitive' } } },
        { doctor: { lastName: { contains: search, mode: 'insensitive' } } },
        { reasonForVisit: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (from || to) {
      where.appointmentDate = {};
      if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) where.appointmentDate.gte = new Date(`${from}T00:00:00+08:00`);
      if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) where.appointmentDate.lte = new Date(`${to}T23:59:59.999+08:00`);
    }
    if (auth.user.role === 'PATIENT') {
      if (!auth.user.patientProfileId) {
        return NextResponse.json({ success: false, error: 'Patient profile not found' }, { status: 403 });
      }
      where.patientId = auth.user.patientProfileId;
    }
    if (auth.user.role === 'DOCTOR') {
      if (!auth.user.doctorProfileId) {
        return NextResponse.json({ success: false, error: 'Doctor profile not found' }, { status: 403 });
      }
      where.doctorId = auth.user.doctorProfileId;
    }

    const [appointments, total] = await prisma.$transaction([
      prisma.appointment.findMany({
      where,
      include: {
        patient: {
          include: {
            rfidCards: true,
          },
        },
        doctor: true,
        queueTicket: true,
      },
      orderBy: {
        appointmentDate: 'desc',
      },
      skip,
      take: pageSize,
      }),
      prisma.appointment.count({ where }),
    ]);

    const formatted = appointments.map((a) => {
      const aDate = new Date(a.appointmentDate);
      const dateStr = aDate.toISOString().split('T')[0];
      const timeStr = aDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      // Determine type
      let type: 'Walk-in' | 'Scheduled' | 'Follow-up' = 'Scheduled';
      if (a.notes?.toLowerCase().includes('walk-in') || a.reasonForVisit.toLowerCase().includes('walk-in')) {
        type = 'Walk-in';
      } else if (a.followUpFromRecordId || a.notes?.toLowerCase().includes('follow-up') || a.reasonForVisit.toLowerCase().includes('follow-up')) {
        type = 'Follow-up';
      }

      const aptNum = `APT-${aDate.getFullYear()}-${a.id.slice(-6).toUpperCase()}`;
      const patId = `${settings.shortName}-${a.patient.createdAt.getFullYear()}-${a.patient.id.slice(-4).toUpperCase()}`;
      const firstCard = (a.patient as any).rfidCards?.[0]?.cardUid || null;
      const archiveMeta = parseArchivedFromNotes(a.notes);

      return {
        id: a.id,
        appointmentNumber: aptNum,
        patientName: `${a.patient.firstName} ${a.patient.lastName}`,
        patientId: patId,
        rawPatientId: a.patient.id,
        cardUid: firstCard,
        gender: a.patient.gender || 'MALE',
        dateOfBirth: a.patient.dateOfBirth ? a.patient.dateOfBirth.toISOString() : null,
        phoneNumber: a.patient.phoneNumber || '',
        doctorId: a.doctorId,
        doctorName: `Dr. ${a.doctor.firstName} ${a.doctor.lastName}`,
        doctorSpecialty: a.doctor.specialization,
        date: dateStr,
        time: timeStr,
        status: mapPrismaStatusToDisplay(a.status),
        type,
        reason: a.reasonForVisit || 'General Consultation',
        queueNumber: a.queueTicket ? `${resolveQueuePrefix(settings, a.doctor.specialization, a.queueTicket.priority)}-${String(a.queueTicket.queueNumber).padStart(2, '0')}` : null,
        checkedInAt: a.checkedInAt ? new Date(a.checkedInAt).toISOString() : null,
        completedAt: a.completedAt ? new Date(a.completedAt).toISOString() : null,
        patientConfirmedAt: a.patientConfirmedAt ? new Date(a.patientConfirmedAt).toISOString() : null,
        cancellationReason: a.cancellationReason,
        cancelledByRole: a.cancelledByRole,
        followUpFromRecordId: a.followUpFromRecordId,
        archivedAt: archiveMeta.archivedAt,
        archiveReason: archiveMeta.archiveReason,
      };
    });

    return NextResponse.json({ success: true, appointments: formatted, pagination: paginationMeta(page, pageSize, total) });
  } catch (error) {
    console.error('Error in GET /api/appointments:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch appointments' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      patientId,
      cardUid,
      firstName,
      lastName,
      phoneNumber,
      dateOfBirth,
      gender,
      address,
      city,
      state,
      zipCode,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      doctorId,
      appointmentDate,
      reasonForVisit,
      notes,
      type,
      privacyAcknowledged,
    } = body;

    if (!doctorId || !appointmentDate) {
      return NextResponse.json(
        { success: false, error: 'Doctor and Appointment Date are required.' },
        { status: 400 }
      );
    }
    if (privacyAcknowledged !== true) return NextResponse.json({ success: false, error: 'Privacy acknowledgement is required before booking.' }, { status: 400 });

    if (!firstName || !lastName || !phoneNumber || !dateOfBirth) {
      return NextResponse.json(
        { success: false, error: 'Pakilagay ang buong pangalan, contact number, at petsa ng kapanganakan ng pasyente.' },
        { status: 400 }
      );
    }

    const parsedBirthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(parsedBirthDate.getTime()) || parsedBirthDate.toISOString().slice(0, 10) !== dateOfBirth || parsedBirthDate >= new Date()) {
      return NextResponse.json({ success: false, error: 'Invalid date of birth.' }, { status: 400 });
    }

    const requestedDate = new Date(appointmentDate);
    if (Number.isNaN(requestedDate.getTime())) {
      return NextResponse.json({ success: false, error: 'Invalid appointment date.' }, { status: 400 });
    }

    const settings = await getClinicSettings();
    const result = await prisma.$transaction(async (tx) => {
      // Serialize booking decisions for one doctor. This closes the race between
      // availability recheck and create, while the DB unique index protects exact starts.
      await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${doctorId}))`;

      const availability = await getDoctorAvailability(doctorId, clinicDateKey(requestedDate), tx);
      if (!availability.found) throw new Error('BOOKING_DOCTOR_NOT_FOUND');
      if (!availability.configured) throw new Error('BOOKING_SCHEDULE_NOT_CONFIGURED');
      if (!requestedSlotMatches(availability.slots, requestedDate)) {
        throw new Error('BOOKING_SLOT_UNAVAILABLE');
      }

      // Public booking never treats a submitted patientId or RFID UID as proof of identity.
      let targetPatientId: string | undefined;
      let isNewPatient = false;
      const existing = await tx.patientProfile.findFirst({
        where: {
          status: 'ACTIVE',
          firstName: { equals: firstName.trim(), mode: 'insensitive' },
          lastName: { equals: lastName.trim(), mode: 'insensitive' },
          phoneNumber: phoneNumber.trim(),
          dateOfBirth: parsedBirthDate,
        },
      });

      if (existing) {
        targetPatientId = existing.id;
      } else {
        isNewPatient = true;
        const safeName = firstName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'patient';
        const userEmail = `patient.${safeName}.${crypto.randomUUID()}@clinic.local`;
        const pwHash = await bcrypt.hash(crypto.randomBytes(32).toString('base64url'), 12);
        const newUser = await tx.user.create({
          data: { email: userEmail, password: pwHash, role: 'PATIENT' },
        });
        const newProfile = await tx.patientProfile.create({
          data: {
            mrn: await nextPatientMrn(tx),
            userId: newUser.id,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            phoneNumber: phoneNumber.trim(),
            dateOfBirth: parsedBirthDate,
            gender: gender?.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE',
            address: address || 'Brgy. Poblacion',
            city: city || 'Sta. Cruz',
            state: state || 'Laguna',
            zipCode: zipCode || '4009',
            emergencyContactName: emergencyContactName || `${firstName} Family`,
            emergencyContactPhone: emergencyContactPhone || phoneNumber,
            emergencyContactRelation: emergencyContactRelation || 'Contact Person',
            ...normalizePatientIdentity({ firstName, lastName, dateOfBirth: parsedBirthDate, phoneNumber, address: address || 'Brgy. Poblacion', city: city || 'Sta. Cruz', state: state || 'Laguna', zipCode: zipCode || '4009' }),
          },
        });
        targetPatientId = newProfile.id;
      }

      const adminUser = await tx.user.findFirst({ where: { role: 'ADMIN', isActive: true } });
      if (!adminUser) throw new Error('BOOKING_SYSTEM_USER_NOT_FOUND');

      const appointment = await tx.appointment.create({
        data: {
          patientId: targetPatientId,
          doctorId,
          createdById: adminUser.id,
          appointmentDate: requestedDate,
          duration: availability.rules.slotDuration,
          reasonForVisit: reasonForVisit || 'Outpatient Consultation',
          notes: notes ? `${notes} [Type: ${type || 'Online Booking'}]` : `[Type: ${type || 'Online Booking'}]`,
          status: AppointmentStatus.SCHEDULED,
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
          doctor: true,
        },
      });
      await tx.patientPrivacyConsent.create({ data: { patientId: targetPatientId, consentType: 'ONLINE_BOOKING_PRIVACY', policyVersion: '2026-10-06', source: 'PUBLIC_BOOKING', ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null, userAgent: req.headers.get('user-agent')?.slice(0, 500) || null, metadata: { appointmentId: appointment.id } } });
      await scheduleAppointmentReminders(tx, appointment.id, requestedDate, settings.appointmentReminderLeadHours);
      let claimCode: string | null = null;
      if (isNewPatient) {
        claimCode = newOpaqueToken();
        await tx.appointmentBookingClaim.create({ data: { appointmentId: appointment.id, patientId: targetPatientId, tokenHash: hashMobileToken(claimCode), expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) } });
      }
      return { appointment, claimCode };
    }, { isolationLevel: 'Serializable' });
    const created = result.appointment;

    // Notify Clinic Admin & OPD Reception
    const formattedDate = new Date(appointmentDate).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    await createAdminNotification({
      type: 'info',
      category: 'ONLINE_APPOINTMENT',
      title: 'Bagong Online Appointment Booking',
      message: `Si ${created.patient.firstName} ${created.patient.lastName} ay nag-book ng appointment kay Dr. ${created.doctor.firstName} ${created.doctor.lastName} para sa ${formattedDate}.`,
      staffName: `${created.patient.firstName} ${created.patient.lastName}`,
      staffRole: 'PATIENT',
      staffSpecialty: created.doctor.specialization,
      staffRoom: created.doctor.roomNumber || 'Room 101',
      metadata: {
        appointmentId: created.id,
        doctorId: created.doctorId,
        patientId: created.patientId,
        appointmentDate,
      },
    }).catch(err => console.error('Notification error:', err));

    await writeAuditLog({ actor: { role: 'PUBLIC' }, action: 'APPOINTMENT_CREATE', targetType: 'Appointment', targetId: created.id, summary: `Appointment created for patient ${created.patientId}.`, request: req, metadata: auditChanges(null, created) });

    return NextResponse.json({
      success: true,
      appointment: {
        id: created.id,
        appointmentNumber: `APT-${new Date(created.appointmentDate).getFullYear()}-${created.id.slice(-4).toUpperCase()}`,
        patientName: `${created.patient.firstName} ${created.patient.lastName}`,
        doctorName: `Dr. ${created.doctor.firstName} ${created.doctor.lastName}`,
        doctorSpecialty: created.doctor.specialization,
        roomNumber: created.doctor.roomNumber || 'Consultation Room 1',
        appointmentDate: created.appointmentDate,
        status: created.status,
      },
      accountClaim: result.claimCode ? { required: true, appointmentId: created.id, claimCode: result.claimCode, expiresInDays: 14 } : { required: false },
    });
  } catch (error: any) {
    console.error('Error in POST /api/appointments:', error);
    const code = error?.code;
    const message = error instanceof Error ? error.message : '';
    if (code === 'P2002' || message === 'BOOKING_SLOT_UNAVAILABLE' || code === 'P2034') {
      return NextResponse.json(
        { success: false, error: 'Hindi na available ang napiling oras. Pumili ng ibang slot.' },
        { status: 409 }
      );
    }
    if (message === 'BOOKING_SCHEDULE_NOT_CONFIGURED') {
      return NextResponse.json(
        { success: false, error: 'Wala pang booking schedule ang napiling doktor.' },
        { status: 409 }
      );
    }
    if (message === 'BOOKING_DOCTOR_NOT_FOUND') {
      return NextResponse.json({ success: false, error: 'Doctor not found.' }, { status: 404 });
    }
    if (
      code === 'P2024' ||
      message.includes('EMAXCONNSESSION') ||
      message.includes('max clients reached')
    ) {
      return NextResponse.json(
        { success: false, error: 'Pansamantalang puno ang koneksyon sa database. Pakisubukan ulit makalipas ang ilang segundo.' },
        { status: 503 }
      );
    }
    return NextResponse.json({ success: false, error: 'Failed to create appointment' }, { status: 500 });
  }
}
