'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Bell, CheckCircle2, Lock, PauseCircle, X } from 'lucide-react';
import { useQueueRealtime } from '@/hooks/useQueueRealtime';

export interface DoctorQueueControlState {
  doctorId: string;
  doctorName: string;
  specialization: string;
  roomNumber: string;
  status: 'OPEN' | 'PAUSED' | 'CLOSED';
  reason: string | null;
  updatedAt: string | null;
}

interface DoctorQueueAlertModalEvent {
  doctorId: string;
  doctorName: string;
  specialization: string;
  roomNumber: string;
  status: 'OPEN' | 'PAUSED' | 'CLOSED';
  reason: string | null;
  changedAt: string;
}

function playAlertTone(status: 'OPEN' | 'PAUSED' | 'CLOSED') {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    const baseFreq = status === 'OPEN' ? 784 : status === 'PAUSED' ? 587 : 440;
    osc.frequency.setValueAtTime(baseFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(status === 'OPEN' ? 988 : baseFreq * 0.85, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch {
    // WebAudio chime is optional.
  }
}

/**
 * Displays live doctor queue status alerts (PAUSED/CLOSED banner) and pops up a realtime modal
 * whenever any doctor pauses, closes, or reopens their queue.
 */
export function DoctorQueueAlertMonitor({
  onStatesUpdated,
}: {
  onStatesUpdated?: (states: DoctorQueueControlState[]) => void;
}) {
  const [states, setStates] = useState<DoctorQueueControlState[]>([]);
  const [modalQueue, setModalQueue] = useState<DoctorQueueAlertModalEvent[]>([]);
  const prevMapRef = useRef<Map<string, { status: string; updatedAt: string | null }>>(new Map());
  const initializedRef = useRef(false);
  const onStatesUpdatedRef = useRef(onStatesUpdated);
  useEffect(() => {
    onStatesUpdatedRef.current = onStatesUpdated;
  }, [onStatesUpdated]);

  const loadStates = useCallback(async () => {
    try {
      const res = await fetch('/api/queue/control', { cache: 'no-store' });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success || !Array.isArray(data.states)) return;

      const nextStates: DoctorQueueControlState[] = data.states;
      setStates(nextStates);
      onStatesUpdatedRef.current?.(nextStates);

      if (!initializedRef.current) {
        const baseline = new Map<string, { status: string; updatedAt: string | null }>();
        for (const s of nextStates) {
          baseline.set(s.doctorId, { status: s.status, updatedAt: s.updatedAt });
        }
        prevMapRef.current = baseline;
        initializedRef.current = true;
        return;
      }

      const transitions: DoctorQueueAlertModalEvent[] = [];
      const nextMap = new Map<string, { status: string; updatedAt: string | null }>();

      for (const s of nextStates) {
        nextMap.set(s.doctorId, { status: s.status, updatedAt: s.updatedAt });
        const prev = prevMapRef.current.get(s.doctorId);
        const statusChanged = prev ? prev.status !== s.status : s.status !== 'OPEN';
        const reasonUpdatedWhileBlocked = prev && prev.status === s.status && s.status !== 'OPEN' && prev.updatedAt !== s.updatedAt;

        if (statusChanged || reasonUpdatedWhileBlocked) {
          transitions.push({
            doctorId: s.doctorId,
            doctorName: s.doctorName,
            specialization: s.specialization,
            roomNumber: s.roomNumber,
            status: s.status,
            reason: s.reason,
            changedAt: new Date().toLocaleTimeString('fil-PH', { hour: '2-digit', minute: '2-digit' }),
          });
        }
      }

      prevMapRef.current = nextMap;

      if (transitions.length > 0) {
        playAlertTone(transitions[0].status);
        setModalQueue((prev) => [...prev, ...transitions]);
      }
    } catch {
      // Non-blocking background sync.
    }
  }, []);

  useQueueRealtime(loadStates, { enabled: true, fallbackMs: 15_000 });

  const blockedDoctors = states.filter((s) => s.status === 'PAUSED' || s.status === 'CLOSED');
  const activeModal = modalQueue[0] || null;

  const dismissModal = () => {
    setModalQueue((prev) => prev.slice(1));
  };

  return (
    <>
      {/* Persistent Banner visible whenever any doctor is PAUSED or CLOSED */}
      {blockedDoctors.length > 0 && (
        <div
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50/95 px-4 py-3 shadow-xs space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-900">
              <Bell className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Abiso sa Pila ng Doktor ({blockedDoctors.length} Naka-pause / Sarado)</span>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {blockedDoctors.map((doc) => {
              const isClosed = doc.status === 'CLOSED';
              return (
                <div
                  key={doc.doctorId}
                  className={`rounded-md border px-3 py-2 text-xs flex items-start justify-between gap-3 ${
                    isClosed
                      ? 'bg-rose-50 border-rose-300 text-rose-950'
                      : 'bg-white border-amber-300 text-amber-950'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="font-bold flex items-center gap-1.5 flex-wrap">
                      <span>{doc.doctorName}</span>
                      <span className="text-[11px] font-normal opacity-80">
                        ({doc.specialization} • {doc.roomNumber})
                      </span>
                    </div>
                    {doc.reason && (
                      <div className="text-[11px] mt-0.5 leading-snug">
                        <span className="font-semibold">Dahilan:</span> {doc.reason}
                      </div>
                    )}
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase border ${
                      isClosed
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300'
                    }`}
                  >
                    {doc.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Realtime Popup Modal on OPEN / PAUSED / CLOSED transition */}
      {activeModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-[1px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="doctor-queue-alert-title"
        >
          <div className="bg-white rounded-xl border border-slate-300 shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div
              className={`px-5 py-4 flex items-start justify-between gap-3 border-b ${
                activeModal.status === 'OPEN'
                  ? 'bg-emerald-50 border-emerald-200'
                  : activeModal.status === 'PAUSED'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-rose-50 border-rose-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    activeModal.status === 'OPEN'
                      ? 'bg-emerald-600 text-white'
                      : activeModal.status === 'PAUSED'
                      ? 'bg-amber-500 text-white'
                      : 'bg-rose-600 text-white'
                  }`}
                >
                  {activeModal.status === 'OPEN' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : activeModal.status === 'PAUSED' ? (
                    <PauseCircle className="w-5 h-5" />
                  ) : (
                    <Lock className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <span
                    className={`inline-block text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border mb-1 ${
                      activeModal.status === 'OPEN'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        : activeModal.status === 'PAUSED'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-rose-100 text-rose-900 border-rose-300'
                    }`}
                  >
                    Live Update • {activeModal.changedAt}
                  </span>
                  <h3 id="doctor-queue-alert-title" className="text-base font-bold text-slate-900 leading-tight">
                    {activeModal.status === 'OPEN'
                      ? `Bukas Na Ulit ang Pila — ${activeModal.doctorName}`
                      : activeModal.status === 'PAUSED'
                      ? `Naka-PAUSE ang Pila — ${activeModal.doctorName}`
                      : `Naka-CLOSE ang Pila — ${activeModal.doctorName}`}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={dismissModal}
                className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-white/70 cursor-pointer"
                aria-label="Isara"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-sm text-slate-700">
              <div className="rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs space-y-1">
                <div>
                  <span className="font-semibold text-slate-500">Departamento / Room:</span>{' '}
                  <strong className="text-slate-900">
                    {activeModal.specialization} • {activeModal.roomNumber}
                  </strong>
                </div>
                {activeModal.reason && activeModal.status !== 'OPEN' && (
                  <div className="pt-1 border-t border-slate-200 text-slate-800">
                    <span className="font-semibold text-slate-500">Dahilan ng Doktor:</span>{' '}
                    <span className="font-bold">{activeModal.reason}</span>
                  </div>
                )}
              </div>

              <div className="flex items-start gap-2 text-xs leading-relaxed text-slate-600">
                <AlertTriangle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span>
                  {activeModal.status === 'OPEN'
                    ? 'Bukas na ulit ang konsultasyon ng doktor na ito. Maaari nang magpasa ng pasyente at mag-issue ng queue ticket.'
                    : activeModal.status === 'PAUSED'
                    ? 'Pansamantalang naka-pause ang pagtawag ng pasyente. Mananatili sa pila ang mga naghihintay hanggang mag-OPEN ulit ang doktor.'
                    : 'Isinara muna ng doktor ang pila. Hindi tatanggap ng bagong check-in ticket para sa doktor na ito hanggang mag-OPEN ulit.'}
                </span>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">
                {modalQueue.length > 1 ? `May ${modalQueue.length - 1} pang abiso` : 'Triage & OPD Live Sync'}
              </span>
              <button
                type="button"
                onClick={dismissModal}
                className={`px-4 py-2 rounded-lg text-xs font-bold text-white shadow-xs cursor-pointer transition ${
                  activeModal.status === 'OPEN'
                    ? 'bg-emerald-700 hover:bg-emerald-800'
                    : activeModal.status === 'PAUSED'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-700 hover:bg-rose-800'
                }`}
              >
                {activeModal.status === 'OPEN' ? 'Okay, Salamat' : 'Naunawaan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

