import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { getClinicSettings } from '@/lib/clinic-settings';
import { writeAuditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const configuredSecret = process.env.CRON_SECRET;
  const suppliedSecret = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const isCron = Boolean(configuredSecret && suppliedSecret === configuredSecret);
  let actor: any = { role: 'SYSTEM' };
  if (!isCron) {
    const auth = await authorizeApi(ACCESS.admin);
    if (!auth.ok) return auth.response;
    actor = auth.user;
  }
  const settings = await getClinicSettings();
  const now = new Date();
  const clinicalCutoff = new Date(now);
  clinicalCutoff.setUTCFullYear(clinicalCutoff.getUTCFullYear() - settings.clinicalRecordRetentionYears);
  const auditCutoff = new Date(now);
  auditCutoff.setUTCFullYear(auditCutoff.getUTCFullYear() - settings.auditRetentionYears);
  const [records, sessions, tokens, rateLimits, notifications, auditRows] = await prisma.$transaction([
    prisma.medicalRecord.updateMany({ where: { archivedAt: null, status: { in: ['FINALIZED', 'AMENDED'] }, updatedAt: { lt: clinicalCutoff } }, data: { archivedAt: now, archiveReason: `Automatic retention archive after ${settings.clinicalRecordRetentionYears} years.` } }),
    prisma.mobileSession.updateMany({ where: { revokedAt: null, expiresAt: { lt: now } }, data: { revokedAt: now } }),
    prisma.patientAccountToken.updateMany({ where: { usedAt: null, expiresAt: { lt: now } }, data: { usedAt: now } }),
    prisma.securityRateLimit.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.adminNotification.updateMany({ where: { archivedAt: null, expiresAt: { lt: now } }, data: { archivedAt: now, isRead: true, readAt: now } }),
    prisma.systemAuditLog.count({ where: { createdAt: { lt: auditCutoff } } }),
  ]);
  const result = { clinicalRecordsArchived: records.count, expiredSessionsRevoked: sessions.count, expiredTokensClosed: tokens.count, expiredRateLimitsDeleted: rateLimits.count, notificationsArchived: notifications.count, auditLogsEligibleForColdStorage: auditRows, auditLogsDeleted: 0 };
  await writeAuditLog({ actor, action: 'DATA_RETENTION_RUN', targetType: 'ClinicSettings', targetId: 'default', summary: 'Retention and archive policy completed without deleting clinical or audit records.', request: req, metadata: result });
  return NextResponse.json({ success: true, result });
}
