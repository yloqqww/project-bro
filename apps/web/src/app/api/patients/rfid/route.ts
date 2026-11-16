import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@clinic/db';
import { AssignRfidCardSchema } from '@clinic/types';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { auditChanges, writeAuditLog } from '@/lib/audit';
import { assignRfidCardToPatient, RfidLifecycleError } from '@/lib/rfid-assignment';

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.patientWrite);
  if (!auth.ok) return auth.response;

  try {
    const parsed = AssignRfidCardSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid RFID assignment.',
            fields: parsed.error.flatten().fieldErrors,
          },
        },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    if (expiresAt && expiresAt <= new Date()) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_EXPIRATION', message: 'Expiration must be in the future.' } },
        { status: 400 }
      );
    }

    const { card, patient } = await assignRfidCardToPatient({
      patientId: input.patientId,
      cardUid: input.cardUid,
      expiresAt,
      replaceExisting: input.replaceExisting,
    });

    await writeAuditLog({
      actor: auth.user,
      action: 'RFID_ASSIGNED',
      targetType: 'RfidCard',
      targetId: card.id,
      summary: `RFID ${card.cardUid} assigned to patient ${card.patientId}.`,
      request: req,
      metadata: auditChanges(null, card, { replacedExisting: input.replaceExisting }),
    });

    return NextResponse.json(
      {
        success: true,
        card: { id: card.id, uid: card.cardUid, status: card.status },
        patient: {
          id: patient.id,
          patientNo: patient.mrn,
          name: `${patient.firstName} ${patient.lastName}`,
          cardUid: card.cardUid,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof RfidLifecycleError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.status }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'RFID_CONFLICT', message: 'The card assignment changed concurrently. Refresh and try again.' },
        },
        { status: 409 }
      );
    }
    console.error('Error assigning RFID card to patient:', error);
    return NextResponse.json({ success: false, error: 'Failed to assign RFID card.' }, { status: 500 });
  }
}

