import { NextRequest, NextResponse } from 'next/server';
import { prisma, UserRole, BloodType, RfidCardStatus } from '@clinic/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { CreatePatientAdminSchema, UpdatePatientAdminSchema } from '@clinic/types';
import { authorizeApi, ownPatientId, requireOwnedPatient } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { getClinicSettings, operationalQueueDate, resolveQueuePrefix } from '@/lib/clinic-settings';
import { paginationMeta, paginationParams } from '@/lib/pagination';
import { auditChanges, writeAuditLog } from '@/lib/audit';
import { calculateQueueMetrics } from '@/lib/queue-service';
import { clearRateLimit, consumeRateLimit } from '@/lib/security-rate-limit';
import { findDuplicateCandidates, nextPatientMrn, normalizePatientIdentity, recordDemographicChange } from '@/lib/patient-master-index';

const PATIENT_PORTAL_WINDOW_MS = 15 * 60 * 1000;
const PATIENT_PORTAL_MAX_FAILURES = 10;

function patientPortalAttemptKey(req: NextRequest, lookup: string) {
  const forwardedFor = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return `${forwardedFor || 'local'}:${lookup}`;
}

function mapBloodType(bt: string): BloodType {
  if (!bt) return BloodType.UNKNOWN;
  const clean = bt.trim().toUpperCase().replace(/\s+/g, '');
  if (clean === 'O+' || clean === 'O_POSITIVE') return BloodType.O_POSITIVE;
  if (clean === 'O-' || clean === 'O_NEGATIVE') return BloodType.O_NEGATIVE;
  if (clean === 'A+' || clean === 'A_POSITIVE') return BloodType.A_POSITIVE;
  if (clean === 'A-' || clean === 'A_NEGATIVE') return BloodType.A_NEGATIVE;
  if (clean === 'B+' || clean === 'B_POSITIVE') return BloodType.B_POSITIVE;
  if (clean === 'B-' || clean === 'B_NEGATIVE') return BloodType.B_NEGATIVE;
  if (clean === 'AB+' || clean === 'AB_POSITIVE') return BloodType.AB_POSITIVE;
  if (clean === 'AB-' || clean === 'AB_NEGATIVE') return BloodType.AB_NEGATIVE;
  return BloodType.UNKNOWN;
}

function formatBloodTypeDisplay(bt: BloodType): string {
  switch (bt) {
    case BloodType.O_POSITIVE: return 'O+';
    case BloodType.O_NEGATIVE: return 'O-';
    case BloodType.A_POSITIVE: return 'A+';
    case BloodType.A_NEGATIVE: return 'A-';
    case BloodType.B_POSITIVE: return 'B+';
    case BloodType.B_NEGATIVE: return 'B-';
    case BloodType.AB_POSITIVE: return 'AB+';
    case BloodType.AB_NEGATIVE: return 'AB-';
    default: return 'N/A';
  }
}

function parsePatientVitals(chronicConditions: string | null) {
  const defaultVitals = {
    bloodPressure: '120/80',
    heartRate: 75,
    temperature: 36.6,
    weight: 65,
    height: 165,
    bmi: 23.9,
    oxygenSaturation: 98,
    respiratoryRate: 18,
    recordedAt: new Date().toISOString(),
  };

  if (!chronicConditions) return defaultVitals;

  try {
    const parsed = JSON.parse(chronicConditions);
    if (parsed && typeof parsed === 'object' && parsed.vitals) {
      return { ...defaultVitals, ...parsed.vitals };
    }
    if (parsed && typeof parsed === 'object' && (parsed.bloodPressure || parsed.temperature)) {
      return { ...defaultVitals, ...parsed };
    }
  } catch (_) {}

  return defaultVitals;
}

