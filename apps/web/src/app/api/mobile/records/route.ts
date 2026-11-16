import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeMobilePatient } from '@/lib/mobile-auth';
import { writeAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await authorizeMobilePatient(req);
  if (!auth.ok) return auth.response;

  const records = await prisma.medicalRecord.findMany({
    where: { patientId: auth.patient.patientId, archivedAt: null },
    include: {
      doctor: { include: { doctorProfile: true } },
      prescriptions: { where: { isActive: true, eSignedAt: { not: null } } },
      attachments: {
        where: { archivedAt: null },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          createdAt: true,
        },
      },
    },
    orderBy: { visitDate: 'desc' },
    take: 50,
  });

  const prescriptions = records.flatMap((record) =>
    record.prescriptions.map((item) => ({
      id: item.id,
      medicationName: item.medicationName,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      instructions: item.instructions,
      prescribedDate: item.prescribedDate,
      doctorName: item.eSignatureName || 'Attending physician',
    }))
  );

  await writeAuditLog({
    actor: { id: auth.patient.userId, email: auth.patient.email, role: 'PATIENT' },
    action: 'MOBILE_MEDICAL_RECORD_VIEW',
    targetType: 'PatientProfile',
    targetId: auth.patient.patientId,
    summary: 'Patient viewed their medical history in the mobile app.',
    request: req,
    metadata: { recordIds: records.map((item) => item.id) },
  });

  return NextResponse.json({
    success: true,
    records: records.map((item) => ({
      id: item.id,
      visitDate: item.visitDate,
      chiefComplaint: item.subjective,
      diagnosis: item.assessment,
      plan: item.plan,
      doctorName: item.doctor.doctorProfile
        ? `Dr. ${item.doctor.doctorProfile.firstName} ${item.doctor.doctorProfile.lastName}`
        : item.doctor.email,
      attachments: item.attachments.map((att) => ({
        id: att.id,
        fileName: att.fileName,
        mimeType: att.mimeType,
        fileSize: att.fileSize,
        createdAt: att.createdAt,
      })),
    })),
    prescriptions,
  });
}
