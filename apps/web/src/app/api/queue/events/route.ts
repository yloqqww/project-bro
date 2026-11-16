import { NextRequest } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';

export const dynamic = 'force-dynamic';

type VersionCache = {
  version: string;
  fetchedAt: number;
  inflight: Promise<string> | null;
};

const globalForSse = globalThis as unknown as {
  __lmcQueueSseCache?: VersionCache;
};

const sseCache: VersionCache =
  globalForSse.__lmcQueueSseCache ??
  (globalForSse.__lmcQueueSseCache = {
    version: '',
    fetchedAt: 0,
    inflight: null,
  });

async function getLatestQueueVersion(): Promise<string> {
  const now = Date.now();
  if (now - sseCache.fetchedAt < 2500 && sseCache.version) {
    return sseCache.version;
  }
  if (sseCache.inflight) {
    return sseCache.inflight;
  }
  sseCache.inflight = (async () => {
    try {
      const rows = await prisma.$queryRawUnsafe<
        Array<{ event_at: Date | null; ticket_at: Date | null; control_at: Date | null }>
      >(`
        SELECT
          (SELECT MAX("createdAt") FROM "queue_events") AS event_at,
          (SELECT MAX("updatedAt") FROM "queue_tickets") AS ticket_at,
          (SELECT MAX("updatedAt") FROM "queue_service_states") AS control_at
      `);
      const row = rows?.[0];
      const version = [row?.event_at, row?.ticket_at, row?.control_at]
        .map((v) => (v instanceof Date ? v.toISOString() : v ? String(v) : ''))
        .join(':');
      sseCache.version = version;
      sseCache.fetchedAt = Date.now();
      return version;
    } finally {
      sseCache.inflight = null;
    }
  })();
  return sseCache.inflight;
}

export async function GET(req: NextRequest) {
  const isPublic = new URL(req.url).searchParams.get('view') === 'public';
  if (!isPublic) {
    const auth = await authorizeApi(ACCESS.queueRead);
    if (!auth.ok) return auth.response;
  }
  const encoder = new TextEncoder();
  let closed = false;
  req.signal.addEventListener('abort', () => { closed = true; });
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode('retry: 3000\n\n'));
      let lastVersion = '';
      while (!closed) {
        try {
          const version = await getLatestQueueVersion();
          if (version !== lastVersion) {
            lastVersion = version;
            controller.enqueue(encoder.encode(`event: queue-update\ndata: ${JSON.stringify({ version, at: new Date().toISOString() })}\n\n`));
          } else controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch { controller.enqueue(encoder.encode('event: queue-error\ndata: {}\n\n')); }
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
      controller.close();
    },
    cancel() { closed = true; },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' } });
}