function parseChronicConditions(raw: string | null): string {
  if (!raw || !raw.trim()) return 'None reported';
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.length > 0 ? parsed.join(', ') : 'None reported';
    }
    if (parsed && typeof parsed === 'object') {
      if (parsed.conditions) {
        if (Array.isArray(parsed.conditions)) {
          return parsed.conditions.length > 0 ? parsed.conditions.join(', ') : 'None reported';
        }
        return String(parsed.conditions);
      }
      if (parsed.chronicConditions) {
        if (Array.isArray(parsed.chronicConditions)) {
          return parsed.chronicConditions.length > 0 ? parsed.chronicConditions.join(', ') : 'None reported';
        }
        return String(parsed.chronicConditions);
      }
      // If object only contains vitals, return clean label
      if (parsed.vitals || parsed.bloodPressure || parsed.temperature) {
        return 'None reported';
      }
    }
  } catch (_) {
    if (!raw.startsWith('{') && !raw.startsWith('[')) {
      return raw;
    }
  }
  return 'None reported';
}

function parseAllergies(raw: string | null): string {
  if (!raw || !raw.trim()) return 'No known drug allergies (NKDA)';
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.length > 0 ? parsed.join(', ') : 'No known drug allergies (NKDA)';
    }
    if (typeof parsed === 'string' && parsed.trim()) {
      return parsed;
    }
  } catch (_) {
    if (!raw.startsWith('{') && !raw.startsWith('[')) {
      return raw;
    }
  }
  return 'No known drug allergies (NKDA)';
}

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.patientRead);
  try {
    const settings = await getClinicSettings();
    const activeQueueDate = operationalQueueDate(new Date(), settings.queueResetTime);
    const { searchParams } = new URL(req.url);
    let cardUid = searchParams.get('cardUid')?.trim().toUpperCase();
    let patientId = searchParams.get('patientId')?.trim();
    let search = searchParams.get('search')?.trim();
    const gender = searchParams.get('gender');
    const cardStatus = searchParams.get('cardStatus');
    const portalLookup = searchParams.get('portalLookup')?.trim().toUpperCase();
    const phoneLast4 = searchParams.get('phoneLast4')?.replace(/\D/g, '');
    const dateOfBirth = searchParams.get('dateOfBirth');
    const isPublicPortalLookup = !auth.ok && Boolean(portalLookup && phoneLast4?.length === 4 && dateOfBirth && /^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth));

    if (!auth.ok && !isPublicPortalLookup) return auth.response;

    if (isPublicPortalLookup && portalLookup && phoneLast4) {
      const attemptKey = patientPortalAttemptKey(req, portalLookup);
      const portalLimit = await consumeRateLimit('PATIENT_PORTAL_LOOKUP', attemptKey, PATIENT_PORTAL_MAX_FAILURES, PATIENT_PORTAL_WINDOW_MS);
      if (!portalLimit.allowed) {
        return NextResponse.json(
          { success: false, error: 'Masyadong maraming maling verification. Subukan muli pagkalipas ng 15 minuto.' },
          { status: 429 }
        );
      }

      const activeCard = await prisma.rfidCard.findFirst({
        where: {
          cardUid: portalLookup,
          patient: { status: 'ACTIVE' },
          status: RfidCardStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { patientId: true },
      });

      if (activeCard) {
        patientId = activeCard.patientId;
      } else {
        const currentTickets = await prisma.queueTicket.findMany({
          where: { queueDate: activeQueueDate },
          include: { doctor: true },
          orderBy: { createdAt: 'desc' },
          take: 500,
        });
        const matchedTicket = currentTickets.find((ticket) => {
          const displayNumber = `${resolveQueuePrefix(settings, ticket.doctor.specialization, ticket.priority)}-${String(ticket.queueNumber).padStart(2, '0')}`;
          return ticket.id.toUpperCase() === portalLookup || displayNumber.toUpperCase() === portalLookup;
        });
        patientId = matchedTicket?.patientId;
      }

      const portalPatient = patientId
        ? await prisma.patientProfile.findFirst({ where: { id: patientId, status: 'ACTIVE' }, select: { phoneNumber: true, dateOfBirth: true } })
        : null;
      const registeredPhone = portalPatient?.phoneNumber.replace(/\D/g, '') || '';
      if (!portalPatient || !registeredPhone.endsWith(phoneLast4) || portalPatient.dateOfBirth.toISOString().slice(0, 10) !== dateOfBirth) {
        return NextResponse.json(
          { success: false, error: 'Hindi nagtugma ang RFID/Ticket at registered phone number.' },
          { status: 404 }
        );
      }

      await clearRateLimit('PATIENT_PORTAL_LOOKUP', attemptKey);

      cardUid = undefined;
      search = undefined;
    }

    if (auth.ok) {
      const ownershipError = requireOwnedPatient(auth, patientId);
      if (ownershipError) return ownershipError;
      if (auth.user.role === 'PATIENT') {
        patientId = ownPatientId(auth, patientId) || undefined;
        cardUid = undefined;
        search = undefined;
      }
    }

    if (cardUid || patientId) {
      let p: any = null;
      let activeCardUid = 'NO_CARD';

      if (patientId) {
        p = await prisma.patientProfile.findFirst({
          where: { id: patientId, status: 'ACTIVE' },
          include: {
            rfidCards: {
              where: {
                status: RfidCardStatus.ACTIVE,
                OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
              },
              take: 1,
            },
            queueTickets: {
              where: {
                queueDate: activeQueueDate,
              },
              include: { doctor: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
            medicalRecords: {
              orderBy: { visitDate: 'desc' },
              take: 5,
              include: {
                doctor: {
                  include: {
                    doctorProfile: true,
                  },
                },
              },
            },
          },
        });
        activeCardUid = p?.rfidCards?.[0]?.cardUid || 'NO_CARD';
      } else if (cardUid) {
        const card: any = await prisma.rfidCard.findFirst({
          where: {
            cardUid,
            status: RfidCardStatus.ACTIVE,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          include: {
            patient: {
              include: {
                rfidCards: {
                  where: {
                    status: RfidCardStatus.ACTIVE,
                    OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
                  },
                  take: 1,
                },
                queueTickets: {
                  where: {
                    queueDate: activeQueueDate,
                  },
                  include: { doctor: true },
                  orderBy: { createdAt: 'desc' },
                  take: 1,
                },
                medicalRecords: {
                  orderBy: { visitDate: 'desc' },
                  take: 5,
                  include: {
                    doctor: {
                      include: {
                        doctorProfile: true,
                      },
                    },
                  },
                },
              },
            },
          },
        });
        p = card?.patient || null;
        activeCardUid = card?.cardUid || 'NO_CARD';
      }

      if (!p) {
        return NextResponse.json(
          { success: false, error: 'Patient not found' },
          { status: 404 }
        );
      }

      const todayTicket = p.queueTickets?.[0] || null;
      const queueMetrics = todayTicket ? await calculateQueueMetrics(prisma, todayTicket, activeQueueDate) : null;
      const canViewClinicalDetails = isPublicPortalLookup || (auth.ok && auth.user.role !== 'RECEPTIONIST');

      // Calculate age
      const dob = new Date(p.dateOfBirth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
        age--;
      }

      // Fetch active prescriptions for patient
      const activePrescriptions = await prisma.prescription.findMany({
        where: {
          medicalRecord: { patientId: p.id },
          isActive: true,
          eSignedAt: { not: null },
        },
        include: {
          doctor: {
            include: { doctorProfile: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      const formattedPatient = {
        id: p.id,
        patientNo: p.mrn,
        name: `${p.firstName} ${p.lastName}`,
        firstName: p.firstName,
        lastName: p.lastName,
        middleName: p.middleName,
        cardUid: activeCardUid,
        dateOfBirth: p.dateOfBirth.toISOString().split('T')[0],
        age: age > 0 ? age : 0,
        gender: p.gender,
        bloodType: formatBloodTypeDisplay(p.bloodType),
        phone: p.phoneNumber,
        address: `${p.address}, ${p.city}, ${p.state}`,
        emergencyContact: `${p.emergencyContactName} (${p.emergencyContactRelation}) • ${p.emergencyContactPhone}`,
        allergies: canViewClinicalDetails ? parseAllergies(p.allergies) : undefined,
        chronicConditions: canViewClinicalDetails ? parseChronicConditions(p.chronicConditions) : undefined,
        lastVisit: p.updatedAt.toISOString().split('T')[0],
        vitals: canViewClinicalDetails ? parsePatientVitals(p.chronicConditions) : undefined,
        prescriptions: canViewClinicalDetails ? activePrescriptions.map((rx) => ({
          id: rx.id,
          medication: rx.medicationName,
          dosage: rx.dosage,
          frequency: rx.frequency,
          duration: rx.duration,
          instructions: rx.instructions || '',
          quantity: rx.quantity,
          prescribedDate: new Date(rx.prescribedDate).toLocaleDateString([], {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          }),
          doctor: rx.doctor?.doctorProfile
            ? `Dr. ${rx.doctor.doctorProfile.firstName} ${rx.doctor.doctorProfile.lastName}`
            : 'Attending Physician',
          eSignedAt: rx.eSignedAt,
          eSignatureName: rx.eSignatureName,
          eSignatureLicense: rx.eSignatureLicense,
          eSignatureHash: rx.eSignatureHash,
        })) : [],
        pastRecords: canViewClinicalDetails && Array.isArray(p.medicalRecords)
          ? p.medicalRecords.map((m: any) => ({
              id: m.id,
              date: new Date(m.visitDate).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' }),
              doctor: m.doctor?.doctorProfile
                ? `Dr. ${m.doctor.doctorProfile.firstName} ${m.doctor.doctorProfile.lastName}`
                : (m.doctor?.email || 'Attending Physician'),
              diagnosis: m.assessment,
              subjective: m.subjective,
              plan: m.plan,
            }))
          : [],
        triageReason: p.medicalRecords?.[0]?.subjective || 'General Outpatient Check-up',
        currentQueue: todayTicket
          ? {
              id: todayTicket.id,
              ticketNumber: `${resolveQueuePrefix(settings, todayTicket.doctor.specialization, todayTicket.priority)}-${String(todayTicket.queueNumber).padStart(2, '0')}`,
              department: todayTicket.doctor.specialization,
              doctor: `Dr. ${todayTicket.doctor.firstName} ${todayTicket.doctor.lastName}`,
              room: todayTicket.doctor.roomNumber || 'Room 101',
              status: todayTicket.status,
              position: queueMetrics?.position || 0,
              peopleAhead: queueMetrics?.peopleAhead || 0,
              estimatedWaitMinutes: queueMetrics?.estimatedWaitMinutes || 0,
              averageConsultationMinutes: queueMetrics?.averageConsultationMinutes || 15,
              recallCount: todayTicket.recallCount,
              lastRecalledAt: todayTicket.lastRecalledAt,
              priority: todayTicket.priority > 0 ? 'Urgent' : 'Regular',
              reasonForVisit: p.medicalRecords?.[0]?.subjective || 'General Outpatient Check-up',
              timeIssued: new Date(todayTicket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }
          : null,
      };

      await writeAuditLog({ actor: auth.ok ? auth.user : { role: 'PUBLIC' }, action: 'PATIENT_RECORD_VIEW', targetType: 'PatientProfile', targetId: p.id, summary: `Patient record ${p.id} was viewed.`, request: req, metadata: { lookupMethod: patientId ? 'PATIENT_ID' : cardUid ? 'RFID' : 'PORTAL_VERIFICATION' } });

      return NextResponse.json({ success: true, patient: formattedPatient });
    }

    // List or search patients
    if (!auth.ok) {
      return NextResponse.json(
        { success: false, error: 'RFID/Ticket, date of birth, at huling 4 digits ng phone ang kailangan.' },
        { status: 400 }
      );
    }
    const includeInactive = auth.user.role === 'ADMIN' && searchParams.get('includeInactive') === 'true';
    const whereClause: any = includeInactive ? {} : { status: 'ACTIVE' };
    if (search) {
      whereClause.OR = [
        { mrn: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { phoneNumber: { contains: search } },
      ];
    }
    if (gender && gender !== 'ALL') whereClause.gender = gender.toUpperCase();
    if (cardStatus === 'ACTIVE') whereClause.rfidCards = { some: { status: RfidCardStatus.ACTIVE } };
    if (cardStatus === 'UNASSIGNED') whereClause.rfidCards = { none: { status: RfidCardStatus.ACTIVE } };

    const { page, pageSize, skip } = paginationParams(searchParams);
    const [patients, total] = await prisma.$transaction([
      prisma.patientProfile.findMany({
      where: whereClause,
      include: {
        user: { select: { email: true } },
        rfidCards: {
          where: {
            status: RfidCardStatus.ACTIVE,
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      }),
      prisma.patientProfile.count({ where: whereClause }),
    ]);

    const formattedList = patients.map((p) => ({
      id: p.id,
      patientNo: p.mrn,
      recordStatus: p.status,
      archivedAt: p.archivedAt,
      archiveReason: p.archiveReason,
      mergedIntoId: p.mergedIntoId,
      name: `${p.firstName} ${p.lastName}`,
      firstName: p.firstName,
      lastName: p.lastName,
      cardUid: p.rfidCards[0]?.cardUid || 'NO_CARD',
      cardStatus: p.rfidCards[0]?.status || null,
      dateOfBirth: p.dateOfBirth.toISOString().split('T')[0],
      gender: p.gender,
      bloodType: formatBloodTypeDisplay(p.bloodType),
      phone: p.phoneNumber,
      email: p.user.email,
      streetAddress: p.address,
      city: p.city,
      state: p.state,
      zipCode: p.zipCode,
      address: `${p.address}, ${p.city}, ${p.state}`,
      emergencyContact: `${p.emergencyContactName} (${p.emergencyContactRelation}) • ${p.emergencyContactPhone}`,
      lastVisit: p.updatedAt.toISOString().split('T')[0],
      vitals: parsePatientVitals(p.chronicConditions),
    }));

    return NextResponse.json({ success: true, patients: formattedList, pagination: paginationMeta(page, pageSize, total) });
  } catch (error) {
    console.error('Error in GET /api/patients:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch patient data' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.patientWrite);
  if (!auth.ok) return auth.response;

  try {
    const parsed = UpdatePatientAdminSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Please correct the patient information and try again.',
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const birthDate = new Date(`${input.dateOfBirth}T00:00:00.000Z`);
    if (Number.isNaN(birthDate.getTime()) || birthDate >= new Date() || birthDate.getUTCFullYear() < 1900) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_DATE_OF_BIRTH', message: 'Date of birth must be a valid past date.' } },
        { status: 400 }
      );
    }

    const existing = await prisma.patientProfile.findUnique({
      where: { id: input.patientId },
      include: { user: { select: { email: true } } },
    });
    if (!existing || existing.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: { code: 'PATIENT_NOT_FOUND', message: 'Patient not found.' } },
        { status: 404 }
      );
    }

    const duplicateCandidates = await findDuplicateCandidates(prisma, { ...input, dateOfBirth: birthDate }, input.patientId);
    if (duplicateCandidates.some((candidate) => candidate.matchLevel === 'HIGH') && !input.duplicateOverrideReason) {
      return NextResponse.json(
        { success: false, error: { code: 'POSSIBLE_DUPLICATE', message: 'A likely duplicate patient record requires master-index review.', candidates: duplicateCandidates } },
        { status: 409 }
      );
    }

    const normalizedEmail = input.email.trim().toLowerCase();
    if (normalizedEmail) {
      const emailOwner = await prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } });
      if (emailOwner && emailOwner.id !== existing.userId) {
        return NextResponse.json(
          { success: false, error: { code: 'EMAIL_IN_USE', message: 'That email address is already in use.' } },
          { status: 409 }
        );
      }
    }

    const identity = normalizePatientIdentity({ ...input, dateOfBirth: birthDate });
    const patient = await prisma.$transaction(async (tx) => {
      if (normalizedEmail) {
        await tx.user.update({ where: { id: existing.userId }, data: { email: normalizedEmail } });
      }
      const updated = await tx.patientProfile.update({
        where: { id: input.patientId },
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          dateOfBirth: birthDate,
          gender: input.gender,
          bloodType: mapBloodType(input.bloodType),
          phoneNumber: input.phoneNumber,
          address: input.address,
          city: input.city,
          state: input.state,
          zipCode: input.zipCode,
          ...identity,
        },
        include: { user: { select: { email: true } } },
      });
      await recordDemographicChange(tx, { patientId: existing.id, changedById: auth.user.id, source: 'STAFF_PORTAL', reason: input.changeReason, before: existing, after: updated });
      return updated;
    });

    await writeAuditLog({ actor: auth.user, action: 'PATIENT_RECORD_UPDATE', targetType: 'PatientProfile', targetId: patient.id, summary: `Patient record ${patient.id} was updated.`, request: req, metadata: auditChanges(existing, patient) });

    return NextResponse.json({
      success: true,
      patient: {
        id: patient.id,
        patientNo: patient.mrn,
        name: `${patient.firstName} ${patient.lastName}`,
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth.toISOString().split('T')[0],
        gender: patient.gender,
        bloodType: formatBloodTypeDisplay(patient.bloodType),
        phone: patient.phoneNumber,
        email: patient.user.email,
        streetAddress: patient.address,
        city: patient.city,
        state: patient.state,
        zipCode: patient.zipCode,
        address: `${patient.address}, ${patient.city}, ${patient.state}`,
      },
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    return NextResponse.json(
      { success: false, error: { code: 'PATIENT_UPDATE_FAILED', message: 'Failed to update patient.' } },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.patientWrite);
  if (!auth.ok) return auth.response;
  try {
    const rawBody = await req.json().catch(() => null);
    const parsed = CreatePatientAdminSchema.safeParse(rawBody);
    if (!parsed.success) return NextResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'Please complete all required patient fields using valid formats.', fields: parsed.error.flatten().fieldErrors } }, { status: 400 });
    const body = parsed.data;
    const vitals = rawBody && typeof rawBody === 'object' ? (rawBody as any).vitals : undefined;
    const {
      firstName,
      lastName,
      middleName,
      dateOfBirth,
      gender,
      bloodType,
      phoneNumber,
      address,
      city,
      state,
      zipCode,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      cardUid,
    } = body;
    const cleanCardUid = cardUid?.trim().toUpperCase() || '';
    const cleanPhone = phoneNumber.trim();
    const birthDate = new Date(`${dateOfBirth}T00:00:00.000Z`);
    const identity = normalizePatientIdentity({ firstName, lastName, dateOfBirth: birthDate, phoneNumber, address, city, state, zipCode });
    const duplicateCandidates = await findDuplicateCandidates(prisma, { firstName, lastName, dateOfBirth: birthDate, phoneNumber, address, city, state, zipCode });
    if (duplicateCandidates.some((candidate) => candidate.matchLevel === 'HIGH') && !body.duplicateOverrideReason) {
      return NextResponse.json({ success: false, error: { code: 'POSSIBLE_DUPLICATE', message: 'A likely duplicate patient record requires master-index review.', candidates: duplicateCandidates } }, { status: 409 });
    }

    // Check if email already exists (if provided)
    if (body.email && body.email.trim()) {
      const cleanEmail = body.email.trim().toLowerCase();
      const existingUserByEmail = await prisma.user.findUnique({
        where: { email: cleanEmail },
        include: { patientProfile: true },
      });
      if (existingUserByEmail) {
        return NextResponse.json(
          {
            success: false,
            field: 'email',
            error: `Ang email na "${cleanEmail}" ay ginagamit na sa sistema. Bawal ang duplicate na email address.`,
          },
          { status: 400 }
        );
      }
    }

    // Check if RFID card already assigned
    const existingCard = cleanCardUid ? await prisma.rfidCard.findUnique({
      where: { cardUid: cleanCardUid },
      include: { patient: true },
    }) : null;

    if (existingCard) {
      return NextResponse.json(
        {
          success: false,
          field: 'cardUid',
          error: `Ang RFID Card na "${cleanCardUid}" ay nakarehistro na kay ${existingCard.patient.firstName} ${existingCard.patient.lastName}. Gumamit ng ibang RFID card.`,
        },
        { status: 400 }
      );
    }

    // Process Vital Signs
    let finalVitals: any = null;
    if (vitals && typeof vitals === 'object') {
      const weightNum = parseFloat(vitals.weight) || 65;
      const heightNum = parseFloat(vitals.height) || 165;
      let calculatedBmi = 23.9;
      if (weightNum > 0 && heightNum > 0) {
        const heightM = heightNum / 100;
        calculatedBmi = parseFloat((weightNum / (heightM * heightM)).toFixed(1));
      }

      finalVitals = {
        bloodPressure: vitals.bloodPressure?.trim() || '120/80',
        heartRate: parseInt(vitals.heartRate, 10) || 75,
        temperature: parseFloat(vitals.temperature) || 36.6,
        weight: weightNum,
        height: heightNum,
        bmi: calculatedBmi,
        oxygenSaturation: parseInt(vitals.oxygenSaturation, 10) || 98,
        respiratoryRate: parseInt(vitals.respiratoryRate, 10) || 18,
        recordedAt: new Date().toISOString(),
      };
    }

    // Patient user account email
    const uniqueEmail = body.email && body.email.trim()
      ? body.email.trim().toLowerCase()
      : `patient.${crypto.randomUUID()}@clinic.local`;
    // The patient must establish a password through the recovery/activation flow.
    // A high-entropy random value prevents a shared default credential in the interim.
    const initialRandomSecret = crypto.randomBytes(32).toString('base64url');
    const defaultPasswordHash = await bcrypt.hash(initialRandomSecret, 12);

    const p = await prisma.$transaction(async (tx) => {
      const mrn = await nextPatientMrn(tx);
      const newUser = await tx.user.create({ data: { email: uniqueEmail, password: defaultPasswordHash, role: UserRole.PATIENT, isActive: true } });
      return tx.patientProfile.create({
        data: {
          mrn,
          userId: newUser.id,
          firstName: firstName.trim(), lastName: lastName.trim(), middleName: middleName?.trim() || null,
          dateOfBirth: birthDate, gender, phoneNumber: cleanPhone,
          address: address.trim(), city: city.trim(), state: state.trim(), zipCode: zipCode.trim(),
          ...identity,
          bloodType: mapBloodType(bloodType),
          allergies: body.allergies || null,
          chronicConditions: finalVitals ? JSON.stringify({ conditions: body.chronicConditions || null, vitals: finalVitals }) : body.chronicConditions || null,
          emergencyContactName: emergencyContactName.trim(), emergencyContactPhone: emergencyContactPhone.trim(), emergencyContactRelation: emergencyContactRelation.trim(),
          rfidCards: cleanCardUid ? { create: { cardUid: cleanCardUid, status: RfidCardStatus.ACTIVE } } : undefined,
        },
        include: { rfidCards: true },
      });
    }, { isolationLevel: 'Serializable' });

    const savedCard = p.rfidCards[0];

    const formattedPatient = {
      id: p.id,
      patientNo: p.mrn,
      name: `${p.firstName} ${p.lastName}`,
      firstName: p.firstName,
      lastName: p.lastName,
      middleName: p.middleName,
      cardUid: savedCard?.cardUid || 'NO_CARD',
      dateOfBirth: p.dateOfBirth.toISOString().split('T')[0],
      gender: p.gender,
      bloodType: formatBloodTypeDisplay(p.bloodType),
      phone: p.phoneNumber,
      address: `${p.address}, ${p.city}, ${p.state}`,
      emergencyContact: `${p.emergencyContactName} (${p.emergencyContactRelation}) • ${p.emergencyContactPhone}`,
      lastVisit: p.createdAt.toISOString().split('T')[0],
      vitals: finalVitals || parsePatientVitals(null),
    };

    await writeAuditLog({ actor: auth.user, action: 'PATIENT_RECORD_CREATE', targetType: 'PatientProfile', targetId: p.id, summary: `Created patient record for ${p.firstName} ${p.lastName}.`, request: req, metadata: auditChanges(null, p) });
    if (savedCard) await writeAuditLog({ actor: auth.user, action: 'RFID_ASSIGNED', targetType: 'RfidCard', targetId: savedCard.id, summary: `RFID ${savedCard.cardUid} assigned during patient registration.`, request: req, metadata: auditChanges(null, savedCard, { patientId: p.id }) });
    if (body.duplicateOverrideReason) await writeAuditLog({ actor: auth.user, action: 'PATIENT_DUPLICATE_OVERRIDE', targetType: 'PatientProfile', targetId: p.id, summary: `Created ${p.mrn} after duplicate review override.`, request: req, metadata: { reason: body.duplicateOverrideReason, candidates: duplicateCandidates.map((candidate) => ({ id: candidate.id, mrn: candidate.mrn, score: candidate.score })) } });

    return NextResponse.json({ success: true, patient: formattedPatient });
  } catch (error) {
    console.error('Error creating patient:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create patient and link RFID card' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Patient ID is required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const reason = String(body.reason || '').trim();
    if (reason.length < 5) return NextResponse.json({ success: false, error: 'Archive reason must contain at least 5 characters.' }, { status: 400 });
    const patient = await prisma.patientProfile.findUnique({ where: { id } });
    if (!patient) {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }

    if (patient.status !== 'ACTIVE') return NextResponse.json({ success: false, error: 'Only active patient records can be archived.' }, { status: 409 });
    const archivedAt = new Date();
    const archived = await prisma.$transaction(async (tx) => {
      const updated = await tx.patientProfile.update({ where: { id }, data: { status: 'ARCHIVED', archivedAt, archivedById: auth.user.id, archiveReason: reason } });
      await tx.user.update({ where: { id: patient.userId }, data: { isActive: false, sessionVersion: { increment: 1 } } });
      await tx.mobileSession.updateMany({ where: { userId: patient.userId, revokedAt: null }, data: { revokedAt: archivedAt } });
      await tx.rfidCard.updateMany({ where: { patientId: id, status: 'ACTIVE' }, data: { status: 'REVOKED', revokedAt: archivedAt, revokedReason: `Patient record archived: ${reason}` } });
      return updated;
    });

    await writeAuditLog({ actor: auth.user, action: 'PATIENT_RECORD_ARCHIVE', targetType: 'PatientProfile', targetId: id, summary: `Archived patient master record ${patient.mrn}.`, request: req, metadata: auditChanges(patient, archived, { reason }) });

    return NextResponse.json({ success: true, message: 'Patient record archived and access deactivated.' });
  } catch (error) {
    console.error('Error deleting patient:', error);
    return NextResponse.json({ success: false, error: 'Failed to archive patient record' }, { status: 500 });
  }
}
