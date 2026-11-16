import { prisma, Prisma, RfidCardStatus } from '@clinic/db';

export class RfidLifecycleError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = 'RfidLifecycleError';
  }
}

export interface AssignRfidCardParams {
  patientId: string;
  cardUid: string;
  expiresAt?: Date | null;
  replaceExisting?: boolean;
}

/**
 * Assigns a physical RFID card UID to an active patient profile inside a serializable transaction.
 */
export async function assignRfidCardToPatient({
  patientId,
  cardUid,
  expiresAt = null,
  replaceExisting = false,
}: AssignRfidCardParams) {
  return prisma.$transaction(
    async (tx) => {
      const patient = await tx.patientProfile.findUnique({
        where: { id: patientId },
        select: { id: true, mrn: true, firstName: true, lastName: true, status: true },
      });
      if (!patient || patient.status !== 'ACTIVE') {
        throw new RfidLifecycleError('PATIENT_NOT_FOUND', 'Patient not found.', 404);
      }

      const uidOwner = await tx.rfidCard.findUnique({
        where: { cardUid },
        select: { id: true },
      });
      if (uidOwner) {
        throw new RfidLifecycleError('CARD_ALREADY_REGISTERED', 'That RFID card is already registered.', 409);
      }

      const activeCard = await tx.rfidCard.findFirst({
        where: {
          patientId,
          status: RfidCardStatus.ACTIVE,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      });
      if (activeCard && !replaceExisting) {
        throw new RfidLifecycleError(
          'ACTIVE_CARD_EXISTS',
          'The patient already has an active card. Confirm replacement first.',
          409
        );
      }

      if (activeCard) {
        await tx.rfidCard.update({
          where: { id: activeCard.id },
          data: {
            status: RfidCardStatus.REVOKED,
            revokedAt: new Date(),
            revokedReason: `Replaced by ${cardUid}`,
          },
        });
      }

      const card = await tx.rfidCard.create({
        data: { cardUid, patientId, expiresAt },
      });

      return { card, patient };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

