'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import LogoutConfirmModal from '@/components/LogoutConfirmModal';
import { ClinicEmergencyBanner } from '@/components/ClinicEmergencyBanner';
import { useSession } from 'next-auth/react';
import { auditedSignOut } from '@/lib/audited-sign-out';
import { useQueueRealtime } from '@/hooks/useQueueRealtime';
import {
  CreditCard,
  Clock,
  Pill,
  RefreshCw,
  AlertCircle,
  Phone,
  Search,
  CheckCircle2,
  Radio,
  ShieldCheck,
  Settings,
  LogOut,
  X,
  Volume2,
  Bell,
  Globe,
  Type,
  Building2,
  Check,
  ChevronRight,
  FileText,
  Printer,
  Calendar,
} from 'lucide-react';

interface PatientData {
  id: string;
  name: string;
  cardUid: string;
  bloodType: string;
  emergencyContact: string;
  hasActiveTicket?: boolean;
  queue: {
    ticketNumber: string;
    department: string;
    room: string;
    doctor: string;
    status: 'WAITING' | 'CALLED' | 'IN_CONSULTATION' | 'COMPLETED' | 'NOW SERVING' | 'NONE';
    positionInQueue: number;
    estimatedWaitMins: number;
    arrivalTime: string;
    recallCount?: number;
  };
  prescriptions: {
    id?: string;
    medication: string;
    dosage: string;
    frequency: string;
    duration?: string;
    quantity?: string;
    instructions?: string;
    doctor?: string;
    prescribedDate?: string;
  }[];
  pastRecords?: {
    id: string;
    date: string;
    doctor: string;
    diagnosis: string;
    subjective: string;
    plan: string;
  }[];
}

