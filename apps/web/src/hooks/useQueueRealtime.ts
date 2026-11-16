'use client';

import { useEffect, useRef, useState } from 'react';

export function useQueueRealtime(onUpdate: () => void | Promise<void>, options: { enabled?: boolean; publicView?: boolean; fallbackMs?: number } = {}) {
  const { enabled = true, publicView = false, fallbackMs = 60_000 } = options;
  const callback = useRef(onUpdate);
  const [connectionState, setConnectionState] = useState<'connecting' | 'live' | 'reconnecting' | 'disabled'>('connecting');
  useEffect(() => { callback.current = onUpdate; }, [onUpdate]);
  useEffect(() => {
    if (!enabled) { setConnectionState('disabled'); return; }
    let active = true;
    const source = new EventSource(`/api/queue/events${publicView ? '?view=public' : ''}`);
    setConnectionState('connecting');
    source.addEventListener('queue-update', () => { if (active) { setConnectionState('live'); void callback.current(); } });
    source.onopen = () => { if (active) setConnectionState('live'); };
    source.onerror = () => { if (active) setConnectionState('reconnecting'); };
    const fallback = window.setInterval(() => { if (active) void callback.current(); }, fallbackMs);
    return () => { active = false; source.close(); window.clearInterval(fallback); };
  }, [enabled, fallbackMs, publicView]);
  return connectionState;
}
