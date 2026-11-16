import 'server-only';
import crypto from 'crypto';
import { prisma } from '@clinic/db';

function rateLimitHash(scope: string, key: string) {
  const pepper = process.env.RATE_LIMIT_PEPPER || process.env.NEXTAUTH_SECRET || 'development-only-rate-limit-pepper';
  return crypto.createHmac('sha256', pepper).update(`${scope}:${key.trim().toLowerCase()}`).digest('hex');
}

export async function consumeRateLimit(scope: string, key: string, limit: number, windowMs: number, database: any = prisma) {
  const keyHash = rateLimitHash(scope, key);
  const now = new Date();
  return database.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT 1 AS "locked" FROM pg_advisory_xact_lock(hashtext(${`rate:${keyHash}`}::text))`;
    const existing = await tx.securityRateLimit.findUnique({ where: { keyHash } });
    if (!existing || existing.expiresAt <= now) {
      await tx.securityRateLimit.upsert({ where: { keyHash }, create: { keyHash, scope, attempts: 1, windowStartedAt: now, expiresAt: new Date(now.getTime() + windowMs) }, update: { scope, attempts: 1, windowStartedAt: now, expiresAt: new Date(now.getTime() + windowMs), blockedUntil: null } });
      return { allowed: true, remaining: Math.max(0, limit - 1), retryAfterSeconds: 0 };
    }
    const attempts = existing.attempts + 1;
    const allowed = attempts <= limit && (!existing.blockedUntil || existing.blockedUntil <= now);
    const blockedUntil = allowed ? existing.blockedUntil : existing.expiresAt;
    await tx.securityRateLimit.update({ where: { keyHash }, data: { attempts, blockedUntil } });
    return { allowed, remaining: Math.max(0, limit - attempts), retryAfterSeconds: allowed ? 0 : Math.max(1, Math.ceil((existing.expiresAt.getTime() - now.getTime()) / 1000)) };
  });
}

export async function clearRateLimit(scope: string, key: string, database: any = prisma) {
  return database.securityRateLimit.deleteMany({ where: { keyHash: rateLimitHash(scope, key) } });
}
