require('dotenv').config();
const { PrismaClient } = require('../packages/db/generated/client-lifecycle');

const prisma = new PrismaClient();

async function main() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT
      to_regclass('public.appointment_waitlist_entries')::text AS waitlist,
      to_regclass('public.appointment_reminders')::text AS reminders,
      to_regclass('public.appointment_booking_claims')::text AS claims,
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'appointments' AND column_name = 'patientConfirmedAt'
      ) AS confirmation
  `);
  const result = rows[0];
  if (!result?.waitlist || !result?.reminders || !result?.claims || !result?.confirmation) throw new Error('Appointment lifecycle database objects are incomplete.');
  console.log(JSON.stringify(result));
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exitCode = 1; });
