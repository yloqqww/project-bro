'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';

type MfaStatus = {
  enabled: boolean;
  enrollmentPending: boolean;
  enforced: boolean;
};

export default function SecurityPage() {
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [secret, setSecret] = useState('');
  const [provisioningUri, setProvisioningUri] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const loadStatus = useCallback(async () => {
    const response = await fetch('/api/security/mfa', { cache: 'no-store' });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || 'Unable to load security status.');
    setStatus({ enabled: body.enabled, enrollmentPending: body.enrollmentPending, enforced: body.enforced });
  }, []);

  useEffect(() => {
    loadStatus().catch((error) => setMessage(error.message));
  }, [loadStatus]);

  const beginEnrollment = async () => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/security/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'BEGIN' }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to start MFA enrollment.');
      setSecret(body.secret);
      setProvisioningUri(body.provisioningUri);
      setStatus((current) => current ? { ...current, enrollmentPending: true } : current);
      setMessage('Add the account to your authenticator app, then enter its 6-digit code.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to start MFA enrollment.');
    } finally {
      setBusy(false);
    }
  };

  const submitMfa = async (action: 'ENABLE' | 'DISABLE') => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/security/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, code }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update MFA.');
      setCode('');
      setSecret('');
      setProvisioningUri('');
      await loadStatus();
      setMessage(action === 'ENABLE' ? 'MFA is now enabled.' : 'MFA is disabled. Other sessions were revoked.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update MFA.');
    } finally {
      setBusy(false);
    }
  };

  const revokeSessions = async () => {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/security/sessions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to revoke sessions.');
      await signOut({ callbackUrl: '/' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to revoke sessions.');
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <section className="mx-auto max-w-2xl space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Account security</h1>
            <p className="mt-1 text-sm text-slate-600">Manage authenticator verification and active sessions.</p>
          </div>
          <Link href="/" className="text-sm font-semibold text-teal-800">Back</Link>
        </div>

        {message ? <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">{message}</div> : null}

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-bold text-slate-950">Authenticator MFA</h2>
            <p className="mt-1 text-sm text-slate-600">
              Status: <strong>{status?.enabled ? 'Enabled' : 'Not enabled'}</strong>
              {status?.enforced ? ' (required by clinic policy)' : ''}
            </p>
          </div>

          {!status?.enabled && !secret ? (
            <button type="button" onClick={beginEnrollment} disabled={busy || !status} className="h-10 rounded bg-teal-800 px-4 text-sm font-bold text-white disabled:opacity-50">
              Set up authenticator
            </button>
          ) : null}

          {secret ? (
            <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm">
              <p className="font-semibold text-amber-950">Keep this secret private. Add it manually to Google Authenticator, Microsoft Authenticator, Authy, or another TOTP app.</p>
              <code className="block break-all rounded bg-white p-2 font-mono text-xs text-slate-900">{secret}</code>
              <a href={provisioningUri} className="block break-all text-xs font-semibold text-teal-800">Open authenticator setup link</a>
            </div>
          ) : null}

          {(secret || status?.enabled) ? (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} placeholder="6-digit code" className="h-10 flex-1 rounded border border-slate-300 px-3 text-sm" />
              <button type="button" onClick={() => submitMfa(status?.enabled ? 'DISABLE' : 'ENABLE')} disabled={busy || code.length !== 6} className="h-10 rounded bg-teal-800 px-4 text-sm font-bold text-white disabled:opacity-50">
                {status?.enabled ? 'Disable MFA' : 'Verify and enable'}
              </button>
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-xl border border-rose-200 bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-950">Revoke all sessions</h2>
          <p className="text-sm text-slate-600">Signs this account out from all web and mobile sessions, including this device.</p>
          <button type="button" onClick={revokeSessions} disabled={busy} className="h-10 rounded bg-rose-700 px-4 text-sm font-bold text-white disabled:opacity-50">Revoke and sign out</button>
        </div>
      </section>
    </main>
  );
}
