import { prisma } from '@clinic/db';

export type QueuePrefixSetting = {
  id: string;
  department: string;
  prefix: string;
};

export type ClinicSettingsValue = {
  id: string;
  clinicName: string;
  shortName: string;
  hotline: string;
  address: string;
  emergencyNotice: string;
  queueResetTime: string;
  queuePrefixes: QueuePrefixSetting[];
  timezone: string;
  operatingDays: number[];
  holidayDates: string[];
  appointmentLeadTimeHours: number;
  bookingHorizonDays: number;
  appointmentCancellationNoticeHours: number;
  appointmentNoShowGraceMinutes: number;
  appointmentReminderLeadHours: number[];
  triagePriorityRules: TriagePriorityRules;
  notificationRetentionDays: number;
  clinicalRecordRetentionYears: number;
  auditRetentionYears: number;
  updatedAt?: Date | string;
};

export type TriagePriorityRules = {
  resuscitation: { painScore: number; oxygenSaturationBelow: number };
  urgent: { painScore: number; temperatureAtLeast: number; systolicAtLeast: number };
  priority: { seniorAge: number; painScore: number };
};

export const DEFAULT_QUEUE_PREFIXES: QueuePrefixSetting[] = [
  { id: 'general', department: 'General', prefix: 'A' },
  { id: 'cardiology', department: 'Cardiology', prefix: 'C' },
  { id: 'pediatrics', department: 'Pediatrics', prefix: 'P' },
  { id: 'priority', department: 'Senior/PWD Priority', prefix: 'PRIO' },
];

export const DEFAULT_CLINIC_SETTINGS: ClinicSettingsValue = {
  id: 'default',
  clinicName: 'Laguna Medical Center',
  shortName: 'LMC',
  hotline: '(049) 545-8888',
  address: 'Santa Cruz, Laguna, Philippines',
  emergencyNotice: 'For emergencies, call 911 or visit the nearest hospital.',
  queueResetTime: '00:00',
  queuePrefixes: DEFAULT_QUEUE_PREFIXES,
  timezone: 'Asia/Manila',
  operatingDays: [1, 2, 3, 4, 5, 6],
  holidayDates: [],
  appointmentLeadTimeHours: 2,
  bookingHorizonDays: 60,
  appointmentCancellationNoticeHours: 24,
  appointmentNoShowGraceMinutes: 30,
  appointmentReminderLeadHours: [24, 2],
  triagePriorityRules: {
    resuscitation: { painScore: 9, oxygenSaturationBelow: 90 },
    urgent: { painScore: 7, temperatureAtLeast: 39, systolicAtLeast: 180 },
    priority: { seniorAge: 60, painScore: 5 },
  },
  notificationRetentionDays: 90,
  clinicalRecordRetentionYears: 10,
  auditRetentionYears: 7,
};

