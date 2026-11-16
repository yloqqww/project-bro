export type QueueMetrics = {
  position: number;
  peopleAhead: number;
  estimatedWaitMinutes: number;
  averageConsultationMinutes: number;
};

export async function calculateQueueMetrics(database: any, ticket: any, queueDate: Date): Promise<QueueMetrics> {
  const activeStatuses = ['WAITING', 'CALLED', 'IN_CONSULTATION'];
  const [line, completed] = await Promise.all([
    database.queueTicket.findMany({
      where: { doctorId: ticket.doctorId, queueDate, status: { in: activeStatuses } },
      select: { id: true, status: true, priority: true, createdAt: true, startedAt: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    }),
    database.queueTicket.findMany({
      where: { doctorId: ticket.doctorId, status: 'COMPLETED', startedAt: { not: null }, completedAt: { not: null } },
      select: { startedAt: true, completedAt: true },
      orderBy: { completedAt: 'desc' },
      take: 20,
    }),
  ]);
  const waiting = line.filter((item: any) => item.status === 'WAITING');
  const waitingIndex = waiting.findIndex((item: any) => item.id === ticket.id);
  const peopleAhead = ticket.status === 'WAITING' ? Math.max(0, waitingIndex) : 0;
  const durations = completed
    .map((item: any) => Math.round((item.completedAt.getTime() - item.startedAt.getTime()) / 60_000))
    .filter((minutes: number) => minutes >= 3 && minutes <= 120);
  const averageConsultationMinutes = durations.length
    ? Math.max(5, Math.round(durations.reduce((sum: number, minutes: number) => sum + minutes, 0) / durations.length))
    : 15;
  const active = line.find((item: any) => item.status === 'IN_CONSULTATION');
  const activeRemaining = active?.startedAt
    ? Math.max(0, averageConsultationMinutes - Math.round((Date.now() - active.startedAt.getTime()) / 60_000))
    : 0;
  return {
    position: ticket.status === 'WAITING' && waitingIndex >= 0 ? waitingIndex + 1 : 0,
    peopleAhead,
    estimatedWaitMinutes: ticket.status === 'WAITING' ? activeRemaining + peopleAhead * averageConsultationMinutes : 0,
    averageConsultationMinutes,
  };
}

export async function queueControlState(database: any, doctorId: string) {
  return database.queueServiceState.findUnique({ where: { doctorId } });
}

export async function recordQueueEvent(database: any, input: {
  queueTicketId: string;
  eventType: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  actor?: { id?: string | null; role?: string | null };
  metadata?: Record<string, unknown>;
}) {
  return database.queueEvent.create({
    data: {
      queueTicketId: input.queueTicketId,
      eventType: input.eventType,
      fromStatus: input.fromStatus || null,
      toStatus: input.toStatus || null,
      actorId: input.actor?.id || null,
      actorRole: input.actor?.role || null,
      metadata: input.metadata || undefined,
    },
  });
}
