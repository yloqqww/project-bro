import { NextRequest, NextResponse } from 'next/server';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { checkDatabaseHealth, checkEmailHealth } from '@/lib/operational-health';
import { sendOperationalAlert } from '@/lib/observability';

export async function POST(req: NextRequest) {
  const suppliedSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const isCron = Boolean(process.env.CRON_SECRET && suppliedSecret === process.env.CRON_SECRET);
  if (!isCron) {
    const auth = await authorizeApi(ACCESS.admin);
    if (!auth.ok) return auth.response;
  }

  const database = await checkDatabaseHealth();
  let email = null;
  if (database.status !== 'ok') {
    await sendOperationalAlert('database', 'down', { latencyMs: database.latencyMs });
  } else {
    email = await checkEmailHealth();
    if (email.status === 'degraded' || email.status === 'unconfigured') {
      await sendOperationalAlert('email', 'degraded', {
        providerConfigured: email.status !== 'unconfigured',
        recentFailures: Number(email.details?.recentFailures || 0),
      });
    }
  }

  const healthy = database.status === 'ok' && email?.status !== 'degraded';
  return NextResponse.json(
    { success: healthy, checks: { database, email }, checkedAt: new Date().toISOString() },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
