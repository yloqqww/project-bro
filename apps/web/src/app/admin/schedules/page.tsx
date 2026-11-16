'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { readJsonResponse } from '@/lib/client-response';
import {
  Save,
  CheckCircle2,
  Loader2,
  Calendar as CalendarIcon,
  X as XIcon,
  AlertTriangle,
  Stethoscope,
  Users,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
} from 'lucide-react';

type Doctor = {
  id: string;
  name: string;
  specialization: string;
  roomNumber?: string;
};

const days = [
  { day: 'Linggo', dayOfWeek: 0 },
  { day: 'Lunes', dayOfWeek: 1 },
  { day: 'Martes', dayOfWeek: 2 },
  { day: 'Miyerkules', dayOfWeek: 3 },
  { day: 'Huwebes', dayOfWeek: 4 },
  { day: 'Biyernes', dayOfWeek: 5 },
  { day: 'Sabado', dayOfWeek: 6 },
];

type ScheduleException = {
  id: string;
  date: string;
  type: 'LEAVE' | 'HOLIDAY' | 'UNAVAILABLE';
  reason?: string | null;
  startTime?: string | null;
  endTime?: string | null;
};

type LeaveRequest = {
  id: string;
  date: string;
  message: string;
  status: string;
  adminReply: string | null;
  doctor: { firstName: string; lastName: string; specialization: string };
};

const createDefaultSchedule = () =>
  days.map(({ day, dayOfWeek }) => ({
    day,
    dayOfWeek,
    enabled: dayOfWeek >= 1 && dayOfWeek <= 6,
    startTime: '09:00',
    endTime: '17:00',
    breakStart: '12:00',
    breakEnd: '13:00',
  }));

