import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { authorizeMobilePatient } from '@/lib/mobile-auth';
import { getDoctorAvailability } from '@/lib/schedule-service';
import { clinicDateKey, requestedSlotMatches } from '@/lib/scheduling';
import { getClinicSettings } from '@/lib/clinic-settings';
import { offerNextWaitlistEntry, scheduleAppointmentReminders } from '@/lib/appointment-lifecycle';
import { writeAuditLog } from '@/lib/audit';

const createSchema = z.object({ doctorId: z.string().min(1), requestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reasonForVisit: z.string().trim().min(3).max(500), notes: z.string().trim().max(1000).optional() });
const changeSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ACCEPT'), waitlistId: z.string().min(1) }),
  z.object({ action: z.literal('CANCEL'), waitlistId: z.string().min(1) }),
]);

export async function GET(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  const entries = await prisma.appointmentWaitlistEntry.findMany({ where: { patientId: auth.patient.patientId }, include: { doctor: true, bookedAppointment: true }, orderBy: { createdAt: 'desc' }, take: 100 });
  return NextResponse.json({ success: true, entries });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Doctor, requested date, and reason are required.' }, { status: 400 });
  try {
    const entry = await prisma.appointmentWaitlistEntry.create({ data: { patientId: auth.patient.patientId, doctorId: parsed.data.doctorId, requestedDate: new Date(`${parsed.data.requestedDate}T00:00:00.000Z`), reasonForVisit: parsed.data.reasonForVisit, notes: parsed.data.notes || null } });
    await writeAuditLog({ actor: { id: auth.patient.userId, email: auth.patient.email, role: 'PATIENT' }, action: 'WAITLIST_JOIN', targetType: 'AppointmentWaitlistEntry', targetId: entry.id, summary: 'Patient joined an appointment waitlist.', request: req, metadata: { doctorId: entry.doctorId, requestedDate: entry.requestedDate } });
    return NextResponse.json({ success: true, entry }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') return NextResponse.json({ success: false, error: 'You already have an active waitlist request for that doctor and date.' }, { status: 409 });
    console.error('Waitlist join failed:', error);
    return NextResponse.json({ success: false, error: 'Unable to join the waitlist.' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  const parsed = changeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid waitlist request.' }, { status: 400 });
  const entry = await prisma.appointmentWaitlistEntry.findFirst({ where: { id: parsed.data.waitlistId, patientId: auth.patient.patientId } });
  if (!entry) return NextResponse.json({ success: false, error: 'Waitlist entry not found.' }, { status: 404 });

  if (parsed.data.action === 'CANCEL') {
    if (!['WAITING', 'OFFERED'].includes(entry.status)) return NextResponse.json({ success: false, error: 'This waitlist entry can no longer be cancelled.' }, { status: 409 });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${entry.doctorId}))`;
      const current = await tx.appointmentWaitlistEntry.findFirst({ where: { id: entry.id, patientId: auth.patient.patientId, status: { in: ['WAITING', 'OFFERED'] } } });
      if (!current) return null;
      const cancelled = await tx.appointmentWaitlistEntry.update({ where: { id: current.id }, data: { status: 'CANCELLED' } });
      if (current.status === 'OFFERED' && current.offeredSlot) await offerNextWaitlistEntry(tx, current.doctorId, current.offeredSlot);
      return cancelled;
    });
    if (!updated) return NextResponse.json({ success: false, error: 'This waitlist entry was already changed. Refresh and try again.' }, { status: 409 });
    await writeAuditLog({ actor: { id: auth.patient.userId, email: auth.patient.email, role: 'PATIENT' }, action: 'WAITLIST_CANCEL', targetType: 'AppointmentWaitlistEntry', targetId: entry.id, summary: 'Patient left an appointment waitlist.', request: req });
    return NextResponse.json({ success: true, entry: updated });
  }

  if (entry.status !== 'OFFERED' || !entry.offeredSlot || !entry.offerExpiresAt || entry.offerExpiresAt <= new Date()) return NextResponse.json({ success: false, error: 'This waitlist offer has expired or is unavailable.' }, { status: 409 });
  const settings = await getClinicSettings();
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${entry.doctorId}))`;
      const current = await tx.appointmentWaitlistEntry.findFirst({ where: { id: entry.id, patientId: auth.patient.patientId, status: 'OFFERED', offerExpiresAt: { gt: new Date() } } });
      if (!current?.offeredSlot) throw new Error('OFFER_EXPIRED');
      const availability = await getDoctorAvailability(current.doctorId, clinicDateKey(current.offeredSlot), tx);
      if (!availability.found || !availability.configured || !requestedSlotMatches(availability.slots, current.offeredSlot)) throw new Error('SLOT_UNAVAILABLE');
      const appointment = await tx.appointment.create({ data: { patientId: current.patientId, doctorId: current.doctorId, createdById: auth.patient.userId, appointmentDate: current.offeredSlot, duration: availability.rules.slotDuration, reasonForVisit: current.reasonForVisit, notes: current.notes, status: 'SCHEDULED' } });
      await scheduleAppointmentReminders(tx, appointment.id, appointment.appointmentDate, settings.appointmentReminderLeadHours);
      const updated = await tx.appointmentWaitlistEntry.update({ where: { id: current.id }, data: { status: 'BOOKED', bookedAppointmentId: appointment.id } });
      return { appointment, entry: updated };
    }, { isolationLevel: 'Serializable' });
    await writeAuditLog({ actor: { id: auth.patient.userId, email: auth.patient.email, role: 'PATIENT' }, action: 'WAITLIST_ACCEPT', targetType: 'AppointmentWaitlistEntry', targetId: entry.id, summary: 'Patient accepted a waitlist slot.', request: req, metadata: { appointmentId: result.appointment.id } });
    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    if (['OFFER_EXPIRED', 'SLOT_UNAVAILABLE'].includes(error?.message) || error?.code === 'P2002' || error?.code === 'P2034') return NextResponse.json({ success: false, error: 'That waitlist slot is no longer available.' }, { status: 409 });
    console.error('Waitlist acceptance failed:', error);
    return NextResponse.json({ success: false, error: 'Unable to accept the waitlist offer.' }, { status: 500 });
  }
}
