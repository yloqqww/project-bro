import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { authorizeMobilePatient } from '@/lib/mobile-auth';
import { auditChanges, writeAuditLog } from '@/lib/audit';
import { findDuplicateCandidates, normalizePatientIdentity, recordDemographicChange } from '@/lib/patient-master-index';

const updateSchema = z.object({ phoneNumber: z.string().trim().min(7).max(30), address: z.string().trim().min(3).max(200), city: z.string().trim().min(2).max(80), state: z.string().trim().min(2).max(80), zipCode: z.string().trim().min(3).max(12), emergencyContactName: z.string().trim().min(2).max(100), emergencyContactPhone: z.string().trim().min(7).max(30), emergencyContactRelation: z.string().trim().min(2).max(60) });

export async function GET(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  const profile = await prisma.patientProfile.findUnique({ where: { id: auth.patient.patientId }, include: { user: { select: { email: true } }, rfidCards: { where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 } } });
  if (!profile) return NextResponse.json({ success: false, error: 'Patient profile unavailable.' }, { status: 404 });
  return NextResponse.json({ success: true, profile: { id: profile.id, email: profile.user.email, firstName: profile.firstName, middleName: profile.middleName, lastName: profile.lastName, dateOfBirth: profile.dateOfBirth.toISOString().slice(0, 10), gender: profile.gender, bloodType: profile.bloodType, phoneNumber: profile.phoneNumber, address: profile.address, city: profile.city, state: profile.state, zipCode: profile.zipCode, emergencyContactName: profile.emergencyContactName, emergencyContactPhone: profile.emergencyContactPhone, emergencyContactRelation: profile.emergencyContactRelation, cardUid: profile.rfidCards[0]?.cardUid || null } });
}

export async function PATCH(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;
  const parsed = updateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Please complete all contact and emergency-contact fields.', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const before = await prisma.patientProfile.findUnique({ where: { id: auth.patient.patientId } });
  if (!before) return NextResponse.json({ success: false, error: 'Patient profile unavailable.' }, { status: 404 });
  const requestedPhone = parsed.data.phoneNumber.replace(/\D/g, '');
  const otherPatients = await prisma.patientProfile.findMany({ where: { id: { not: before.id } }, select: { phoneNumber: true } });
  if (otherPatients.some((item) => item.phoneNumber.replace(/\D/g, '') === requestedPhone)) return NextResponse.json({ success: false, error: 'That phone number is already registered to another patient.' }, { status: 409 });
  if (before.status !== 'ACTIVE') return NextResponse.json({ success: false, error: 'This patient record is not active.' }, { status: 409 });
  const duplicateCandidates = await findDuplicateCandidates(prisma, { ...before, ...parsed.data, dateOfBirth: before.dateOfBirth }, before.id);
  if (duplicateCandidates.some((candidate) => candidate.matchLevel === 'HIGH')) return NextResponse.json({ success: false, error: 'This change matches another patient record and requires clinic review.' }, { status: 409 });
  const identity = normalizePatientIdentity({ ...before, ...parsed.data, dateOfBirth: before.dateOfBirth });
  const updated = await prisma.$transaction(async (tx) => {
    const profile = await tx.patientProfile.update({ where: { id: before.id }, data: { ...parsed.data, ...identity } });
    await recordDemographicChange(tx, { patientId: before.id, changedById: auth.patient.userId, source: 'PATIENT_MOBILE', reason: 'Patient self-service contact update', before, after: profile });
    return profile;
  });
  await writeAuditLog({ actor: { id: auth.patient.userId, email: auth.patient.email, role: 'PATIENT' }, action: 'PATIENT_SELF_SERVICE_PROFILE_UPDATE', targetType: 'PatientProfile', targetId: before.id, summary: 'Patient updated mobile contact information.', request: req, metadata: auditChanges(before, updated) });
  return NextResponse.json({ success: true, profile: updated });
}
