import { NextRequest, NextResponse } from 'next/server';
import { authorizeApi } from '@/lib/api-auth';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const auth = await authorizeApi();
  if (!auth.ok) return auth.response;
  await writeAuditLog({ actor: auth.user, action: 'LOGOUT', targetType: 'UserSession', targetId: auth.user.id, summary: `${auth.user.email} signed out.`, request: req });
  return NextResponse.json({ success: true });
}
