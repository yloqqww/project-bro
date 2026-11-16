import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@clinic/db';
import { authOptions } from '@/lib/auth';
import { AppRole, canAccessPatient, roleAllowed } from '@/lib/access-policy';

type AuthorizedUser = {
  id: string;
  email: string;
  role: AppRole;
  patientProfileId: string | null;
  doctorProfileId: string | null;
};

export type ApiAuthorization =
  | { ok: true; user: AuthorizedUser }
  | { ok: false; response: NextResponse };

function authError(status: 401 | 403, code: string, message: string) {
  return NextResponse.json(
    { success: false, error: { code, message } },
    { status }
  );
}

/**
 * Server-side authorization for route handlers. The database lookup is intentional:
 * it makes deactivation and role changes effective even while an older JWT exists.
 */
export async function authorizeApi(allowedRoles?: readonly AppRole[]): Promise<ApiAuthorization> {
  const session = await getServerSession(authOptions);
  const sessionUserId = session?.user?.id;

  if (!sessionUserId) {
    return { ok: false, response: authError(401, 'UNAUTHENTICATED', 'Authentication required.') };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUserId },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      patientProfile: { select: { id: true, status: true } },
      doctorProfile: { select: { id: true, isActive: true } },
    },
  });

  if (!user?.isActive) {
    return { ok: false, response: authError(401, 'ACCOUNT_INACTIVE', 'Authentication required.') };
  }

  const role = user.role as AppRole;
  if (allowedRoles && !roleAllowed(role, allowedRoles)) {
    return { ok: false, response: authError(403, 'FORBIDDEN', 'You do not have permission to perform this action.') };
  }

  if (role === 'DOCTOR' && user.doctorProfile && !user.doctorProfile.isActive) {
    return { ok: false, response: authError(403, 'CLINICIAN_INACTIVE', 'You do not have permission to perform this action.') };
  }
  if (role === 'PATIENT' && user.patientProfile?.status !== 'ACTIVE') {
    return { ok: false, response: authError(403, 'PATIENT_RECORD_INACTIVE', 'Patient access is unavailable.') };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role,
      patientProfileId: user.patientProfile?.id || null,
      doctorProfileId: user.doctorProfile?.id || null,
    },
  };
}

export function requireOwnedPatient(auth: Extract<ApiAuthorization, { ok: true }>, requestedPatientId?: string | null) {
  if (auth.user.role !== 'PATIENT') return null;
  if (!auth.user.patientProfileId) {
    return authError(403, 'PATIENT_PROFILE_MISSING', 'Patient access is unavailable.');
  }
  if (requestedPatientId && !canAccessPatient(auth.user.role, auth.user.patientProfileId, requestedPatientId)) {
    return authError(403, 'PATIENT_ACCESS_DENIED', 'You may only access your own patient record.');
  }
  return null;
}

export function ownPatientId(auth: Extract<ApiAuthorization, { ok: true }>, requestedPatientId?: string | null) {
  return auth.user.role === 'PATIENT' ? auth.user.patientProfileId : requestedPatientId || null;
}
