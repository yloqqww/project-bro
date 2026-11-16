import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { calculateQueueMetrics } from '../src/lib/queue-service.ts';

test('queue position and wait estimate use priority order and recent consultation duration', async () => {
  const now = Date.now();
  const database = {
    queueTicket: {
      findMany: async (query: any) => query.where.status === 'COMPLETED'
        ? [{ startedAt: new Date(now - 30 * 60_000), completedAt: new Date(now - 10 * 60_000) }]
        : [
            { id: 'active', status: 'IN_CONSULTATION', priority: 0, createdAt: new Date(now - 30 * 60_000), startedAt: new Date(now - 5 * 60_000) },
            { id: 'ahead', status: 'WAITING', priority: 2, createdAt: new Date(now - 4 * 60_000), startedAt: null },
            { id: 'patient', status: 'WAITING', priority: 0, createdAt: new Date(now - 3 * 60_000), startedAt: null },
          ],
    },
  };
  const metrics = await calculateQueueMetrics(database, { id: 'patient', doctorId: 'doctor', status: 'WAITING' }, new Date());
  assert.equal(metrics.position, 2);
  assert.equal(metrics.peopleAhead, 1);
  assert.equal(metrics.averageConsultationMinutes, 20);
  assert.ok(metrics.estimatedWaitMinutes >= 34 && metrics.estimatedWaitMinutes <= 35);
});

test('queue lifecycle provides SSE, reconnection fallback, events, recall, transfer, and controls', () => {
  const root = path.resolve(import.meta.dirname, '../../..');
  const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
  assert.match(read('apps/web/src/app/api/queue/events/route.ts'), /text\/event-stream/);
  assert.match(read('apps/web/src/hooks/useQueueRealtime.ts'), /onerror[\s\S]*reconnecting/);
  assert.match(read('apps/web/src/app/api/queue/[id]/route.ts'), /action === 'RECALL'[\s\S]*action === 'TRANSFER'/);
  assert.match(read('apps/web/src/app/api/queue/control/route.ts'), /OPEN[\s\S]*PAUSED[\s\S]*CLOSED/);
  assert.match(read('packages/db/prisma/schema.prisma'), /model QueueEvent/);
  assert.doesNotMatch(read('apps/web/src/app/patient/page.tsx'), /rawStatus === 'WAITING' \? 1 : 0/);
});
