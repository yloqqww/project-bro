import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { sha256Bytes } from '@/lib/medical-record-integrity';
import { writeAuditLog } from '@/lib/audit';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await authorizeApi(ACCESS.medicalRecordWrite);
    if (!auth.ok) return auth.response;
    const { id } = await params;
    const record = await prisma.medicalRecord.findFirst({ where: { id, doctorId: auth.user.id } });
    if (!record) return NextResponse.json({ success: false, error: 'Medical record not found or not owned by the signed-in doctor.' }, { status: 404 });
    if (record.archivedAt) return NextResponse.json({ success: false, error: 'Archived records cannot accept attachments.' }, { status: 409 });
    if (record.status !== 'DRAFT') return NextResponse.json({ success: false, error: 'Attachments can only be added to a draft. Create an amendment first.' }, { status: 409 });

    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) return NextResponse.json({ success: false, error: 'A PDF, JPEG, or PNG file is required.' }, { status: 400 });
    if (!ALLOWED_TYPES.has(file.type)) return NextResponse.json({ success: false, error: 'Only PDF, JPEG, and PNG clinical attachments are allowed.' }, { status: 415 });
    if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) return NextResponse.json({ success: false, error: 'Attachment must be between 1 byte and 10 MB.' }, { status: 413 });

    const bytes = Buffer.from(await file.arrayBuffer());
    const checksum = sha256Bytes(bytes);
    const safeName = file.name.replace(/[\r\n"\\/]/g, '_').slice(0, 180) || 'clinical-attachment';
    const duplicate = await prisma.medicalRecordAttachment.findFirst({ where: { medicalRecordId: id, checksum, archivedAt: null } });
    if (duplicate) return NextResponse.json({ success: false, error: 'This exact attachment is already linked to the record.' }, { status: 409 });

    const attachment = await prisma.medicalRecordAttachment.create({
      data: { medicalRecordId: id, fileName: safeName, mimeType: file.type, fileSize: file.size, checksum, data: bytes, uploadedById: auth.user.id },
      select: { id: true, fileName: true, mimeType: true, fileSize: true, checksum: true, createdAt: true },
    });
    await writeAuditLog({ actor: auth.user, action: 'MEDICAL_RECORD_ATTACHMENT_ADD', targetType: 'MedicalRecord', targetId: id, summary: `Added clinical attachment ${safeName} to record ${id}.`, request: req, metadata: { attachmentId: attachment.id, checksum, fileSize: file.size, mimeType: file.type } });
    return NextResponse.json({ success: true, attachment }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/medical-records/[id]/attachments:', error);
    return NextResponse.json({ success: false, error: 'Failed to upload clinical attachment.' }, { status: 500 });
  }
}
