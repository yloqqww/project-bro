import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi, requireOwnedPatient } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { writeAuditLog } from '@/lib/audit';

type RouteContext = { params: Promise<{ attachmentId: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await authorizeApi(ACCESS.medicalRecordRead);
    if (!auth.ok) return auth.response;
    const { attachmentId } = await params;
    const attachment = await prisma.medicalRecordAttachment.findFirst({
      where: { id: attachmentId, archivedAt: null, medicalRecord: { archivedAt: null } },
      include: { medicalRecord: { select: { id: true, patientId: true } } },
    });
    if (!attachment) return NextResponse.json({ success: false, error: 'Clinical attachment not found.' }, { status: 404 });
    const ownershipError = requireOwnedPatient(auth, attachment.medicalRecord.patientId);
    if (ownershipError) return ownershipError;
    const encodedName = encodeURIComponent(attachment.fileName);
    return new NextResponse(Uint8Array.from(attachment.data).buffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Length': String(attachment.fileSize),
        'Content-Disposition': `attachment; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/medical-records/attachments/[attachmentId]:', error);
    return NextResponse.json({ success: false, error: 'Failed to download clinical attachment.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  try {
    const auth = await authorizeApi(ACCESS.medicalRecordWrite);
    if (!auth.ok) return auth.response;
    const { attachmentId } = await params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (reason.length < 5) return NextResponse.json({ success: false, error: 'An archive reason of at least 5 characters is required.' }, { status: 400 });
    const attachment = await prisma.medicalRecordAttachment.findFirst({
      where: { id: attachmentId, archivedAt: null, medicalRecord: { doctorId: auth.user.id, status: 'DRAFT', archivedAt: null } },
      select: { id: true, medicalRecordId: true, fileName: true },
    });
    if (!attachment) return NextResponse.json({ success: false, error: 'Only attachments on an owned draft record can be archived.' }, { status: 404 });
    await prisma.medicalRecordAttachment.update({ where: { id: attachmentId }, data: { archivedAt: new Date(), archiveReason: reason } });
    await writeAuditLog({ actor: auth.user, action: 'MEDICAL_RECORD_ATTACHMENT_ARCHIVE', targetType: 'MedicalRecord', targetId: attachment.medicalRecordId, summary: `Archived clinical attachment ${attachment.fileName}.`, request: req, metadata: { attachmentId, reason } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/medical-records/attachments/[attachmentId]:', error);
    return NextResponse.json({ success: false, error: 'Failed to archive clinical attachment.' }, { status: 500 });
  }
}
