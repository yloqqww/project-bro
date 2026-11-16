import { prisma } from '@clinic/db';
import { getClinicSettings } from '@/lib/clinic-settings';

export type AppointmentChangePolicy = {
  allowed: boolean;
  noticeHours: number;
  hoursUntilAppointment: number;
  code: 'ALLOWED' | 'NOTICE_PERIOD_VIOLATION' | 'APPOINTMENT_STARTED';
};

export function evaluatePatientChangePolicy(appointmentDate: Date, now: Date, noticeHours: number): AppointmentChangePolicy {
  const hoursUntilAppointment = (appointmentDate.getTime() - now.getTime()) / 3_600_000;
  if (hoursUntilAppointment <= 0) return { allowed: false, noticeHours, hoursUntilAppointment, code: 'APPOINTMENT_STARTED' };
  if (hoursUntilAppointment < noticeHours) return { allowed: false, noticeHours, hoursUntilAppointment, code: 'NOTICE_PERIOD_VIOLATION' };
  return { allowed: true, noticeHours, hoursUntilAppointment, code: 'ALLOWED' };
}

export async function scheduleAppointmentReminders(
  database: any,
  appointmentId: string,
  appointmentDate: Date,
  leadHours: number[],
) {
  const now = new Date();
  const rows = leadHours
    .map((hours) => ({
      appointmentId,
      reminderType: `${hours}_HOURS_BEFORE`,
      scheduledFor: new Date(appointmentDate.getTime() - hours * 3_600_000),
      deliveryChannel: 'PUSH',
      dedupeKey: `${appointmentId}:${hours}_HOURS_BEFORE`,
    }))
    .filter((row) => row.scheduledFor > now);
  if (!rows.length) return 0;
  const result = await database.appointmentReminder.createMany({ data: rows, skipDuplicates: true });
  return result.count;
}

export async function cancelAppointmentReminders(database: any, appointmentId: string) {
  return database.appointmentReminder.updateMany({
    where: { appointmentId, status: { in: ['PENDING', 'FAILED'] } },
    data: { status: 'CANCELLED' },
  });
}

export async function offerNextWaitlistEntry(database: any, doctorId: string, appointmentDate: Date) {
  const start = new Date(appointmentDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const next = await database.appointmentWaitlistEntry.findFirst({
    where: { doctorId, requestedDate: { gte: start, lt: end }, status: 'WAITING' },
    orderBy: { createdAt: 'asc' },
  });
  if (!next) return null;
  const now = new Date();
  return database.appointmentWaitlistEntry.update({
    where: { id: next.id },
    data: {
      status: 'OFFERED',
      offeredAt: now,
      offerExpiresAt: new Date(now.getTime() + 6 * 3_600_000),
      offeredSlot: appointmentDate,
    },
  });
}

type ReminderDelivery = (reminder: any) => Promise<void>;

export async function runAppointmentAutomation(now = new Date(), database: any = prisma, deliver?: ReminderDelivery) {
  const settings = await getClinicSettings(database);
  const expiredOffers = await database.appointmentWaitlistEntry.findMany({
    where: { status: 'OFFERED', offerExpiresAt: { lt: now }, offeredSlot: { not: null } },
    select: { id: true, doctorId: true, offeredSlot: true },
    take: 100,
  });
  let expiredWaitlistOffers = 0;
  for (const offer of expiredOffers) {
    await database.$transaction(async (tx: any) => {
      await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${offer.doctorId}))`;
      const expired = await tx.appointmentWaitlistEntry.updateMany({
        where: { id: offer.id, status: 'OFFERED', offerExpiresAt: { lt: now } },
        data: { status: 'EXPIRED' },
      });
      if (!expired.count || !offer.offeredSlot) return;
      expiredWaitlistOffers += expired.count;
      await offerNextWaitlistEntry(tx, offer.doctorId, offer.offeredSlot);
    });
  }

  const possibleNoShows = await database.appointment.findMany({
    where: {
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      appointmentDate: { lt: now },
      checkedInAt: null,
    },
    select: { id: true, appointmentDate: true, duration: true },
    take: 500,
  });
  const noShowCandidates = possibleNoShows.filter((item: any) => new Date(item.appointmentDate).getTime() + (item.duration + settings.appointmentNoShowGraceMinutes) * 60_000 < now.getTime());
  if (noShowCandidates.length) {
    await database.appointment.updateMany({
      where: { id: { in: noShowCandidates.map((item: any) => item.id) }, status: { in: ['SCHEDULED', 'CONFIRMED'] }, checkedInAt: null },
      data: { status: 'NO_SHOW', noShowMarkedAt: now, noShowMarkedBy: 'AUTOMATION' },
    });
    await database.appointmentReminder.updateMany({
      where: { appointmentId: { in: noShowCandidates.map((item: any) => item.id) }, status: { in: ['PENDING', 'FAILED'] } },
      data: { status: 'CANCELLED' },
    });
  }

  const dueReminders = await database.appointmentReminder.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      scheduledFor: { lte: now },
      appointment: { status: { in: ['SCHEDULED', 'CONFIRMED'] } },
    },
    include: {
      appointment: {
        include: {
          doctor: true,
          patient: { include: { user: { include: { patientPushDevices: { where: { enabled: true } } } } } },
        },
      },
    },
    orderBy: { scheduledFor: 'asc' },
    take: 100,
  });

  let sent = 0;
  let failed = 0;
  for (const reminder of dueReminders) {
    try {
      if (deliver) await deliver(reminder);
      await database.appointmentReminder.update({ where: { id: reminder.id }, data: { status: 'SENT', sentAt: now, lastError: null } });
      sent += 1;
    } catch (error) {
      await database.appointmentReminder.update({
        where: { id: reminder.id },
        data: { status: 'FAILED', lastError: error instanceof Error ? error.message.slice(0, 500) : 'Reminder delivery failed.' },
      });
      failed += 1;
    }
  }

  return { expiredWaitlistOffers, noShowsMarked: noShowCandidates.length, remindersSent: sent, remindersFailed: failed };
}
