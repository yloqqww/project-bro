import { NextResponse } from 'next/server';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';

export async function GET() {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    success: true,
    status: 'configured',
  });
}
