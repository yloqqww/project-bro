import { NextRequest, NextResponse } from 'next/server';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { buildOperationalReport } from '@/lib/operational-report';

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    return NextResponse.json({ success: true, report: await buildOperationalReport(new URL(req.url).searchParams) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to generate report.' }, { status: 400 });
  }
}
