import { NextRequest, NextResponse } from 'next/server';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { runAppointmentAutomation } from '@/lib/appointment-lifecycle';
import { writeAuditLog } from '@/lib/audit';

async function deliverPushReminder(reminder: any) {
  const devices = reminder.appointment.patient.user.patientPushDevices || [];
  if (!devices.length) return;
  const messages = devices.map((device: any) => ({
    to: device.expoPushToken,
    sound: 'default',
    title: 'Appointment reminder',
    body: `You have an appointment with Dr. ${reminder.appointment.doctor.firstName} ${reminder.appointment.doctor.lastName} on ${new Date(reminder.appointment.appointmentDate).toLocaleString('en-PH', { timeZone: 'Asia/Manila' })}.`,
    data: { appointmentId: reminder.appointmentId },
  }));
  const response = await fetch('https://exp.host/--/api/v2/push/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(messages) });
  if (!response.ok) throw new Error(`Expo push service returned ${response.status}.`);
  const payload = await response.json().catch(() => null);
  if (payload?.data?.some?.((ticket: any) => ticket.status === 'error')) throw new Error('Expo rejected one or more reminder messages.');
}

export async function POST(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  const suppliedSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const isCron = Boolean(configuredSecret && suppliedSecret === configuredSecret);
  let actor: any = { role: 'SYSTEM' };
  if (!isCron) {
    const auth = await authorizeApi(ACCESS.admin);
    if (!auth.ok) return auth.response;
    actor = auth.user;
  }
  try {
    const result = await runAppointmentAutomation(new Date(), undefined, deliverPushReminder);
    await writeAuditLog({ actor, action: 'APPOINTMENT_AUTOMATION_RUN', targetType: 'Appointment', summary: 'Appointment no-show, waitlist, and reminder automation completed.', request: req, metadata: result });
    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Appointment automation failed:', error);
    return NextResponse.json({ success: false, error: 'Appointment automation failed.' }, { status: 500 });
  }
}
