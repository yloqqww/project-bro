import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import crypto from 'crypto';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { getClinicSettings } from '@/lib/clinic-settings';
import { writeAuditLog } from '@/lib/audit';

function determinePriority(input: { age?: unknown; painScore?: unknown; oxygenSaturation?: unknown; temperature?: unknown; bloodPressure?: unknown }, rules: Awaited<ReturnType<typeof getClinicSettings>>['triagePriorityRules']) {
  const pain = Number(input.painScore || 0);
  const oxygen = Number(input.oxygenSaturation || 100);
  const temp = Number(input.temperature || 0);
  const systolic = Number(String(input.bloodPressure || '').split('/')[0] || 0);
  const age = Number(input.age || 0);
  if (pain >= rules.resuscitation.painScore || oxygen < rules.resuscitation.oxygenSaturationBelow) return 'RESUSCITATION';
  if (pain >= rules.urgent.painScore || temp >= rules.urgent.temperatureAtLeast || systolic >= rules.urgent.systolicAtLeast) return 'URGENT';
  if (age >= rules.priority.seniorAge || pain >= rules.priority.painScore) return 'PRIORITY';
  return 'STANDARD';
}

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.triageRead);
  if (!auth.ok) return auth.response;
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 100);

    const includeArchived = searchParams.get('includeArchived') === 'true';

    let query = `
      SELECT t.*
      FROM "triage_assessments" t
      LEFT JOIN "patient_profiles" p ON p."id" = t."patientId"
    `;
    const conditions: string[] = [];
    const values: any[] = [];
    let pIndex = 1;

    if (!includeArchived) {
      // Exclude triage records linked to archived, merged, or deleted patient profiles.
      conditions.push(`(t."patientId" IS NULL OR p."status" = 'ACTIVE')`);
    }

    if (status && status !== 'ALL') {
      conditions.push(`t."status" = $${pIndex++}`);
      values.push(status);
    }

    if (search) {
      conditions.push(`(t."patientName" ILIKE $${pIndex} OR t."triageNumber" ILIKE $${pIndex} OR t."cardUid" ILIKE $${pIndex})`);
      values.push(`%${search.trim()}%`);
      pIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY t."createdAt" DESC LIMIT $${pIndex}`;
    values.push(limit);

    const rows = await prisma.$queryRawUnsafe<any[]>(query, ...values);

    const formatted = rows.map((r) => ({
      ...r,
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
      updatedAt: r.updatedAt instanceof Date ? r.updatedAt.toISOString() : String(r.updatedAt),
    }));

    return NextResponse.json({ success: true, triageList: formatted });
  } catch (error: any) {
    console.error('Error fetching triage records:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch triage records', details: error?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.triageCreate);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const {
      patientId,
      patientName,
      age,
      gender,
      cardUid,
      bloodPressure,
      heartRate,
      temperature,
      respiratoryRate,
      oxygenSaturation,
      weightKg,
      heightCm,
      bmi,
      chiefComplaint,
      symptomsDuration,
      painScore,
      department,
      nurseName,
      allergies,
      chronicConditions,
    } = body;

    if (!patientName || !patientName.trim()) {
      return NextResponse.json({ success: false, error: 'Kailangan ang Pangalan ng pasyente.' }, { status: 400 });
    }
    if (!age || isNaN(Number(age)) || Number(age) <= 0) {
      return NextResponse.json({ success: false, error: 'Kailangan ang wastong Edad ng pasyente.' }, { status: 400 });
    }
    if (!bloodPressure || !String(bloodPressure).trim() || String(bloodPressure).trim() === '0') {
      return NextResponse.json({ success: false, error: 'Kailangan ang Presyon (BP) ng pasyente.' }, { status: 400 });
    }
    if (!temperature || !String(temperature).trim() || String(temperature).trim() === '0') {
      return NextResponse.json({ success: false, error: 'Kailangan ang Temperatura ng pasyente.' }, { status: 400 });
    }
    if (!heartRate || !String(heartRate).trim() || String(heartRate).trim() === '0') {
      return NextResponse.json({ success: false, error: 'Kailangan ang Pulso (Heart Rate) ng pasyente.' }, { status: 400 });
    }
    if (!weightKg || !String(weightKg).trim() || String(weightKg).trim() === '0') {
      return NextResponse.json({ success: false, error: 'Kailangan ang Timbang ng pasyente.' }, { status: 400 });
    }
    if (!heightCm || !String(heightCm).trim() || String(heightCm).trim() === '0') {
      return NextResponse.json({ success: false, error: 'Kailangan ang Taas ng pasyente.' }, { status: 400 });
    }
    if (!allergies || !String(allergies).trim()) {
      return NextResponse.json({ success: false, error: 'Kailangan ang Alerhiya ng pasyente (o NKDA).' }, { status: 400 });
    }
    if (!chronicConditions || !String(chronicConditions).trim()) {
      return NextResponse.json({ success: false, error: 'Kailangan ang Karamdaman / Maintenance ng pasyente (o None).' }, { status: 400 });
    }
    if (!chiefComplaint || !chiefComplaint.trim()) {
      return NextResponse.json({ success: false, error: 'Kailangan ang Dahilan ng Pagpapatingin (Chief Complaint).' }, { status: 400 });
    }
    if (!department) {
      return NextResponse.json({ success: false, error: 'Kailangan ang Departamento ng pasyente.' }, { status: 400 });
    }

    const normalizedName = String(patientName).trim();
    const existingPending = patientId
      ? await prisma.$queryRawUnsafe<any[]>(
          `SELECT t."id", t."triageNumber", t."patientName"
           FROM "triage_assessments" t
           LEFT JOIN "patient_profiles" p ON p."id" = t."patientId"
           WHERE t."status" = 'PENDING_OPD'
             AND t."patientId" = $1
             AND (t."patientId" IS NULL OR p."status" = 'ACTIVE')
           ORDER BY t."createdAt" DESC
           LIMIT 1`,
          patientId
        )
      : await prisma.$queryRawUnsafe<any[]>(
          `SELECT t."id", t."triageNumber", t."patientName"
           FROM "triage_assessments" t
           LEFT JOIN "patient_profiles" p ON p."id" = t."patientId"
           WHERE t."status" = 'PENDING_OPD'
             AND LOWER(TRIM(t."patientName")) = LOWER($1)
             AND (t."patientId" IS NULL OR p."status" = 'ACTIVE')
           ORDER BY t."createdAt" DESC
           LIMIT 1`,
          normalizedName
        );

    if (existingPending.length > 0) {
      const dup = existingPending[0];
      return NextResponse.json(
        {
          success: false,
          error: `May nakapila nang triage para kay ${dup.patientName} (${dup.triageNumber}) na naghihintay sa OPD Counter. I-process muna ito bago mag-triage ulit.`,
          existingTriage: dup,
        },
        { status: 409 }
      );
    }

    const settings = await getClinicSettings();
    const resolvedPriority = determinePriority({ age, painScore, oxygenSaturation, temperature, bloodPressure }, settings.triagePriorityRules);

    // Generate daily sequential triage number: TRG-YYYYMMDD-XXX
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Use highest sequence for today's prefix so deleted records never cause number collisions
    const maxSeqRes = await prisma.$queryRawUnsafe<any[]>(
      `SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(SPLIT_PART("triageNumber", '-', 3), '[^0-9]', '', 'g'), '')::int), 0) as max_seq
       FROM "triage_assessments"
       WHERE "triageNumber" LIKE $1`,
      `TRG-${dateStr}-%`
    );
    const maxSeq = maxSeqRes?.[0]?.max_seq ? Number(maxSeqRes[0].max_seq) : 0;
    const seq = String(maxSeq + 1).padStart(3, '0');
    const triageNumber = `TRG-${dateStr}-${seq}`;

    const id = `trg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;

    const cleanAllergies = allergies ? String(allergies).trim() : null;
    const cleanConditions = chronicConditions ? String(chronicConditions).trim() : null;

    await prisma.$executeRawUnsafe(
      `INSERT INTO "triage_assessments" (
        "id", "triageNumber", "patientId", "patientName", "age", "gender", "cardUid",
        "bloodPressure", "heartRate", "temperature", "respiratoryRate", "oxygenSaturation",
        "weightKg", "heightCm", "bmi",
        "chiefComplaint", "symptomsDuration", "painScore",
        "department", "priorityLevel", "nurseId", "nurseName",
        "status", "allergies", "chronicConditions", "createdAt", "updatedAt"
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18,
        $19, $20, $21, $22,
        'PENDING_OPD', $23, $24, NOW(), NOW()
      )`,
      id,
      triageNumber,
      patientId || null,
      patientName.trim(),
      age ? parseInt(String(age), 10) : null,
      gender || 'MALE',
      cardUid ? cardUid.trim().toUpperCase() : null,
      bloodPressure ? bloodPressure.trim() : null,
      heartRate ? String(heartRate).trim() : null,
      temperature ? String(temperature).trim() : null,
      respiratoryRate ? String(respiratoryRate).trim() : null,
      oxygenSaturation ? String(oxygenSaturation).trim() : null,
      weightKg ? String(weightKg).trim() : null,
      heightCm ? String(heightCm).trim() : null,
      bmi ? String(bmi).trim() : null,
      chiefComplaint.trim(),
      symptomsDuration ? symptomsDuration.trim() : null,
      painScore ? parseInt(String(painScore), 10) : 0,
      department,
      resolvedPriority,
      auth.user.id,
      auth.user.email.split('@')[0],
      cleanAllergies,
      cleanConditions
    );

    if (patientId) {
      try {
        await prisma.patientProfile.update({
          where: { id: patientId },
          data: {
            allergies: cleanAllergies,
            chronicConditions: cleanConditions,
          },
        });
      } catch (profErr) {
        console.error('Failed to sync allergies/conditions to patientProfile:', profErr);
      }
    }

    const createdRecord = {
      id,
      triageNumber,
      patientId,
      patientName: patientName.trim(),
      age,
      gender,
      cardUid,
      bloodPressure,
      heartRate,
      temperature,
      respiratoryRate,
      oxygenSaturation,
      weightKg,
      heightCm,
      bmi,
      chiefComplaint,
      symptomsDuration,
      painScore,
      department,
      priorityLevel: resolvedPriority,
      nurseName: auth.user.email.split('@')[0],
      allergies: cleanAllergies,
      chronicConditions: cleanConditions,
      status: 'PENDING_OPD',
      createdAt: new Date().toISOString(),
    };

    await writeAuditLog({ actor: auth.user, action: 'TRIAGE_CREATE', targetType: 'TriageAssessment', targetId: id, summary: `${triageNumber} recorded with ${resolvedPriority} priority.`, request: req });

    return NextResponse.json({
      success: true,
      message: 'Triage assessment recorded successfully',
      triageAssessment: createdRecord,
    });
  } catch (error: any) {
    console.error('Error saving triage assessment:', error);
    return NextResponse.json({ success: false, error: 'Failed to record triage assessment', details: error?.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.triageHandoff);
  if (!auth.ok) return auth.response;
  try {
    const body = await req.json();
    const { id, triageNumber, status, opdQueueTicketId, patientId, cardUid } = body;

    if (!id && !triageNumber) {
      return NextResponse.json(
        { success: false, error: 'id or triageNumber is required.' },
        { status: 400 }
      );
    }

    const triage = id
      ? await prisma.triageAssessment.findUnique({ where: { id } })
      : await prisma.triageAssessment.findUnique({ where: { triageNumber } });

    if (!triage) {
      return NextResponse.json({ success: false, error: 'Triage assessment not found.' }, { status: 404 });
    }

    const updateData: {
      status?: string;
      opdQueueTicketId?: string;
      patientId?: string;
      cardUid?: string;
    } = {};

    if (status) {
      const allowedStatuses = ['PENDING_OPD', 'OPD_PROCESSED', 'COMPLETED'];
      if (!allowedStatuses.includes(status)) {
        return NextResponse.json({ success: false, error: 'Invalid triage status.' }, { status: 400 });
      }
      updateData.status = status;
    }

    if (opdQueueTicketId) updateData.opdQueueTicketId = opdQueueTicketId;

    if (patientId || cardUid) {
      if (!patientId || !cardUid) {
        return NextResponse.json(
          { success: false, error: 'Both patientId and cardUid are required when linking a registration.' },
          { status: 400 }
        );
      }

      const activeCard = await prisma.rfidCard.findFirst({
        where: {
          patientId,
          cardUid: String(cardUid).trim().toUpperCase(),
          status: 'ACTIVE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
      });

      if (!activeCard) {
        return NextResponse.json(
          { success: false, error: 'The RFID card is not active or does not belong to this patient.' },
          { status: 400 }
        );
      }

      updateData.patientId = patientId;
      updateData.cardUid = activeCard.cardUid;

      const triageAny = triage as any;
      if (triageAny.allergies || triageAny.chronicConditions) {
        try {
          await prisma.patientProfile.update({
            where: { id: patientId },
            data: {
              ...(triageAny.allergies ? { allergies: triageAny.allergies } : {}),
              ...(triageAny.chronicConditions ? { chronicConditions: triageAny.chronicConditions } : {}),
            },
          });
        } catch (syncErr) {
          console.error('Failed to sync triage allergies to patientProfile in PATCH:', syncErr);
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ success: false, error: 'No triage changes were provided.' }, { status: 400 });
    }

    const updated = await prisma.triageAssessment.update({
      where: { id: triage.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, message: 'Triage assessment updated.', triageAssessment: updated });
  } catch (error: any) {
    console.error('Error updating triage assessment:', error);
    return NextResponse.json({ success: false, error: 'Failed to update triage assessment', details: error?.message }, { status: 500 });
  }
}
