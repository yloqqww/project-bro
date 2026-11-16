import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import bcrypt from 'bcryptjs';
import { authorizeApi, ownPatientId, requireOwnedPatient } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { createPrescriptionSignatureHash } from '@/lib/prescription-signature';
import { auditChanges, writeAuditLog } from '@/lib/audit';

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.medicalRecordRead);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const patientId = searchParams.get('patientId');
    const cardUid = searchParams.get('cardUid');

    const ownershipError = requireOwnedPatient(auth, patientId);
    if (ownershipError) return ownershipError;
    let targetPatientId = ownPatientId(auth, patientId);

    if (!targetPatientId && cardUid && auth.user.role !== 'PATIENT') {
      const card = await prisma.rfidCard.findFirst({
        where: {
          cardUid: cardUid.trim().toUpperCase(),
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      if (card) {
        targetPatientId = card.patientId;
      }
    }

    if (!targetPatientId) {
      return NextResponse.json(
        { success: false, error: 'Patient ID or Card UID is required' },
        { status: 400 }
      );
    }

    const prescriptions = await prisma.prescription.findMany({
      where: {
        medicalRecord: {
          patientId: targetPatientId,
        },
        isActive: true,
        ...(auth.user.role === 'PATIENT' ? { eSignedAt: { not: null } } : {}),
      },
      include: {
        doctor: {
          include: {
            doctorProfile: true,
          },
        },
        medicalRecord: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formatted = prescriptions.map((p) => ({
      id: p.id,
      medication: p.medicationName,
      medicationName: p.medicationName,
      dosage: p.dosage,
      frequency: p.frequency,
      duration: p.duration,
      instructions: p.instructions || '',
      quantity: p.quantity,
      prescribedDate: new Date(p.prescribedDate).toLocaleDateString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
      doctor: p.doctor?.doctorProfile
        ? `Dr. ${p.doctor.doctorProfile.firstName} ${p.doctor.doctorProfile.lastName}`
        : 'Attending Physician',
      doctorName: p.eSignatureName || (p.doctor?.doctorProfile
        ? `${p.doctor.doctorProfile.firstName} ${p.doctor.doctorProfile.lastName}`
        : 'Attending Physician'),
      specialty: p.doctor?.doctorProfile?.specialization || 'Outpatient Clinic',
      isSigned: Boolean(p.eSignedAt && p.eSignatureHash),
      eSignedAt: p.eSignedAt,
      eSignatureName: p.eSignatureName,
      eSignatureLicense: p.eSignatureLicense,
      eSignatureHash: p.eSignatureHash,
    }));

    await writeAuditLog({ actor: auth.user, action: 'PRESCRIPTION_VIEW', targetType: 'PatientProfile', targetId: targetPatientId, summary: `Viewed ${prescriptions.length} active prescription record(s).`, request: req, metadata: { prescriptionIds: prescriptions.map((item) => item.id) } });

    return NextResponse.json({ success: true, prescriptions: formatted });
  } catch (error) {
    console.error('Error in GET /api/prescriptions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch prescriptions' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.prescriptionWrite);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const {
      patientId,
      cardUid,
      items,
      medicationName,
      dosage,
      frequency,
      duration,
      instructions,
      quantity,
      signaturePassword,
      signatureConsent,
    } = body;

    if (signatureConsent !== true || typeof signaturePassword !== 'string' || !signaturePassword) {
      return NextResponse.json(
        { success: false, error: 'Kailangan ang e-sign consent at kasalukuyang password ng doktor bago ma-issue ang reseta.' },
        { status: 400 }
      );
    }

    const signingDoctor = await prisma.user.findUnique({
      where: { id: auth.user.id },
      select: {
        password: true,
        doctorProfile: {
          select: { firstName: true, lastName: true, licenseNumber: true, isActive: true },
        },
      },
    });

    if (!signingDoctor?.doctorProfile?.isActive) {
      return NextResponse.json(
        { success: false, error: 'Walang aktibong doctor profile na maaaring pumirma sa resetang ito.' },
        { status: 403 }
      );
    }

    const passwordMatches = await bcrypt.compare(signaturePassword, signingDoctor.password);
    if (!passwordMatches) {
      return NextResponse.json(
        { success: false, error: 'Mali ang password. Hindi na-e-sign o na-issue ang reseta.' },
        { status: 401 }
      );
    }

    let targetPatientId = patientId;
    if (!targetPatientId && cardUid) {
      const card = await prisma.rfidCard.findFirst({
        where: {
          cardUid: cardUid.trim().toUpperCase(),
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });
      if (card) {
        targetPatientId = card.patientId;
      }
    }

    if (!targetPatientId) {
      return NextResponse.json(
        { success: false, error: 'Patient ID is required' },
        { status: 400 }
      );
    }

    const doctorUserId = auth.user.id;

    // Compile items to insert
    const itemsToInsert: Array<{
      medicationName: string;
      dosage: string;
      frequency: string;
      duration?: string;
      instructions?: string;
      quantity?: number | null;
    }> = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        if (it.medicationName && it.dosage && it.frequency) {
          itemsToInsert.push({
            medicationName: it.medicationName.trim(),
            dosage: it.dosage.trim(),
            frequency: it.frequency.trim(),
            duration: it.duration?.trim() || '7 days',
            instructions: it.instructions?.trim() || '',
            quantity: it.quantity && Number.isFinite(Number(it.quantity)) ? parseInt(it.quantity, 10) : null,
          });
        }
      }
    } else if (medicationName && dosage && frequency) {
      itemsToInsert.push({
        medicationName: medicationName.trim(),
        dosage: dosage.trim(),
        frequency: frequency.trim(),
        duration: duration?.trim() || '7 days',
        instructions: instructions?.trim() || '',
        quantity: quantity && Number.isFinite(Number(quantity)) ? parseInt(quantity, 10) : null,
      });
    }

    if (itemsToInsert.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one valid prescription item (name, dosage, frequency) is required.' },
        { status: 400 }
      );
    }

    const signedAt = new Date();
    const signatureName = `Dr. ${signingDoctor.doctorProfile.firstName} ${signingDoctor.doctorProfile.lastName}`;
    const signatureLicense = signingDoctor.doctorProfile.licenseNumber;

    const createdList = await prisma.$transaction(async (tx) => {
      let medicalRecord = await tx.medicalRecord.findFirst({
        where: { patientId: targetPatientId, doctorId: doctorUserId, status: 'DRAFT', archivedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (!medicalRecord) {
        const encounter = await tx.queueTicket.findFirst({
          where: {
            patientId: targetPatientId,
            doctor: { userId: doctorUserId },
            OR: [
              { status: 'IN_CONSULTATION' },
              { status: 'COMPLETED', completedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true, appointmentId: true },
        });
        medicalRecord = await tx.medicalRecord.create({
          data: {
            patientId: targetPatientId,
            doctorId: doctorUserId,
            appointmentId: encounter?.appointmentId || null,
            queueTicketId: encounter?.id || null,
            visitDate: signedAt,
            subjective: 'Outpatient Consultation Encounter',
            objective: 'Physical Examination & Clinical Assessment',
            assessment: 'Outpatient Prescription Issued',
            plan: 'Prescribed Medications and Outpatient Care Instructions',
            status: 'DRAFT',
          },
        });
      }

      const signedPrescriptions = [];
      for (const item of itemsToInsert) {
        const created = await tx.prescription.create({
          data: {
            medicalRecordId: medicalRecord.id,
            doctorId: doctorUserId,
            medicationName: item.medicationName,
            dosage: item.dosage,
            frequency: item.frequency,
            duration: item.duration || '7 days',
            instructions: item.instructions || '',
            quantity: item.quantity ?? null,
            prescribedDate: signedAt,
            isActive: true,
            eSignedAt: signedAt,
            eSignatureName: signatureName,
            eSignatureLicense: signatureLicense,
          },
        });

        const eSignatureHash = createPrescriptionSignatureHash({
          prescriptionId: created.id,
          doctorId: doctorUserId,
          patientId: targetPatientId,
          medicalRecordId: medicalRecord.id,
          medicationName: created.medicationName,
          dosage: created.dosage,
          frequency: created.frequency,
          duration: created.duration,
          instructions: created.instructions || '',
          quantity: created.quantity,
          signedAt,
        });

        signedPrescriptions.push(await tx.prescription.update({
          where: { id: created.id },
          data: { eSignatureHash },
        }));
      }
      return signedPrescriptions;
    });

    await writeAuditLog({ actor: auth.user, action: 'PRESCRIPTION_ISSUED', targetType: 'PatientProfile', targetId: targetPatientId, summary: `Issued and e-signed ${createdList.length} prescription(s).`, request: req, metadata: auditChanges(null, createdList, { prescriptionIds: createdList.map((item) => item.id) }) });

    return NextResponse.json({
      success: true,
      message: `Successfully e-signed and issued ${createdList.length} prescription(s)`,
      count: createdList.length,
      prescriptions: createdList,
      signature: {
        name: signatureName,
        licenseNumber: signatureLicense,
        signedAt,
      },
    });
  } catch (error: any) {
    console.error('Error in POST /api/prescriptions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to issue prescription', details: error?.message || String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.prescriptionWrite);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Prescription ID is required' }, { status: 400 });
    }

    const ownedPrescription = await prisma.prescription.findFirst({
      where: { id, doctorId: auth.user.id },
    });
    if (!ownedPrescription) {
      return NextResponse.json({ success: false, error: 'Prescription not found' }, { status: 404 });
    }

    const cancelled = await prisma.prescription.update({
      where: { id },
      data: { isActive: false },
    });

    await writeAuditLog({ actor: auth.user, action: 'PRESCRIPTION_CANCELLED', targetType: 'Prescription', targetId: id, summary: `Prescription ${id} was marked inactive.`, request: req, metadata: auditChanges(ownedPrescription, cancelled) });

    return NextResponse.json({ success: true, message: 'Prescription marked inactive' });
  } catch (error) {
    console.error('Error in DELETE /api/prescriptions:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete prescription' }, { status: 500 });
  }
}
