import 'server-only';

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@clinic/db';
import { clearRateLimit, consumeRateLimit } from '@/lib/security-rate-limit';

export type MobilePatientAuth = {
  sessionId: string;
  userId: string;
  email: string;
  patientId: string;
  firstName: string;
  lastName: string;
};

export async function accountRequestAllowed(key: string) {
  return (await consumeRateLimit('PATIENT_ACCOUNT_REQUEST', key, 5, 60 * 60 * 1000)).allowed;
}

export async function mobileLoginAllowed(key: string) {
  return (await consumeRateLimit('MOBILE_LOGIN', key, 5, 15 * 60 * 1000)).allowed;
}

export function recordMobileLoginFailure(_key: string) {}

export async function clearMobileLoginFailures(key: string) {
  await clearRateLimit('MOBILE_LOGIN', key);
}

export function hashMobileToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function newOpaqueToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function passwordValidationError(password: string) {
  if (password.length < 12) return 'Password must contain at least 12 characters.';
  if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password)) return 'Password must include uppercase, lowercase, and a number.';
  return null;
}

export function requestIp(req: NextRequest) {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null;
}

export async function createMobileSession(req: NextRequest, userId: string, deviceName?: string) {
  const token = newOpaqueToken();
  const tokenHash = hashMobileToken(token);
  const id = `mobile_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await prisma.$executeRaw`INSERT INTO "mobile_sessions" ("id", "userId", "tokenHash", "deviceName", "userAgent", "ipAddress", "lastUsedAt", "expiresAt", "createdAt") VALUES (${id}, ${userId}, ${tokenHash}, ${deviceName?.slice(0, 120) || null}, ${req.headers.get('user-agent')?.slice(0, 500) || null}, ${requestIp(req)}, NOW(), ${expiresAt}, NOW())`;
  return { token, expiresAt };
}

export async function authorizeMobilePatient(req: NextRequest): Promise<{ ok: true; patient: MobilePatientAuth } | { ok: false; response: NextResponse }> {
  const authorization = req.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!token) return { ok: false, response: NextResponse.json({ success: false, error: 'Authentication required.' }, { status: 401 }) };
  const rows = await prisma.$queryRaw<Array<MobilePatientAuth & { expiresAt: Date; revokedAt: Date | null; isActive: boolean; patientStatus: string }>>`
    SELECT s."id" AS "sessionId", u."id" AS "userId", u."email", p."id" AS "patientId", p."firstName", p."lastName", p."status"::text AS "patientStatus", s."expiresAt", s."revokedAt", u."isActive"
    FROM "mobile_sessions" s
    JOIN "users" u ON u."id" = s."userId"
    JOIN "patient_profiles" p ON p."userId" = u."id"
    WHERE s."tokenHash" = ${hashMobileToken(token)} AND u."role" = 'PATIENT'::"UserRole"
    LIMIT 1
  `;
  const patient = rows[0];
  if (!patient || patient.revokedAt || !patient.isActive || patient.patientStatus !== 'ACTIVE' || new Date(patient.expiresAt) <= new Date()) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'Your mobile session has expired. Please sign in again.' }, { status: 401 }) };
  }
  await prisma.$executeRaw`UPDATE "mobile_sessions" SET "lastUsedAt" = NOW(), "ipAddress" = ${requestIp(req)}, "userAgent" = ${req.headers.get('user-agent')?.slice(0, 500) || null} WHERE "id" = ${patient.sessionId}`;
  return { ok: true, patient };
}

export async function revokeMobileSession(sessionId: string) {
  await prisma.$executeRaw`UPDATE "mobile_sessions" SET "revokedAt" = NOW() WHERE "id" = ${sessionId} AND "revokedAt" IS NULL`;
}

export async function issuePatientAccountToken(userId: string, type: 'ACTIVATION' | 'PASSWORD_RESET') {
  const token = newOpaqueToken();
  const id = `pat_token_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
  const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
  await prisma.$transaction([
    prisma.$executeRaw`UPDATE "patient_account_tokens" SET "usedAt" = NOW() WHERE "userId" = ${userId} AND "type" = ${type}::"PatientAccountTokenType" AND "usedAt" IS NULL`,
    prisma.$executeRaw`INSERT INTO "patient_account_tokens" ("id", "userId", "type", "tokenHash", "expiresAt", "createdAt") VALUES (${id}, ${userId}, ${type}::"PatientAccountTokenType", ${hashMobileToken(token)}, ${expiresAt}, NOW())`,
  ]);
  return { token, expiresAt };
}
