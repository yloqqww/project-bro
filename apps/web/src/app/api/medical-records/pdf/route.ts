import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { createTextPdf } from '@/lib/simple-pdf';
import { writeAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.medicalRecordRead);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  const recordId = searchParams.get('recordId');
  const patientId = searchParams.get('patientId');
  if (!recordId && !patientId) return NextResponse.json({ success: false, error: 'recordId or patientId is required.' }, { status: 400 });

  const lifecycleFilter = auth.user.role === 'PATIENT' ? { status: 'FINALIZED' as const } : {};
  const records = await prisma.medicalRecord.findMany({
    where: recordId
      ? { id: recordId, archivedAt: null, ...lifecycleFilter }
      : { patientId: patientId!, archivedAt: null, ...lifecycleFilter },
    include: {
      patient: true,
      doctor: { include: { doctorProfile: true } },
      prescriptions: true,
      finalizedBy: { include: { doctorProfile: true } },
      appointment: { select: { id: true } },
      queueTicket: { select: { id: true, queueNumber: true } },
      attachments: { where: { archivedAt: null }, select: { fileName: true, checksum: true } },
    },
    orderBy: { visitDate: 'desc' },
  });
  if (!records.length) return NextResponse.json({ success: false, error: 'Medical record not found.' }, { status: 404 });
  if (auth.user.role === 'PATIENT' && records.some((record) => record.patientId !== auth.user.patientProfileId)) {
    return NextResponse.json({ success: false, error: 'Forbidden.' }, { status: 403 });
  }

  const patient = records[0].patient;
  const lines = records.flatMap((record, index) => [
    `${index + 1}. Visit: ${record.visitDate.toISOString()}`,
    `Lifecycle: ${record.status} | Version: ${record.version}`,
    `Finalized: ${record.finalizedAt?.toISOString() || 'Not finalized'} | Signer: ${record.finalizedByName || 'N/A'}`,
    `Integrity hash: ${record.contentHash || 'Legacy record - no hash available'}`,
    `Encounter: Appointment ${record.appointment?.id || 'N/A'} | Queue ${record.queueTicket ? `#${record.queueTicket.queueNumber} (${record.queueTicket.id})` : 'N/A'}`,
    ...(record.amendmentReason ? [`Amendment reason: ${record.amendmentReason}`] : []),
    `Physician: ${record.doctor.doctorProfile ? `Dr. ${record.doctor.doctorProfile.firstName} ${record.doctor.doctorProfile.lastName}` : record.doctor.email}`,
    `Subjective: ${record.subjective}`,
    `Objective: ${record.objective}`,
    `Assessment: ${record.assessment}`,
    `Plan: ${record.plan}`,
    ...record.prescriptions.map((rx) => `Prescription: ${rx.medicationName} ${rx.dosage}; ${rx.frequency}; ${rx.duration}`),
    ...record.attachments.map((attachment) => `Attachment: ${attachment.fileName} | SHA-256 ${attachment.checksum}`),
    '',
  ]);
  const filename = recordId ? `medical-record-${recordId}.pdf` : `medical-chart-${patient.id}.pdf`;
  const pdf = createTextPdf(`Medical Record - ${patient.firstName} ${patient.lastName}`, lines);
  await writeAuditLog({ actor: auth.user, action: 'MEDICAL_RECORD_EXPORT', targetType: recordId ? 'MedicalRecord' : 'PatientProfile', targetId: recordId || patient.id, summary: `PDF medical record exported for ${patient.firstName} ${patient.lastName}.`, request: req });
  return new NextResponse(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store' } });
}
