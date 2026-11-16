import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { authorizeMobilePatient } from '@/lib/mobile-auth';
import { getDoctorAvailability } from '@/lib/schedule-service';
import { clinicDateKey, requestedSlotMatches } from '@/lib/scheduling';
import { getClinicSettings } from '@/lib/clinic-settings';
import { cancelAppointmentReminders, evaluatePatientChangePolicy, offerNextWaitlistEntry, scheduleAppointmentReminders } from '@/lib/appointment-lifecycle';
import { auditChanges, writeAuditLog } from '@/lib/audit';

const createSchema = z.object({ doctorId: z.string().min(1), appointmentDate: z.string().datetime(), reasonForVisit: z.string().trim().min(3).max(500), notes: z.string().trim().max(1000).optional() });
const changeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('CONFIRM'), appointmentId: z.string().min(1) }),
  z.object({ action: z.literal('CANCEL'), appointmentId: z.string().min(1), reason: z.string().trim().min(3).max(300) }),
  z.object({ action: z.literal('RESCHEDULE'), appointmentId: z.string().min(1), appointmentDate: z.string().datetime(), reason: z.string().trim().min(3).max(300) }),
]);

function formatAppointment(item: any, noticeHours: number) {
  return {
    id: item.id, appointmentDate: item.appointmentDate, duration: item.duration, status: item.status,
    reasonForVisit: item.reasonForVisit, notes: item.notes, patientConfirmedAt: item.patientConfirmedAt,
    cancellationReason: item.cancellationReason, cancelledByRole: item.cancelledByRole,
    rescheduledFromId: item.rescheduledFromId, rescheduledToId: item.rescheduledTo?.id || null,
    followUpFromRecordId: item.followUpFromRecordId,
    changePolicy: evaluatePatientChangePolicy(new Date(item.appointmentDate), new Date(), noticeHours),
    reminders: item.reminders || [],
    doctor: { id: item.doctor.id, name: `Dr. ${item.doctor.firstName} ${item.doctor.lastName}`, specialization: item.doctor.specialization, roomNumber: item.doctor.roomNumber },
  };
}

