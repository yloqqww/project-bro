'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck2,
  CalendarDays,
  CalendarOff,
  CheckCircle2,
  Clock3,
  Coffee,
  Hourglass,
  Loader2,
  MessageSquareText,
  Send,
  Stethoscope,
  Users,
  XCircle,
} from 'lucide-react';
import { StaffWorkstationSidebar } from '@/components/StaffWorkstationSidebar';

type Day = { dayOfWeek: number; enabled: boolean; startTime: string; endTime: string };
type LeaveRequest = { id: string; date: string; message: string; status: string; adminReply: string | null };
type Exception = { id: string; date: string; type: string; reason: string | null };
type Schedule = { slotDuration: number; bufferMinutes: number; maxPatientsPerDay: number; weeklyAvailability: Day[] };
type ApiError = string | { message?: string };
type ScheduleResponse = {
  schedule?: Schedule | null;
  leaveRequests?: LeaveRequest[];
  exceptions?: Exception[];
  error?: ApiError;
};

const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const shortDayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

async function readJsonResponse<T>(response: Response): Promise<T> {
  const body = await response.text();
  if (!body.trim()) throw new Error('Walang natanggap na tugon mula sa server. Subukan muli.');
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error('Hindi mabasa ang tugon mula sa server. Subukan muli.');
  }
}