function numberBetween(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function normalizeOperatingDays(value: unknown) {
  if (!Array.isArray(value)) return [...DEFAULT_CLINIC_SETTINGS.operatingDays];
  const days = [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort();
  return days.length ? days : [...DEFAULT_CLINIC_SETTINGS.operatingDays];
}

export function normalizeHolidayDates(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(String).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
}

export function normalizeReminderLeadHours(value: unknown) {
  if (!Array.isArray(value)) return [...DEFAULT_CLINIC_SETTINGS.appointmentReminderLeadHours];
  const hours = [...new Set(value.map(Number).filter((hour) => Number.isInteger(hour) && hour >= 1 && hour <= 720))]
    .sort((a, b) => b - a);
  return hours.length ? hours.slice(0, 5) : [...DEFAULT_CLINIC_SETTINGS.appointmentReminderLeadHours];
}

export function normalizeTriagePriorityRules(value: unknown): TriagePriorityRules {
  const raw = value && typeof value === 'object' ? value as any : {};
  const defaults = DEFAULT_CLINIC_SETTINGS.triagePriorityRules;
  return {
    resuscitation: {
      painScore: numberBetween(raw.resuscitation?.painScore, defaults.resuscitation.painScore, 0, 10),
      oxygenSaturationBelow: numberBetween(raw.resuscitation?.oxygenSaturationBelow, defaults.resuscitation.oxygenSaturationBelow, 50, 100),
    },
    urgent: {
      painScore: numberBetween(raw.urgent?.painScore, defaults.urgent.painScore, 0, 10),
      temperatureAtLeast: numberBetween(raw.urgent?.temperatureAtLeast, defaults.urgent.temperatureAtLeast, 35, 45),
      systolicAtLeast: numberBetween(raw.urgent?.systolicAtLeast, defaults.urgent.systolicAtLeast, 100, 260),
    },
    priority: {
      seniorAge: numberBetween(raw.priority?.seniorAge, defaults.priority.seniorAge, 50, 100),
      painScore: numberBetween(raw.priority?.painScore, defaults.priority.painScore, 0, 10),
    },
  };
}

export function normalizeQueuePrefixes(value: unknown): QueuePrefixSetting[] {
  if (!Array.isArray(value)) return DEFAULT_QUEUE_PREFIXES.map((item) => ({ ...item }));
  const normalized = value
    .map((item: any, index) => ({
      id: String(item?.id || `prefix-${index + 1}`),
      department: String(item?.department || '').trim(),
      prefix: String(item?.prefix || '').trim().toUpperCase(),
    }))
    .filter((item) => item.department && /^[A-Z0-9]{1,6}$/.test(item.prefix));
  return normalized.length ? normalized : DEFAULT_QUEUE_PREFIXES.map((item) => ({ ...item }));
}

export async function getClinicSettings(database: any = prisma): Promise<ClinicSettingsValue> {
  let stored: any;
  if (database === prisma) {
    try {
      const rows = await prisma.$queryRaw<any[]>`SELECT * FROM "clinic_settings" WHERE "id" = 'default' LIMIT 1`;
      stored = rows[0];
    } catch {
      stored = await database.clinicSettings.findUnique({ where: { id: 'default' } });
    }
  } else {
    stored = await database.clinicSettings.findUnique({ where: { id: 'default' } });
  }
  if (!stored) return { ...DEFAULT_CLINIC_SETTINGS, queuePrefixes: [...DEFAULT_QUEUE_PREFIXES] };
  return {
    ...DEFAULT_CLINIC_SETTINGS,
    ...stored,
    queuePrefixes: normalizeQueuePrefixes(stored.queuePrefixes),
    operatingDays: normalizeOperatingDays(stored.operatingDays),
    holidayDates: normalizeHolidayDates(stored.holidayDates),
    triagePriorityRules: normalizeTriagePriorityRules(stored.triagePriorityRules),
    appointmentLeadTimeHours: numberBetween(stored.appointmentLeadTimeHours, DEFAULT_CLINIC_SETTINGS.appointmentLeadTimeHours, 0, 168),
    bookingHorizonDays: numberBetween(stored.bookingHorizonDays, DEFAULT_CLINIC_SETTINGS.bookingHorizonDays, 1, 365),
    appointmentCancellationNoticeHours: numberBetween(stored.appointmentCancellationNoticeHours, DEFAULT_CLINIC_SETTINGS.appointmentCancellationNoticeHours, 0, 720),
    appointmentNoShowGraceMinutes: numberBetween(stored.appointmentNoShowGraceMinutes, DEFAULT_CLINIC_SETTINGS.appointmentNoShowGraceMinutes, 0, 240),
    appointmentReminderLeadHours: normalizeReminderLeadHours(stored.appointmentReminderLeadHours),
    notificationRetentionDays: numberBetween(stored.notificationRetentionDays, DEFAULT_CLINIC_SETTINGS.notificationRetentionDays, 7, 3650),
    clinicalRecordRetentionYears: numberBetween(stored.clinicalRecordRetentionYears, DEFAULT_CLINIC_SETTINGS.clinicalRecordRetentionYears, 1, 50),
    auditRetentionYears: numberBetween(stored.auditRetentionYears, DEFAULT_CLINIC_SETTINGS.auditRetentionYears, 1, 50),
  };
}

export function resolveQueuePrefix(
  settings: Pick<ClinicSettingsValue, 'queuePrefixes'>,
  department: string,
  numericPriority = 0,
) {
  const prefixes = normalizeQueuePrefixes(settings.queuePrefixes);
  if (numericPriority === 1) {
    const priority = prefixes.find((item) => /senior|pwd|priority/i.test(item.department));
    if (priority) return priority.prefix;
  }
  const departmentKey = department.trim().toLowerCase();
  const exact = prefixes.find((item) => item.department.trim().toLowerCase() === departmentKey);
  if (exact) return exact.prefix;
  const partial = prefixes.find((item) => {
    const configured = item.department.trim().toLowerCase();
    return configured !== 'general' && (departmentKey.includes(configured) || configured.includes(departmentKey));
  });
  if (partial) return partial.prefix;
  return prefixes.find((item) => item.department.trim().toLowerCase() === 'general')?.prefix || 'Q';
}

export function operationalQueueDate(now: Date, resetTime: string, timezone = 'Asia/Manila') {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((item) => item.type === type)?.value);
  const [resetHour, resetMinute] = resetTime.split(':').map(Number);
  const currentMinutes = part('hour') * 60 + part('minute');
  const resetMinutes = resetHour * 60 + resetMinute;
  const utcDate = new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
  if (currentMinutes < resetMinutes) utcDate.setUTCDate(utcDate.getUTCDate() - 1);
  return utcDate;
}
