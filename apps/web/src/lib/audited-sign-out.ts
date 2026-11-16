'use client';

import { signOut } from 'next-auth/react';

export async function auditedSignOut(callbackUrl: string) {
  await fetch('/api/auth/audit-logout', { method: 'POST', keepalive: true }).catch(() => undefined);
  return signOut({ callbackUrl });
}
