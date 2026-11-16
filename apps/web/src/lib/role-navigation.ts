export function getRoleBasedRedirect(role: string): string {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'DOCTOR':
      return '/doctor/queue';
    case 'NURSE':
      return '/triage';
    case 'RECEPTIONIST':
      return '/reception/checkin';
    default:
      return '/';
  }
}