export default function PatientPortalPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [isInitializing, setIsInitializing] = useState(true);
  const [searchInput, setSearchInput] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [verificationBirthDate, setVerificationBirthDate] = useState('');
  const [activePatient, setActivePatient] = useState<PatientData | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState('Kasalukuyan');
  const [activeTab, setActiveTab] = useState<'queue' | 'card' | 'consultations' | 'rx'>('queue');
  const [viewRxSlip, setViewRxSlip] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [nfcReading, setNfcReading] = useState(false);

  // Settings states with persistent localStorage loading
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [voiceAlerts, setVoiceAlerts] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [largeText, setLargeText] = useState(false);
  const [appLanguage, setAppLanguage] = useState<'fil' | 'en'>('fil');

  // Notification and live audio state indicators
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioBanner, setAudioBanner] = useState<string | null>(null);
  const [queueNotification, setQueueNotification] = useState<string | null>(null);

  // Play realistic hospital announcement chime using Web Audio API + Speech Synthesis
  const playHospitalChime = async (customTicket?: string, customRoom?: string) => {
    setIsPlayingAudio(true);
    const ticketToAnnounce = customTicket || (activePatient ? activePatient.queue.ticketNumber : 'C-14');
    const roomToAnnounce = customRoom || (activePatient ? activePatient.queue.room : 'Room 201');

    setAudioBanner(
      appLanguage === 'fil'
        ? `🔊 Tumutunog: Laguna Medical Center Chime (Ding-Dong) — Ticket ${ticketToAnnounce}`
        : `🔊 Playing: Laguna Medical Center Chime (Ding-Dong) — Ticket ${ticketToAnnounce}`
    );

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        if (ctx.state === 'suspended') {
          await ctx.resume();
        }
        const now = ctx.currentTime;

        // 3-tone harmonic hospital chime: D5 (587.33Hz) -> F#5 (739.99Hz) -> A5 (880Hz)
        const notes = [
          { freq: 587.33, start: now, duration: 0.35, gain: 0.28 },
          { freq: 739.99, start: now + 0.22, duration: 0.4, gain: 0.3 },
          { freq: 880.00, start: now + 0.46, duration: 0.8, gain: 0.32 },
        ];

        notes.forEach(({ freq, start, duration, gain }) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, start);
          g.gain.setValueAtTime(gain, start);
          g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
          osc.connect(g);
          g.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + duration);
        });
      }

      // Haptic vibration feedback on supported mobile devices
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }

      // Voice announcement after chime notes
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setTimeout(() => {
          const phrase =
            appLanguage === 'fil'
              ? `Numero ${ticketToAnnounce}. Pumasok po sa ${roomToAnnounce}.`
              : `Ticket ${ticketToAnnounce}. Please proceed to ${roomToAnnounce}.`;
          const utterance = new SpeechSynthesisUtterance(phrase);
          utterance.lang = appLanguage === 'fil' ? 'tl-PH' : 'en-US';
          utterance.rate = 0.92;
          utterance.volume = 1;
          utterance.onerror = () => {
            try {
              const fallback = new SpeechSynthesisUtterance(
                `Ticket ${ticketToAnnounce}. Please proceed to ${roomToAnnounce}.`
              );
              fallback.lang = 'en-US';
              window.speechSynthesis.speak(fallback);
            } catch {}
          };
          window.speechSynthesis.speak(utterance);
        }, 750);
      }
    } catch (err) {
      console.error('Audio chime error:', err);
    }

    setTimeout(() => {
      setIsPlayingAudio(false);
      setTimeout(() => setAudioBanner(null), 3500);
    }, 1500);
  };

  // Immediate root font scaling for "Malalaking Titik" across all rem units
  useEffect(() => {
    if (typeof document !== 'undefined') {
      if (largeText) {
        document.documentElement.classList.add('large-text-mode');
        document.documentElement.style.fontSize = '125%';
      } else {
        document.documentElement.classList.remove('large-text-mode');
        document.documentElement.style.fontSize = '';
      }
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('large-text-mode');
        document.documentElement.style.fontSize = '';
      }
    };
  }, [largeText]);

  // Handle mobile NFC scan
  const handleStartNfcScan = async () => {
    if (typeof window === 'undefined' || !('NDEFReader' in window)) return;
    try {
      setNfcReading(true);
      const ndef = new (window as any).NDEFReader();
      await ndef.scan();
      ndef.onreading = (event: any) => {
        const serialNumber = (event.serialNumber || '').replace(/:/g, '').toUpperCase();
        if (serialNumber) {
          performLookup(serialNumber);
        }
      };
    } catch (err) {
      console.warn('NFC read error:', err);
      setNfcReading(false);
    }
  };

  // Check URL parameters, saved session, and load persistent settings on mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'NDEFReader' in window) {
      setNfcSupported(true);
    }

    if (typeof window !== 'undefined') {
      // Load saved preferences
      const savedVoice = localStorage.getItem('lmc_setting_voice');
      const savedAuto = localStorage.getItem('lmc_setting_auto');
      const savedLarge = localStorage.getItem('lmc_setting_large');
      const savedLang = localStorage.getItem('lmc_setting_lang');

      if (savedVoice !== null) setVoiceAlerts(savedVoice === 'true');
      if (savedAuto !== null) setAutoRefresh(savedAuto === 'true');
      if (savedLarge !== null) setLargeText(savedLarge === 'true');
      if (savedLang === 'fil' || savedLang === 'en') setAppLanguage(savedLang);

      const cardFromUrl = new URLSearchParams(window.location.search).get('card');
      if (cardFromUrl) setSearchInput(cardFromUrl.trim().toUpperCase());

      setIsInitializing(sessionStatus === 'loading');
    }
  }, [sessionStatus]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return;
    if (session?.user?.role !== 'PATIENT') {
      setErrorMessage('This portal is only available to patient accounts.');
      setIsInitializing(false);
      return;
    }
    performLookup('', false);
  // performLookup is intentionally triggered only when the authenticated identity changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, session?.user?.role]);

  useQueueRealtime(
    () =>
      performLookup(
        sessionStatus === 'authenticated'
          ? ''
          : activePatient?.cardUid || activePatient?.queue?.ticketNumber || searchInput || '',
        true
      ),
    {
      enabled: Boolean(autoRefresh && activePatient?.id),
      publicView: sessionStatus !== 'authenticated',
      fallbackMs: 15_000,
    }
  );

  const performLookup = async (query = '', isSilent = false) => {
    const cleanQuery = query.trim().toUpperCase();
    if (!cleanQuery && sessionStatus !== 'authenticated') {
      if (!isSilent) {
        setErrorMessage(
          appLanguage === 'fil'
            ? 'Pakilagay ang iyong RFID Card UID o Ticket Number.'
            : 'Please enter your RFID Card UID or Ticket Number.'
        );
      }
      return;
    }
    if (sessionStatus !== 'authenticated' && (!/^\d{4}$/.test(phoneLast4) || !/^\d{4}-\d{2}-\d{2}$/.test(verificationBirthDate))) {
      if (!isSilent) {
        setErrorMessage(
          appLanguage === 'fil'
            ? 'Ilagay ang huling 4 digits ng registered phone number.'
            : 'Enter your date of birth and the last 4 digits of the registered phone number.'
        );
      }
      return;
    }

    if (!isSilent) setIsSearching(true);
    setErrorMessage('');

    try {
      const endpoint = sessionStatus === 'authenticated'
        ? '/api/patients'
        : `/api/patients?portalLookup=${encodeURIComponent(cleanQuery)}&phoneLast4=${encodeURIComponent(phoneLast4)}&dateOfBirth=${encodeURIComponent(verificationBirthDate)}`;
      const res = await fetch(endpoint);
      const data = await res.json();

      if (res.ok && data.success && data.patient) {
        const p = data.patient;
        const q = p.currentQueue;
        const hasActiveTicket = !!q;
        const rawStatus = q?.status || 'NONE';

        const prevStatus = activePatient?.queue?.status;
        const prevRecallCount = activePatient?.queue?.recallCount || 0;
        const nextRecallCount = Number(q?.recallCount || 0);

        // Notify on initial CALLED status OR whenever doctor clicks Call Again (recallCount increments)
        if (rawStatus === 'CALLED' && (prevStatus !== 'CALLED' || nextRecallCount > prevRecallCount)) {
          const isRecall = prevStatus === 'CALLED' && nextRecallCount > prevRecallCount;
          const callMsg =
            appLanguage === 'fil'
              ? isRecall
                ? `🔔 TINATAWAG ULIT NI ${q.doctor}! Pumasok na po sa ${q.room}.`
                : `🔔 TINAWAG NA NI ${q.doctor}! Pumasok na po sa ${q.room}.`
              : isRecall
              ? `🔔 RECALLED BY ${q.doctor}! Please proceed to ${q.room}.`
              : `🔔 TICKET CALLED BY ${q.doctor}! Please enter ${q.room}.`;
          setQueueNotification(callMsg);
          if (voiceAlerts) {
            playHospitalChime(q.ticketNumber, q.room);
          }
          if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('Laguna Medical Center', { body: callMsg.replace('🔔 ', '') });
            } catch { /* ignore notification errors in unsupported browsers */ }
          }
        } else if (rawStatus !== 'CALLED') {
          setQueueNotification(null);
        }

        const formatted: PatientData = {
          id: p.id,
          name: p.name,
          cardUid: p.cardUid,
          bloodType: p.bloodType,
          emergencyContact: p.emergencyContact,
          hasActiveTicket,
          queue: hasActiveTicket
            ? {
                ticketNumber: q.ticketNumber,
                department: q.department,
                room: q.room,
                doctor: q.doctor,
                status: rawStatus,
                positionInQueue: rawStatus === 'WAITING' ? q.position : 0,
                estimatedWaitMins: rawStatus === 'WAITING' ? q.estimatedWaitMinutes : 0,
                arrivalTime: q.timeIssued,
                recallCount: nextRecallCount,
              }
            : {
                ticketNumber: 'WALA',
                department: 'Walang Aktibong Pila',
                room: 'Triage / Reception',
                doctor: 'Front Desk',
                status: 'NONE',
                positionInQueue: 0,
                estimatedWaitMins: 0,
                arrivalTime: '—',
                recallCount: 0,
              },
          prescriptions: p.prescriptions || [],
          pastRecords: p.pastRecords || [],
        };

        setActivePatient(formatted);
        if (!isSilent && cleanQuery) setSearchInput(cleanQuery);
        setLastSynced(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        if (typeof window !== 'undefined') window.history.replaceState({}, '', window.location.pathname);
      } else {
        if (!isSilent) {
          const apiMessage = typeof data?.error === 'string' ? data.error : data?.error?.message;
          setErrorMessage(apiMessage || (appLanguage === 'fil'
            ? 'Hindi makuha ang iyong patient record.'
            : 'Your patient record could not be loaded.'));
        }
      }
    } catch (err) {
      console.error('Error looking up patient:', err);
      if (!isSilent) {
        setErrorMessage('Hindi makakonekta sa database server.');
      }
    } finally {
      setIsSearching(false);
      setIsRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    setActivePatient(null);
    setSearchInput('');
    setPhoneLast4('');
    setErrorMessage('');

    // Clear saved session and URL query
    if (typeof window !== 'undefined') {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
    if (sessionStatus === 'authenticated') {
      await auditedSignOut('/patient');
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performLookup(searchInput);
  };

  const handleRefresh = () => {
    if (activePatient?.cardUid) {
      setIsRefreshing(true);
      performLookup(activePatient.cardUid);
    }
  };

  const toggleVoiceAlerts = () => {
    const next = !voiceAlerts;
    setVoiceAlerts(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lmc_setting_voice', String(next));
    }
    if (next) {
      playHospitalChime();
    }
  };

  const toggleAutoRefresh = () => {
    const next = !autoRefresh;
    setAutoRefresh(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lmc_setting_auto', String(next));
    }
  };

  const toggleLargeText = () => {
    const next = !largeText;
    setLargeText(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lmc_setting_large', String(next));
    }
  };

  const changeLanguage = (lang: 'fil' | 'en') => {
    setAppLanguage(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lmc_setting_lang', lang);
    }
  };

  if (sessionStatus === 'authenticated' && session?.user?.role !== 'PATIENT') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-sm bg-white border border-slate-200 rounded-lg p-6 text-center space-y-4">
          <h1 className="text-lg font-bold text-slate-900">Patient access required</h1>
          <p className="text-sm text-slate-600">Sign out of the staff account before using the patient portal.</p>
          <button onClick={() => auditedSignOut('/patient')} className="bg-slate-900 text-white rounded px-4 py-2 text-sm font-semibold">Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col justify-between transition-all duration-150 ${
        largeText ? 'text-base sm:text-lg' : 'text-sm'
      }`}
      style={largeText ? { fontSize: '115%' } : {}}
    >
      
      {/* ── 1. NATIVE APP HEADER (CLEAN, PROPORTIONATE & UNCLUTTERED) ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Hospital Monogram & Title */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-md bg-teal-800 flex items-center justify-center text-white font-bold text-xs tracking-wider shrink-0 shadow-2xs">
              LMC
            </div>
            <div>
              <div className="text-sm sm:text-base font-bold text-slate-900 leading-tight">
                Laguna Medical Center
              </div>
              <div className="text-[11px] text-slate-500 font-normal">
                Patient Portal • Live Queue & RFID
              </div>
            </div>
          </div>

          {/* Action Header Icons (Subtle, Compact & Un-Cramped) */}
          <div className="flex items-center space-x-2">
            <Link
              href="/book"
              className="h-9 px-3 rounded-md bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs flex items-center space-x-1.5 transition-colors shadow-2xs"
              title="Mag-book ng Clinic Appointment Online"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Online Booking</span>
              <span className="sm:hidden">Book</span>
            </Link>

            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="w-9 h-9 rounded-md border border-slate-200 bg-white hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
              title="Patient Settings"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            {activePatient && (
              <button
                type="button"
                onClick={() => {
                  if (sessionStatus === 'authenticated') setIsLogoutModalOpen(true);
                  else handleSignOut();
                }}
                className="h-9 px-3 rounded-md border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-medium text-xs flex items-center space-x-1.5 transition-colors cursor-pointer"
                title={sessionStatus === 'authenticated' ? 'Sign Out' : 'I-clear ang Patient Record'}
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{sessionStatus === 'authenticated' ? 'Sign Out' : 'I-clear'}</span>
              </button>
            )}
          </div>
        </div>
      </header>
      <ClinicEmergencyBanner />

      {/* ── 2. MAIN BODY ─────────────────────────────────────────────── */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 sm:py-10">
        {isInitializing ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-3">
            <div className="w-10 h-10 rounded-md bg-teal-800 text-white font-bold flex items-center justify-center text-xs tracking-wider shadow-2xs animate-pulse">
              LMC
            </div>
            <div className="text-xs text-slate-400 font-medium">
              Kinukuha ang rekord ng pasyente...
            </div>
          </div>
        ) : !activePatient ? (
          /* ── VIEW 1: CLEAN, UN-BOXED LOOKUP EXPERIENCE ────────────── */
          <div className="space-y-8">
            
            {/* Direct Header Typography */}
            <div className="space-y-2 pt-2 sm:pt-4">
              <span className="text-[11px] font-bold text-teal-800 tracking-widest uppercase">
                Patient Self-Service
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                {appLanguage === 'fil' ? 'Tingnan ang Iyong Pila at RFID Card' : 'Track Your Queue & RFID Status'}
              </h1>
              <p className="text-slate-600 text-sm leading-relaxed">
                {appLanguage === 'fil'
                  ? 'I-type ang iyong RFID Card UID mula sa plastic card o ang Ticket Number mula sa printed receipt.'
                  : 'Enter your RFID Card UID from your physical card or the Ticket Number from your reception receipt.'}
              </p>
            </div>

            {/* Online Appointment Booking Banner */}
            <div className="p-4 bg-teal-50/70 border border-teal-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
              <div className="space-y-0.5">
                <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block">
                  {appLanguage === 'fil' ? 'Online Appointment Portal' : 'Online Appointment Portal'}
                </span>
                <p className="text-xs text-teal-950 font-semibold">
                  {appLanguage === 'fil'
                    ? 'Magpa-iskedyul ng konsultasyon bago pumunta sa ospital'
                    : 'Schedule your consultation before visiting the hospital'}
                </p>
                <p className="text-[11px] text-teal-800/80">
                  {appLanguage === 'fil'
                    ? 'Pumili ng doktor, petsa, at oras gamit ang web o mobile phone.'
                    : 'Select your doctor, specialty, date, and time slot from web or mobile.'}
                </p>
              </div>
              <Link
                href="/book"
                className="inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors shrink-0"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{appLanguage === 'fil' ? 'Mag-book Online' : 'Book Online'}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div
                role="alert"
                className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-xs sm:text-sm flex items-start space-x-3"
              >
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-normal">{errorMessage}</span>
              </div>
            )}

            {/* Search Input Block */}
            <form onSubmit={handleSearchSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="lookup-input"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  {appLanguage === 'fil' ? 'Card UID o Ticket Number' : 'Card UID or Ticket Number'}
                </label>
                
                <div className="relative">
                  <input
                    id="lookup-input"
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Hal. A1B2C3D4 o C-14"
                    required
                    autoFocus
                    className="w-full h-13 px-4 pr-12 bg-white border border-slate-300 rounded-lg text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 uppercase font-mono tracking-wider transition-colors shadow-2xs"
                  />
                  {searchInput && (
                    <button
                      type="button"
                      onClick={() => setSearchInput('')}
                      className="absolute right-3 top-3 text-slate-400 hover:text-slate-700 text-xs px-2 py-1 rounded bg-slate-100"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {sessionStatus !== 'authenticated' && (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label htmlFor="verification-birth-date" className="block text-xs font-bold uppercase tracking-wider text-slate-700">{appLanguage === 'fil' ? 'Petsa ng Kapanganakan' : 'Date of Birth'}</label>
                    <input id="verification-birth-date" type="date" required value={verificationBirthDate} onChange={(e) => setVerificationBirthDate(e.target.value)} className="h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-700/20" />
                  </div>
                  <div className="space-y-1.5">
                  <label
                    htmlFor="phone-last-four"
                    className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                  >
                    {appLanguage === 'fil' ? 'Huling 4 Digits ng Registered Phone' : 'Last 4 Digits of Registered Phone'}
                  </label>
                  <input
                    id="phone-last-four"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{4}"
                    maxLength={4}
                    required
                    value={phoneLast4}
                    onChange={(e) => setPhoneLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="Hal. 1234"
                    autoComplete="tel"
                    className="w-full h-12 px-4 bg-white border border-slate-300 rounded-lg text-base text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700 font-mono tracking-widest transition-colors shadow-2xs"
                  />
                  <p className="text-[11px] text-slate-500">
                    {appLanguage === 'fil'
                      ? 'Verification lamang ito—walang patient account o password na kailangan.'
                      : 'For verification only—no patient account or password is required.'}
                  </p>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSearching}
                className="w-full h-12 bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white font-semibold text-sm rounded-lg transition-colors flex items-center justify-center space-x-2 disabled:opacity-60 cursor-pointer shadow-2xs"
              >
                <Search className="w-4 h-4" />
                <span>
                  {isSearching
                    ? (appLanguage === 'fil' ? 'Hinahanap ang rekord...' : 'Searching...')
                    : (appLanguage === 'fil' ? 'Hanapin ang Aking Pila at Status' : 'Find My Queue & Status')}
                </span>
              </button>

              {nfcSupported && (
                <button
                  type="button"
                  onClick={handleStartNfcScan}
                  className="w-full h-11 bg-white hover:bg-slate-50 text-slate-800 font-medium text-xs rounded-lg border border-slate-300 flex items-center justify-center space-x-2 transition-colors cursor-pointer"
                >
                  <Radio className={`w-4 h-4 text-teal-700 ${nfcReading ? 'animate-pulse' : ''}`} />
                  <span>
                    {nfcReading
                      ? 'Itapat ang RFID Card sa likod ng iyong telepono...'
                      : 'I-tap ang Physical RFID Card (NFC Scanner)'}
                  </span>
                </button>
              )}
            </form>

            {/* Assistance Advisory Notice */}
            <div className="p-4 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed flex items-start space-x-3">
              <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 block mb-0.5">
                  {appLanguage === 'fil' ? 'Wala ka pa bang RFID Card o Ticket?' : 'Need an RFID Card or Ticket?'}
                </span>
                <p>
                  {appLanguage === 'fil'
                    ? 'Magtungo sa Central Registration Desk sa Ground Floor ng Laguna Medical Center upang mabigyan ng opisyal na hospital RFID card.'
                    : 'Please visit Central Registration on the Ground Floor of Laguna Medical Center to receive your official patient card.'}
                </p>
              </div>
            </div>

          </div>
        ) : (
          /* ── VIEW 2: GENUINE NATIVE PATIENT DASHBOARD ─────────────── */
          <div className="space-y-6">
            
            {/* Patient Header Strip */}
            <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                  Rehistradong Pasyente
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                  {activePatient.name}
                </h2>
                <div className="text-xs text-slate-500 font-mono mt-0.5">
                  UID: <strong className="text-slate-800">{activePatient.cardUid}</strong> • Dugo: <strong className="text-slate-800">{activePatient.bloodType}</strong>
                </div>
              </div>

              <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300 font-mono">
                Aktibo
              </span>
            </div>

            {/* Live Audio Playback Banner */}
            {audioBanner && (
              <div className="p-3.5 bg-teal-900 text-white rounded-lg text-xs font-semibold flex items-center justify-between shadow-md animate-pulse">
                <div className="flex items-center space-x-2.5">
                  <Volume2 className="w-4 h-4 text-teal-300 shrink-0 animate-bounce" />
                  <span className="leading-tight">{audioBanner}</span>
                </div>
                <span className="text-[10px] bg-teal-800 text-teal-200 px-2 py-0.5 rounded uppercase font-bold shrink-0">
                  Tumutunog
                </span>
              </div>
            )}

            {/* Live Queue Progression Notice */}
            {queueNotification && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-950 rounded-lg text-xs font-medium flex items-center justify-between shadow-xs">
                <div className="flex items-center space-x-2.5">
                  <Bell className="w-4 h-4 text-amber-600 shrink-0" />
                  <span className="leading-tight">{queueNotification}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setQueueNotification(null)}
                  className="text-amber-800 hover:text-amber-950 p-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* iOS Style Segmented Control (Tabs) */}
            <nav className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-slate-200 p-1 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setActiveTab('queue')}
                className={`py-2 text-center rounded-md transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                  activeTab === 'queue'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Pila (Live)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('card')}
                className={`py-2 text-center rounded-md transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                  activeTab === 'card'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>RFID Card</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('consultations')}
                className={`py-2 text-center rounded-md transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                  activeTab === 'consultations'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Payo at Rekord</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('rx')}
                className={`py-2 text-center rounded-md transition-colors flex items-center justify-center space-x-1.5 cursor-pointer ${
                  activeTab === 'rx'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Pill className="w-3.5 h-3.5" />
                <span>Reseta ({activePatient.prescriptions?.length || 0})</span>
              </button>
            </nav>

            {/* ── TAB 1: LIVE QUEUE (CONNECTED DIRECTLY TO DOCTOR'S DESK) ── */}
            {activeTab === 'queue' && (
              <div className="space-y-4">
                {!activePatient.hasActiveTicket ? (
                  /* No Active Ticket State */
                  <div className="bg-white border border-slate-200 rounded-lg p-6 sm:p-8 text-center space-y-4 shadow-2xs">
                    <div className="w-14 h-14 rounded-full bg-slate-100 border border-slate-200 text-slate-500 flex items-center justify-center mx-auto">
                      <Clock className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-bold text-slate-900">
                        Walang Aktibong Queue Ticket Ngayong Araw
                      </h3>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
                        Naka-rehistro ang inyong RFID Card ({activePatient.cardUid}), ngunit wala pa kayong nakatalagang numero sa pila sa alinmang doktor ngayong araw.
                      </p>
                    </div>

                    <div className="p-4 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900 max-w-md mx-auto text-left space-y-1.5">
                      <div className="font-bold flex items-center gap-1.5 text-teal-950">
                        <span className="w-2 h-2 rounded-full bg-teal-600" />
                        Paano Kumuha ng Ticket sa Pila:
                      </div>
                      <p className="text-slate-600 pl-3.5 leading-relaxed">
                        Pumunta po sa <strong>Triage Desk / Reception Desk</strong> sa ground floor at i-tap ang inyong RFID Card upang maitala ang inyong Vital Signs at mabigyan ng Ticket Number para sa inyong doktor.
                      </p>
                    </div>

                    <div className="pt-2 flex justify-center">
                      <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="h-10 px-4 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-md border border-slate-300 inline-flex items-center space-x-2 transition-colors cursor-pointer shadow-2xs"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>{isRefreshing ? 'Sinusuri ang database...' : 'I-check Muli ang Pila'}</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Active Queue Ticket from Doctor */
                  <div className="bg-white border border-slate-200 rounded-lg p-6 space-y-6 shadow-2xs">
                    {/* Department & Live Indicator */}
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                          Kagawaran & Konsultasyon
                        </span>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900">
                          {activePatient.queue.department} • {activePatient.queue.room}
                        </h3>
                      </div>

                      <span className="inline-flex items-center px-2.5 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-semibold rounded">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-1.5 animate-pulse" />
                        Live Queue
                      </span>
                    </div>

                    {/* Clean Ticket Callout */}
                    <div className="text-center py-2 space-y-2">
                      <span className="text-xs text-slate-400 uppercase font-bold tracking-wider block">
                        Numero sa Pila (Ticket #)
                      </span>
                      <div className="text-6xl sm:text-7xl font-extrabold font-mono text-slate-900 tracking-wider">
                        {activePatient.queue.ticketNumber}
                      </div>

                      <div>
                        {activePatient.queue.status === 'CALLED' ? (
                          <div className="p-3 bg-emerald-100 border-2 border-emerald-500 rounded-lg animate-pulse text-emerald-950 max-w-md mx-auto">
                            <span className="font-black text-sm sm:text-base block">
                              🔔 TINAWAG NA PO NI {activePatient.queue.doctor}!
                            </span>
                            <span className="text-xs font-bold block mt-0.5">
                              PUMASOK NA PO SA {activePatient.queue.room}
                            </span>
                          </div>
                        ) : activePatient.queue.status === 'IN_CONSULTATION' ? (
                          <div className="p-3 bg-blue-100 border border-blue-400 rounded-lg text-blue-950 max-w-md mx-auto">
                            <span className="font-bold text-xs sm:text-sm block">
                              ⚕️ KASALUKUYANG NASA KONSULTASYON
                            </span>
                            <span className="text-xs text-blue-800 block mt-0.5">
                              Kasalukuyang sinusuri ni {activePatient.queue.doctor} sa {activePatient.queue.room}
                            </span>
                          </div>
                        ) : activePatient.queue.status === 'COMPLETED' ? (
                          <div className="p-3 bg-slate-100 border border-slate-300 rounded-lg text-slate-800 max-w-md mx-auto">
                            <span className="font-bold text-xs sm:text-sm block">
                              ✓ NATAPOS NA ANG KONSULTASYON
                            </span>
                            <span className="text-xs text-slate-600 block mt-0.5">
                              Maraming salamat sa inyong pagbisita sa Laguna Medical Center!
                            </span>
                          </div>
                        ) : (
                          <span className="inline-block px-3 py-1.5 bg-amber-50 border border-amber-300 text-amber-950 font-semibold text-xs sm:text-sm rounded-md">
                            ⏳ Nasa Pila — Naghihintay tawagin ni {activePatient.queue.doctor}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Doctor Details & Estimated Time */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs">
                      <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">
                          Doktor na Titingin
                        </span>
                        <span className="font-bold text-slate-900 text-sm block">
                          {activePatient.queue.doctor}
                        </span>
                        <span className="text-slate-500">{activePatient.queue.department} Specialist</span>
                      </div>

                      <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                        <span className="text-slate-400 uppercase text-[10px] font-bold block mb-0.5">
                          Silid ng Konsultasyon
                        </span>
                        <span className="font-bold text-teal-800 text-sm block">
                          {activePatient.queue.room}
                        </span>
                        <span className="text-slate-500">Check-in Oras: {activePatient.queue.arrivalTime}</span>
                      </div>
                    </div>

                    {/* Vertical Progress Roadmap */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                        Katayuan ng Inyong Pagbisita:
                      </span>
                      
                      <div className="space-y-3 text-xs">
                        {/* Step 1: Check-in */}
                        <div className="flex items-start space-x-3">
                          <div className="w-5 h-5 rounded-full bg-teal-800 text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                            ✓
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">1. Check-In sa Triage Desk</span>
                            <span className="text-slate-500">Narehistro at naisyuhan ng Ticket {activePatient.queue.ticketNumber} ({activePatient.queue.arrivalTime})</span>
                          </div>
                        </div>

                        {/* Step 2: Waiting in Lobby */}
                        <div className="flex items-start space-x-3">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                            activePatient.queue.status === 'WAITING'
                              ? 'bg-amber-600 text-white animate-pulse'
                              : 'bg-teal-800 text-white'
                          }`}>
                            {activePatient.queue.status === 'WAITING' ? '2' : '✓'}
                          </div>
                          <div>
                            <span className={`font-bold block ${
                              activePatient.queue.status === 'WAITING' ? 'text-amber-900' : 'text-slate-900'
                            }`}>
                              2. Naghihintay sa Waiting Lobby
                            </span>
                            <span className="text-slate-500">
                              {activePatient.queue.status === 'WAITING'
                                ? 'Nasa pila — pakinggan ang tawag ng doktor sa overhead Queue TV screens'
                                : 'Tinawag na ang inyong tiket'}
                            </span>
                          </div>
                        </div>

                        {/* Step 3: Consultation with Doctor */}
                        <div className={`flex items-start space-x-3 ${
                          activePatient.queue.status === 'WAITING' ? 'opacity-60' : 'opacity-100'
                        }`}>
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${
                            activePatient.queue.status === 'CALLED'
                              ? 'bg-emerald-600 text-white animate-bounce'
                              : activePatient.queue.status === 'IN_CONSULTATION'
                              ? 'bg-blue-600 text-white'
                              : activePatient.queue.status === 'COMPLETED'
                              ? 'bg-teal-800 text-white'
                              : 'bg-slate-300 text-slate-700'
                          }`}>
                            {activePatient.queue.status === 'COMPLETED' ? '✓' : '3'}
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block">
                              3. Konsultasyon kay {activePatient.queue.doctor}
                            </span>
                            <span className="text-slate-500">
                              {activePatient.queue.status === 'CALLED'
                                ? `🔔 TINAWAG NA! Pumasok na sa ${activePatient.queue.room}`
                                : activePatient.queue.status === 'IN_CONSULTATION'
                                ? `Kasalukuyang sinusuri sa ${activePatient.queue.room}`
                                : activePatient.queue.status === 'COMPLETED'
                                ? 'Tapos na ang konsultasyon'
                                : `Papasok sa ${activePatient.queue.room} kapag tinawag ng Doktor`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Refresh Queue Action (Connected to Doctor) */}
                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="h-10 px-4 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs rounded-md border border-slate-300 flex items-center justify-center space-x-2 transition-colors cursor-pointer shadow-2xs w-full sm:w-auto"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
                        <span>{isRefreshing ? 'Sinusuri ang estado...' : 'I-refresh ang Katayuan sa Doktor'}</span>
                      </button>

                      <span className="text-[11px] text-slate-500">
                        Huling update mula sa database: <strong>{lastSynced}</strong>
                      </span>
                    </div>
                  </div>
                )}

                <div className="p-3.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 leading-normal">
                  <strong>Paalala:</strong> Ang pag-usad ng pila ay pinamamahalaan at ina-update nang direkta ng inyong Doktor sa Consultation Desk. Manatili po sa Waiting Lobby o pakinggan ang anunsyo sa Queue TV screens.
                </div>

              </div>
            )}

            {/* ── TAB 2: DIGITAL RFID CARD (PROPORTIONATE & CLEAN) ─────── */}
            {activeTab === 'card' && (
              <div className="space-y-4">
                
                {/* Physical Hospital Card Rendering */}
                <div className="bg-slate-900 text-white rounded-xl p-6 border border-slate-800 shadow-sm space-y-5">
                  <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="text-xs font-bold tracking-wider uppercase text-slate-300">
                        Laguna Medical Center
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Official Patient Identification Card
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
                      ACTIVE
                    </span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 block uppercase tracking-widest font-mono">
                      Card Hardware UID
                    </span>
                    <span className="text-3xl font-bold font-mono tracking-widest text-white block">
                      {activePatient.cardUid}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Pangalan ng Pasyente</span>
                      <span className="font-semibold text-white">{activePatient.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[11px]">Uri ng Dugo</span>
                      <span className="font-bold text-white font-mono">{activePatient.bloodType}</span>
                    </div>
                  </div>
                </div>

                {/* Scannable Barcode */}
                <div className="bg-white border border-slate-200 rounded-lg p-5 text-center space-y-2">
                  <div className="text-sm font-semibold text-slate-900">
                    Front-Desk Check-In Barcode
                  </div>
                  <p className="text-xs text-slate-500 leading-normal">
                    Ipakita ang barcode o ang Card UID sa reception desk para sa mabilisang verification.
                  </p>

                  <div className="py-2 flex items-center justify-center space-x-1" aria-hidden="true">
                    {[3, 1, 4, 2, 1, 5, 2, 4, 1, 3, 2, 6, 2, 4, 1, 3, 2, 5, 1, 4].map((w, i) => (
                      <div key={i} className="bg-slate-900 h-10" style={{ width: `${w * 2}px` }} />
                    ))}
                  </div>
                  <div className="font-mono text-xs text-slate-700 font-semibold tracking-wider">
                    *{activePatient.cardUid}*
                  </div>
                </div>

                {/* Registered Emergency Contact Card */}
                <div className="bg-white border border-slate-200 rounded-lg p-4 text-xs space-y-1">
                  <span className="font-semibold text-slate-600 block text-[11px] uppercase">
                    Rehistradong Emergency Contact:
                  </span>
                  <div className="text-slate-900 font-medium">
                    {activePatient.emergencyContact}
                  </div>
                </div>

              </div>
            )}

            {/* ── TAB 3: CONSULTATIONS & DOCTOR ADVICE ─────────────── */}
            {activeTab === 'consultations' && (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4">
                  <h3 className="font-bold text-base text-slate-900">
                    Rekord ng Konsultasyon at Payo ng Doktor
                  </h3>
                  <p className="text-xs text-slate-500">
                    Pagsusuri (Diagnosis), dahilan ng pagbisita, at plano ng gamutan mula sa iyong attending physician
                  </p>
                </div>

                {(!activePatient.pastRecords || activePatient.pastRecords.length === 0) ? (
                  <div className="p-8 bg-white border border-slate-200 rounded-lg text-center space-y-2">
                    <FileText className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-800 text-sm">
                      Wala Pang Naitalang Rekord ng Konsultasyon
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Pagkatapos ng inyong konsultasyon sa doktor, dito lilitaw ang opisyal na buod ng inyong check-up at ang mga payo sa inyong kalusugan.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activePatient.pastRecords.map((rec, idx) => (
                      <div
                        key={rec.id || idx}
                        className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 shadow-2xs"
                      >
                        {/* Header: Date and Attending Doctor */}
                        <div className="flex items-start justify-between border-b border-slate-100 pb-2.5">
                          <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                              Petsa ng Konsultasyon
                            </span>
                            <span className="font-bold text-sm text-slate-900 font-mono">
                              {rec.date}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                              Attending Physician
                            </span>
                            <span className="font-semibold text-xs text-teal-900">
                              {rec.doctor}
                            </span>
                          </div>
                        </div>

                        {/* Clinical Diagnosis / Assessment */}
                        <div>
                          <span className="text-[11px] text-slate-500 font-medium block mb-1">
                            Pagsusuri ng Doktor (Clinical Diagnosis / Assessment):
                          </span>
                          <div className="inline-block px-2.5 py-1 rounded bg-teal-50 border border-teal-200 text-teal-950 font-bold text-xs">
                            {rec.diagnosis || 'General Outpatient Assessment'}
                          </div>
                        </div>

                        {/* Chief Complaint / Subjective Reason */}
                        {rec.subjective && (
                          <div className="text-xs bg-slate-50 p-2.5 rounded border border-slate-100">
                            <span className="font-semibold text-slate-700 block text-[11px] mb-0.5">
                              Dahilan ng Pagbisita / Chief Complaint:
                            </span>
                            <p className="text-slate-800">{rec.subjective}</p>
                          </div>
                        )}

                        {/* Doctor's Advice & Treatment Plan */}
                        <div>
                          <span className="font-semibold text-slate-800 block text-xs mb-1">
                            Payo ng Doktor at Plano ng Gamutan (Doctor&apos;s Advice & Care Plan):
                          </span>
                          <div className="p-3 bg-teal-50/50 border border-teal-200 rounded text-xs text-slate-800 leading-relaxed">
                            {rec.plan || 'Manatiling uminom ng maraming tubig at sundin ang mga iniresetang gamot.'}
                          </div>
                        </div>

                        {/* Sub-note pointing to Prescriptions tab */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                          <span>Kailangan ng gamot?</span>
                          <button
                            type="button"
                            onClick={() => setActiveTab('rx')}
                            className="font-semibold text-teal-800 hover:text-teal-950 hover:underline cursor-pointer flex items-center space-x-1"
                          >
                            <Pill className="w-3 h-3" />
                            <span>Tingnan ang Reseta ({activePatient.prescriptions?.length || 0})</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── TAB 4: PRESCRIPTIONS (RESETA / RX ONLY) ───────────────── */}
            {activeTab === 'rx' && (
              <div className="space-y-4">
                <div className="bg-white border border-slate-200 rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-base text-slate-900">
                      Mga Iniresetang Gamot (Prescriptions)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Opisyal na inireseta ng attending physician ng Laguna Medical Center
                    </p>
                  </div>

                  {activePatient.prescriptions && activePatient.prescriptions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setViewRxSlip(true)}
                      className="px-3 py-1.5 rounded border border-teal-700 bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs flex items-center space-x-1.5 transition cursor-pointer shrink-0 shadow-2xs"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Digital Rx Slip</span>
                    </button>
                  )}
                </div>

                {(!activePatient.prescriptions || activePatient.prescriptions.length === 0) ? (
                  <div className="p-8 bg-white border border-slate-200 rounded-lg text-center space-y-2">
                    <Pill className="w-8 h-8 text-slate-300 mx-auto" />
                    <p className="font-semibold text-slate-800 text-sm">
                      {appLanguage === 'fil' ? 'Wala Pang Naitalang Reseta' : 'No Active Prescriptions'}
                    </p>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      {appLanguage === 'fil'
                        ? 'Kapag nag-isyu ang inyong attending physician ng mga gamot pagkatapos ng konsultasyon, awtomatiko itong lilitaw dito kasama ang dosis at tagubilin.'
                        : 'When your attending physician prescribes medications during or after consultation, they will appear here automatically with dosage instructions.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activePatient.prescriptions.map((rx, idx) => (
                      <div
                        key={rx.id || idx}
                        className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5 shadow-2xs"
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="font-bold text-base text-slate-900">{rx.medication}</div>
                            <div className="text-xs text-slate-600 font-mono mt-0.5">
                              Dosis: <strong className="text-slate-900">{rx.dosage}</strong> {rx.duration ? `• Tagal: ${rx.duration}` : ''} {rx.quantity ? `• Bilang: #${rx.quantity}` : ''}
                            </div>
                          </div>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-300">
                            Aktibong Reseta
                          </span>
                        </div>

                        <div className="pt-2 border-t border-slate-100 text-xs space-y-1.5">
                          <div>
                            <span className="text-slate-500 font-medium block text-[11px]">Dalas ng Pag-inom:</span>
                            <span className="font-semibold text-slate-900">{rx.frequency}</span>
                          </div>
                          {rx.instructions && (
                            <div className="p-2 bg-slate-50 border border-slate-200 rounded text-slate-700 text-xs">
                              <strong>Tagubilin ng Doktor:</strong> {rx.instructions}
                            </div>
                          )}
                        </div>

                        {rx.doctor && (
                          <div className="text-[11px] text-slate-500 font-mono pt-1.5 border-t border-slate-100 flex items-center justify-between">
                            <span>Inireseta ni: <strong>{rx.doctor}</strong></span>
                            <span>{rx.prescribedDate ? `${rx.prescribedDate}` : ''}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="p-4 bg-white border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed flex items-start space-x-3">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
                  <span>
                    Maaaring kunin ang inyong mga gamot sa <strong>Outpatient Pharmacy</strong> sa Ground Floor pagkatapos ng inyong konsultasyon. Ipakita ang inyong RFID Card o ang Digital Rx Slip.
                  </span>
                </div>
              </div>
            )}

            {/* ── DIGITAL RX PRESCRIPTION SLIP MODAL ────────────────────── */}
            {viewRxSlip && activePatient.prescriptions && activePatient.prescriptions.length > 0 && (
              <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto print:p-0 print:bg-white">
                <div className="bg-white border border-slate-300 rounded-lg max-w-xl w-full p-6 space-y-4 my-8 shadow-xl print:shadow-none print:border-none">
                  {/* Modal Hospital Header */}
                  <div className="flex items-start justify-between border-b-2 border-slate-800 pb-3">
                    <div className="space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 rounded bg-teal-800 text-white font-bold flex items-center justify-center text-xs">
                          LMC
                        </div>
                        <div>
                          <h2 className="font-bold text-base text-slate-900 leading-tight">
                            LAGUNA MEDICAL CENTER
                          </h2>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">
                            Republic of the Philippines • Outpatient Clinical Services
                          </p>
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 font-mono">
                        Santa Cruz, Laguna • Tel: (049) 501-1234
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setViewRxSlip(false)}
                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 print:hidden cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Patient Details Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-slate-50 p-3 rounded border border-slate-200">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">Pasyente</span>
                      <span className="font-bold text-slate-900">{activePatient.name}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">RFID UID</span>
                      <span className="font-mono font-bold text-slate-800">{activePatient.cardUid}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">Dugo / Blood</span>
                      <span className="font-bold text-slate-800">{activePatient.bloodType}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase font-semibold">Petsa / Date</span>
                      <span className="font-mono text-slate-800">{new Date().toLocaleDateString('fil-PH')}</span>
                    </div>
                  </div>

                  {/* Big Rx Header */}
                  <div className="flex items-center space-x-2 pt-1">
                    <span className="font-serif font-black text-3xl text-teal-900 italic">Rx</span>
                    <div className="h-0.5 flex-1 bg-slate-200" />
                  </div>

                  {/* Medications List */}
                  <div className="space-y-3 divide-y divide-slate-100">
                    {activePatient.prescriptions.map((rx, idx) => (
                      <div key={rx.id || idx} className="pt-2 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-slate-900 font-sans">
                            {idx + 1}. {rx.medication} {rx.dosage}
                          </span>
                          {rx.quantity && (
                            <span className="font-mono font-bold text-slate-700">
                              #{rx.quantity}
                            </span>
                          )}
                        </div>
                        <div className="text-slate-700 pl-4 font-mono text-[11px]">
                          Sig: {rx.frequency} {rx.duration ? `for ${rx.duration}` : ''}
                        </div>
                        {rx.instructions && (
                          <div className="text-slate-600 pl-4 italic text-[11px]">
                            Tagubilin: &ldquo;{rx.instructions}&rdquo;
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Physician Signature Block */}
                  <div className="pt-4 border-t border-slate-200 flex justify-between items-end text-xs">
                    <div className="text-[10px] text-slate-500 max-w-xs space-y-0.5">
                      <p>Valid for dispensing at <strong>LMC Outpatient Pharmacy</strong>.</p>
                      <p>Generic prescribing complies with RA 6675 (Generics Act of 1988).</p>
                    </div>

                    <div className="text-right space-y-0.5">
                      <div className="font-serif italic text-sm text-slate-800 font-bold border-b border-slate-400 pb-0.5 inline-block min-w-40 text-center">
                        {activePatient.prescriptions[0]?.doctor || 'Dr. Jake Santos'}
                      </div>
                      <p className="text-[10px] text-slate-600 font-medium">Attending Physician • Room 1</p>
                      <p className="text-[10px] text-slate-500 font-mono">PRC Lic. Verified • S2 Lic.</p>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex justify-between items-center pt-3 border-t border-slate-200 print:hidden">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="h-8 px-3 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-medium text-xs flex items-center space-x-1.5 transition cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-600" />
                      <span>Print Reseta</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewRxSlip(false)}
                      className="h-8 px-4 rounded bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs transition cursor-pointer"
                    >
                      Isara (Close)
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}
      </main>

      {/* ── 3. FOOTER ────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-200 py-6 text-xs text-slate-600">
        <div className="max-w-2xl mx-auto px-4 text-center space-y-1">
          <div className="font-bold text-slate-800">
            Laguna Medical Center
          </div>
          <div className="text-slate-500">
            Santa Cruz, Laguna
          </div>
          <div className="pt-0.5">
            <a
              href="tel:0495458888"
              className="inline-flex items-center space-x-1 text-teal-800 font-medium hover:underline"
            >
              <Phone className="w-3.5 h-3.5" />
              <span>(049) 545-8888</span>
            </a>
          </div>
        </div>
      </footer>

      {/* ── 4. SETTINGS MODAL ────────────────────────────────────────── */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl border border-slate-300 shadow-xl p-6 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">
                  {appLanguage === 'fil' ? 'Mga Setting ng Pasyente' : 'Patient Settings'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close Settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs">
              {/* Language Selection */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center space-x-2 font-semibold text-slate-800">
                  <Globe className="w-3.5 h-3.5 text-slate-600" />
                  <span>{appLanguage === 'fil' ? 'Wika / Language' : 'Language / Wika'}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => changeLanguage('fil')}
                    className={`py-2 px-2 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                      appLanguage === 'fil'
                        ? 'bg-teal-800 text-white border-teal-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    Filipino / Tagalog
                  </button>
                  <button
                    type="button"
                    onClick={() => changeLanguage('en')}
                    className={`py-2 px-2 rounded-md text-xs font-semibold border transition-colors cursor-pointer ${
                      appLanguage === 'en'
                        ? 'bg-teal-800 text-white border-teal-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>

              {/* Audio Chime Alerts */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                      <Volume2 className="w-3.5 h-3.5 text-slate-600" />
                      <span>{appLanguage === 'fil' ? 'Tunog ng Pila' : 'Queue Audio Chime'}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        voiceAlerts ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {voiceAlerts ? (appLanguage === 'fil' ? 'Naka-ON' : 'ON') : (appLanguage === 'fil' ? 'Naka-OFF' : 'OFF')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      {appLanguage === 'fil'
                        ? 'Magpapatunog ng hospital chime at boses kapag "NOW SERVING" na ang inyong tiket.'
                        : 'Plays hospital chime and voice announcement when your ticket is called (NOW SERVING).'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleVoiceAlerts}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      voiceAlerts ? 'bg-teal-800 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-2xs" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => playHospitalChime()}
                  disabled={isPlayingAudio}
                  className="w-full py-2 px-3 bg-white hover:bg-slate-100 active:bg-slate-200 text-teal-800 font-semibold text-xs rounded border border-slate-300 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
                >
                  <Volume2 className={`w-3.5 h-3.5 ${isPlayingAudio ? 'animate-bounce text-teal-600' : ''}`} />
                  <span>
                    {isPlayingAudio
                      ? (appLanguage === 'fil' ? '🔊 Nagpapatunog ng Hospital Chime...' : '🔊 Playing Hospital Chime...')
                      : (appLanguage === 'fil' ? 'Pakinggan / Subukan ang Tunog (Ding-Dong)' : 'Test Audio Chime (Ding-Dong)')}
                  </span>
                </button>
              </div>

              {/* Auto Refresh */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-2">
                    <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                      <Bell className="w-3.5 h-3.5 text-slate-600" />
                      <span>{appLanguage === 'fil' ? 'Awtomatikong Pag-update' : 'Auto-sync Queue'}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        autoRefresh ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {autoRefresh ? '30s' : (appLanguage === 'fil' ? 'Naka-OFF' : 'OFF')}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 leading-normal">
                      {autoRefresh
                        ? (appLanguage === 'fil'
                            ? 'Kusang nag-a-update ang posisyon bawat 30 segundo mula sa database.'
                            : 'Queue status updates automatically every 30s from the database.')
                        : (appLanguage === 'fil' ? 'Naka-off: Mano-manong refresh lamang.' : 'Disabled: Manual refresh only.')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleAutoRefresh}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                      autoRefresh ? 'bg-teal-800 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-2xs" />
                  </button>
                </div>

                {activePatient && (
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="w-full py-2 px-3 bg-white hover:bg-slate-100 active:bg-slate-200 text-slate-800 font-semibold text-xs rounded border border-slate-300 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-teal-700" />
                    <span>
                      {appLanguage === 'fil' ? 'I-synchronize ang Pila mula sa Database' : 'Synchronize Queue from Live Database'}
                    </span>
                  </button>
                )}
              </div>

              {/* Large Text Mode */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                <div className="space-y-0.5 pr-2">
                  <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                    <Type className="w-3.5 h-3.5 text-slate-600" />
                    <span>{appLanguage === 'fil' ? 'Malalaking Titik' : 'Large Text Mode'}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                      largeText ? 'bg-teal-100 text-teal-800' : 'bg-slate-200 text-slate-600'
                    }`}>
                      {largeText ? '125%' : '100%'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    {largeText
                      ? (appLanguage === 'fil' ? 'Aktibo: Mas malalaking letra (125% zoom para sa madaling pagbasa).' : 'Active: High-legibility 125% font scale enabled.')
                      : (appLanguage === 'fil' ? 'Normal na laki ng letra (100%).' : 'Standard font size (100%).')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleLargeText}
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer shrink-0 ${
                    largeText ? 'bg-teal-800 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-2xs" />
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                {appLanguage === 'fil' ? 'I-save at Isara' : 'Save & Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        userName={activePatient?.name || 'Patient'}
        userRole="PATIENT PORTAL"
        description="Sigurado ka bang nais mong mag-sign out? Ma-aalis ang inyong aktibong sesyon ng pasyente sa browser na ito."
        onConfirmLogout={() => {
          handleSignOut();
          setIsLogoutModalOpen(false);
        }}
      />
    </div>
  );
}
