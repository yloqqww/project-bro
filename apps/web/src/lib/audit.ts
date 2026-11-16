import 'server-only';

import crypto from 'crypto';
import { prisma } from '@clinic/db';

type AuditActor = { id?: string; email?: string | null; role?: string } | null | undefined;
type HeaderSource = Headers | Record<string, string | string[] | undefined>;
type AuditRequest = { headers?: HeaderSource; method?: string; url?: string } | null | undefined;

const REDACTED_KEYS = /password|secret|token|signaturehash|authorization|cookie/i;

function headerValue(headers: HeaderSource | undefined, name: string) {
  if (!headers) return null;
  if (headers instanceof Headers) return headers.get(name);
  const match = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase())?.[1];
  return Array.isArray(match) ? match[0] || null : match || null;
}

function safeAuditValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => safeAuditValue(item, seen));
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]';
    seen.add(value);
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, REDACTED_KEYS.test(key) ? '[REDACTED]' : safeAuditValue(item, seen)]));
  }
  return String(value);
}

export function auditChanges(before: unknown, after: unknown, extra: Record<string, unknown> = {}) {
  return safeAuditValue({ before, after, ...extra }) as Record<string, unknown>;
}

export async function writeAuditLog(input: {
  actor?: AuditActor;
  action: string;
  targetType: string;
  targetId?: string | null;
  summary: string;
  request?: AuditRequest;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const forwarded = headerValue(input.request?.headers, 'x-forwarded-for');
  const ipAddress = input.ipAddress || forwarded?.split(',')[0]?.trim() || headerValue(input.request?.headers, 'x-real-ip') || null;
  const userAgent = input.userAgent || headerValue(input.request?.headers, 'user-agent') || null;
  const requestUrl = input.request?.url ? (() => { try { return new URL(input.request!.url!).pathname; } catch { return input.request!.url; } })() : undefined;
  const metadata = safeAuditValue({
    ...(input.metadata || {}),
    request: input.request ? { method: input.request.method || null, path: requestUrl || null } : undefined,
  });

  try {
    const id = `audit_${Date.now()}_${crypto.randomBytes(5).toString('hex')}`;
    await prisma.$executeRaw`
      INSERT INTO "system_audit_logs" ("id", "actorId", "actorEmail", "actorRole", "action", "targetType", "targetId", "summary", "ipAddress", "userAgent", "metadata", "createdAt")
      VALUES (${id}, ${input.actor?.id || null}, ${input.actor?.email || null}, ${input.actor?.role || null}, ${input.action}, ${input.targetType}, ${input.targetId || null}, ${input.summary}, ${ipAddress}, ${userAgent?.slice(0, 500) || null}, ${JSON.stringify(metadata || {})}::jsonb, NOW())
    `;
    return { id };
  } catch (error) {
    console.error('Audit log write failed:', error);
    return null;
  }
}
