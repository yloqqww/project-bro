import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@clinic/db';
import { hashMobileToken, passwordValidationError } from '@/lib/mobile-auth';
import { writeAuditLog } from '@/lib/audit';

const schema = z.object({ token: z.string().min(20), password: z.string().min(1) });

export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ success: false, error: 'Reset token and password are required.' }, { status: 400 });
  const passwordError = passwordValidationError(parsed.data.password);
  if (passwordError) return NextResponse.json({ success: false, error: passwordError }, { status: 400 });
  const tokens = await prisma.$queryRaw<Array<{ id: string; userId: string; email: string }>>`SELECT t."id", t."userId", u."email" FROM "patient_account_tokens" t JOIN "users" u ON u."id" = t."userId" WHERE t."tokenHash" = ${hashMobileToken(parsed.data.token)} AND t."type" = 'PASSWORD_RESET'::"PatientAccountTokenType" AND t."usedAt" IS NULL AND t."expiresAt" > NOW() AND u."role" = 'PATIENT'::"UserRole" LIMIT 1`;
  const token = tokens[0];
  if (!token) return NextResponse.json({ success: false, error: 'Password reset link is invalid or expired.' }, { status: 400 });
  const passwordHash = await bcrypt.hash(parsed.data.password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: token.userId }, data: { password: passwordHash } }),
    prisma.$executeRaw`UPDATE "users" SET "lastPasswordChangeAt" = NOW() WHERE "id" = ${token.userId}`,
    prisma.$executeRaw`UPDATE "patient_account_tokens" SET "usedAt" = NOW() WHERE "id" = ${token.id}`,
    prisma.$executeRaw`UPDATE "mobile_sessions" SET "revokedAt" = NOW() WHERE "userId" = ${token.userId} AND "revokedAt" IS NULL`,
  ]);
  await writeAuditLog({ actor: { id: token.userId, email: token.email, role: 'PATIENT' }, action: 'PASSWORD_RESET_COMPLETED', targetType: 'User', targetId: token.userId, summary: 'Patient password reset completed and existing mobile sessions revoked.', request: req });
  return NextResponse.json({ success: true, message: 'Password reset complete. Sign in with your new password.' });
}
