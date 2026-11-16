import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { authorizeMobilePatient, requestIp } from '@/lib/mobile-auth';
import { writeAuditLog } from '@/lib/audit';

const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('ACKNOWLEDGE'), consentType: z.string().trim().min(3).max(80), policyVersion: z.string().trim().min(1).max(40) }),
  z.object({ action: z.literal('WITHDRAW'), consentId: z.string().min(1) }),
]);

export async function GET(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  const consents = await prisma.patientPrivacyConsent.findMany({ where: { patientId: auth.patient.patientId }, orderBy: { acknowledgedAt: 'desc' }, take: 100 });
  return NextResponse.json({ success: true, consents });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid privacy consent request.' }, { status: 400 });
  if (parsed.data.action === 'ACKNOWLEDGE') {
    const consent = await prisma.patientPrivacyConsent.create({ data: { patientId: auth.patient.patientId, consentType: parsed.data.consentType, policyVersion: parsed.data.policyVersion, source: 'PATIENT_MOBILE', ipAddress: requestIp(req), userAgent: req.headers.get('user-agent')?.slice(0, 500) || null } });
    await writeAuditLog({ actor: { id: auth.patient.userId, email: auth.patient.email, role: 'PATIENT' }, action: 'PRIVACY_CONSENT_ACKNOWLEDGED', targetType: 'PatientPrivacyConsent', targetId: consent.id, summary: `${consent.consentType} consent acknowledged.`, request: req, metadata: { policyVersion: consent.policyVersion } });
    return NextResponse.json({ success: true, consent }, { status: 201 });
  }
  const consent = await prisma.patientPrivacyConsent.findFirst({ where: { id: parsed.data.consentId, patientId: auth.patient.patientId } });
  if (!consent) return NextResponse.json({ success: false, error: 'Consent record not found.' }, { status: 404 });
  if (consent.withdrawnAt) return NextResponse.json({ success: true, consent });
  const withdrawn = await prisma.patientPrivacyConsent.update({ where: { id: consent.id }, data: { withdrawnAt: new Date() } });
  await writeAuditLog({ actor: { id: auth.patient.userId, email: auth.patient.email, role: 'PATIENT' }, action: 'PRIVACY_CONSENT_WITHDRAWN', targetType: 'PatientPrivacyConsent', targetId: consent.id, summary: `${consent.consentType} consent withdrawn.`, request: req });
  return NextResponse.json({ success: true, consent: withdrawn });
}
