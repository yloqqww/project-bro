import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeMobilePatient } from '@/lib/mobile-auth';
import { writeAuditLog } from '@/lib/audit';

type RouteContext = { params: Promise<{ attachmentId: string }> };

function getSigningSecret() {
  return process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || 'lmc-mobile-attachment-signing-secret';
}

function signAttachmentAccess(attachmentId: string, patientId: string, exp: number) {
  return crypto
    .createHmac('sha256', getSigningSecret())
    .update(`${attachmentId}:${patientId}:${exp}`)
    .digest('base64url');
}

function verifySignedAttachmentAccess(attachmentId: string, patientId: string, expStr: string | null, sig: string | null) {
  if (!expStr || !sig) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = signAttachmentAccess(attachmentId, patientId, exp);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Issues a short-lived (120s) signed URL path so the mobile app can open PDFs/files in the device browser
 * without exposing the patient's Bearer session token in the URL.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;

  const { attachmentId } = await params;
  const attachment = await prisma.medicalRecordAttachment.findFirst({
    where: {
      id: attachmentId,
      archivedAt: null,
      medicalRecord: { archivedAt: null, patientId: auth.patient.patientId },
    },
    select: { id: true, fileName: true, mimeType: true, fileSize: true },
  });

  if (!attachment) {
    return NextResponse.json({ success: false, error: 'Clinical attachment not found.' }, { status: 404 });
  }

  const exp = Date.now() + 120 * 1000;
  const sig = signAttachmentAccess(attachment.id, auth.patient.patientId, exp);
  const downloadPath = `/api/mobile/records/attachments/${encodeURIComponent(attachment.id)}?exp=${exp}&sig=${encodeURIComponent(sig)}`;

  return NextResponse.json({
    success: true,
    downloadPath,
    expiresInSeconds: 120,
    attachment,
  });
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const { attachmentId } = await params;
    const { searchParams } = new URL(req.url);
    const exp = searchParams.get('exp');
    const sig = searchParams.get('sig');
    const format = searchParams.get('format');
    const download = searchParams.get('download') === '1';

    const attachment = await prisma.medicalRecordAttachment.findFirst({
      where: { id: attachmentId, archivedAt: null, medicalRecord: { archivedAt: null } },
      include: {
        medicalRecord: { select: { id: true, patientId: true } },
      },
    });

    if (!attachment) {
      return NextResponse.json({ success: false, error: 'Clinical attachment not found.' }, { status: 404 });
    }

    let actorUserId: string | null = null;
    let actorEmail: string | null = null;

    if (req.headers.get('authorization')?.startsWith('Bearer ')) {
      const auth = await authorizeMobilePatient(req);
      if (!auth.ok) return auth.response;
      if (auth.patient.patientId !== attachment.medicalRecord.patientId) {
        return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
      }
      actorUserId = auth.patient.userId;
      actorEmail = auth.patient.email;
    } else if (!verifySignedAttachmentAccess(attachment.id, attachment.medicalRecord.patientId, exp, sig)) {
      return NextResponse.json({ success: false, error: 'Unauthorized or expired attachment link.' }, { status: 401 });
    }

    await writeAuditLog({
      actor: actorUserId
        ? { id: actorUserId, email: actorEmail, role: 'PATIENT' }
        : { role: 'PATIENT', id: attachment.medicalRecord.patientId },
      action: 'MOBILE_ATTACHMENT_VIEW',
      targetType: 'MedicalRecordAttachment',
      targetId: attachment.id,
      summary: `Patient accessed clinical attachment ${attachment.fileName} via mobile.`,
      request: req,
      metadata: {
        medicalRecordId: attachment.medicalRecordId,
        mimeType: attachment.mimeType,
        download,
      },
    });

    if (format === 'data-url') {
      const base64 = Buffer.from(attachment.data).toString('base64');
      return NextResponse.json({
        success: true,
        id: attachment.id,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        fileSize: attachment.fileSize,
        dataUrl: `data:${attachment.mimeType};base64,${base64}`,
      });
    }

    const encodedName = encodeURIComponent(attachment.fileName);
    const disposition = download ? 'attachment' : 'inline';
    return new NextResponse(Uint8Array.from(attachment.data).buffer, {
      headers: {
        'Content-Type': attachment.mimeType,
        'Content-Length': String(attachment.fileSize),
        'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/mobile/records/attachments/[attachmentId]:', error);
    return NextResponse.json({ success: false, error: 'Failed to load clinical attachment.' }, { status: 500 });
  }
}

