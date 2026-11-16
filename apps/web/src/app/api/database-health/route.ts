import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/operational-health';

export async function GET() {
  const database = await checkDatabaseHealth();
  return NextResponse.json(
    { status: database.status, database, timestamp: new Date().toISOString() },
    { status: database.status === 'ok' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  );
}