export default function DoctorSchedules() {
  const [activeTab, setActiveTab] = useState<'weekly' | 'calendar'>('weekly');
  const [showSlotRules, setShowSlotRules] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [loading, setLoading] = useState(false);
  const [togglingDate, setTogglingDate] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const [schedule, setSchedule] = useState(createDefaultSchedule);
  const [slotDuration, setSlotDuration] = useState('20');
  const [maxPatients, setMaxPatients] = useState('24');
  const [bufferTime, setBufferTime] = useState('5');
  const [exceptions, setExceptions] = useState<ScheduleException[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>([]);
  const [leaveReplies, setLeaveReplies] = useState<Record<string, string>>({});
  const [reviewingLeaveId, setReviewingLeaveId] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState(new Date().toISOString().slice(0, 7));

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoadingDoctors(true);
        const res = await fetch('/api/doctors');
        const data = await res.json();
        if (data.success && Array.isArray(data.doctors)) {
          setDoctors(data.doctors);
          if (data.doctors.length > 0) {
            setSelectedDoctor(data.doctors[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching doctors:', err);
      } finally {
        setLoadingDoctors(false);
      }
    };
    fetchDoctors();
  }, []);

  const loadLeaveRequests = async () => {
    try {
      const response = await fetch('/api/admin/schedules/leave-requests');
      const data = await readJsonResponse<any>(response);
      if (!response.ok || !data.success) throw new Error(data.error || 'Hindi nakuha ang leave requests.');
      setLeaveRequests(data.requests || []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Hindi nakuha ang leave requests.', 'error');
    }
  };

  useEffect(() => {
    void loadLeaveRequests();
  }, []);

  const loadSchedule = async (doctorId: string) => {
    try {
      setLoadingSchedule(true);
      const res = await fetch(`/api/admin/schedules?doctorId=${encodeURIComponent(doctorId)}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Hindi ma-load ang schedule.');
      const weeklyByDay = new Map<number, any>(
        data.schedule.weeklyAvailability.map((item: any) => [item.dayOfWeek, item])
      );
      setSchedule(
        days.map(({ day, dayOfWeek }) => {
          const saved = weeklyByDay.get(dayOfWeek);
          return {
            day,
            dayOfWeek,
            enabled: saved?.enabled ?? false,
            startTime: saved?.startTime || '09:00',
            endTime: saved?.endTime || '17:00',
            breakStart: '12:00',
            breakEnd: '13:00',
          };
        })
      );
      setSlotDuration(String(data.schedule.slotDuration));
      setMaxPatients(String(data.schedule.maxPatientsPerDay));
      setBufferTime(String(data.schedule.bufferMinutes));
      setExceptions(
        (data.exceptions || []).map((item: any) => ({
          ...item,
          date: String(item.date).slice(0, 10),
        }))
      );
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Hindi ma-load ang schedule.', 'error');
    } finally {
      setLoadingSchedule(false);
    }
  };

  useEffect(() => {
    if (selectedDoctor) void loadSchedule(selectedDoctor);
  }, [selectedDoctor]);

  const selectedDoc = doctors.find((d) => d.id === selectedDoctor);
  const [calendarYear, calendarMonthNumber] = calendarMonth.split('-').map(Number);
  const calendarFirstDay = new Date(Date.UTC(calendarYear, calendarMonthNumber - 1, 1)).getUTCDay();
  const calendarDays = new Date(Date.UTC(calendarYear, calendarMonthNumber, 0)).getUTCDate();
  const calendarCells = Array.from({ length: calendarFirstDay + calendarDays }, (_, index) => {
    if (index < calendarFirstDay) return null;
    const day = index - calendarFirstDay + 1;
    const date = `${calendarMonth}-${String(day).padStart(2, '0')}`;
    return {
      day,
      date,
      weekday: new Date(`${date}T00:00:00Z`).getUTCDay(),
      exception: exceptions.find((item) => item.date === date),
    };
  });

  const handleSaveSchedule = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selectedDoc) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          doctorId: selectedDoctor,
          slotDuration: Number(slotDuration),
          maxPatientsPerDay: Number(maxPatients),
          bufferMinutes: Number(bufferTime),
          timezone: 'Asia/Manila',
          weeklyAvailability: schedule.map(({ dayOfWeek, enabled, startTime, endTime, breakStart, breakEnd }) => ({
            dayOfWeek,
            enabled,
            startTime,
            endTime,
            breakStart: breakStart || null,
            breakEnd: breakEnd || null,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Hindi na-save ang schedule.');
      showToast(`Na-save na ang schedule ni ${selectedDoc.name}.`);
      await loadSchedule(selectedDoctor);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Hindi na-save ang schedule.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // 1-Click Calendar Day Off Toggle
  const toggleCalendarDateOff = async (date: string, existing?: ScheduleException) => {
    if (!selectedDoctor || togglingDate) return;
    setTogglingDate(date);
    try {
      if (existing) {
        const res = await fetch(`/api/admin/schedules/exceptions?id=${encodeURIComponent(existing.id)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Hindi nabuksan ang petsa.');
        setExceptions((items) => items.filter((item) => item.id !== existing.id));
        showToast(`Bukas na ulit ang ${date}.`, 'info');
      } else {
        const res = await fetch('/api/admin/schedules/exceptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            doctorId: selectedDoctor,
            date,
            type: 'UNAVAILABLE',
            reason: 'Day-off / Walang clinic',
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Hindi naisara ang petsa.');
        await loadSchedule(selectedDoctor);
        showToast(`Isinara ang ${date} (Walang pasok).`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Hindi na-update ang petsa.', 'error');
    } finally {
      setTogglingDate(null);
    }
  };

  const reviewLeave = async (id: string, decision: 'APPROVED' | 'REJECTED') => {
    setReviewingLeaveId(id);
    try {
      const response = await fetch('/api/admin/schedules/leave-requests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, decision, reply: leaveReplies[id] || '' }),
      });
      const data = await readJsonResponse<any>(response);
      if (!response.ok) throw new Error(data.error || 'Hindi na-review ang request.');
      showToast(decision === 'APPROVED' ? 'Na-approve ang leave at naisara na ang slots.' : 'Ni-reject ang leave request.');
      await loadLeaveRequests();
      if (selectedDoctor) await loadSchedule(selectedDoctor);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Hindi na-review ang request.', 'error');
    } finally {
      setReviewingLeaveId(null);
    }
  };

  const applyPresetShift = (includeSaturday: boolean) => {
    setSchedule((prev) =>
      prev.map((row) => ({
        ...row,
        enabled: includeSaturday ? row.dayOfWeek >= 1 && row.dayOfWeek <= 6 : row.dayOfWeek >= 1 && row.dayOfWeek <= 5,
        startTime: '09:00',
        endTime: '17:00',
      }))
    );
    showToast(
      includeSaturday
        ? 'Naka-set na ang Lunes–Sabado (9:00 AM – 5:00 PM). Pindutin ang I-save.'
        : 'Naka-set na ang Lunes–Biyernes (9:00 AM – 5:00 PM). Pindutin ang I-save.',
      'info'
    );
  };

  const pendingLeaves = leaveRequests.filter((r) => r.status === 'PENDING');

  return (
    <div className="w-full space-y-4 text-slate-800">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center space-x-2 px-3.5 py-2.5 bg-slate-900 border border-slate-700 text-white rounded-lg text-xs shadow-lg">
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'info' && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          <span className="font-medium">{toastMessage.text}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="ml-2 text-slate-400 hover:text-white">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Simple Top Header + Doctor Selector */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Schedule ng mga Doktor</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Piliin ang doktor, itakda ang oras ng duty, o mag-click sa kalendaryo para sa day-off.
          </p>
        </div>

        {/* Select Doctor right at the top */}
        <div className="flex flex-wrap items-center gap-2.5">
          {doctors.length > 0 && (
            <div className="w-64">
              <Select value={selectedDoctor} onValueChange={(value) => setSelectedDoctor(value)}>
                <SelectTrigger className="h-9 text-xs bg-white border-slate-300 rounded-md font-bold text-slate-900">
                  <SelectValue placeholder="Pumili ng doktor..." />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map((doc) => (
                    <SelectItem key={doc.id} value={doc.id}>
                      {doc.name} ({doc.specialization})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {activeTab === 'weekly' && doctors.length > 0 && (
            <Button
              type="button"
              onClick={() => void handleSaveSchedule()}
              disabled={loading || loadingSchedule}
              className="h-9 px-4 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-md shadow-xs cursor-pointer"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              <span>{loading ? 'Sine-save...' : 'I-save ang Schedule'}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Pending Leave Requests Banner (Shown ONLY if there are pending requests!) */}
      {pendingLeaves.length > 0 && (
        <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-amber-950">
              Mga Naghihintay na Leave Request ({pendingLeaves.length})
            </h2>
            <span className="text-[11px] font-semibold text-amber-800">Pindutin ang Approve para isara ang petsa</span>
          </div>
          <div className="space-y-2">
            {pendingLeaves.map((request) => (
              <div key={request.id} className="rounded-md border border-amber-200 bg-white p-3 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <strong className="text-slate-900">
                      Dr. {request.doctor.firstName} {request.doctor.lastName}
                    </strong>{' '}
                    • <span className="font-mono font-bold text-teal-800">{request.date.slice(0, 10)}</span>
                  </div>
                </div>
                <p className="text-slate-600">{request.message}</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    value={leaveReplies[request.id] || ''}
                    onChange={(event) => setLeaveReplies((current) => ({ ...current, [request.id]: event.target.value }))}
                    maxLength={500}
                    placeholder="Paalala sa doktor (optional)"
                    className="h-8 text-xs flex-1"
                  />
                  <Button
                    type="button"
                    disabled={reviewingLeaveId === request.id}
                    onClick={() => void reviewLeave(request.id, 'APPROVED')}
                    className="h-8 px-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                  >
                    Approve Leave
                  </Button>
                  <Button
                    type="button"
                    disabled={reviewingLeaveId === request.id}
                    onClick={() => void reviewLeave(request.id, 'REJECTED')}
                    className="h-8 px-3 bg-slate-600 hover:bg-slate-700 text-white text-xs font-bold cursor-pointer"
                  >
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Main Content */}
      {loadingDoctors ? (
        <div className="p-12 text-center text-slate-500 bg-white border border-slate-200 rounded-lg">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-700" />
          <p className="text-xs">Kinukuha ang listahan ng mga doktor...</p>
        </div>
      ) : doctors.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-12 text-center shadow-2xs">
          <Stethoscope className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">Walang Nakalistang Doktor</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
            Magdagdag muna ng Doktor sa Staff Accounts bago makapag-set ng schedule.
          </p>
          <Link
            href="/admin/staff"
            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-teal-800 text-white rounded-md text-xs font-bold hover:bg-teal-900"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Pumunta sa Staff Accounts</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* 2 Simple View Tabs */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg p-2 shadow-2xs">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('weekly')}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-xs font-bold transition cursor-pointer ${
                  activeTab === 'weekly' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Lingguhang Oras</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('calendar')}
                className={`inline-flex h-9 items-center gap-1.5 rounded-md px-3.5 text-xs font-bold transition cursor-pointer ${
                  activeTab === 'calendar' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <CalendarIcon className="w-3.5 h-3.5" />
                <span>Kalendaryo &amp; Day-Off ({exceptions.length})</span>
              </button>
            </div>

            {activeTab === 'weekly' && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold text-slate-500 mr-1">Mabilisang Setup:</span>
                <button
                  type="button"
                  onClick={() => applyPresetShift(true)}
                  className="h-7 px-2.5 rounded border border-slate-300 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-[11px] font-bold text-slate-700 cursor-pointer"
                >
                  Lun–Sab (9AM–5PM)
                </button>
                <button
                  type="button"
                  onClick={() => applyPresetShift(false)}
                  className="h-7 px-2.5 rounded border border-slate-300 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-[11px] font-bold text-slate-700 cursor-pointer"
                >
                  Lun–Biy (9AM–5PM)
                </button>
              </div>
            )}
          </div>

          {/* TAB 1: WEEKLY SCHEDULE */}
          {activeTab === 'weekly' ? (
            <form onSubmit={handleSaveSchedule} className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">
                      Oras ng Duty — {selectedDoc?.name}
                    </h2>
                    <p className="text-xs text-slate-500">
                      I-on o i-off ang araw kung kailan may clinic (automatic na may 12NN–1PM lunch break).
                    </p>
                  </div>
                  <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2.5 py-0.5 rounded">
                    {schedule.filter((s) => s.enabled).length} / 7 Araw Bukas
                  </span>
                </div>

                <div className="divide-y divide-slate-200">
                  {schedule.map((day, index) => (
                    <div
                      key={day.day}
                      className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        day.enabled ? 'bg-white' : 'bg-slate-50/70 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center space-x-3 w-40">
                        <Switch
                          checked={day.enabled}
                          onCheckedChange={(checked) => {
                            const newSchedule = [...schedule];
                            newSchedule[index].enabled = checked;
                            setSchedule(newSchedule);
                          }}
                          className="data-[state=checked]:bg-teal-800"
                        />
                        <span className={`font-bold text-sm ${day.enabled ? 'text-slate-900' : 'text-slate-400'}`}>
                          {day.day}
                        </span>
                      </div>

                      {day.enabled ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <Input
                            type="time"
                            value={day.startTime}
                            onChange={(e) => {
                              const newSchedule = [...schedule];
                              newSchedule[index].startTime = e.target.value;
                              setSchedule(newSchedule);
                            }}
                            className="h-8 w-32 text-xs font-mono font-bold text-slate-900 border-slate-300 rounded bg-white"
                            required={day.enabled}
                          />
                          <span className="text-xs text-slate-500 font-semibold">hanggang</span>
                          <Input
                            type="time"
                            value={day.endTime}
                            onChange={(e) => {
                              const newSchedule = [...schedule];
                              newSchedule[index].endTime = e.target.value;
                              setSchedule(newSchedule);
                            }}
                            className="h-8 w-32 text-xs font-mono font-bold text-slate-900 border-slate-300 rounded bg-white"
                            required={day.enabled}
                          />
                        </div>
                      ) : (
                        <span className="text-xs italic text-slate-400">Walang Clinic sa araw na ito</span>
                      )}

                      <span
                        className={`text-xs font-bold px-2.5 py-0.5 rounded self-start sm:self-auto ${
                          day.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {day.enabled ? 'Bukas' : 'Sarado'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Collapsible Advanced Slot Rules */}
              <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowSlotRules((prev) => !prev)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left bg-slate-50 hover:bg-slate-100 transition cursor-pointer"
                >
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">
                      Advanced Slot Rules ({slotDuration} mins/pasyente • Max {maxPatients}/araw)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Baguhin lang kung gusto mong dagdagan o bawasan ang limit ng pasyente bawat araw.
                    </span>
                  </div>
                  {showSlotRules ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </button>

                {showSlotRules && (
                  <div className="p-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Tagal ng Check-up (Mins)</label>
                      <Select value={slotDuration} onValueChange={setSlotDuration}>
                        <SelectTrigger className="h-9 text-xs bg-white border-slate-300">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 minuto</SelectItem>
                          <SelectItem value="20">20 minuto</SelectItem>
                          <SelectItem value="30">30 minuto</SelectItem>
                          <SelectItem value="45">45 minuto</SelectItem>
                          <SelectItem value="60">60 minuto</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Max Pasyente Bawat Araw</label>
                      <Input type="number" min="1" max="100" value={maxPatients} onChange={(e) => setMaxPatients(e.target.value)} className="h-9 text-xs font-mono" />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 block mb-1">Pahinga sa Pagitan (Mins)</label>
                      <Input type="number" min="0" max="30" value={bufferTime} onChange={(e) => setBufferTime(e.target.value)} className="h-9 text-xs font-mono" />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={loading || loadingSchedule}
                  className="h-9 px-5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded-md shadow-xs cursor-pointer"
                >
                  {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  <span>{loading ? 'Sine-save...' : 'I-save ang Schedule'}</span>
                </Button>
              </div>
            </form>
          ) : (
            /* TAB 2: CLICKABLE CALENDAR FOR DAY-OFF / LEAVE */
            <div className="bg-white border border-slate-200 rounded-lg p-4 shadow-2xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">
                    I-click ang Petsa para sa Day-Off / Leave — {selectedDoc?.name}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Isang click lang sa kahit anong araw sa kalendaryo para isara (o buksan ulit) ang booking para sa petsang iyon.
                  </p>
                </div>
                <Input
                  type="month"
                  value={calendarMonth}
                  onChange={(event) => setCalendarMonth(event.target.value)}
                  className="h-9 w-44 text-xs font-bold"
                />
              </div>

              <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-slate-200 text-xs">
                {['Lin', 'Lun', 'Mar', 'Miy', 'Huw', 'Biy', 'Sab'].map((day) => (
                  <div key={day} className="bg-slate-100 p-2 text-center font-bold text-slate-600 border-b border-slate-200">
                    {day}
                  </div>
                ))}
                {calendarCells.map((cell, index) => {
                  if (!cell) {
                    return <div key={`blank-${index}`} className="min-h-20 border-b border-r border-slate-200 bg-slate-50" />;
                  }
                  const weeklyRow = schedule.find((item) => item.dayOfWeek === cell.weekday);
                  const isWeeklyOpen = weeklyRow?.enabled;
                  const isBusy = togglingDate === cell.date;

                  return (
                    <button
                      key={cell.date}
                      type="button"
                      disabled={isBusy}
                      onClick={() => void toggleCalendarDateOff(cell.date, cell.exception)}
                      className={`min-h-20 border-b border-r border-slate-200 p-2 text-left transition cursor-pointer hover:ring-2 hover:ring-inset hover:ring-teal-600 ${
                        cell.exception
                          ? 'bg-rose-50 hover:bg-rose-100/70'
                          : isWeeklyOpen
                          ? 'bg-white hover:bg-teal-50/40'
                          : 'bg-slate-50 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">{cell.day}</span>
                        {isBusy && <Loader2 className="h-3 w-3 animate-spin text-teal-700" />}
                      </div>
                      {cell.exception ? (
                        <div className="mt-1.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800">
                          WALANG PASOK
                        </div>
                      ) : isWeeklyOpen ? (
                        <p className="mt-1.5 text-[10px] font-semibold text-emerald-700">
                          {weeklyRow?.startTime}–{weeklyRow?.endTime}
                        </p>
                      ) : (
                        <p className="mt-1.5 text-[10px] text-slate-400">Sarado</p>
                      )}
                    </button>
                  );
                })}
              </div>

              {exceptions.length > 0 && (
                <div className="pt-2">
                  <h3 className="text-xs font-bold text-slate-700 mb-2">Mga Petsang Nakasarang Day-Off / Leave:</h3>
                  <div className="flex flex-wrap gap-2">
                    {exceptions.map((ex) => (
                      <div
                        key={ex.id}
                        className="inline-flex items-center gap-2 rounded-md border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-900"
                      >
                        <span className="font-mono">{ex.date}</span>
                        <button
                          type="button"
                          onClick={() => void toggleCalendarDateOff(ex.date, ex)}
                          className="text-rose-700 hover:text-rose-950 cursor-pointer"
                          title="Alisin ang day-off"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
