CREATE TABLE "doctor_leave_requests" (
  "id" TEXT NOT NULL,
  "doctorId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "message" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "adminReply" TEXT,
  "exceptionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  CONSTRAINT "doctor_leave_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "doctor_leave_requests_doctorId_date_idx" ON "doctor_leave_requests"("doctorId", "date");
CREATE INDEX "doctor_leave_requests_status_createdAt_idx" ON "doctor_leave_requests"("status", "createdAt");
ALTER TABLE "doctor_leave_requests" ADD CONSTRAINT "doctor_leave_requests_doctorId_fkey"
FOREIGN KEY ("doctorId") REFERENCES "doctor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
