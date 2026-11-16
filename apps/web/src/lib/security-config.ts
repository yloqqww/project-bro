import 'server-only';

export function validateProductionSecurityConfig() {
  if (process.env.NODE_ENV !== 'production') return;
  const errors: string[] = [];
  if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) errors.push('NEXTAUTH_SECRET must contain at least 32 characters.');
  if (!process.env.RATE_LIMIT_PEPPER || process.env.RATE_LIMIT_PEPPER.length < 32) errors.push('RATE_LIMIT_PEPPER must contain at least 32 characters.');
  if (!process.env.MFA_ENCRYPTION_KEY || !/^[a-fA-F0-9]{64}$/.test(process.env.MFA_ENCRYPTION_KEY)) errors.push('MFA_ENCRYPTION_KEY must be a 64-character hexadecimal key.');
  if (!process.env.CRON_SECRET || process.env.CRON_SECRET.length < 32) errors.push('CRON_SECRET must contain at least 32 characters.');
  if (process.env.REQUIRE_STAFF_MFA === 'true' && !process.env.MFA_ENCRYPTION_KEY) errors.push('MFA_ENCRYPTION_KEY is required when staff MFA enforcement is enabled.');
  if (errors.length) throw new Error(`Unsafe production security configuration: ${errors.join(' ')}`);
}
