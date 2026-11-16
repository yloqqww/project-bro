import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { authorizeApi } from '@/lib/api-auth';
import { ACCESS } from '@/lib/access-policy';
import { paginationMeta, paginationParams } from '@/lib/pagination';

export async function GET(req: NextRequest) {
  const auth = await authorizeApi(ACCESS.admin);
  if (!auth.ok) return auth.response;
  const { searchParams } = new URL(req.url);
  if (searchParams.get('mode') === 'investigation') {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [failedLogins, sensitiveAccess, sourceIps, sessionRevocations] = await Promise.all([
      prisma.$queryRaw<Array<{ actorEmail: string | null; attempts: number }>>`SELECT "actorEmail", COUNT(*)::int AS attempts FROM "system_audit_logs" WHERE "createdAt" >= ${since} AND "action" IN ('LOGIN_FAILURE', 'MOBILE_LOGIN_FAILURE') GROUP BY "actorEmail" HAVING COUNT(*) >= 3 ORDER BY attempts DESC LIMIT 100`,
      prisma.$queryRaw<Array<{ actorEmail: string | null; views: number }>>`SELECT "actorEmail", COUNT(*)::int AS views FROM "system_audit_logs" WHERE "createdAt" >= ${since} AND "action" IN ('PATIENT_RECORD_VIEW', 'MEDICAL_RECORD_PDF_EXPORT', 'PATIENT_EXPORT') GROUP BY "actorEmail" HAVING COUNT(*) >= 20 ORDER BY views DESC LIMIT 100`,
      prisma.$queryRaw<Array<{ ipAddress: string | null; events: number; actors: number }>>`SELECT "ipAddress", COUNT(*)::int AS events, COUNT(DISTINCT "actorEmail")::int AS actors FROM "system_audit_logs" WHERE "createdAt" >= ${since} AND "ipAddress" IS NOT NULL GROUP BY "ipAddress" HAVING COUNT(DISTINCT "actorEmail") >= 3 ORDER BY events DESC LIMIT 100`,
      prisma.systemAuditLog.count({ where: { createdAt: { gte: since }, action: 'SESSIONS_REVOKED_ALL' } }),
    ]);
    return NextResponse.json({ success: true, window: { since, hours: 24 }, signals: { failedLogins, sensitiveAccess, sharedSourceIps: sourceIps, sessionRevocations }, generatedAt: new Date() });
  }
  const { page, pageSize, skip } = paginationParams(searchParams, 25);
  const action = searchParams.get('action');
  const search = searchParams.get('search')?.trim();
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const conditions: string[] = [];
  const values: unknown[] = [];
  const add = (clause: string, value: unknown) => { values.push(value); conditions.push(clause.replace('?', `$${values.length}`)); };
  if (action && action !== 'ALL') add('"action" = ?', action);
  if (search) add('(COALESCE("actorEmail", \'\') ILIKE ? OR "summary" ILIKE $' + (values.length + 1) + ' OR COALESCE("targetId", \'\') ILIKE $' + (values.length + 1) + ')', `%${search}%`);
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) add('"createdAt" >= ?', new Date(`${from}T00:00:00+08:00`));
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) add('"createdAt" <= ?', new Date(`${to}T23:59:59.999+08:00`));
  const whereSql = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const logs = await prisma.$queryRawUnsafe<any[]>(`SELECT * FROM "system_audit_logs" ${whereSql} ORDER BY "createdAt" DESC OFFSET $${values.length + 1} LIMIT $${values.length + 2}`, ...values, skip, pageSize);
  const countRows = await prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS count FROM "system_audit_logs" ${whereSql}`, ...values);
  const total = Number(countRows[0]?.count || 0);
  return NextResponse.json({
    success: true,
    logs: logs.map((log: any) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      actor: log.actorEmail || 'System',
      role: log.actorRole || 'SYSTEM',
      action: log.action,
      target: log.summary,
      targetType: log.targetType,
      targetId: log.targetId,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      metadata: log.metadata || {},
      station: log.ipAddress || 'Server',
    })),
    pagination: paginationMeta(page, pageSize, total),
  });
}