export async function GET(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  const [appointments, settings] = await Promise.all([
    prisma.appointment.findMany({ where: { patientId: auth.patient.patientId }, include: { doctor: true, rescheduledTo: { select: { id: true } }, reminders: { orderBy: { scheduledFor: 'asc' } } }, orderBy: { appointmentDate: 'desc' }, take: 100 }),
    getClinicSettings(),
  ]);
  const now = new Date();
  const format = (item: any) => formatAppointment(item, settings.appointmentCancellationNoticeHours);
  return NextResponse.json({ success: true, policy: { cancellationNoticeHours: settings.appointmentCancellationNoticeHours, reminderLeadHours: settings.appointmentReminderLeadHours }, upcoming: appointments.filter((item) => item.appointmentDate >= now && !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(item.status)).map(format), history: appointments.filter((item) => item.appointmentDate < now || ['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(item.status)).map(format) });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Doctor, valid schedule, and reason for visit are required.' }, { status: 400 });
  const requestedDate = new Date(parsed.data.appointmentDate);
  const settings = await getClinicSettings();
  try {
    const created = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${parsed.data.doctorId}))`;
      const availability = await getDoctorAvailability(parsed.data.doctorId, clinicDateKey(requestedDate), tx);
      if (!availability.found || !availability.configured || !requestedSlotMatches(availability.slots, requestedDate)) throw new Error('SLOT_UNAVAILABLE');
      const appointment = await tx.appointment.create({ data: { patientId: auth.patient.patientId, doctorId: parsed.data.doctorId, createdById: auth.patient.userId, appointmentDate: requestedDate, duration: availability.rules.slotDuration, reasonForVisit: parsed.data.reasonForVisit, notes: parsed.data.notes || null, status: 'SCHEDULED' }, include: { doctor: true } });
      await scheduleAppointmentReminders(tx, appointment.id, requestedDate, settings.appointmentReminderLeadHours);
      return appointment;
    }, { isolationLevel: 'Serializable' });
    await writeAuditLog({ actor: { id: auth.patient.userId, email: auth.patient.email, role: 'PATIENT' }, action: 'MOBILE_APPOINTMENT_CREATE', targetType: 'Appointment', targetId: created.id, summary: 'Patient booked an appointment in the mobile app.', request: req, metadata: auditChanges(null, created) });
    return NextResponse.json({ success: true, appointment: formatAppointment(created, settings.appointmentCancellationNoticeHours) }, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'SLOT_UNAVAILABLE' || error?.code === 'P2002' || error?.code === 'P2034') return NextResponse.json({ success: false, error: 'That appointment slot is no longer available.' }, { status: 409 });
    console.error('Mobile appointment booking failed:', error);
    return NextResponse.json({ success: false, error: 'Unable to book the appointment.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  const parsed = changeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid appointment change request.' }, { status: 400 });
  const [before, settings] = await Promise.all([
    prisma.appointment.findFirst({ where: { id: parsed.data.appointmentId, patientId: auth.patient.patientId }, include: { doctor: true } }),
    getClinicSettings(),
  ]);
  if (!before) return NextResponse.json({ success: false, error: 'Appointment not found.' }, { status: 404 });
  if (!['SCHEDULED', 'CONFIRMED'].includes(before.status) || before.appointmentDate <= new Date()) return NextResponse.json({ success: false, error: 'Only future scheduled or confirmed appointments can be changed.' }, { status: 409 });

  if (parsed.data.action === 'CONFIRM') {
    if (before.patientConfirmedAt) return NextResponse.json({ success: true, appointment: formatAppointment(before, settings.appointmentCancellationNoticeHours) });
    const updated = await prisma.appointment.update({ where: { id: before.id }, data: { status: 'CONFIRMED', patientConfirmedAt: new Date(), patientConfirmationSource: 'MOBILE_APP' }, include: { doctor: true } });
    await writeAuditLog({ actor: { id: auth.patient.userId, email: auth.patient.email, role: 'PATIENT' }, action: 'MOBILE_APPOINTMENT_CONFIRM', targetType: 'Appointment', targetId: before.id, summary: 'Patient confirmed attendance.', request: req, metadata: auditChanges(before, updated) });
    return NextResponse.json({ success: true, appointment: formatAppointment(updated, settings.appointmentCancellationNoticeHours) });
  }

  const policy = evaluatePatientChangePolicy(before.appointmentDate, new Date(), settings.appointmentCancellationNoticeHours);
  if (!policy.allowed) return NextResponse.json({ success: false, code: policy.code, error: `Online changes close ${policy.noticeHours} hours before the appointment. Please contact the clinic.`, policy }, { status: 409 });
  const change = parsed.data as Exclude<typeof parsed.data, { action: 'CONFIRM' }>;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${before.doctorId}))`;
      const current = await tx.appointment.findFirst({ where: { id: before.id, patientId: auth.patient.patientId, status: { in: ['SCHEDULED', 'CONFIRMED'] } }, include: { doctor: true } });
      if (!current) throw new Error('STALE_APPOINTMENT');
      await cancelAppointmentReminders(tx, current.id);
      if (change.action === 'CANCEL') {
        const cancelled = await tx.appointment.update({ where: { id: current.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: change.reason, cancelledByRole: 'PATIENT', cancellationPolicyResult: policy.code }, include: { doctor: true } });
        await offerNextWaitlistEntry(tx, current.doctorId, current.appointmentDate);
        return cancelled;
      }
      const requestedDate = new Date(change.appointmentDate);
      const availability = await getDoctorAvailability(current.doctorId, clinicDateKey(requestedDate), tx);
      if (!availability.found || !availability.configured || !requestedSlotMatches(availability.slots, requestedDate)) throw new Error('SLOT_UNAVAILABLE');
      const replacement = await tx.appointment.create({ data: { patientId: current.patientId, doctorId: current.doctorId, createdById: auth.patient.userId, appointmentDate: requestedDate, duration: availability.rules.slotDuration, reasonForVisit: current.reasonForVisit, notes: current.notes, status: 'SCHEDULED', rescheduledFromId: current.id }, include: { doctor: true } });
      await tx.appointment.update({ where: { id: current.id }, data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: `Rescheduled by patient: ${change.reason}`, cancelledByRole: 'PATIENT', cancellationPolicyResult: policy.code } });
      await scheduleAppointmentReminders(tx, replacement.id, requestedDate, settings.appointmentReminderLeadHours);
      await offerNextWaitlistEntry(tx, current.doctorId, current.appointmentDate);
      return replacement;
    }, { isolationLevel: 'Serializable' });
    await writeAuditLog({ actor: { id: auth.patient.userId, email: auth.patient.email, role: 'PATIENT' }, action: change.action === 'CANCEL' ? 'MOBILE_APPOINTMENT_CANCEL' : 'MOBILE_APPOINTMENT_RESCHEDULE', targetType: 'Appointment', targetId: before.id, summary: `Patient ${change.action === 'CANCEL' ? 'cancelled' : 'rescheduled'} an appointment.`, request: req, metadata: { ...auditChanges(before, updated), policy } });
    return NextResponse.json({ success: true, appointment: formatAppointment(updated, settings.appointmentCancellationNoticeHours) });
  } catch (error: any) {
    if (error?.message === 'SLOT_UNAVAILABLE' || error?.code === 'P2002' || error?.code === 'P2034') return NextResponse.json({ success: false, error: 'That reschedule slot is no longer available.' }, { status: 409 });
    if (error?.message === 'STALE_APPOINTMENT') return NextResponse.json({ success: false, error: 'This appointment was already changed. Refresh and try again.' }, { status: 409 });
    console.error('Mobile appointment change failed:', error);
    return NextResponse.json({ success: false, error: 'Unable to change the appointment.' }, { status: 500 });
  }
}
