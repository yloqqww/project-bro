import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { comparePatientIdentity } from '@/lib/patient-master-index';
import { auditChanges, writeAuditLog } from '@/lib/audit';

const mergeSchema = z.object({
  action: z.literal('MERGE'),
  sourcePatientId: z.string().cuid(),
  targetPatientId: z.string().cuid(),
  reason: z.string().trim().min(10).max(500),
});

const restoreSchema = z.object({ action: z.literal('RESTORE'), patientId: z.string().cuid(), reason: z.string().trim().min(5).max(250) });
const actionSchema = z.discriminatedUnion('action', [mergeSchema, restoreSchema]);

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const patientId = searchParams.get('patientId');
  if (patientId) {
    const patient = await prisma.patientProfile.findUnique({ where: { id: patientId }, select: { id: true, mrn: true, status: true, archiveReason: true, archivedAt: true, mergedInto: { select: { id: true, mrn: true, firstName: true, lastName: true } }, demographicChanges: { orderBy: { createdAt: 'desc' }, take: 100, include: { changedBy: { select: { email: true, role: true } } } }, mergeHistoryAsSource: { orderBy: { createdAt: 'desc' }, include: { targetPatient: { select: { mrn: true, firstName: true, lastName: true } }, mergedBy: { select: { email: true } } } }, mergeHistoryAsTarget: { orderBy: { createdAt: 'desc' }, include: { sourcePatient: { select: { mrn: true, firstName: true, lastName: true } }, mergedBy: { select: { email: true } } } } } });
    if (!patient) return NextResponse.json({ success: false, error: 'Patient record not found.' }, { status: 404 });
    return NextResponse.json({ success: true, patient });
  }

  const patients = await prisma.patientProfile.findMany({ where: { status: 'ACTIVE' }, select: { id: true, mrn: true, firstName: true, lastName: true, dateOfBirth: true, phoneNumber: true, address: true, city: true, state: true, zipCode: true, normalizedFirstName: true, normalizedLastName: true, normalizedPhone: true, normalizedAddress: true }, orderBy: [{ normalizedLastName: 'asc' }, { normalizedFirstName: 'asc' }], take: 2000 });
  const candidates: any[] = [];
  for (let leftIndex = 0; leftIndex < patients.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < patients.length; rightIndex += 1) {
      const left = patients[leftIndex];
      const right = patients[rightIndex];
      if (left.normalizedLastName !== right.normalizedLastName && left.normalizedPhone !== right.normalizedPhone) continue;
      const comparison = comparePatientIdentity(left, right);
      if (comparison.score < 50) continue;
      candidates.push({ id: `${left.id}:${right.id}`, left: { id: left.id, mrn: left.mrn, name: `${left.firstName} ${left.lastName}`, dateOfBirth: left.dateOfBirth, phoneNumber: left.phoneNumber, address: [left.address, left.city, left.state, left.zipCode].join(', ') }, right: { id: right.id, mrn: right.mrn, name: `${right.firstName} ${right.lastName}`, dateOfBirth: right.dateOfBirth, phoneNumber: right.phoneNumber, address: [right.address, right.city, right.state, right.zipCode].join(', ') }, ...comparison });
      if (candidates.length >= 200) break;
    }
    if (candidates.length >= 200) break;
  }
  candidates.sort((left, right) => right.score - left.score);
  return NextResponse.json({ success: true, candidates, scanned: patients.length, truncated: patients.length >= 2000 || candidates.length >= 200 });
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  const parsed = actionSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Invalid master-index action.', fields: parsed.error.flatten().fieldErrors }, { status: 400 });

  if (parsed.data.action === 'RESTORE') {
    const existing = await prisma.patientProfile.findUnique({ where: { id: parsed.data.patientId } });
    if (!existing || existing.status !== 'ARCHIVED') return NextResponse.json({ success: false, error: 'Only archived, non-merged records can be restored.' }, { status: 409 });
    const restored = await prisma.$transaction(async (tx) => {
      const profile = await tx.patientProfile.update({ where: { id: existing.id }, data: { status: 'ACTIVE', archivedAt: null, archivedById: null, archiveReason: null } });
      await tx.user.update({ where: { id: existing.userId }, data: { isActive: true, sessionVersion: { increment: 1 } } });
      return profile;
    });
    await writeAuditLog({ actor: auth.user, action: 'PATIENT_RECORD_RESTORE', targetType: 'PatientProfile', targetId: restored.id, summary: `Restored patient master record ${restored.mrn}.`, request: req, metadata: auditChanges(existing, restored, { reason: parsed.data.reason }) });
    return NextResponse.json({ success: true, patient: { id: restored.id, mrn: restored.mrn, status: restored.status } });
  }

  const mergeAction = parsed.data;
  if (mergeAction.sourcePatientId === mergeAction.targetPatientId) return NextResponse.json({ success: false, error: 'Source and target patients must be different.' }, { status: 400 });
  const [sourceLock, targetLock] = [mergeAction.sourcePatientId, mergeAction.targetPatientId].sort();
  const result = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${`patient-merge:${sourceLock}`}))`;
    await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${`patient-merge:${targetLock}`}))`;
    const [source, target] = await Promise.all([tx.patientProfile.findUnique({ where: { id: mergeAction.sourcePatientId } }), tx.patientProfile.findUnique({ where: { id: mergeAction.targetPatientId } })]);
    if (!source || !target) throw new Error('PATIENT_NOT_FOUND');
    if (source.status !== 'ACTIVE' || target.status !== 'ACTIVE') throw new Error('PATIENT_NOT_ACTIVE');

    const movedCounts = {
      appointments: (await tx.appointment.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } })).count,
      waitlist: (await tx.appointmentWaitlistEntry.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } })).count,
      bookingClaims: (await tx.appointmentBookingClaim.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } })).count,
      privacyConsents: (await tx.patientPrivacyConsent.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } })).count,
      queueTickets: (await tx.queueTicket.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } })).count,
      medicalRecords: (await tx.medicalRecord.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } })).count,
      conversations: (await tx.clinicalConversation.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } })).count,
      rfidCards: (await tx.rfidCard.updateMany({ where: { patientId: source.id }, data: { patientId: target.id } })).count,
    };
    const now = new Date();
    const merged = await tx.patientProfile.update({ where: { id: source.id }, data: { status: 'MERGED', mergedIntoId: target.id, archivedAt: now, archivedById: auth.user.id, archiveReason: mergeAction.reason } });
    await tx.user.update({ where: { id: source.userId }, data: { isActive: false, sessionVersion: { increment: 1 } } });
    await tx.mobileSession.updateMany({ where: { userId: source.userId, revokedAt: null }, data: { revokedAt: now } });
    await tx.patientAccountToken.updateMany({ where: { userId: source.userId, usedAt: null }, data: { usedAt: now } });
    await tx.patientPushDevice.updateMany({ where: { userId: source.userId }, data: { enabled: false } });
    await tx.patientMergeHistory.create({ data: { sourcePatientId: source.id, targetPatientId: target.id, mergedById: auth.user.id, reason: mergeAction.reason, sourceSnapshot: JSON.parse(JSON.stringify(source)), targetSnapshot: JSON.parse(JSON.stringify(target)), movedCounts } });
    return { source, target, merged, movedCounts };
  }, { isolationLevel: 'Serializable' }).catch((error) => {
    if (error instanceof Error && error.message === 'PATIENT_NOT_FOUND') return null;
    if (error instanceof Error && error.message === 'PATIENT_NOT_ACTIVE') return 'inactive' as const;
    throw error;
  });
  if (!result) return NextResponse.json({ success: false, error: 'Source or target patient not found.' }, { status: 404 });
  if (result === 'inactive') return NextResponse.json({ success: false, error: 'Both source and target must be active patient records.' }, { status: 409 });
  await writeAuditLog({ actor: auth.user, action: 'PATIENT_RECORD_MERGE', targetType: 'PatientProfile', targetId: result.target.id, summary: `Merged ${result.source.mrn} into permanent record ${result.target.mrn}.`, request: req, metadata: { sourcePatientId: result.source.id, sourceMrn: result.source.mrn, targetPatientId: result.target.id, targetMrn: result.target.mrn, reason: mergeAction.reason, movedCounts: result.movedCounts } });
  return NextResponse.json({ success: true, source: { id: result.source.id, mrn: result.source.mrn, status: result.merged.status }, target: { id: result.target.id, mrn: result.target.mrn }, movedCounts: result.movedCounts });
}
