import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma } from '@clinic/db';
import { authorizeApi, ownPatientId, requireOwnedPatient } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { paginationMeta, paginationParams } from '@/lib/pagination';
import { auditChanges, writeAuditLog } from '@/lib/audit';
import { formatMedicalRecord, medicalRecordInclude } from '@/lib/medical-records';

export async function GET(req: NextRequest) {
  try {
    const auth = await authorizeApi(ACCESS.medicalRecordRead);
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(req.url);
    const requestedPatientId = searchParams.get('patientId');
    const ownershipError = requireOwnedPatient(auth, requestedPatientId);
    if (ownershipError) return ownershipError;
    const patientId = ownPatientId(auth, requestedPatientId);
    const doctorId = searchParams.get('doctorId');
    const search = searchParams.get('search')?.trim();
    const status = searchParams.get('status');
    const includeArchived = auth.user.role === 'ADMIN' && searchParams.get('includeArchived') === 'true';
    const { page, pageSize, skip } = paginationParams(searchParams);

    const whereClause: Prisma.MedicalRecordWhereInput = includeArchived ? {} : { archivedAt: null };
    if (patientId) whereClause.patientId = patientId;
    if (doctorId) whereClause.doctorId = doctorId;
    if (auth.user.role === 'PATIENT') {
      whereClause.status = 'FINALIZED';
    } else if (status && ['DRAFT', 'FINALIZED', 'AMENDED'].includes(status)) {
      whereClause.status = status as 'DRAFT' | 'FINALIZED' | 'AMENDED';
    }
    if (search) {
      whereClause.OR = [
        { patient: { firstName: { contains: search, mode: 'insensitive' } } },
        { patient: { lastName: { contains: search, mode: 'insensitive' } } },
        { assessment: { contains: search, mode: 'insensitive' } },
        { subjective: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [records, total] = await prisma.$transaction([
      prisma.medicalRecord.findMany({
        where: whereClause,
        include: medicalRecordInclude,
        orderBy: [{ visitDate: 'desc' }, { version: 'desc' }],
        skip,
        take: pageSize,
      }),
      prisma.medicalRecord.count({ where: whereClause }),
    ]);

    await writeAuditLog({
      actor: auth.user,
      action: 'MEDICAL_RECORD_VIEW',
      targetType: patientId ? 'PatientProfile' : 'MedicalRecordCollection',
      targetId: patientId,
      summary: `Viewed ${records.length} medical record(s).`,
      request: req,
      metadata: { recordIds: records.map((record) => record.id), page, pageSize, includeArchived },
    });

    return NextResponse.json({ success: true, records: records.map(formatMedicalRecord), pagination: paginationMeta(page, pageSize, total) });
  } catch (error) {
    console.error('Error in GET /api/medical-records:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch medical records.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeApi(ACCESS.medicalRecordWrite);
    if (!auth.ok) return auth.response;
    const body = await req.json();
    const patientId = typeof body.patientId === 'string' ? body.patientId : '';
    if (!patientId) return NextResponse.json({ success: false, error: 'Patient ID is required.' }, { status: 400 });
    if (!String(body.chiefComplaint || '').trim() || !String(body.diagnosis || '').trim()) {
      return NextResponse.json({ success: false, error: 'Chief complaint and clinical diagnosis are required.' }, { status: 400 });
    }
    if (Array.isArray(body.prescriptions) && body.prescriptions.length > 0) {
      return NextResponse.json({ success: false, error: 'Hindi maaaring mag-issue ng reseta mula sa Medical Records form. Gamitin ang Doctor Rx Station para sa required e-signature.' }, { status: 400 });
    }

    let appointmentId: string | null = null;
    let queueTicketId: string | null = null;
    if (body.queueTicketId) {
      const ticket = await prisma.queueTicket.findFirst({
        where: { id: String(body.queueTicketId), patientId, doctor: { userId: auth.user.id } },
        select: { id: true, appointmentId: true },
      });
      if (!ticket) return NextResponse.json({ success: false, error: 'The selected encounter does not belong to this patient and doctor.' }, { status: 400 });
      queueTicketId = ticket.id;
      appointmentId = ticket.appointmentId;
    } else if (body.appointmentId) {
      const appointment = await prisma.appointment.findFirst({
        where: { id: String(body.appointmentId), patientId, doctor: { userId: auth.user.id } },
        select: { id: true, queueTicket: { select: { id: true } } },
      });
      if (!appointment) return NextResponse.json({ success: false, error: 'The selected appointment does not belong to this patient and doctor.' }, { status: 400 });
      appointmentId = appointment.id;
      queueTicketId = appointment.queueTicket?.id || null;
    } else {
      const recentEncounter = await prisma.queueTicket.findFirst({
        where: {
          patientId,
          doctor: { userId: auth.user.id },
          OR: [
            { status: 'IN_CONSULTATION' },
            { status: 'COMPLETED', completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
          ],
        },
        orderBy: { createdAt: 'desc' },
        select: { id: true, appointmentId: true },
      });
      queueTicketId = recentEncounter?.id || null;
      appointmentId = recentEncounter?.appointmentId || null;
    }

    const newRecord = await prisma.medicalRecord.create({
      data: {
        patientId,
        doctorId: auth.user.id,
        appointmentId,
        queueTicketId,
        visitDate: new Date(),
        subjective: `${body.type ? `[${body.type}] ` : ''}${String(body.chiefComplaint).trim()}`,
        objective: String(body.objective || body.notes || 'Clinical examination conducted.').trim(),
        assessment: String(body.diagnosis).trim(),
        plan: String(body.plan || body.notes || 'Follow general medical advice.').trim(),
        vitals: body.vitalSigns || undefined,
        status: 'DRAFT',
      },
      include: medicalRecordInclude,
    });

    await writeAuditLog({
      actor: auth.user,
      action: 'MEDICAL_RECORD_CREATE',
      targetType: 'MedicalRecord',
      targetId: newRecord.id,
      summary: `Created draft medical record ${newRecord.id} for patient ${patientId}.`,
      request: req,
      metadata: auditChanges(null, newRecord, { appointmentId, queueTicketId }),
    });
    return NextResponse.json({ success: true, record: formatMedicalRecord(newRecord) }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/medical-records:', error);
    return NextResponse.json({ success: false, error: 'Failed to create medical record.' }, { status: 500 });
  }
}
