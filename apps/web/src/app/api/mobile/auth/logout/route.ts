import { NextRequest, NextResponse } from 'next/server';
import { authorizeMobilePatient, revokeMobileSession } from '@/lib/mobile-auth';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  await revokeMobileSession(auth.patient.sessionId);
  await writeAuditLog({ actor: { id: auth.patient.userId, email: auth.patient.email, role: 'PATIENT' }, action: 'MOBILE_LOGOUT', targetType: 'MobileSession', targetId: auth.patient.sessionId, summary: `${auth.patient.email} signed out of the patient mobile app.`, request: req });
  return NextResponse.json({ success: true });
}