function errorMessage(error: ApiError | undefined, fallback: string) {
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string') return error.message;
  return fallback;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return value;
  return new Intl.DateTimeFormat('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(2000, 0, 1, hours, minutes));
}

function requestStatus(status: string) {
  const normalized = status.toUpperCase();
  if (normalized === 'APPROVED') {
    return { label: 'Approved', className: 'border-emerald-200 bg-emerald-50 text-emerald-800', icon: CheckCircle2 };
  }
  if (normalized === 'REJECTED' || normalized === 'DECLINED') {
    return {
      label: normalized === 'DECLINED' ? 'Declined' : 'Rejected',
      className: 'border-rose-200 bg-rose-50 text-rose-800',
      icon: XCircle,
    };
  }
  return { label: 'Pending review', className: 'border-amber-200 bg-amber-50 text-amber-800', icon: Hourglass };
}

export default function DoctorSchedulePage() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [exceptions, setExceptions] = useState<Exception[]>([]);
  const [date, setDate] = useState('');
  const [message, setMessage] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeTone, setNoticeTone] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const response = await fetch('/api/doctor/schedule');
      const data = await readJsonResponse<ScheduleResponse>(response);
      if (!response.ok) {
        setNoticeTone('error');
        setNotice(errorMessage(data.error, 'Hindi makuha ang schedule.'));
        return;
      }
      setSchedule(data.schedule || null);
      setRequests(data.leaveRequests || []);
      setExceptions(data.exceptions || []);
    } catch (error) {
      setNoticeTone('error');
      setNotice(error instanceof Error ? error.message : 'Hindi makuha ang schedule.');
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setNotice('');
    try {
      const response = await fetch('/api/doctor/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, message }),
      });
      const data = await readJsonResponse<ScheduleResponse>(response);
      if (!response.ok) throw new Error(errorMessage(data.error, 'Hindi naipadala ang request.'));
      setDate('');
      setMessage('');
      setNoticeTone('success');
      setNotice('Naipadala na sa admin ang leave request at naghihintay ito ng approval.');
      await load(false);
    } catch (error) {
      setNoticeTone('error');
      setNotice(error instanceof Error ? error.message : 'Hindi naipadala ang request.');
    } finally {
      setSaving(false);
    }
  };

  const activeDays = schedule?.weeklyAvailability.filter((day) => day.enabled).length || 0;
  const unavailableDates = useMemo(
    () => exceptions.filter((item) => !requests.some((request) =>
      request.status.toUpperCase() === 'APPROVED' && request.date.slice(0, 10) === item.date.slice(0, 10)
    )),
    [exceptions, requests]
  );

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 antialiased">
      <header className="sticky top-0 z-30 border-b border-slate-300 bg-white">
        <div className="flex w-full flex-col gap-3 px-4 py-3 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8 xl:px-10">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-teal-800 text-white shadow-sm">
              <Stethoscope className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-bold tracking-tight text-slate-900 sm:text-lg">Laguna Medical Center</span>
                <span className="rounded border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-teal-800">Doctor Schedule</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-slate-500">Consultation availability, booking limits, and leave coordination</p>
            </div>
          </div>
          <Link href="/doctor/queue" className="inline-flex h-9 items-center justify-center gap-2 self-start rounded-md border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 shadow-sm transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-900 lg:self-auto">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Consultation Desk
          </Link>
        </div>
      </header>

      <main className="w-full px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-start gap-4">
          <StaffWorkstationSidebar role="DOCTOR" />
          <div className="flex-1 min-w-0 w-full space-y-4">
        <section className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Aking Schedule</h1>
              <p className="mt-0.5 text-xs text-slate-500">Ito ang oras ng iyong clinic na nakikita ng mga pasyente kapag nagbu-book.</p>
            </div>
            <div className="inline-flex items-center gap-2 self-start rounded-md border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 sm:self-auto">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              Active sa Booking
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-2 text-sm font-medium text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-teal-700" aria-hidden="true" /> Loading schedule...
            </div>
          ) : !schedule ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700"><CalendarOff className="h-6 w-6" aria-hidden="true" /></div>
              <h2 className="mt-3 font-bold text-slate-900">Wala pang naka-set na schedule</h2>
              <p className="mt-1 max-w-md text-xs text-slate-600">Makipag-ugnayan sa admin para ma-set ang iyong lingguhang oras ng clinic.</p>
            </div>
          ) : (
            <div className="p-4 sm:p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Metric icon={CalendarDays} label="Araw na Bukas" value={activeDays} unit="/ 7" iconClass="text-teal-700" />
                <Metric icon={Clock3} label="Bawat Pasyente" value={schedule.slotDuration} unit="min" iconClass="text-teal-700" />
                <Metric icon={Users} label="Max Pasyente" value={schedule.maxPatientsPerDay} unit="/ araw" iconClass="text-indigo-700" />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7">
                {schedule.weeklyAvailability.map((day) => (
                  <div key={day.dayOfWeek} className={`rounded-md border p-3 ${day.enabled ? 'border-teal-200 bg-teal-50/60' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{dayNames[day.dayOfWeek]}</span>
                      <span className={`h-2 w-2 shrink-0 rounded-full ${day.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    </div>
                    <div className={`mt-2 border-t pt-2 ${day.enabled ? 'border-teal-200' : 'border-slate-200'}`}>
                      {day.enabled ? (
                        <p className="text-xs font-semibold text-slate-800">{formatTime(day.startTime)} – {formatTime(day.endTime)}</p>
                      ) : (
                        <p className="text-xs font-semibold text-slate-400">Walang Clinic</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3.5 py-2 text-xs text-amber-900">
                <Coffee className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <span><strong>Lunch Break (12:00 PM–1:00 PM):</strong> Walang booking slots araw-araw sa oras na ito.</span>
              </div>
            </div>
          )}
        </section>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.35fr)]">
          <section className="rounded-lg border border-slate-300 bg-white shadow-sm">
            <SectionHeader icon={CalendarOff} title="Mag-request ng Leave" subtitle="Ipapadala sa Admin para aprubahan" iconClass="border-teal-200 bg-teal-50 text-teal-800" />
            <form onSubmit={submit} className="space-y-4 p-5">
              <label className="block text-xs font-bold text-slate-800">Petsa ng Leave
                <input type="date" required value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 block h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-teal-600" />
              </label>
              <label className="block text-xs font-bold text-slate-800">Dahilan / Paalala sa Admin
                <textarea required minLength={5} maxLength={500} value={message} onChange={(event) => setMessage(event.target.value)} className="mt-1.5 block w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-teal-600" rows={3} placeholder="Ilagay ang dahilan..." />
                <span className="mt-1 block text-right text-[11px] font-normal text-slate-400">{message.length}/500</span>
              </label>
              <button disabled={saving} className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-teal-800 px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-teal-900 disabled:opacity-60 cursor-pointer">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}{saving ? 'Ipinapadala...' : 'Ipadala sa Admin'}
              </button>
            </form>
            {notice && <div role="status" className={`mx-5 mb-5 flex items-start gap-2 rounded-md border px-3 py-2.5 text-xs font-medium ${noticeTone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
              {noticeTone === 'success' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}<span>{notice}</span>
            </div>}
          </section>

          <section className="rounded-lg border border-slate-300 bg-white shadow-sm">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-sky-200 bg-sky-50 text-sky-800"><MessageSquareText className="h-4 w-4" aria-hidden="true" /></div>
                <div><h2 className="text-sm font-bold text-slate-900">Mga Leave Request at Day-Off</h2><p className="text-xs text-slate-500">Status at sagot mula sa Admin</p></div>
              </div>
              <span className="self-start rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 sm:self-auto">{requests.length + unavailableDates.length} records</span>
            </div>
            <div className="p-5">
              {requests.length === 0 && unavailableDates.length === 0 ? (
                <div className="flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 text-center">
                  <CalendarCheck2 className="h-7 w-7 text-slate-400" aria-hidden="true" /><p className="mt-2 text-xs font-bold text-slate-700">Wala pang leave request</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {requests.map((item) => <RequestCard key={item.id} item={item} />)}
                  {unavailableDates.map((item) => (
                    <article key={item.id} className="rounded-md border border-slate-200 bg-slate-50 p-3.5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <RecordDate icon={CalendarOff} date={item.date} label="Walang Clinic" />
                        <span className="inline-flex self-start rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-700">{item.type.replaceAll('_', ' ')}</span>
                      </div>
                      {item.reason && <p className="mt-2 text-xs text-slate-600">{item.reason}</p>}
                    </article>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Metric({ icon: Icon, label, value, unit, iconClass }: { icon: typeof Clock3; label: string; value: number; unit: string; iconClass: string }) {
  return <div className="rounded-md border border-slate-200 bg-slate-50 p-3.5"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500"><Icon className={`h-4 w-4 ${iconClass}`} aria-hidden="true" />{label}</div><p className="mt-2 text-2xl font-bold font-mono text-slate-900">{value}<span className="ml-1 text-sm font-medium text-slate-500">{unit}</span></p></div>;
}

function SectionHeader({ icon: Icon, title, subtitle, iconClass }: { icon: typeof CalendarOff; title: string; subtitle: string; iconClass: string }) {
  return <div className="border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><div className={`flex h-9 w-9 items-center justify-center rounded-md border ${iconClass}`}><Icon className="h-4 w-4" aria-hidden="true" /></div><div><h2 className="font-bold text-slate-900">{title}</h2><p className="text-xs text-slate-500">{subtitle}</p></div></div></div>;
}

function RecordDate({ icon: Icon, date, label }: { icon: typeof CalendarOff; date: string; label: string }) {
  return <div className="flex items-center gap-2.5"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600"><Icon className="h-4 w-4" aria-hidden="true" /></div><div><p className="text-sm font-bold text-slate-900">{formatDate(date)}</p><p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">{label}</p></div></div>;
}

function RequestCard({ item }: { item: LeaveRequest }) {
  const status = requestStatus(item.status);
  const StatusIcon = status.icon;
  return <article className="rounded-md border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><RecordDate icon={CalendarDays} date={item.date} label="Leave request" /><span className={`inline-flex self-start items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${status.className}`}><StatusIcon className="h-3.5 w-3.5" aria-hidden="true" />{status.label}</span></div><p className="mt-3 text-sm leading-6 text-slate-700">{item.message}</p>{item.adminReply && <div className="mt-3 rounded-md border-l-4 border-teal-600 bg-teal-50 px-3 py-2.5"><p className="text-[11px] font-bold uppercase tracking-wider text-teal-800">Admin reply</p><p className="mt-1 text-sm leading-5 text-teal-950">{item.adminReply}</p></div>}</article>;
}
