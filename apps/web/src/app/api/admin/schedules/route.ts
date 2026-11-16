import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { z } from 'zod';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import {
  CLINIC_LUNCH_BREAK_END,
  CLINIC_LUNCH_BREAK_START,
  minutesFromTime,
  validateWeeklyAvailability,
} from '@/lib/scheduling';

const weeklyDaySchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  enabled: z.boolean(),
  startTime: z.string(),
  endTime: z.string(),
  breakStart: z.string().nullable().optional(),
  breakEnd: z.string().nullable().optional(),
});

const scheduleSchema = z.object({
  doctorId: z.string().min(1),
  slotDuration: z.number().int().min(5).max(240),
  maxPatientsPerDay: z.number().int().min(1).max(200),
  bufferMinutes: z.number().int().min(0).max(120),
  timezone: z.literal('Asia/Manila').default('Asia/Manila'),
  weeklyAvailability: z.array(weeklyDaySchema).length(7),
});

function defaultWeek() {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    enabled: dayOfWeek >= 1 && dayOfWeek <= 6,
    startTime: '09:00',
    endTime: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00',
  }));
}

function applyRequiredLunchBreak(day: z.infer<typeof weeklyDaySchema>) {
  if (!day.enabled) return { ...day, breakStart: null, breakEnd: null };
  const coversLunch = minutesFromTime(day.startTime) <= minutesFromTime(CLINIC_LUNCH_BREAK_START)
    && minutesFromTime(day.endTime) >= minutesFromTime(CLINIC_LUNCH_BREAK_END);
  return {
    ...day,
    breakStart: coversLunch ? CLINIC_LUNCH_BREAK_START : null,
    breakEnd: coversLunch ? CLINIC_LUNCH_BREAK_END : null,
  };
}

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;

  const doctorId = new URL(req.url).searchParams.get('doctorId');
  if (!doctorId) {
    return NextResponse.json({ success: false, error: 'doctorId is required.' }, { status: 400 });
  }

  const doctor = await prisma.doctorProfile.findUnique({
    where: { id: doctorId },
    include: {
      schedule: { include: { weeklyAvailability: { orderBy: { dayOfWeek: 'asc' } } } },
      scheduleExceptions: { orderBy: [{ date: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  if (!doctor) return NextResponse.json({ success: false, error: 'Doctor not found.' }, { status: 404 });

  return NextResponse.json({
    success: true,
    configured: Boolean(doctor.schedule),
    schedule: doctor.schedule
      ? {
          doctorId,
          slotDuration: doctor.schedule.slotDuration,
          maxPatientsPerDay: doctor.schedule.maxPatientsPerDay,
          bufferMinutes: doctor.schedule.bufferMinutes,
          timezone: doctor.schedule.timezone,
          weeklyAvailability: doctor.schedule.weeklyAvailability,
        }
      : {
          doctorId,
          slotDuration: 20,
          maxPatientsPerDay: 24,
          bufferMinutes: 5,
          timezone: 'Asia/Manila',
          weeklyAvailability: defaultWeek(),
        },
    exceptions: doctor.scheduleExceptions,
  });
}

export async function PUT(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;

  try {
    const parsed = scheduleSchema.parse(await req.json());
    const weeklyAvailability = parsed.weeklyAvailability.map(applyRequiredLunchBreak);
    validateWeeklyAvailability(weeklyAvailability);
    const doctor = await prisma.doctorProfile.findUnique({ where: { id: parsed.doctorId } });
    if (!doctor) return NextResponse.json({ success: false, error: 'Doctor not found.' }, { status: 404 });

    const enabledDays = weeklyAvailability.filter((day) => day.enabled);
    const earliestStart = enabledDays.map((day) => day.startTime).sort()[0] || null;
    const latestEnd = enabledDays.map((day) => day.endTime).sort().at(-1) || null;

    const saved = await prisma.$transaction(async (tx) => {
      const schedule = await tx.doctorSchedule.upsert({
        where: { doctorId: parsed.doctorId },
        create: {
          doctorId: parsed.doctorId,
          slotDuration: parsed.slotDuration,
          maxPatientsPerDay: parsed.maxPatientsPerDay,
          bufferMinutes: parsed.bufferMinutes,
          timezone: parsed.timezone,
        },
        update: {
          slotDuration: parsed.slotDuration,
          maxPatientsPerDay: parsed.maxPatientsPerDay,
          bufferMinutes: parsed.bufferMinutes,
          timezone: parsed.timezone,
        },
      });

      await tx.doctorWeeklyAvailability.deleteMany({ where: { scheduleId: schedule.id } });
      await tx.doctorWeeklyAvailability.createMany({
        data: weeklyAvailability.map((day) => ({
          scheduleId: schedule.id,
          dayOfWeek: day.dayOfWeek,
          enabled: day.enabled,
          startTime: day.startTime,
          endTime: day.endTime,
          breakStart: day.breakStart || null,
          breakEnd: day.breakEnd || null,
        })),
      });
      await tx.doctorProfile.update({
        where: { id: parsed.doctorId },
        data: { availableFrom: earliestStart, availableTo: latestEnd },
      });
      return tx.doctorSchedule.findUnique({
        where: { doctorId: parsed.doctorId },
        include: { weeklyAvailability: { orderBy: { dayOfWeek: 'asc' } } },
      });
    });

    return NextResponse.json({ success: true, schedule: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid schedule.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
