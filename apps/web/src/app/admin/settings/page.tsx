'use client';

import { useEffect, useState } from 'react';
import {
  Clock,
  Save,
  RotateCcw,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface QueuePrefix {
  id: string;
  department: string;
  prefix: string;
}

const DEFAULT_PREFIXES: QueuePrefix[] = [
  { id: '1', department: 'General', prefix: 'A' },
  { id: '2', department: 'Cardiology', prefix: 'C' },
  { id: '3', department: 'Pediatrics', prefix: 'P' },
  { id: '4', department: 'Senior/PWD Priority', prefix: 'PRIO' }
];

const DEFAULT_RESET_TIME = '00:00';
const DEFAULT_CLINIC_NAME = 'Laguna Medical Center';
const DEFAULT_HOTLINE = '(049) 545-8888';
const DEFAULT_ADDRESS = 'Santa Cruz, Laguna, Philippines';
const DEFAULT_EMERGENCY = 'Para sa emergency, tumawag sa 911 o pumunta sa pinakamalapit na ospital.';
const DEFAULT_RULES = {
  resuscitation: { painScore: 9, oxygenSaturationBelow: 90 },
  urgent: { painScore: 7, temperatureAtLeast: 39, systolicAtLeast: 180 },
  priority: { seniorAge: 60, painScore: 5 },
};

const DAY_LABELS = [
  { day: 0, label: 'Linggo' },
  { day: 1, label: 'Lunes' },
  { day: 2, label: 'Martes' },
  { day: 3, label: 'Miyerkules' },
  { day: 4, label: 'Huwebes' },
  { day: 5, label: 'Biyernes' },
  { day: 6, label: 'Sabado' },
];

export default function ClinicSettings() {
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [prefixes, setPrefixes] = useState<QueuePrefix[]>(DEFAULT_PREFIXES);
  const [resetTime, setResetTime] = useState(DEFAULT_RESET_TIME);
  const [clinicName, setClinicName] = useState(DEFAULT_CLINIC_NAME);
  const [hotline, setHotline] = useState(DEFAULT_HOTLINE);
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [emergency, setEmergency] = useState(DEFAULT_EMERGENCY);
  const [timezone, setTimezone] = useState('Asia/Manila');
  const [operatingDays, setOperatingDays] = useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [holidayDatesText, setHolidayDatesText] = useState('');
  const [appointmentLeadTimeHours, setAppointmentLeadTimeHours] = useState(2);
  const [bookingHorizonDays, setBookingHorizonDays] = useState(60);
  const [appointmentCancellationNoticeHours, setAppointmentCancellationNoticeHours] = useState(24);
  const [appointmentNoShowGraceMinutes, setAppointmentNoShowGraceMinutes] = useState(30);
  const [appointmentReminderLeadHoursText, setAppointmentReminderLeadHoursText] = useState('24, 2');
  const [notificationRetentionDays, setNotificationRetentionDays] = useState(90);
  const [triagePriorityRules, setTriagePriorityRules] = useState(DEFAULT_RULES);
  const [lastSaved, setLastSaved] = useState({
    prefixes: DEFAULT_PREFIXES,
    resetTime: DEFAULT_RESET_TIME,
    clinicName: DEFAULT_CLINIC_NAME,
    hotline: DEFAULT_HOTLINE,
    address: DEFAULT_ADDRESS,
    emergency: DEFAULT_EMERGENCY,
    timezone: 'Asia/Manila',
    operatingDays: [1, 2, 3, 4, 5, 6],
    holidayDatesText: '',
    appointmentLeadTimeHours: 2,
    bookingHorizonDays: 60,
    appointmentCancellationNoticeHours: 24,
    appointmentNoShowGraceMinutes: 30,
    appointmentReminderLeadHoursText: '24, 2',
    notificationRetentionDays: 90,
    triagePriorityRules: DEFAULT_RULES,
  });

  const applySettings = (settings: any) => {
    const next = {
      prefixes: Array.isArray(settings.queuePrefixes) ? settings.queuePrefixes : DEFAULT_PREFIXES,
      resetTime: settings.queueResetTime || DEFAULT_RESET_TIME,
      clinicName: settings.clinicName || DEFAULT_CLINIC_NAME,
      hotline: settings.hotline || DEFAULT_HOTLINE,
      address: settings.address || DEFAULT_ADDRESS,
      emergency: settings.emergencyNotice ?? DEFAULT_EMERGENCY,
      timezone: settings.timezone || 'Asia/Manila',
      operatingDays: Array.isArray(settings.operatingDays) ? settings.operatingDays : [1, 2, 3, 4, 5, 6],
      holidayDatesText: Array.isArray(settings.holidayDates) ? settings.holidayDates.join('\n') : '',
      appointmentLeadTimeHours: Number(settings.appointmentLeadTimeHours ?? 2),
      bookingHorizonDays: Number(settings.bookingHorizonDays ?? 60),
      appointmentCancellationNoticeHours: Number(settings.appointmentCancellationNoticeHours ?? 24),
      appointmentNoShowGraceMinutes: Number(settings.appointmentNoShowGraceMinutes ?? 30),
      appointmentReminderLeadHoursText: Array.isArray(settings.appointmentReminderLeadHours)
        ? settings.appointmentReminderLeadHours.join(', ')
        : '24, 2',
      notificationRetentionDays: Number(settings.notificationRetentionDays ?? 90),
      triagePriorityRules: settings.triagePriorityRules || DEFAULT_RULES,
    };
    setPrefixes(next.prefixes.map((item: QueuePrefix) => ({ ...item })));
    setResetTime(next.resetTime);
    setClinicName(next.clinicName);
    setHotline(next.hotline);
    setAddress(next.address);
    setEmergency(next.emergency);
    setTimezone(next.timezone);
    setOperatingDays(next.operatingDays);
    setHolidayDatesText(next.holidayDatesText);
    setAppointmentLeadTimeHours(next.appointmentLeadTimeHours);
    setBookingHorizonDays(next.bookingHorizonDays);
    setAppointmentCancellationNoticeHours(next.appointmentCancellationNoticeHours);
    setAppointmentNoShowGraceMinutes(next.appointmentNoShowGraceMinutes);
    setAppointmentReminderLeadHoursText(next.appointmentReminderLeadHoursText);
    setNotificationRetentionDays(next.notificationRetentionDays);
    setTriagePriorityRules(next.triagePriorityRules);
    setLastSaved({ ...next, prefixes: next.prefixes.map((item: QueuePrefix) => ({ ...item })) });
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        setLoadingSettings(true);
        const res = await fetch('/api/admin/settings');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load settings.');
        applySettings(data.settings);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : 'Hindi ma-load ang settings.');
      } finally {
        setLoadingSettings(false);
      }
    }
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicName,
          hotline,
          address,
          emergencyNotice: emergency,
          queueResetTime: resetTime,
          queuePrefixes: prefixes,
          timezone,
          operatingDays,
          holidayDates: holidayDatesText.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean),
          appointmentLeadTimeHours,
          bookingHorizonDays,
          appointmentCancellationNoticeHours,
          appointmentNoShowGraceMinutes,
          appointmentReminderLeadHours: appointmentReminderLeadHoursText
            .split(',')
            .map((value) => Number(value.trim()))
            .filter((value) => Number.isInteger(value) && value > 0),
          notificationRetentionDays,
          triagePriorityRules,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Hindi na-save ang settings.');
      applySettings(data.settings);
      setSuccessMessage('Na-save na ang lahat ng settings ng clinic.');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Hindi na-save ang settings.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPrefixes(lastSaved.prefixes.map((item) => ({ ...item })));
    setResetTime(lastSaved.resetTime);
    setClinicName(lastSaved.clinicName);
    setHotline(lastSaved.hotline);
    setAddress(lastSaved.address);
    setEmergency(lastSaved.emergency);
    setTimezone(lastSaved.timezone);
    setOperatingDays(lastSaved.operatingDays);
    setHolidayDatesText(lastSaved.holidayDatesText);
    setAppointmentLeadTimeHours(lastSaved.appointmentLeadTimeHours);
    setBookingHorizonDays(lastSaved.bookingHorizonDays);
    setAppointmentCancellationNoticeHours(lastSaved.appointmentCancellationNoticeHours);
    setAppointmentNoShowGraceMinutes(lastSaved.appointmentNoShowGraceMinutes);
    setAppointmentReminderLeadHoursText(lastSaved.appointmentReminderLeadHoursText);
    setNotificationRetentionDays(lastSaved.notificationRetentionDays);
    setTriagePriorityRules(lastSaved.triagePriorityRules);
  };

  return (
    <div className="w-full space-y-5 text-slate-800">
      {/* Toast Notification */}
      {successMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center space-x-2.5 px-4 py-2.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs font-medium shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-5 right-5 z-50 max-w-md px-4 py-2.5 bg-rose-700 border border-rose-800 text-white rounded-lg text-xs font-medium shadow-lg">
          {errorMessage}
        </div>
      )}

      {/* Simple Header */}
      <div className="pb-3 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Mga Setting ng Clinic</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Baguhin dito ang impormasyon ng ospital, araw ng bukas, at numero ng mga ticket.
        </p>
      </div>

      {loadingSettings ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center text-sm text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-700" /> Kinukuha ang mga setting...
        </div>
      ) : (
        <form onSubmit={handleSaveSettings} className="space-y-4 w-full">
          {/* 1. Impormasyon ng Clinic */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">1. Impormasyon ng Clinic</h2>
              <p className="text-xs text-slate-500 mt-0.5">Ito ang makikita ng mga pasyente sa booking page at ticket.</p>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pangalan ng Clinic / Ospital *</label>
                  <input
                    type="text"
                    value={clinicName}
                    onChange={(e) => setClinicName(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-hidden focus:border-teal-700"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Hotline / Contact Number *</label>
                  <input
                    type="text"
                    value={hotline}
                    onChange={(e) => setHotline(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-sm font-mono text-slate-900 focus:outline-hidden focus:border-teal-700"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Address ng Clinic *</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-hidden focus:border-teal-700"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Paalala para sa Emergency</label>
                <textarea
                  value={emergency}
                  onChange={(e) => setEmergency(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-sm text-slate-900 focus:outline-hidden focus:border-teal-700 resize-none"
                />
              </div>
            </div>
          </div>

          {/* 2. Oras ng Bukas at Holidays */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">2. Mga Araw na Bukas ang Clinic</h2>
              <p className="text-xs text-slate-500 mt-0.5">Hindi makakapagpa-schedule ang pasyente sa mga araw na naka-uncheck o holiday.</p>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Mga Araw ng Operasyon</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map(({ day, label }) => {
                    const checked = operatingDays.includes(day);
                    return (
                      <label
                        key={day}
                        className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-bold cursor-pointer transition ${
                          checked ? 'bg-teal-50 border-teal-600 text-teal-900' : 'bg-white border-slate-200 text-slate-500'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setOperatingDays((current) =>
                              e.target.checked ? [...current, day].sort() : current.filter((item) => item !== day)
                            )
                          }
                          className="accent-teal-800"
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Mga Holiday (Petsang walang clinic — format: YYYY-MM-DD)
                </label>
                <textarea
                  value={holidayDatesText}
                  onChange={(e) => setHolidayDatesText(e.target.value)}
                  rows={2}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
                  placeholder="Hal. 2026-12-25"
                />
              </div>
            </div>
          </div>

          {/* 3. Numero sa Pila (Ticket Letters & Reset Time) */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-900">3. Letra ng Ticket sa Pila</h2>
              <p className="text-xs text-slate-500 mt-0.5">Letra sa unahan ng queue number (hal. A-14, P-14) at oras ng reset kinabukasan.</p>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {prefixes.map((item, index) => (
                  <div key={item.id} className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2">
                    <input
                      type="text"
                      value={item.department}
                      onChange={(e) => {
                        const newPrefixes = [...prefixes];
                        newPrefixes[index].department = e.target.value;
                        setPrefixes(newPrefixes);
                      }}
                      placeholder="Department"
                      className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-xs font-bold text-slate-900"
                      required
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.prefix}
                        onChange={(e) => {
                          const newPrefixes = [...prefixes];
                          newPrefixes[index].prefix = e.target.value.toUpperCase();
                          setPrefixes(newPrefixes);
                        }}
                        className="w-20 h-8 px-2 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-center uppercase"
                        required
                        maxLength={6}
                      />
                      <span className="text-xs font-mono text-slate-500">Hal: {item.prefix || '?'}-14</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700">Oras ng Reset ng Pila (Araw-araw)</label>
                  <span className="text-[11px] text-slate-500">Babalik sa #1 ang mga ticket pagsapit ng oras na ito</span>
                </div>
                <input
                  type="time"
                  value={resetTime}
                  onChange={(e) => setResetTime(e.target.value)}
                  className="w-36 h-9 px-2.5 bg-white border border-slate-300 rounded-md text-sm font-mono font-bold text-slate-900"
                  required
                />
              </div>
            </div>
          </div>

          {/* 4. Advanced Rules (Collapsible so non-IT users don't get overwhelmed) */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvanced((prev) => !prev)}
              className="w-full px-4 py-3 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
            >
              <div>
                <span className="text-xs font-bold text-slate-800 block">
                  Advanced Settings (Triage Vital Thresholds &amp; Booking Limits)
                </span>
                <span className="text-[11px] text-slate-500">
                  Mga awtomatikong panuntunan sa pag-book at vital signs warning — naka-set na ito sa standard ng clinic.
                </span>
              </div>
              {showAdvanced ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>

            {showAdvanced && (
              <div className="p-4 border-t border-slate-200 space-y-5">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <label className="text-xs font-semibold text-slate-700">
                    Timezone
                    <input value={timezone} onChange={(e) => setTimezone(e.target.value)} className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 text-xs" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Booking Lead Time (Hours)
                    <input type="number" min="0" max="168" value={appointmentLeadTimeHours} onChange={(e) => setAppointmentLeadTimeHours(Number(e.target.value))} className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 text-xs" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    Max Days Ahead Booking
                    <input type="number" min="1" max="365" value={bookingHorizonDays} onChange={(e) => setBookingHorizonDays(Number(e.target.value))} className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 text-xs" />
                  </label>
                  <label className="text-xs font-semibold text-slate-700">
                    No-Show Grace Period (Mins)
                    <input type="number" min="0" max="240" value={appointmentNoShowGraceMinutes} onChange={(e) => setAppointmentNoShowGraceMinutes(Number(e.target.value))} className="mt-1 h-9 w-full rounded border border-slate-300 px-2.5 text-xs" />
                  </label>
                </div>

                <div className="border-t border-slate-200 pt-4">
                  <h3 className="text-xs font-bold text-slate-800 mb-3">Triage Auto-Urgent Thresholds</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <label className="text-xs text-slate-700">
                      Emergency Pain Score ≥
                      <input type="number" min="0" max="10" value={triagePriorityRules.resuscitation.painScore} onChange={(e) => setTriagePriorityRules((r) => ({ ...r, resuscitation: { ...r.resuscitation, painScore: Number(e.target.value) } }))} className="mt-1 h-8 w-full rounded border border-slate-300 px-2.5" />
                    </label>
                    <label className="text-xs text-slate-700">
                      Emergency SpO2 below (%)
                      <input type="number" min="50" max="100" value={triagePriorityRules.resuscitation.oxygenSaturationBelow} onChange={(e) => setTriagePriorityRules((r) => ({ ...r, resuscitation: { ...r.resuscitation, oxygenSaturationBelow: Number(e.target.value) } }))} className="mt-1 h-8 w-full rounded border border-slate-300 px-2.5" />
                    </label>
                    <label className="text-xs text-slate-700">
                      Urgent Fever ≥ (°C)
                      <input type="number" step="0.1" min="35" max="45" value={triagePriorityRules.urgent.temperatureAtLeast} onChange={(e) => setTriagePriorityRules((r) => ({ ...r, urgent: { ...r.urgent, temperatureAtLeast: Number(e.target.value) } }))} className="mt-1 h-8 w-full rounded border border-slate-300 px-2.5" />
                    </label>
                    <label className="text-xs text-slate-700">
                      Urgent Systolic BP ≥
                      <input type="number" min="100" max="260" value={triagePriorityRules.urgent.systolicAtLeast} onChange={(e) => setTriagePriorityRules((r) => ({ ...r, urgent: { ...r.urgent, systolicAtLeast: Number(e.target.value) } }))} className="mt-1 h-8 w-full rounded border border-slate-300 px-2.5" />
                    </label>
                    <label className="text-xs text-slate-700">
                      Senior Citizen Age ≥
                      <input type="number" min="50" max="100" value={triagePriorityRules.priority.seniorAge} onChange={(e) => setTriagePriorityRules((r) => ({ ...r, priority: { ...r.priority, seniorAge: Number(e.target.value) } }))} className="mt-1 h-8 w-full rounded border border-slate-300 px-2.5" />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 5. Save & Reset Bar */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold rounded-md transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Ibalik sa Dati</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center space-x-1.5 px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-md transition shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{loading ? 'Sine-save...' : 'I-save ang Settings'}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
