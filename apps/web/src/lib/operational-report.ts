import { prisma } from '@clinic/db';
import { getClinicSettings } from '@/lib/clinic-settings';
import { reportRange, zonedDateKey } from '@/lib/clinic-time';

export async function buildOperationalReport(searchParams: URLSearchParams) {
  const settings = await getClinicSettings();
  const range = reportRange(searchParams, settings.timezone);
  const dateFilter = { gte: range.from, lte: range.to };
  const [appointments, tickets, records, prescriptions, registrations] = await Promise.all([
    prisma.appointment.findMany({ where: { appointmentDate: dateFilter }, select: { status: true, appointmentDate: true } }),
    prisma.queueTicket.findMany({ where: { createdAt: dateFilter }, select: { status: true, createdAt: true, calledAt: true, startedAt: true, completedAt: true } }),
    prisma.medicalRecord.findMany({ where: { visitDate: dateFilter }, select: { visitDate: true, assessment: true } }),
    prisma.prescription.count({ where: { prescribedDate: dateFilter } }),
    prisma.patientProfile.count({ where: { createdAt: dateFilter } }),
  ]);
  const counts = (values: string[]) => values.reduce<Record<string, number>>((map, value) => ({ ...map, [value]: (map[value] || 0) + 1 }), {});
  const waits = tickets.filter((ticket) => ticket.calledAt).map((ticket) => Math.max(0, Math.round((ticket.calledAt!.getTime() - ticket.createdAt.getTime()) / 60000)));
  const consultations = tickets.filter((ticket) => ticket.startedAt && ticket.completedAt).map((ticket) => Math.max(0, Math.round((ticket.completedAt!.getTime() - ticket.startedAt!.getTime()) / 60000)));
  const daily = new Map<string, { date: string; appointments: number; queueTickets: number; encounters: number }>();
  const day = (date: Date) => {
    const key = zonedDateKey(date, settings.timezone);
    if (!daily.has(key)) daily.set(key, { date: key, appointments: 0, queueTickets: 0, encounters: 0 });
    return daily.get(key)!;
  };
  appointments.forEach((item) => day(item.appointmentDate).appointments++);
  tickets.forEach((item) => day(item.createdAt).queueTickets++);
  records.forEach((item) => day(item.visitDate).encounters++);
  return {
    clinicName: settings.clinicName,
    timezone: settings.timezone,
    range: { from: range.fromKey, to: range.toKey },
    summary: {
      appointments: appointments.length,
      queueTickets: tickets.length,
      completedConsultations: tickets.filter((ticket) => ticket.status === 'COMPLETED').length,
      medicalRecords: records.length,
      prescriptions,
      newPatients: registrations,
      averageWaitMinutes: waits.length ? Math.round(waits.reduce((sum, value) => sum + value, 0) / waits.length) : 0,
      averageConsultationMinutes: consultations.length ? Math.round(consultations.reduce((sum, value) => sum + value, 0) / consultations.length) : 0,
    },
    appointmentStatuses: counts(appointments.map((item) => item.status)),
    queueStatuses: counts(tickets.map((item) => item.status)),
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
