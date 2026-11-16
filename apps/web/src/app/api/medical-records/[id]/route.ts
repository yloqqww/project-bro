import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { auditChanges, writeAuditLog } from '@/lib/audit';
import { createMedicalRecordContentHash } from '@/lib/medical-record-integrity';
import { formatMedicalRecord, medicalRecordInclude } from '@/lib/medical-records';

type RouteContext = { params: Promise<{ id: string }> };

function clinicalUpdate(body: any) {
  return {
    ...(typeof body.type === 'string' || typeof body.chiefComplaint === 'string'
      ? { subjective: `${body.type ? `[${body.type}] ` : ''}${String(body.chiefComplaint || '').trim()}` }
      : {}),
    ...(typeof body.objective === 'string' || typeof body.notes === 'string'
      ? { objective: String(body.objective || body.notes).trim() }
      : {}),
    ...(typeof body.diagnosis === 'string' ? { assessment: body.diagnosis.trim() } : {}),
    ...(typeof body.plan === 'string' || typeof body.notes === 'string'
      ? { plan: String(body.plan || body.notes).trim() }
      : {}),
    ...(body.vitalSigns && typeof body.vitalSigns === 'object' ? { vitals: body.vitalSigns } : {}),
  };
}

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await authorizeApi(ACCESS.medicalRecordWrite);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const body = await req.json();
    const action = String(body.action || '').toUpperCase();
    const record = await prisma.medicalRecord.findFirst({
      where: { id, doctorId: auth.user.id },
      include: {
        attachments: { where: { archivedAt: null }, select: { checksum: true } },
        prescriptions: { where: { isActive: true }, select: { eSignatureHash: true } },
        doctor: { include: { doctorProfile: true } },
      },
    });
    if (!record) return NextResponse.json({ success: false, error: 'Medical record not found or not owned by the signed-in doctor.' }, { status: 404 });
    if (record.archivedAt) return NextResponse.json({ success: false, error: 'Archived records cannot be changed.' }, { status: 409 });

    if (action === 'UPDATE_DRAFT') {
      if (record.status !== 'DRAFT') return NextResponse.json({ success: false, error: 'Only draft records can be edited. Create an amendment for finalized records.' }, { status: 409 });
      const update = clinicalUpdate(body);
      if ('subjective' in update && !update.subjective) return NextResponse.json({ success: false, error: 'Chief complaint is required.' }, { status: 400 });
      if ('assessment' in update && !update.assessment) return NextResponse.json({ success: false, error: 'Clinical diagnosis is required.' }, { status: 400 });
      const updated = await prisma.medicalRecord.update({ where: { id }, data: update, include: medicalRecordInclude });
      await writeAuditLog({ actor: auth.user, action: 'MEDICAL_RECORD_UPDATE', targetType: 'MedicalRecord', targetId: id, summary: `Updated draft medical record ${id}.`, request: req, metadata: auditChanges(record, updated) });
      return NextResponse.json({ success: true, record: formatMedicalRecord(updated) });
    }

    if (action === 'FINALIZE') {
      if (record.status !== 'DRAFT') return NextResponse.json({ success: false, error: 'Only draft records can be finalized.' }, { status: 409 });
      const signer = record.doctor?.doctorProfile
        ? `Dr. ${record.doctor.doctorProfile.firstName} ${record.doctor.doctorProfile.lastName}`
        : auth.user.email;
      const finalizedAt = new Date();
      const contentHash = createMedicalRecordContentHash({
        ...record,
        attachmentChecksums: record.attachments.map((attachment) => attachment.checksum),
        prescriptionHashes: record.prescriptions.flatMap((prescription) => prescription.eSignatureHash ? [prescription.eSignatureHash] : []),
      });
      const updated = await prisma.medicalRecord.update({
        where: { id },
        data: { status: 'FINALIZED', finalizedAt, finalizedById: auth.user.id, finalizedByName: signer, contentHash },
        include: medicalRecordInclude,
      });
      await writeAuditLog({ actor: auth.user, action: 'MEDICAL_RECORD_FINALIZE', targetType: 'MedicalRecord', targetId: id, summary: `Finalized medical record ${id} version ${record.version}.`, request: req, metadata: { finalizedAt, signer, contentHash } });
      return NextResponse.json({ success: true, record: formatMedicalRecord(updated) });
    }

    if (action === 'AMEND') {
      const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
      if (record.status !== 'FINALIZED') return NextResponse.json({ success: false, error: 'Only the current finalized version can be amended.' }, { status: 409 });
      if (reason.length < 10) return NextResponse.json({ success: false, error: 'A specific amendment reason of at least 10 characters is required.' }, { status: 400 });
      const amendment = await prisma.$transaction(async (tx) => {
        const changed = await tx.medicalRecord.updateMany({ where: { id, status: 'FINALIZED', archivedAt: null }, data: { status: 'AMENDED' } });
        if (changed.count !== 1) throw new Error('The record lifecycle changed before the amendment could be created.');
        return tx.medicalRecord.create({
          data: {
            patientId: record.patientId,
            doctorId: auth.user.id,
            appointmentId: record.appointmentId,
            queueTicketId: record.queueTicketId,
            visitDate: record.visitDate,
            subjective: record.subjective,
            objective: record.objective,
            assessment: record.assessment,
            plan: record.plan,
            vitals: record.vitals ?? undefined,
            followUpDate: record.followUpDate,
            followUpNotes: record.followUpNotes,
            status: 'DRAFT',
            version: record.version + 1,
            parentRecordId: record.id,
            amendmentReason: reason,
          },
          include: medicalRecordInclude,
        });
      });
      await writeAuditLog({ actor: auth.user, action: 'MEDICAL_RECORD_AMENDMENT_CREATE', targetType: 'MedicalRecord', targetId: amendment.id, summary: `Created amendment version ${amendment.version} from record ${record.id}.`, request: req, metadata: { parentRecordId: record.id, reason } });
      return NextResponse.json({ success: true, record: formatMedicalRecord(amendment) }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: 'Unsupported medical-record action.' }, { status: 400 });
  } catch (error) {
    console.error('Error in PATCH /api/medical-records/[id]:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Failed to update medical record.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await authorizeApi(ACCESS.medicalRecordWrite);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 5) return NextResponse.json({ success: false, error: 'An archive reason of at least 5 characters is required.' }, { status: 400 });
    const existing = await prisma.medicalRecord.findFirst({ where: { id, doctorId: auth.user.id } });
    if (!existing) return NextResponse.json({ success: false, error: 'Medical record not found or not owned by the signed-in doctor.' }, { status: 404 });
    if (existing.archivedAt) return NextResponse.json({ success: false, error: 'Medical record is already archived.' }, { status: 409 });
    const archived = await prisma.medicalRecord.update({
      where: { id },
      data: { archivedAt: new Date(), archivedById: auth.user.id, archiveReason: reason },
    });
    await writeAuditLog({ actor: auth.user, action: 'MEDICAL_RECORD_ARCHIVE', targetType: 'MedicalRecord', targetId: id, summary: `Archived medical record ${id}.`, request: req, metadata: auditChanges(existing, archived, { reason }) });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/medical-records/[id]:', error);
    return NextResponse.json({ success: false, error: 'Failed to archive medical record.' }, { status: 500 });
  }
}
