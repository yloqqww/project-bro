import { NextResponse } from 'next/server';
import { checkDatabaseHealth, checkEmailHealth } from '@/lib/operational-health';

export async function GET() {
  const database = await checkDatabaseHealth();
  const email = database.status === 'ok' ? await checkEmailHealth() : null;
  const ready = database.status === 'ok';
  return NextResponse.json(
    { status: ready ? 'ready' : 'not_ready', checks: { database, email }, timestamp: new Date().toISOString() },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
