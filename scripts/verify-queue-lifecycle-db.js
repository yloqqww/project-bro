require('dotenv').config();
const { PrismaClient } = require('../packages/db/generated/client-queue');
const prisma = new PrismaClient();

async function main() {
  const [row] = await prisma.$queryRawUnsafe(`
    SELECT
      to_regclass('public.queue_events')::text AS events,
      to_regclass('public.queue_service_states')::text AS controls,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'queue_tickets' AND column_name = 'recallCount') AS recall,
      EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'queue_tickets' AND column_name = 'transferredAt') AS transfer
  `);
  if (!row?.events || !row?.controls || !row?.recall || !row?.transfer) throw new Error('Queue lifecycle database objects are incomplete.');
  console.log(JSON.stringify(row));
}

main().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exitCode = 1; });
