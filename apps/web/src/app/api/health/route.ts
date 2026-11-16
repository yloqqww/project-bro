import { NextResponse } from 'next/server';
import { checkDatabaseHealth, checkEmailHealth } from '@/lib/operational-health';

export async function GET() {
  const database = await checkDatabaseHealth();
  const email = database.status === 'ok' ? await checkEmailHealth() : null;
  return NextResponse.json(
    { status: database.status === 'ok' ? 'ok' : 'degraded', database, email, timestamp: new Date().toISOString() },
    { status: database.status === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
