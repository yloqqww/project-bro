import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { authorizeMobilePatient } from '@/lib/mobile-auth';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({ expoPushToken: z.string().regex(/^ExponentPushToken\[.+\]$|^ExpoPushToken\[.+\]$/), platform: z.string().max(30).optional(), deviceName: z.string().max(120).optional() });

export async function POST(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'A valid Expo push token is required.' }, { status: 400 });
  const id = `push_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
  await prisma.$executeRaw`INSERT INTO "patient_push_devices" ("id", "userId", "expoPushToken", "platform", "deviceName", "enabled", "lastSeenAt", "createdAt", "updatedAt") VALUES (${id}, ${auth.patient.userId}, ${parsed.data.expoPushToken}, ${parsed.data.platform || null}, ${parsed.data.deviceName || null}, true, NOW(), NOW(), NOW()) ON CONFLICT ("expoPushToken") DO UPDATE SET "userId" = EXCLUDED."userId", "platform" = EXCLUDED."platform", "deviceName" = EXCLUDED."deviceName", "enabled" = true, "lastSeenAt" = NOW(), "updatedAt" = NOW()`;
  await writeAuditLog({ actor: { id: auth.patient.userId, email: auth.patient.email, role: 'PATIENT' }, action: 'MOBILE_PUSH_DEVICE_REGISTERED', targetType: 'PatientPushDevice', summary: 'Patient registered a mobile device for notifications.', request: req, metadata: { platform: parsed.data.platform, deviceName: parsed.data.deviceName } });
  return NextResponse.json({ success: true });
}
