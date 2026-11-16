const { randomUUID } = require('node:crypto');
require('dotenv').config();
const { PrismaClient } = require('../packages/db/generated/client-lifecycle');

async function expectRejected(label, expectedText, operation) {
  try {
    await operation();
  } catch (error) {
    if (String(error).includes(expectedText)) return;
    throw new Error(`${label} failed for an unexpected reason: ${error}`);
  }
  throw new Error(`${label} was not rejected.`);
}

async function createSyntheticDraft(tx, doctorId, patientId) {
  return tx.medicalRecord.create({
    data: {
      patientId,
      doctorId,
      subjective: '[Integrity Test] Synthetic record',
      objective: 'Synthetic, transaction-scoped test',
      assessment: 'Synthetic integrity verification',
      plan: 'Rollback only',
      status: 'DRAFT',
    },
  });
}

async function finalizeSynthetic(tx, record, doctorId) {
  return tx.medicalRecord.update({
    where: { id: record.id },
    data: {
      status: 'FINALIZED',
      finalizedAt: new Date(),
      finalizedById: doctorId,
      finalizedByName: 'Synthetic integrity test',
      contentHash: randomUUID().replaceAll('-', ''),
    },
  });
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await prisma.medicalRecordAttachment.count();
    const triggers = await prisma.$queryRawUnsafe(
      `SELECT tgname FROM pg_trigger WHERE tgname = 'medical_records_integrity_guard' AND NOT tgisinternal`
    );
    if (triggers.length !== 1) throw new Error('Medical-record integrity trigger is missing.');

    const [doctor, patient] = await Promise.all([
      prisma.user.findFirst({ where: { role: 'DOCTOR', isActive: true }, select: { id: true } }),
      prisma.patientProfile.findFirst({ select: { id: true } }),
    ]);
    if (!doctor || !patient) {
      console.log('Schema and trigger verified; synthetic mutation probes skipped because no active doctor/patient fixture exists.');
      return;
    }

    await expectRejected('Direct finalized insert', 'must be created as drafts', () =>
      prisma.medicalRecord.create({
        data: {
          patientId: patient.id,
          doctorId: doctor.id,
          subjective: 'Synthetic', objective: 'Synthetic', assessment: 'Synthetic', plan: 'Synthetic',
          status: 'FINALIZED', finalizedAt: new Date(), finalizedById: doctor.id,
          finalizedByName: 'Synthetic integrity test', contentHash: randomUUID().replaceAll('-', ''),
        },
      })
    );

    await expectRejected('Finalized content mutation', 'immutable', () =>
      prisma.$transaction(async (tx) => {
        const draft = await createSyntheticDraft(tx, doctor.id, patient.id);
        const finalized = await finalizeSynthetic(tx, draft, doctor.id);
        await tx.medicalRecord.update({ where: { id: finalized.id }, data: { assessment: 'Tamper attempt' } });
      })
    );

    await expectRejected('Medical-record hard deletion', 'hard deleted', () =>
      prisma.$transaction(async (tx) => {
        const draft = await createSyntheticDraft(tx, doctor.id, patient.id);
        const finalized = await finalizeSynthetic(tx, draft, doctor.id);
        await tx.medicalRecord.delete({ where: { id: finalized.id } });
      })
    );

    console.log('Medical-record DB integrity verified with transaction-scoped synthetic records; no patient record was changed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
