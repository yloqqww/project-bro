CREATE TABLE "clinical_conversations" (
  "id" TEXT NOT NULL,
  "queueTicketId" TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "createdById" TEXT,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "clinical_messages" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "senderId" TEXT,
  "recipientId" TEXT,
  "senderName" TEXT NOT NULL,
  "senderRole" TEXT NOT NULL,
  "recipientRole" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'ROUTINE',
  "readAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "clinical_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staff_announcements" (
  "id" TEXT NOT NULL,
  "createdById" TEXT,
  "creatorName" TEXT NOT NULL,
  "targetRole" TEXT NOT NULL DEFAULT 'ALL_STAFF',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "priority" TEXT NOT NULL DEFAULT 'ROUTINE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_announcements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "staff_announcement_reads" (
  "id" TEXT NOT NULL,
  "announcementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "staff_announcement_reads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "clinical_conversations_queueTicketId_key" ON "clinical_conversations"("queueTicketId");
CREATE INDEX "clinical_conversations_doctorId_status_idx" ON "clinical_conversations"("doctorId", "status");
CREATE INDEX "clinical_conversations_createdById_status_idx" ON "clinical_conversations"("createdById", "status");
CREATE INDEX "clinical_conversations_updatedAt_idx" ON "clinical_conversations"("updatedAt");
CREATE INDEX "clinical_messages_conversationId_createdAt_idx" ON "clinical_messages"("conversationId", "createdAt");
CREATE INDEX "clinical_messages_recipientId_readAt_idx" ON "clinical_messages"("recipientId", "readAt");
CREATE INDEX "staff_announcements_targetRole_createdAt_idx" ON "staff_announcements"("targetRole", "createdAt");
CREATE UNIQUE INDEX "staff_announcement_reads_announcementId_userId_key" ON "staff_announcement_reads"("announcementId", "userId");
CREATE INDEX "staff_announcement_reads_userId_readAt_idx" ON "staff_announcement_reads"("userId", "readAt");

ALTER TABLE "clinical_conversations" ADD CONSTRAINT "clinical_conversations_queueTicketId_fkey" FOREIGN KEY ("queueTicketId") REFERENCES "queue_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinical_conversations" ADD CONSTRAINT "clinical_conversations_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinical_conversations" ADD CONSTRAINT "clinical_conversations_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinical_conversations" ADD CONSTRAINT "clinical_conversations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinical_messages" ADD CONSTRAINT "clinical_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "clinical_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "clinical_messages" ADD CONSTRAINT "clinical_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "clinical_messages" ADD CONSTRAINT "clinical_messages_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff_announcements" ADD CONSTRAINT "staff_announcements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "staff_announcement_reads" ADD CONSTRAINT "staff_announcement_reads_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "staff_announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "staff_announcement_reads" ADD CONSTRAINT "staff_announcement_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
