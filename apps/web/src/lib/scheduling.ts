export const CLINIC_TIMEZONE = 'Asia/Manila';
export const CLINIC_UTC_OFFSET = '+08:00';
export const CLINIC_LUNCH_BREAK_START = '12:00';
export const CLINIC_LUNCH_BREAK_END = '13:00';

export type WeeklyAvailability = {
  dayOfWeek: number;
  enabled: boolean;
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
};

export type ScheduleException = {
  type: 'LEAVE' | 'HOLIDAY' | 'UNAVAILABLE';
  startTime?: string | null;
  endTime?: string | null;
  reason?: string | null;
};

export type BusyAppointment = {
  appointmentDate: Date | string;
  duration: number;
};

export type AvailableSlot = {
  start: string;
  end: string;
  label: string;
};

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function minutesFromTime(value: string) {
  const match = TIME_RE.exec(value);
  if (!match) throw new Error(`Invalid time: ${value}`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export function clinicDateTime(date: string, time: string) {
  minutesFromTime(time);
  return new Date(`${date}T${time}:00${CLINIC_UTC_OFFSET}`);
}

export function clinicDayOfWeek(date: string) {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day) throw new Error('Invalid date.');
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function clinicDateKey(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
}

export function formatSlotLabel(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: CLINIC_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

export function validateWeeklyAvailability(days: WeeklyAvailability[]) {
  if (days.length !== 7 || new Set(days.map((day) => day.dayOfWeek)).size !== 7) {
    throw new Error('A complete seven-day schedule is required.');
  }

  for (const day of days) {
    if (!Number.isInteger(day.dayOfWeek) || day.dayOfWeek < 0 || day.dayOfWeek > 6) {
      throw new Error('Invalid day of week.');
    }
    if (!day.enabled) continue;
    const start = minutesFromTime(day.startTime);
    const end = minutesFromTime(day.endTime);
    if (start >= end) throw new Error('Working hours must end after they start.');
    if (day.breakStart || day.breakEnd) {
      if (!day.breakStart || !day.breakEnd) throw new Error('Both break times are required.');
      const breakStart = minutesFromTime(day.breakStart);
      const breakEnd = minutesFromTime(day.breakEnd);
      if (breakStart >= breakEnd || breakStart < start || breakEnd > end) {
        throw new Error('Break time must be within working hours.');
      }
    }
  }
}

function overlaps(startA: number, endA: number, startB: number, endB: number) {
  return startA < endB && endA > startB;
}

export function generateAvailableSlots(input: {
  date: string;
  weeklyAvailability: WeeklyAvailability[];
  exceptions: ScheduleException[];
  appointments: BusyAppointment[];
  slotDuration: number;
  bufferMinutes: number;
  maxPatientsPerDay: number;
  now?: Date;
}) {
  const {
    date,
    weeklyAvailability,
    exceptions,
    appointments,
    slotDuration,
    bufferMinutes,
    maxPatientsPerDay,
    now = new Date(),
  } = input;

  if (slotDuration < 5 || slotDuration > 240) throw new Error('Invalid slot duration.');
  if (bufferMinutes < 0 || bufferMinutes > 120) throw new Error('Invalid buffer time.');
  if (maxPatientsPerDay < 1) return [];
  if (appointments.length >= maxPatientsPerDay) return [];

  const day = weeklyAvailability.find((item) => item.dayOfWeek === clinicDayOfWeek(date));
  if (!day?.enabled) return [];

  const wholeDayException = exceptions.some((item) => !item.startTime && !item.endTime);
  if (wholeDayException) return [];

  const dayStart = minutesFromTime(day.startTime);
  const dayEnd = minutesFromTime(day.endTime);
  // Clinic-wide lunch is mandatory. Keeping this in the slot engine means
  // legacy schedules with blank/incorrect break fields cannot expose noon slots.
  const breakStart = minutesFromTime(CLINIC_LUNCH_BREAK_START);
  const breakEnd = minutesFromTime(CLINIC_LUNCH_BREAK_END);
  const step = slotDuration + bufferMinutes;
  const slots: AvailableSlot[] = [];

  for (let startMinute = dayStart; startMinute + slotDuration <= dayEnd; startMinute += step) {
    const endMinute = startMinute + slotDuration;
    if (overlaps(startMinute, endMinute, breakStart, breakEnd)) {
      continue;
    }

    const exceptionConflict = exceptions.some((item) => {
      if (!item.startTime || !item.endTime) return true;
      return overlaps(startMinute, endMinute, minutesFromTime(item.startTime), minutesFromTime(item.endTime));
    });
    if (exceptionConflict) continue;

    const hh = String(Math.floor(startMinute / 60)).padStart(2, '0');
    const mm = String(startMinute % 60).padStart(2, '0');
    const slotStart = clinicDateTime(date, `${hh}:${mm}`);
    const slotEnd = new Date(slotStart.getTime() + slotDuration * 60_000);
    if (slotStart.getTime() <= now.getTime()) continue;

    const appointmentConflict = appointments.some((appointment) => {
      const busyStart = new Date(appointment.appointmentDate).getTime();
      const busyEnd = busyStart + appointment.duration * 60_000;
      const buffer = bufferMinutes * 60_000;
      return slotStart.getTime() < busyEnd + buffer && slotEnd.getTime() + buffer > busyStart;
    });
    if (appointmentConflict) continue;

    slots.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      label: formatSlotLabel(slotStart),
    });
    if (slots.length + appointments.length >= maxPatientsPerDay) break;
  }

  return slots;
}

export function requestedSlotMatches(availableSlots: AvailableSlot[], requestedDate: Date) {
  return availableSlots.some((slot) => new Date(slot.start).getTime() === requestedDate.getTime());
}
