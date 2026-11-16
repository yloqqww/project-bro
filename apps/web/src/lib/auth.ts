import 'server-only';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@clinic/db';
import bcrypt from 'bcryptjs';
import { createAdminNotification } from '@/lib/notifications';
import { roleMatchesLoginPortal } from '@/lib/access-policy';
import { writeAuditLog } from '@/lib/audit';
import { clearRateLimit, consumeRateLimit } from '@/lib/security-rate-limit';
import { decryptMfaSecret, verifyTotp } from '@/lib/mfa';
import { validateProductionSecurityConfig } from '@/lib/security-config';

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
validateProductionSecurityConfig();

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        expectedRole: { label: 'Expected role', type: 'text' },
        mfaCode: { label: 'Authenticator code', type: 'text' },
      },
      async authorize(credentials, request) {
        try {
          if (!credentials?.email || !credentials?.password || !credentials?.expectedRole) {
            await writeAuditLog({ action: 'LOGIN_FAILURE', targetType: 'User', summary: 'Login rejected because required credentials were incomplete.', request: request as never, metadata: { reason: 'INCOMPLETE_CREDENTIALS' } });
            return null;
          }

          const rateLimit = await consumeRateLimit('STAFF_LOGIN', credentials.email, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);
          if (!rateLimit.allowed) {
            await writeAuditLog({ actor: { email: credentials.email, role: credentials.expectedRole }, action: 'LOGIN_FAILURE', targetType: 'User', summary: `Rate-limited login attempt for ${credentials.email}.`, request: request as never, metadata: { reason: 'RATE_LIMITED' } });
            return null;
          }

          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase() },
            select: {
              id: true,
              email: true,
              password: true,
              role: true,
              isActive: true,
              passwordActivatedAt: true,
              passwordExpiresAt: true,
              mfaEnabled: true,
              mfaSecretEncrypted: true,
              sessionVersion: true,
              doctorProfile: {
                select: { firstName: true, lastName: true, specialization: true, roomNumber: true },
              },
              patientProfile: {
                select: { firstName: true, lastName: true },
              },
              staffProfile: {
                select: { firstName: true, lastName: true, specialty: true, roomNumber: true },
              },
            },
          });

          if (user && user.isActive && roleMatchesLoginPortal(user.role, credentials.expectedRole)) {
            const providedPassword = credentials.password;
            const isBcryptHash = /^\$2[aby]\$\d{2}\$/.test(user.password);
            const isPasswordValid = isBcryptHash
              ? await bcrypt.compare(providedPassword, user.password)
              : false;

            if (isPasswordValid) {
              const isStaff = user.role !== 'PATIENT';
              if (isStaff && process.env.REQUIRE_STAFF_PASSWORD_ACTIVATION === 'true' && !user.passwordActivatedAt) {
                await writeAuditLog({ actor: { id: user.id, email: user.email, role: user.role }, action: 'LOGIN_FAILURE', targetType: 'User', targetId: user.id, summary: 'Login rejected because staff password activation is required.', request: request as never, metadata: { reason: 'PASSWORD_ACTIVATION_REQUIRED' } });
                return null;
              }
              if (user.passwordExpiresAt && user.passwordExpiresAt <= new Date()) {
                await writeAuditLog({ actor: { id: user.id, email: user.email, role: user.role }, action: 'LOGIN_FAILURE', targetType: 'User', targetId: user.id, summary: 'Login rejected because the password expired.', request: request as never, metadata: { reason: 'PASSWORD_EXPIRED' } });
                return null;
              }
              if (isStaff && process.env.REQUIRE_STAFF_MFA === 'true' && !user.mfaEnabled) {
                await writeAuditLog({ actor: { id: user.id, email: user.email, role: user.role }, action: 'LOGIN_FAILURE', targetType: 'User', targetId: user.id, summary: 'Login rejected because staff MFA enrollment is required.', request: request as never, metadata: { reason: 'MFA_ENROLLMENT_REQUIRED' } });
                return null;
              }
              if (user.mfaEnabled) {
                const validMfa = Boolean(credentials.mfaCode && user.mfaSecretEncrypted && verifyTotp(decryptMfaSecret(user.mfaSecretEncrypted), credentials.mfaCode));
                if (!validMfa) {
                  await writeAuditLog({ actor: { id: user.id, email: user.email, role: user.role }, action: 'LOGIN_FAILURE', targetType: 'User', targetId: user.id, summary: 'Login rejected because MFA verification failed.', request: request as never, metadata: { reason: 'MFA_INVALID' } });
                  return null;
                }
              }
              await clearRateLimit('STAFF_LOGIN', credentials.email);
              const staffFullName = user.staffProfile
                ? `${user.staffProfile.firstName} ${user.staffProfile.lastName}`.trim()
                : '';

              const displayName = user.doctorProfile
                ? `Dr. ${user.doctorProfile.firstName} ${user.doctorProfile.lastName}`
                : staffFullName || (user.patientProfile
                ? `${user.patientProfile.firstName} ${user.patientProfile.lastName}`
                : user.email.split('@')[0]);

              // Dispatch notification to admin ONLY when a staff member (Doctor, Nurse, Receptionist) logs in
              if (user.role !== 'PATIENT' && user.role !== 'ADMIN') {
                try {
                  const roleLabel =
                    user.role === 'DOCTOR' ? 'Doctor' :
                    user.role === 'NURSE' ? 'Nurse' :
                    user.role === 'RECEPTIONIST' ? 'Receptionist' :
                    user.role === 'ADMIN' ? 'Admin' : 'Staff';

                  const specialty = user.doctorProfile?.specialization || user.staffProfile?.specialty || null;
                  const room = user.doctorProfile?.roomNumber || user.staffProfile?.roomNumber || null;

                  let roleSubtitle = roleLabel;
                  if (specialty && room) {
                    roleSubtitle = `${roleLabel} • ${specialty} (${room})`;
                  } else if (specialty) {
                    roleSubtitle = `${roleLabel} • ${specialty}`;
                  } else if (room) {
                    roleSubtitle = `${roleLabel} (${room})`;
                  }

                  const notifTitle = `${roleLabel} Logged In: ${displayName}`;
                  const notifMessage = `${displayName} (${roleSubtitle}) has successfully logged in to the portal.`;

                  // Asynchronously record notification without blocking authentication flow
                  createAdminNotification({
                    type: 'info',
                    category: 'STAFF_LOGIN',
                    title: notifTitle,
                    message: notifMessage,
                    staffName: displayName,
                    staffEmail: user.email,
                    staffRole: user.role,
                    staffSpecialty: specialty || undefined,
                    staffRoom: room || undefined,
                    metadata: {
                      userId: user.id,
                      email: user.email,
                      role: user.role,
                      loginTimestamp: new Date().toISOString(),
                    },
                  }).catch((err) => {
                    console.error('Failed to log admin notification on login:', err);
                  });
                } catch (notifErr) {
                  console.error('Error constructing staff login notification:', notifErr);
                }
              }

              await writeAuditLog({ actor: { id: user.id, email: user.email, role: user.role }, action: 'LOGIN_SUCCESS', targetType: 'User', targetId: user.id, summary: `${displayName} signed in successfully.`, request: request as never });
              return {
                id: user.id,
                email: user.email,
                role: user.role,
                name: displayName,
                sessionVersion: user.sessionVersion,
              };
            }
          }

          await writeAuditLog({
            actor: { id: user?.id, email: credentials.email, role: credentials.expectedRole },
            action: 'LOGIN_FAILURE',
            targetType: 'User',
            targetId: user?.id,
            summary: `Rejected login attempt for ${credentials.email}.`,
            request: request as never,
            metadata: { reason: !user ? 'ACCOUNT_NOT_FOUND' : !user.isActive ? 'ACCOUNT_INACTIVE' : !roleMatchesLoginPortal(user.role, credentials.expectedRole) ? 'ROLE_MISMATCH' : 'INVALID_PASSWORD' },
          });
          return null;
        } catch (error) {
          await writeAuditLog({ actor: { email: credentials?.email, role: credentials?.expectedRole }, action: 'LOGIN_FAILURE', targetType: 'User', summary: `Login attempt failed because of a server error.`, request: request as never, metadata: { reason: 'SERVER_ERROR' } });
          console.error('Authorization failed.', error);
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.id = user.id;
        token.sessionVersion = user.sessionVersion;
      } else if (token.id) {
        const current = await prisma.user.findUnique({ where: { id: token.id }, select: { sessionVersion: true, isActive: true } });
        if (!current?.isActive || current.sessionVersion !== token.sessionVersion) token.revoked = true;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && !token.revoked) {
        session.user.role = token.role;
        session.user.id = token.id;
        session.user.sessionVersion = token.sessionVersion;
      } else if (session.user && token.revoked) {
        session.user.id = '';
      }
      return session;
    },
  },
  pages: {
    signIn: '/',
    error: '/',
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
};

