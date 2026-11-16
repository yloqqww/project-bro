import { NextRequest, NextResponse } from 'next/server';
import { prisma, Prisma, RfidCardStatus } from '@clinic/db';
import { AssignRfidCardSchema, ChangeRfidCardStatusSchema } from '@clinic/types';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { auditChanges, writeAuditLog } from '@/lib/audit';
import { assignRfidCardToPatient, RfidLifecycleError } from '@/lib/rfid-assignment';

export async function GET() {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  try {
    const cards = await prisma.rfidCard.findMany({
      include: {
        patient: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedCards = cards.map((card) => ({
      id: card.id,
      uid: card.cardUid,
      patientId: card.patientId,
      patient: card.patient ? `${card.patient.firstName} ${card.patient.lastName}` : 'Unassigned',
      issued: card.issuedAt.toISOString().split('T')[0],
      status: card.status === RfidCardStatus.ACTIVE && card.expiresAt && card.expiresAt <= new Date()
        ? RfidCardStatus.EXPIRED
        : card.status,
      expiresAt: card.expiresAt?.toISOString() || null,
      revokedAt: card.revokedAt?.toISOString() || null,
      revokedReason: card.revokedReason,
      lastScannedAt: card.lastScannedAt?.toISOString() || null,
    }));

    return NextResponse.json({ success: true, cards: formattedCards });
  } catch (error) {
    console.error('Error fetching RFID cards:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch RFID cards' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;

  try {
    const parsed = AssignRfidCardSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid RFID assignment.', fields: parsed.error.flatten().fieldErrors } },
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

    const { card } = await assignRfidCardToPatient({
      patientId: input.patientId,
      cardUid: input.cardUid,
      expiresAt,
      replaceExisting: input.replaceExisting,
    });

    await writeAuditLog({ actor: auth.user, action: 'RFID_ASSIGNED', targetType: 'RfidCard', targetId: card.id, summary: `RFID ${card.cardUid} assigned to patient ${card.patientId}.`, request: req, metadata: auditChanges(null, card, { replacedExisting: input.replaceExisting }) });

    return NextResponse.json({ success: true, card: { id: card.id, uid: card.cardUid, status: card.status } }, { status: 201 });
  } catch (error) {
    if (error instanceof RfidLifecycleError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.status }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2002' || error.code === 'P2034')) {
      return NextResponse.json(
        { success: false, error: { code: 'RFID_CONFLICT', message: 'The card assignment changed concurrently. Refresh and try again.' } },
        { status: 409 }
      );
    }
    console.error('Error assigning RFID card:', error);
    return NextResponse.json({ success: false, error: { code: 'RFID_ASSIGNMENT_FAILED', message: 'Failed to assign RFID card.' } }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;

  try {
    const parsed = ChangeRfidCardStatusSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid RFID status update.', fields: parsed.error.flatten().fieldErrors } },
        { status: 400 }
      );
    }

    const input = parsed.data;
    const card = await prisma.rfidCard.findUnique({ where: { cardUid: input.cardUid } });
    if (!card) {
      return NextResponse.json({ success: false, error: { code: 'CARD_NOT_FOUND', message: 'RFID card not found.' } }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (input.status === RfidCardStatus.ACTIVE) {
        if (card.expiresAt && card.expiresAt <= new Date()) {
          throw new RfidLifecycleError('CARD_EXPIRED', 'An expired card cannot be reactivated.', 422);
        }
        const anotherActive = await tx.rfidCard.findFirst({
          where: {
            patientId: card.patientId,
            status: RfidCardStatus.ACTIVE,
            id: { not: card.id },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          select: { id: true },
        });
        if (anotherActive) {
          throw new RfidLifecycleError('ACTIVE_CARD_EXISTS', 'The patient already has another active card.', 409);
        }
      }

      return tx.rfidCard.update({
        where: { id: card.id },
        data: {
          status: input.status,
          revokedAt: input.status === RfidCardStatus.ACTIVE ? null : new Date(),
          revokedReason: input.status === RfidCardStatus.ACTIVE ? null : input.reason || input.status,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const action = updated.status === RfidCardStatus.REVOKED ? 'RFID_REVOKED' : updated.status === RfidCardStatus.ACTIVE ? 'RFID_ACTIVATED' : 'RFID_STATUS_CHANGE';
    await writeAuditLog({ actor: auth.user, action, targetType: 'RfidCard', targetId: updated.id, summary: `RFID ${updated.cardUid} status changed from ${card.status} to ${updated.status}.`, request: req, metadata: auditChanges(card, updated, { reason: input.reason || null }) });

    return NextResponse.json({ success: true, card: { id: updated.id, uid: updated.cardUid, status: updated.status } });
  } catch (error) {
    if (error instanceof RfidLifecycleError) {
      return NextResponse.json(
        { success: false, error: { code: error.code, message: error.message } },
        { status: error.status }
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
      return NextResponse.json(
        { success: false, error: { code: 'RFID_CONFLICT', message: 'The card status changed concurrently. Refresh and try again.' } },
        { status: 409 }
      );
    }
    console.error('Error updating RFID card:', error);
    return NextResponse.json({ success: false, error: { code: 'RFID_UPDATE_FAILED', message: 'Failed to update RFID card.' } }, { status: 500 });
  }
}
