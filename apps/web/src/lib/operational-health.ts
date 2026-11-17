import 'server-only';
import { prisma } from '@clinic/db';

export type ServiceHealth = {
  status: 'ok' | 'degraded' | 'down' | 'unconfigured';
  latencyMs?: number;
  checkedAt: string;
  details?: Record<string, string | number | boolean | null>;
};

export async function checkDatabaseHealth(database: any = prisma): Promise<ServiceHealth> {
  const startedAt = Date.now();
  try {
    await database.$queryRaw`SELECT 1`;
    return { status: 'ok', latencyMs: Date.now() - startedAt, checkedAt: new Date().toISOString() };
  } catch (error: any) {
    return {
      status: 'down',
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      details: {
        error: error?.message || String(error),
        code: error?.code || null,
        name: error?.name || null,
      },
    };
  }
}

export function configuredEmailProvider() {
  if (process.env.SMTP_USER && process.env.SMTP_PASS) return 'SMTP';
  if (process.env.RESEND_API_KEY) return 'RESEND';
  return null;
}

export async function checkEmailHealth(database: any = prisma): Promise<ServiceHealth> {
  const provider = configuredEmailProvider();
  if (!provider) return { status: 'unconfigured', checkedAt: new Date().toISOString(), details: { provider: null } };
  try {
    const since = new Date(Date.now() - 30 * 60 * 1000);
    const [recentFailures, latestSent] = await Promise.all([
      database.emailDelivery.count({ where: { status: 'FAILED', lastAttemptAt: { gte: since } } }),
      database.emailDelivery.findFirst({ where: { status: 'SENT' }, orderBy: { sentAt: 'desc' }, select: { sentAt: true } }),
    ]);
    return {
      status: recentFailures > 0 ? 'degraded' : 'ok',
      checkedAt: new Date().toISOString(),
      details: { provider, recentFailures, lastSuccessfulDeliveryAt: latestSent?.sentAt?.toISOString() || null },
    };
  } catch {
    return { status: 'degraded', checkedAt: new Date().toISOString(), details: { provider, deliveryStoreReachable: false } };
  }
}