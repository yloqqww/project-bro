CREATE TYPE "QueueControlStatus" AS ENUM ('OPEN', 'PAUSED', 'CLOSED');

ALTER TABLE "queue_tickets"
  ADD COLUMN "lastRecalledAt" TIMESTAMP(3),
  ADD COLUMN "recallCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "transferredAt" TIMESTAMP(3),
  ADD COLUMN "transferredFromDoctorId" TEXT;

CREATE TABLE "queue_events" (
  "id" TEXT NOT NULL,
  "queueTicketId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "fromStatus" "QueueStatus",
  "toStatus" "QueueStatus",
  "actorId" TEXT,
  "actorRole" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "queue_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "queue_events_queueTicketId_fkey" FOREIGN KEY ("queueTicketId") REFERENCES "queue_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "queue_events_queueTicketId_createdAt_idx" ON "queue_events"("queueTicketId", "createdAt");
CREATE INDEX "queue_events_createdAt_idx" ON "queue_events"("createdAt");

CREATE TABLE "queue_service_states" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "status" "QueueControlStatus" NOT NULL DEFAULT 'OPEN',
  "reason" TEXT,
  "updatedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "queue_service_states_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "queue_service_states_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "queue_service_states_doctorId_key" ON "queue_service_states"("doctorId");
CREATE INDEX "queue_service_states_status_idx" ON "queue_service_states"("status");
