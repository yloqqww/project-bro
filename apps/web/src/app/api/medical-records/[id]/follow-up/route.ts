import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { getDoctorAvailability } from '@/lib/schedule-service';
import { clinicDateKey, requestedSlotMatches } from '@/lib/scheduling';
import { getClinicSettings } from '@/lib/clinic-settings';
import { scheduleAppointmentReminders } from '@/lib/appointment-lifecycle';
import { writeAuditLog } from '@/lib/audit';

type RouteContext = { params: Promise<{ id: string }> };
const schema = z.object({ appointmentDate: z.string().datetime(), reasonForVisit: z.string().trim().min(3).max(500).optional(), notes: z.string().trim().max(1000).optional() });

export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorizeApi(ACCESS.medicalRecordWrite);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'A valid follow-up schedule is required.' }, { status: 400 });
  const { id } = await params;
  const record = await prisma.medicalRecord.findFirst({ where: { id, doctorId: auth.user.id, status: 'FINALIZED', archivedAt: null }, include: { doctor: { include: { doctorProfile: true } } } });
  if (!record?.doctor.doctorProfile) return NextResponse.json({ success: false, error: 'Finalized medical record or doctor profile not found.' }, { status: 404 });
  const requestedDate = new Date(parsed.data.appointmentDate);
  const settings = await getClinicSettings();
  try {
    const appointment = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${record.doctor.doctorProfile!.id}))`;
      const availability = await getDoctorAvailability(record.doctor.doctorProfile!.id, clinicDateKey(requestedDate), tx);
      if (!availability.found || !availability.configured || !requestedSlotMatches(availability.slots, requestedDate)) throw new Error('SLOT_UNAVAILABLE');
      const created = await tx.appointment.create({ data: { patientId: record.patientId, doctorId: record.doctor.doctorProfile!.id, createdById: auth.user.id, appointmentDate: requestedDate, duration: availability.rules.slotDuration, reasonForVisit: parsed.data.reasonForVisit || `Follow-up: ${record.assessment.slice(0, 180)}`, notes: parsed.data.notes || record.followUpNotes || 'Scheduled from finalized consultation record.', status: 'SCHEDULED', followUpFromRecordId: record.id } });
      await scheduleAppointmentReminders(tx, created.id, requestedDate, settings.appointmentReminderLeadHours);
      return created;
    }, { isolationLevel: 'Serializable' });
    await writeAuditLog({ actor: auth.user, action: 'FOLLOW_UP_APPOINTMENT_CREATE', targetType: 'Appointment', targetId: appointment.id, summary: 'Doctor scheduled a follow-up from a finalized consultation.', request: req, metadata: { medicalRecordId: record.id, patientId: record.patientId, appointmentDate: requestedDate } });
    return NextResponse.json({ success: true, appointment }, { status: 201 });
  } catch (error: any) {
    if (error?.message === 'SLOT_UNAVAILABLE' || error?.code === 'P2002' || error?.code === 'P2034') return NextResponse.json({ success: false, error: 'That follow-up slot is no longer available.' }, { status: 409 });
    console.error('Follow-up scheduling failed:', error);
    return NextResponse.json({ success: false, error: 'Unable to schedule the follow-up.' }, { status: 500 });
  }
}
