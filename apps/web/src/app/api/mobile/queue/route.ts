import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeMobilePatient } from '@/lib/mobile-auth';
import { getClinicSettings, operationalQueueDate, resolveQueuePrefix } from '@/lib/clinic-settings';
import { calculateQueueMetrics } from '@/lib/queue-service';

export async function GET(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  const settings = await getClinicSettings();
  const queueDate = operationalQueueDate(new Date(), settings.queueResetTime, settings.timezone);
  const ticket = await prisma.queueTicket.findFirst({ where: { patientId: auth.patient.patientId, queueDate }, include: { doctor: true }, orderBy: { createdAt: 'desc' } });
  if (!ticket) return NextResponse.json({ success: true, queue: null, refreshedAt: new Date().toISOString() });
  const metrics = await calculateQueueMetrics(prisma, ticket, queueDate);
  return NextResponse.json({ success: true, queue: { id: ticket.id, ticketNumber: `${resolveQueuePrefix(settings, ticket.doctor.specialization, ticket.priority)}-${String(ticket.queueNumber).padStart(2, '0')}`, department: ticket.doctor.specialization, doctor: `Dr. ${ticket.doctor.firstName} ${ticket.doctor.lastName}`, room: ticket.station || ticket.doctor.roomNumber || 'Consultation room', status: ticket.status, ...metrics, issuedAt: ticket.createdAt, calledAt: ticket.calledAt, startedAt: ticket.startedAt, completedAt: ticket.completedAt, recallCount: ticket.recallCount, lastRecalledAt: ticket.lastRecalledAt }, refreshedAt: new Date().toISOString() });
}
