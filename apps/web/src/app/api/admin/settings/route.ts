import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { z } from 'zod';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { getClinicSettings, normalizeHolidayDates, normalizeOperatingDays, normalizeQueuePrefixes, normalizeReminderLeadHours, normalizeTriagePriorityRules } from '@/lib/clinic-settings';
import { createAdminNotification } from '@/lib/notifications';
import { auditChanges, writeAuditLog } from '@/lib/audit';

const prefixSchema = z.object({
  id: z.string().trim().min(1).max(50),
  department: z.string().trim().min(2).max(80),
  prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/),
});

const settingsSchema = z.object({
  clinicName: z.string().trim().min(2).max(120),
  shortName: z.string().trim().min(2).max(12).optional(),
  hotline: z.string().trim().min(3).max(50),
  address: z.string().trim().min(5).max(300),
  emergencyNotice: z.string().trim().max(500),
  queueResetTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  queuePrefixes: z.array(prefixSchema).min(1).max(20),
  timezone: z.string().trim().min(3).max(80).default('Asia/Manila'),
  operatingDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  holidayDates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(100),
  appointmentLeadTimeHours: z.number().int().min(0).max(168),
  bookingHorizonDays: z.number().int().min(1).max(365),
  appointmentCancellationNoticeHours: z.number().int().min(0).max(720),
  appointmentNoShowGraceMinutes: z.number().int().min(0).max(240),
  appointmentReminderLeadHours: z.array(z.number().int().min(1).max(720)).min(1).max(5),
  notificationRetentionDays: z.number().int().min(7).max(3650),
  triagePriorityRules: z.object({
    resuscitation: z.object({ painScore: z.number().min(0).max(10), oxygenSaturationBelow: z.number().min(50).max(100) }),
    urgent: z.object({ painScore: z.number().min(0).max(10), temperatureAtLeast: z.number().min(35).max(45), systolicAtLeast: z.number().min(100).max(260) }),
    priority: z.object({ seniorAge: z.number().min(50).max(100), painScore: z.number().min(0).max(10) }),
  }),
});

export async function GET() {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  const settings = await getClinicSettings();
  return NextResponse.json({ success: true, settings });
}

export async function PUT(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const parsed = settingsSchema.parse(await req.json());
    const queuePrefixes = normalizeQueuePrefixes(parsed.queuePrefixes);
    const operatingDays = normalizeOperatingDays(parsed.operatingDays);
    const holidayDates = normalizeHolidayDates(parsed.holidayDates);
    const triagePriorityRules = normalizeTriagePriorityRules(parsed.triagePriorityRules);
    const appointmentReminderLeadHours = normalizeReminderLeadHours(parsed.appointmentReminderLeadHours);
    const departmentKeys = queuePrefixes.map((item) => item.department.toLowerCase());
    const prefixKeys = queuePrefixes.map((item) => item.prefix.toLowerCase());
    if (new Set(departmentKeys).size !== departmentKeys.length) throw new Error('Department names must be unique.');
    if (new Set(prefixKeys).size !== prefixKeys.length) throw new Error('Queue prefixes must be unique.');

    const existing = await getClinicSettings();
    const saved = await prisma.clinicSettings.upsert({
      where: { id: 'default' },
      create: {
        id: 'default',
        clinicName: parsed.clinicName,
        shortName: parsed.shortName || existing.shortName,
        hotline: parsed.hotline,
        address: parsed.address,
        emergencyNotice: parsed.emergencyNotice,
        queueResetTime: parsed.queueResetTime,
        queuePrefixes,
        timezone: parsed.timezone,
        updatedById: auth.user.id,
      },
      update: {
        clinicName: parsed.clinicName,
        shortName: parsed.shortName || existing.shortName,
        hotline: parsed.hotline,
        address: parsed.address,
        emergencyNotice: parsed.emergencyNotice,
        queueResetTime: parsed.queueResetTime,
        queuePrefixes,
        timezone: parsed.timezone,
        updatedById: auth.user.id,
      },
    });
    await prisma.$executeRawUnsafe(
      `UPDATE "clinic_settings" SET "operatingDays" = $1::jsonb, "holidayDates" = $2::jsonb, "appointmentLeadTimeHours" = $3, "bookingHorizonDays" = $4, "triagePriorityRules" = $5::jsonb, "notificationRetentionDays" = $6, "timezone" = $7, "appointmentCancellationNoticeHours" = $8, "appointmentNoShowGraceMinutes" = $9, "appointmentReminderLeadHours" = $10::jsonb, "updatedAt" = NOW() WHERE "id" = 'default'`,
      JSON.stringify(operatingDays), JSON.stringify(holidayDates), parsed.appointmentLeadTimeHours, parsed.bookingHorizonDays, JSON.stringify(triagePriorityRules), parsed.notificationRetentionDays, parsed.timezone, parsed.appointmentCancellationNoticeHours, parsed.appointmentNoShowGraceMinutes, JSON.stringify(appointmentReminderLeadHours),
    );

    await createAdminNotification({
      type: 'info',
      category: 'SYSTEM_SETTINGS',
      title: 'Clinic Settings Updated',
      message: `Clinic identity and queue rules were updated by ${auth.user.email}.`,
      staffEmail: auth.user.email,
      staffRole: auth.user.role,
      metadata: { settingsId: saved.id, updatedAt: saved.updatedAt.toISOString() },
    }).catch((error) => console.error('Settings notification error:', error));

    await writeAuditLog({
      actor: auth.user,
      action: 'SETTINGS_UPDATE',
      targetType: 'ClinicSettings',
      targetId: saved.id,
      summary: 'Clinic operating, booking, queue, retention, and triage rules updated.',
      request: req,
      metadata: auditChanges(existing, { ...saved, queuePrefixes, operatingDays, holidayDates, triagePriorityRules }),
    });

    return NextResponse.json({
      success: true,
      settings: { ...saved, queuePrefixes, operatingDays, holidayDates, triagePriorityRules, appointmentReminderLeadHours, appointmentCancellationNoticeHours: parsed.appointmentCancellationNoticeHours, appointmentNoShowGraceMinutes: parsed.appointmentNoShowGraceMinutes },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid settings.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
