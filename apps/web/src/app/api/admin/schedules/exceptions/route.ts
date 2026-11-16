import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { z } from 'zod';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { minutesFromTime } from '@/lib/scheduling';

const exceptionSchema = z.object({
  doctorId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(['LEAVE', 'HOLIDAY', 'UNAVAILABLE']),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  reason: z.string().trim().max(300).nullable().optional(),
});

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const parsed = exceptionSchema.parse(await req.json());
    if (parsed.startTime || parsed.endTime) {
      if (!parsed.startTime || !parsed.endTime || minutesFromTime(parsed.startTime) >= minutesFromTime(parsed.endTime)) {
        throw new Error('A valid start and end time are required for a partial-day exception.');
      }
    }
    const exception = await prisma.doctorScheduleException.create({
      data: {
        doctorId: parsed.doctorId,
        date: new Date(`${parsed.date}T00:00:00.000Z`),
        type: parsed.type,
        startTime: parsed.startTime || null,
        endTime: parsed.endTime || null,
        reason: parsed.reason || null,
      },
    });
    return NextResponse.json({ success: true, exception }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid schedule exception.';
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ success: false, error: 'id is required.' }, { status: 400 });
  await prisma.$transaction(async (tx) => {
    await tx.doctorScheduleException.delete({ where: { id } });
    await tx.doctorLeaveRequest.updateMany({
      where: { exceptionId: id, status: 'APPROVED' },
      data: { status: 'CANCELLED', adminReply: 'Approved leave was removed from the schedule.' },
    });
  });
  return NextResponse.json({ success: true });
}
