'use client';

import { useEffect, useState } from 'react';

export function SystemStatusBanner() {
  const [state, setState] = useState<'checking' | 'ok' | 'degraded' | 'offline'>('checking');
  useEffect(() => {
    let active = true;
    const check = async () => {
      try { const response = await fetch('/api/health', { cache: 'no-store' }); if (active) setState(response.ok ? 'ok' : 'degraded'); }
      catch { if (active) setState('offline'); }
    };
    void check();
    const interval = window.setInterval(check, 60_000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);
  if (state === 'checking' || state === 'ok') return null;
  return <div role="status" aria-live="polite" className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-900">{state === 'offline' ? 'Network connection unavailable. Some actions may not be saved.' : 'The clinic database is temporarily unavailable. The system is in read-limited maintenance mode.'}</div>;
}
