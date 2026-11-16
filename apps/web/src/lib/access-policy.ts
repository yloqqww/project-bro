export const APP_ROLES = ['ADMIN', 'DOCTOR', 'RECEPTIONIST', 'PATIENT', 'NURSE'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const ACCESS = {
  admin: ['ADMIN'],
  clinicalRead: ['ADMIN', 'DOCTOR', 'NURSE'],
  medicalRecordRead: ['ADMIN', 'DOCTOR', 'NURSE', 'PATIENT'],
  patientRead: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PATIENT'],
  patientWrite: ['ADMIN', 'RECEPTIONIST'],
  appointmentRead: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PATIENT'],
  appointmentManage: ['ADMIN', 'RECEPTIONIST', 'NURSE'],
  queueRead: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST', 'PATIENT'],
  queueIssue: ['ADMIN', 'RECEPTIONIST'],
  queueClinicalUpdate: ['DOCTOR'],
  queueManage: ['ADMIN', 'DOCTOR', 'RECEPTIONIST'],
  triageRead: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  triageCreate: ['NURSE'],
  triageHandoff: ['RECEPTIONIST'],
  medicalRecordWrite: ['DOCTOR'],
  prescriptionWrite: ['DOCTOR'],
  analytics: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  staffMessaging: ['ADMIN', 'DOCTOR', 'NURSE', 'RECEPTIONIST'],
  clinicalHandoffWrite: ['DOCTOR', 'NURSE', 'RECEPTIONIST'],
  staffAnnouncementWrite: ['ADMIN'],
} as const satisfies Record<string, readonly AppRole[]>;

export function roleAllowed(role: string, allowed: readonly AppRole[]) {
  return allowed.includes(role as AppRole);
}

export function roleMatchesLoginPortal(actualRole: string, expectedRole: string) {
  return APP_ROLES.includes(actualRole as AppRole)
    && APP_ROLES.includes(expectedRole as AppRole)
    && actualRole === expectedRole;
}

export function canAccessPatient(role: AppRole, ownPatientId: string | null, requestedPatientId: string | null) {
  if (role !== 'PATIENT') return true;
  return Boolean(ownPatientId && requestedPatientId && ownPatientId === requestedPatientId);
}
