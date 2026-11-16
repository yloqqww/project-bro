export const medicalRecordInclude = {
  patient: true,
  doctor: { include: { doctorProfile: true } },
  finalizedBy: { include: { doctorProfile: true } },
  appointment: { select: { id: true, appointmentDate: true, status: true, reasonForVisit: true } },
  queueTicket: { select: { id: true, queueNumber: true, queueDate: true, status: true } },
  prescriptions: true,
  attachments: {
    where: { archivedAt: null },
    select: { id: true, fileName: true, mimeType: true, fileSize: true, checksum: true, createdAt: true },
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

function clinicianName(user: any) {
  if (user?.doctorProfile) return `Dr. ${user.doctorProfile.firstName} ${user.doctorProfile.lastName}`;
  return user?.email ? `Dr. ${user.email.split('@')[0]}` : 'Physician';
}

export function formatMedicalRecord(record: any) {
  let vitalsParsed: any = {};
  if (record.vitals) {
    if (typeof record.vitals === 'string') {
      try { vitalsParsed = JSON.parse(record.vitals); } catch { vitalsParsed = {}; }
    } else if (typeof record.vitals === 'object') vitalsParsed = record.vitals;
  }
  const cleanVitals = vitalsParsed?.vitals || vitalsParsed || {};
  const subjective = record.subjective || '';
  let type: 'Consultation' | 'Follow-up' | 'Emergency' | 'Procedure' = 'Consultation';
  const lower = subjective.toLowerCase();
  if (lower.includes('emergency') || lower.includes('urgent')) type = 'Emergency';
  else if (lower.includes('follow-up') || lower.includes('follow up')) type = 'Follow-up';
  else if (lower.includes('procedure') || lower.includes('opera')) type = 'Procedure';

  return {
    id: record.id,
    recordNumber: `MR-${record.id.slice(-6).toUpperCase()}-V${record.version}`,
    patientId: record.patientId,
    patientName: record.patient ? `${record.patient.firstName} ${record.patient.lastName}` : 'Unknown Patient',
    doctorName: clinicianName(record.doctor),
    doctorSpecialty: record.doctor?.doctorProfile?.specialization || 'General Practice',
    date: new Date(record.visitDate).toISOString().split('T')[0],
    time: new Date(record.visitDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type,
    chiefComplaint: subjective.replace(/^\[[^\]]+\]\s*/, '') || 'Clinical Outpatient Consultation',
    diagnosis: record.assessment || 'Under Clinical Evaluation',
    subjective: record.subjective,
    objective: record.objective,
    assessment: record.assessment,
    plan: record.plan,
    prescriptions: (record.prescriptions || []).map((prescription: any) => ({
      id: prescription.id,
      medication: prescription.medicationName,
      dosage: prescription.dosage,
      frequency: prescription.frequency,
      duration: prescription.duration,
      instructions: prescription.instructions || '',
      quantity: prescription.quantity,
      prescribedDate: prescription.prescribedDate,
      isActive: prescription.isActive,
      isSigned: Boolean(prescription.eSignedAt && prescription.eSignatureHash),
      eSignedAt: prescription.eSignedAt,
      eSignatureName: prescription.eSignatureName,
      eSignatureLicense: prescription.eSignatureLicense,
      eSignatureHash: prescription.eSignatureHash,
    })),
    vitalSigns: {
      bloodPressure: String(cleanVitals.bloodPressure || ''),
      heartRate: String(cleanVitals.heartRate || ''),
      temperature: String(cleanVitals.temperature || ''),
      weight: String(cleanVitals.weight || ''),
    },
    notes: record.plan
      ? `Plan: ${record.plan}${record.objective ? ` | Exam Findings: ${record.objective}` : ''}`
      : record.objective || '',
    status: record.status,
    version: record.version,
    parentRecordId: record.parentRecordId,
    amendmentReason: record.amendmentReason,
    finalizedAt: record.finalizedAt,
    finalizedByName: record.finalizedByName || (record.finalizedBy ? clinicianName(record.finalizedBy) : null),
    contentHash: record.contentHash,
    archivedAt: record.archivedAt,
    archiveReason: record.archiveReason,
    appointment: record.appointment,
    queueTicket: record.queueTicket,
    attachments: record.attachments || [],
  };
}
