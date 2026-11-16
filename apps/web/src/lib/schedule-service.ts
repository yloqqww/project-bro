import { AppointmentStatus, prisma } from '@clinic/db';
import { generateAvailableSlots } from '@/lib/scheduling';
import { getClinicSettings } from '@/lib/clinic-settings';

const ACTIVE_APPOINTMENT_STATUSES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
];

export function clinicDayBounds(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date must use YYYY-MM-DD.');
  const start = new Date(`${date}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  if (Number.isNaN(start.getTime())) throw new Error('Invalid date.');
  return { start, end };
}

export async function getDoctorAvailability(
  doctorId: string,
  date: string,
  database: any = prisma,
) {
  const settings = await getClinicSettings(database);
  const { start, end } = clinicDayBounds(date);
  const requestedStart = start.getTime();
  const earliest = Date.now() + settings.appointmentLeadTimeHours * 60 * 60 * 1000;
  const horizon = Date.now() + settings.bookingHorizonDays * 24 * 60 * 60 * 1000;
  const requestedDay = new Date(`${date}T00:00:00Z`).getUTCDay();
  const globallyClosed = !settings.operatingDays.includes(requestedDay) || settings.holidayDates.includes(date);
  const outsideBookingWindow = requestedStart > horizon || end.getTime() < earliest;
  const [doctor, appointments, exceptions] = await Promise.all([
    database.doctorProfile.findFirst({
      where: { id: doctorId, isActive: true, user: { isActive: true } },
      include: {
        schedule: {
          include: { weeklyAvailability: { orderBy: { dayOfWeek: 'asc' } } },
        },
      },
    }),
    database.appointment.findMany({
      where: {
        doctorId,
        appointmentDate: { gte: start, lt: end },
        status: { in: ACTIVE_APPOINTMENT_STATUSES },
      },
      select: { appointmentDate: true, duration: true },
      orderBy: { appointmentDate: 'asc' },
    }),
    database.doctorScheduleException.findMany({
      where: { doctorId, date: new Date(`${date}T00:00:00.000Z`) },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!doctor) return { found: false as const, configured: false as const, slots: [] };
  if (!doctor.schedule) {
    return {
      found: true as const,
      configured: false as const,
      doctor: {
        id: doctor.id,
        name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
        specialization: doctor.specialization,
      },
      slots: [],
    };
  }

  const schedule = doctor.schedule;
  const slots = globallyClosed || outsideBookingWindow ? [] : generateAvailableSlots({
    date,
    weeklyAvailability: schedule.weeklyAvailability,
    exceptions,
    appointments,
    slotDuration: schedule.slotDuration,
    bufferMinutes: schedule.bufferMinutes,
    maxPatientsPerDay: schedule.maxPatientsPerDay,
  }).filter((slot) => new Date(slot.start).getTime() >= earliest);

  return {
    found: true as const,
    configured: true as const,
    doctor: {
      id: doctor.id,
      name: `Dr. ${doctor.firstName} ${doctor.lastName}`,
      specialization: doctor.specialization,
    },
    rules: {
      slotDuration: schedule.slotDuration,
      bufferMinutes: schedule.bufferMinutes,
      maxPatientsPerDay: schedule.maxPatientsPerDay,
      timezone: schedule.timezone,
      operatingDays: settings.operatingDays,
      appointmentLeadTimeHours: settings.appointmentLeadTimeHours,
      bookingHorizonDays: settings.bookingHorizonDays,
    },
    closureReason: globallyClosed ? 'CLINIC_CLOSED' : outsideBookingWindow ? 'OUTSIDE_BOOKING_WINDOW' : null,
    exceptions: exceptions.map((exception: any) => ({
      id: exception.id,
      type: exception.type,
      startTime: exception.startTime,
      endTime: exception.endTime,
      reason: exception.reason,
    })),
    bookedCount: appointments.length,
    slots,
  };
}

export { ACTIVE_APPOINTMENT_STATUSES };
