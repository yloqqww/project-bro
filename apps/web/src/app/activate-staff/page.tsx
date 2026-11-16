'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

export default function ActivateStaffPage() {
  const [email, setEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/security/staff-activation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, temporaryPassword, newPassword }),
      });
      const body = await response.json();
      setMessage(body.message || body.error || 'Activation request completed.');
      if (response.ok) {
        setTemporaryPassword('');
        setNewPassword('');
      }
    } catch {
      setMessage('Unable to reach the activation service.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-slate-950">Activate staff password</h1>
          <p className="mt-1 text-sm text-slate-600">Replace the temporary password issued by the clinic administrator.</p>
        </div>
        <label className="block text-xs font-semibold text-slate-700">
          Staff email
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm" />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          Temporary password
          <input type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} required className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm" />
        </label>
        <label className="block text-xs font-semibold text-slate-700">
          New password
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required className="mt-1 h-11 w-full rounded border border-slate-300 px-3 text-sm" />
        </label>
        <p className="text-xs text-slate-500">Use at least 12 characters with uppercase, lowercase, and a number.</p>
        {message ? <p className="rounded bg-slate-100 p-3 text-sm text-slate-700">{message}</p> : null}
        <button disabled={busy} className="h-11 w-full rounded bg-teal-800 text-sm font-bold text-white disabled:opacity-50">
          {busy ? 'Activating...' : 'Activate password'}
        </button>
        <Link href="/" className="block text-center text-sm font-semibold text-teal-800">Back to staff sign in</Link>
      </form>
    </main>
  );
}
