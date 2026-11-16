'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Play, Pause, ChevronLeft, ChevronRight, LayoutGrid, Tv } from 'lucide-react';
import { useQueueRealtime } from '@/hooks/useQueueRealtime';

interface QueueItem {
  number: string;
  name: string;
}

interface DepartmentQueue {
  id: string;
  name: string;
  doctor: string;
  room: string;
  nowServing: QueueItem;
  next: QueueItem;
  waiting: QueueItem;
}

const PAGE_SIZE = 2; // Show 2 departments per screen on large TV carousel
const CYCLE_INTERVAL_SECONDS = 10;
const DEFAULT_PUBLIC_SETTINGS = {
  clinicName: 'Laguna Medical Center',
  shortName: 'LMC',
  hotline: '(049) 545-8888',
  address: 'Santa Cruz, Laguna, Philippines',
  emergencyNotice: '',
};

export default function QueueTV() {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [departments, setDepartments] = useState<DepartmentQueue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [clinicSettings, setClinicSettings] = useState(DEFAULT_PUBLIC_SETTINGS);
  
  // Hospital Display Navigation & Cycling State
  const [viewMode, setViewMode] = useState<'grid' | 'cycle'>('grid');
  const [currentPage, setCurrentPage] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(CYCLE_INTERVAL_SECONDS);

  const totalPages = Math.max(1, Math.ceil(departments.length / PAGE_SIZE));

  // Live Clock (Ticks every second)
  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch live doctors & active tickets from Database
  const fetchLiveQueue = async () => {
    try {
      const [docsRes, queueRes, settingsRes] = await Promise.all([
        fetch('/api/doctors'),
        fetch('/api/queue?view=public'),
        fetch('/api/settings'),
      ]);
      const docsData = await docsRes.json();
      const queueData = await queueRes.json();
      const settingsData = await settingsRes.json();
      if (settingsData.success && settingsData.settings) setClinicSettings(settingsData.settings);

      if (docsData.success && Array.isArray(docsData.doctors)) {
        const tickets = queueData.success && Array.isArray(queueData.tickets) ? queueData.tickets : [];
        
        const builtDepts: DepartmentQueue[] = docsData.doctors.map((doc: any) => {
          const docTickets = tickets.filter(
            (t: any) => t.doctorId === doc.id || t.department === doc.specialization
          );

          const servingTicket = docTickets.find(
            (t: any) => t.status === 'CALLED' || t.status === 'IN_CONSULTATION' || t.status === 'NOW SERVING'
          );

          const waitingTickets = docTickets.filter((t: any) => t.status === 'WAITING');

          return {
            id: doc.id,
            name: doc.specialization,
            doctor: doc.name,
            room: doc.roomNumber,
            nowServing: servingTicket
              ? { number: servingTicket.ticketNumber, name: 'Please proceed to the assigned room' }
              : { number: '—', name: 'Walang Pasyente' },
            next: waitingTickets[0]
              ? { number: waitingTickets[0].ticketNumber, name: 'Please remain in the waiting area' }
              : { number: '—', name: 'Wala' },
            waiting: waitingTickets[1]
              ? { number: waitingTickets[1].ticketNumber, name: 'Please remain in the waiting area' }
              : { number: '—', name: 'Wala' },
          };
        });

        setDepartments(builtDepts);
      }
    } catch (e) {
      console.error('Failed to sync live queue:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveQueue();
  }, []);
  useQueueRealtime(fetchLiveQueue, { publicView: true, fallbackMs: 60_000 });

  // Auto-Cycle Timer (Cycles pages every 10s when in 'cycle' mode and not paused)
  useEffect(() => {
    if (viewMode !== 'cycle' || isPaused || departments.length === 0) return;

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setCurrentPage((curr) => (curr + 1) % totalPages);
          return CYCLE_INTERVAL_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [viewMode, isPaused, totalPages, departments.length]);

  // Handle Safe Back Navigation (Directly returns to Receptionist Desk)
  const handleBackToReception = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/reception/checkin');
    }
  };

  const handleNextPage = () => {
    setCurrentPage((curr) => (curr + 1) % totalPages);
    setSecondsRemaining(CYCLE_INTERVAL_SECONDS);
  };

  const handlePrevPage = () => {
    setCurrentPage((curr) => (curr - 1 + totalPages) % totalPages);
    setSecondsRemaining(CYCLE_INTERVAL_SECONDS);
  };

  const carouselDepartments = departments.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  );

  const formattedDate = currentTime
    ? currentTime.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : '';

  const formattedTime = currentTime
    ? currentTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      })
    : '';

  return (
    <div className={`min-h-screen ${viewMode === 'grid' ? 'lg:h-screen lg:max-h-screen lg:overflow-hidden' : ''} bg-slate-100 text-slate-900 font-sans antialiased flex flex-col justify-between`}>
      
      {/* ── 1. TOP HEADER (COMPACT INSTITUTIONAL BAR - ZERO OVERFLOW) ─── */}
      <header className="bg-white border-b border-slate-300 h-14 shrink-0 z-30 shadow-xs">
        <div className="max-w-[1680px] mx-auto px-4 sm:px-6 h-full flex items-center justify-between gap-3">
          
          {/* Left: Safe Back to Receptionist & Institutional Title */}
          <div className="flex items-center space-x-3 min-w-0">
            <button
              type="button"
              onClick={handleBackToReception}
              className="inline-flex items-center space-x-1.5 text-xs font-semibold text-slate-700 hover:text-slate-950 border border-slate-300 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 rounded-md transition-colors shadow-xs cursor-pointer shrink-0"
              title="Bumalik sa Reception Check-in Station"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-600 shrink-0" />
              <span className="hidden sm:inline">Reception Desk</span>
              <span className="sm:hidden">Back</span>
            </button>

            <div className="border-l border-slate-200 pl-3 min-w-0">
              <h1 className="text-sm sm:text-base font-black tracking-tight text-slate-900 uppercase truncate leading-tight">
                Queue Monitor
              </h1>
              <p className="text-[10px] text-slate-500 truncate hidden md:block">
                 {clinicSettings.clinicName}
              </p>
            </div>
          </div>

          {/* Right: Mode Switcher & Real-time Clock */}
          <div className="flex items-center space-x-3 shrink-0">
            
            {/* View Mode Toggle */}
            <div className="inline-flex items-center border border-slate-300 rounded-md p-0.5 bg-slate-50 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2.5 py-1 rounded transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Ipakita ang lahat ng departamento sa iisang screen nang walang scroll"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Lahat (Grid)</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('cycle')}
                className={`px-2.5 py-1 rounded transition-colors flex items-center space-x-1.5 cursor-pointer ${
                  viewMode === 'cycle'
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="I-rotate nang 2 klinika bawat screen para sa malalayong TV"
              >
                <Tv className="w-3.5 h-3.5" />
                <span>TV Mode</span>
              </button>
            </div>

            {/* Live Clock */}
            <div className="flex items-center space-x-2 text-right border-l border-slate-200 pl-3">
              <Clock className="w-3.5 h-3.5 text-slate-500 hidden sm:block" />
              <div className="font-mono text-xs sm:text-sm text-slate-800 font-bold">
                {currentTime ? (
                  <>
                    <span className="hidden lg:inline text-slate-600 font-normal mr-2">{formattedDate}</span>
                    <span>{formattedTime}</span>
                  </>
                ) : (
                  <span className="text-slate-400">...</span>
                )}
              </div>
            </div>

          </div>

        </div>
      </header>

      {/* ── 2. INSTRUCTION & CYCLING CONTROLS BANNER ───────────────────── */}
      <div className="bg-slate-900 text-slate-100 border-b border-slate-800 py-1 px-4 sm:px-6 shrink-0">
        <div className="max-w-[1680px] mx-auto flex items-center justify-between text-xs font-medium">
          <p className="truncate">
            When your queue number appears under <strong className="text-emerald-400 font-bold">NOW SERVING</strong>, please proceed to the indicated consultation room.
          </p>

          {/* Controls when in 2-Clinic TV Carousel */}
          {viewMode === 'cycle' && departments.length > 0 && (
            <div className="flex items-center space-x-2 text-xs bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700 shrink-0 ml-2">
              <span className="text-slate-300 font-mono text-[11px]">
                {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, departments.length)} of {departments.length}
              </span>
              <span className="text-slate-500">•</span>
              <span className="font-mono text-[11px] text-slate-300">
                {isPaused ? 'PAUSED' : `${secondsRemaining}s`}
              </span>
              <button
                type="button"
                onClick={() => setIsPaused(!isPaused)}
                className="p-0.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                title={isPaused ? 'Resume' : 'Pause'}
              >
                {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
              </button>
              <button
                type="button"
                onClick={handlePrevPage}
                className="p-0.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Previous"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextPage}
                className="p-0.5 hover:bg-slate-700 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Next"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
      {clinicSettings.emergencyNotice && (
        <div className="bg-rose-50 text-rose-900 border-b border-rose-200 px-4 py-1 text-center text-[11px] font-semibold shrink-0">
          {clinicSettings.emergencyNotice} {clinicSettings.hotline && `• Hotline: ${clinicSettings.hotline}`}
        </div>
      )}

      {/* ── 3. MAIN DISPLAY ────────────────────────────────────────────── */}
      
      {/* Empty State when no doctors registered yet */}
      {departments.length === 0 && !isLoading && (
        <main className="flex-1 min-h-0 p-8 max-w-[1680px] w-full mx-auto flex flex-col items-center justify-center text-center">
          <div className="max-w-md bg-white border border-slate-300 rounded-lg p-8 shadow-sm space-y-3">
            <div className="w-12 h-12 rounded bg-slate-100 flex items-center justify-center mx-auto text-slate-600 font-bold text-sm">
              {clinicSettings.shortName}
            </div>
            <h2 className="text-lg font-bold text-slate-900 uppercase">Walang Aktibong Konsultasyon sa Ngayon</h2>
            <p className="text-xs text-slate-600 leading-relaxed">
              Maaari nang mag-login ang Admin sa <strong>/admin/staff</strong> upang mag-rehistro ng mga Doktor para sa bawat kagawaran.
            </p>
          </div>
        </main>
      )}

      {/* MODE 1: LAHAT (GRID / MASTER BOARD) - 100% FITS IN SINGLE SCREEN WITH ZERO SCROLL & ZERO OVERLAP */}
      {viewMode === 'grid' && departments.length > 0 && (
        <main className="flex-1 min-h-0 p-2 sm:p-3 max-w-[1680px] w-full mx-auto flex flex-col justify-between gap-1.5 overflow-hidden">
          
          {/* Master Board Column Headers */}
          <div className="hidden lg:grid grid-cols-12 gap-2.5 px-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
            <div className="col-span-3">Kagawaran / Doktor / Silid</div>
            <div className="col-span-4 text-emerald-800 font-black">NOW SERVING (Kasalukuyan)</div>
            <div className="col-span-3 text-amber-800 font-black">NEXT (Susunod)</div>
            <div className="col-span-2 text-slate-600 font-bold">WAITING (Pila)</div>
          </div>

          {/* Equal-Height Department Rows - CSS Grid 12 cols guarantees ZERO OVERLAP */}
          <div className="flex-1 min-h-0 flex flex-col justify-between gap-1.5">
            {departments.map((dept) => (
              <div
                key={dept.id}
                className="flex-1 min-h-0 bg-white border border-slate-300 rounded-lg px-3 py-1.5 sm:px-4 grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-2.5 items-center shadow-xs"
              >
                {/* Col 1: Dept Name, Doctor, Room Badge (3 of 12 columns) */}
                <div className="col-span-12 lg:col-span-3 flex items-center justify-between lg:justify-start space-x-2.5 min-w-0">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight truncate leading-tight">
                      {dept.name}
                    </div>
                    <div className="text-[11px] sm:text-xs text-slate-600 font-medium truncate">
                      {dept.doctor}
                    </div>
                  </div>
                  <div className="shrink-0 px-2 py-0.5 rounded bg-slate-800 text-white font-mono font-bold text-[11px] tracking-wider">
                    {dept.room}
                  </div>
                </div>

                {/* Col 2: NOW SERVING (4 of 12 columns, Emerald, Zero collision) */}
                <div className="col-span-12 lg:col-span-4 h-full min-h-[46px] bg-emerald-50 border-2 border-emerald-700 rounded-md px-3 py-1 flex items-center justify-between min-w-0">
                  <div className="min-w-0 flex-1 pr-2">
                    <div className="inline-block text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-emerald-800 text-white tracking-widest leading-normal">
                      NOW SERVING
                    </div>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 truncate mt-0.5">
                      {dept.nowServing.name}
                    </div>
                  </div>
                  <div className="text-2xl sm:text-3xl lg:text-[34px] font-black font-mono text-emerald-950 tracking-wider shrink-0">
                    {dept.nowServing.number}
                  </div>
                </div>

                {/* Col 3: NEXT (3 of 12 columns, Amber, Second State) */}
                <div className="col-span-12 lg:col-span-3 h-full min-h-[46px] bg-amber-50 border border-amber-400 rounded-md px-3 py-1 flex items-center justify-between min-w-0">
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="text-[9px] font-bold uppercase text-amber-900 block leading-tight">
                      NEXT
                    </span>
                    <div className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      {dept.next.name}
                    </div>
                  </div>
                  <div className="text-xl sm:text-2xl lg:text-[26px] font-extrabold font-mono text-amber-950 tracking-wider shrink-0">
                    {dept.next.number}
                  </div>
                </div>

                {/* Col 4: WAITING (2 of 12 columns, Slate, Quiet State) */}
                <div className="col-span-12 lg:col-span-2 h-full min-h-[46px] bg-slate-50 border border-slate-300 rounded-md px-2.5 py-1 flex items-center justify-between min-w-0">
                  <div className="min-w-0 flex-1 pr-1.5">
                    <span className="text-[9px] font-bold uppercase text-slate-600 block leading-tight">
                      WAITING
                    </span>
                    <div className="text-xs font-semibold text-slate-800 truncate">
                      {dept.waiting.name}
                    </div>
                  </div>
                  <div className="text-lg sm:text-xl lg:text-2xl font-bold font-mono text-slate-700 tracking-wider shrink-0">
                    {dept.waiting.number}
                  </div>
                </div>

              </div>
            ))}
          </div>

        </main>
      )}

      {/* MODE 2: 2-CLINIC TV CAROUSEL (FOR VERY DISTANT VIEWING) */}
      {viewMode === 'cycle' && departments.length > 0 && (
        <main className="flex-1 max-w-[1680px] w-full mx-auto p-4 sm:p-6 space-y-5">
          {carouselDepartments.map((dept) => (
            <section
              key={dept.id}
              className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden"
            >
              {/* Title Bar */}
              <div className="bg-slate-900 text-white px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300">
                <div className="flex items-baseline space-x-3">
                  <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white uppercase">
                    {dept.name}
                  </h2>
                  <span className="text-slate-500 hidden sm:inline">•</span>
                  <span className="text-sm sm:text-base font-medium text-slate-300">
                    {dept.doctor}
                  </span>
                </div>

                <div className="inline-flex items-center self-start sm:self-auto px-3.5 py-1 rounded bg-slate-800 border border-slate-700 text-white text-xs sm:text-sm font-mono font-bold tracking-wider">
                  LOCATION: {dept.room}
                </div>
              </div>

              {/* Three-Column Display */}
              <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-5 items-stretch">
                
                {/* NOW SERVING */}
                <div className="bg-emerald-50 border-2 border-emerald-700 rounded-lg p-5 sm:p-6 flex flex-col justify-between text-center">
                  <div>
                    <div className="inline-block bg-emerald-800 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded">
                      NOW SERVING
                    </div>
                    <div className="text-5xl sm:text-6xl lg:text-7xl font-black font-mono text-emerald-950 tracking-wider my-3">
                      {dept.nowServing.number}
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-slate-900">
                      {dept.nowServing.name}
                    </div>
                  </div>
                  <div className="mt-5 pt-3 border-t border-emerald-200">
                    <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
                      Please proceed to {dept.room}
                    </span>
                  </div>
                </div>

                {/* NEXT */}
                <div className="bg-amber-50 border border-amber-400 rounded-lg p-5 sm:p-6 flex flex-col justify-between text-center">
                  <div>
                    <div className="inline-block bg-amber-600 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded">
                      NEXT
                    </div>
                    <div className="text-4xl sm:text-5xl font-extrabold font-mono text-amber-950 tracking-wider my-3">
                      {dept.next.number}
                    </div>
                    <div className="text-base sm:text-lg font-bold text-slate-900">
                      {dept.next.name}
                    </div>
                  </div>
                  <div className="mt-5 pt-3 border-t border-amber-200">
                    <span className="text-xs font-semibold text-amber-900">
                      Please be ready
                    </span>
                  </div>
                </div>

                {/* WAITING */}
                <div className="bg-slate-50 border border-slate-300 rounded-lg p-5 sm:p-6 flex flex-col justify-between text-center">
                  <div>
                    <div className="inline-block bg-slate-600 text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded">
                      WAITING
                    </div>
                    <div className="text-3xl sm:text-4xl font-bold font-mono text-slate-800 tracking-wider my-3">
                      {dept.waiting.number}
                    </div>
                    <div className="text-base sm:text-lg font-bold text-slate-800">
                      {dept.waiting.name}
                    </div>
                  </div>
                  <div className="mt-5 pt-3 border-t border-slate-200">
                    <span className="text-xs font-medium text-slate-500">
                      Waiting in queue
                    </span>
                  </div>
                </div>

              </div>
            </section>
          ))}
        </main>
      )}

      {/* ── 4. FOOTER / STATUS BAR ─────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-300 py-1.5 px-4 sm:px-6 shrink-0">
        <div className="max-w-[1680px] mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-1.5">
          
          <div>
            {clinicSettings.clinicName} • {clinicSettings.address} • {clinicSettings.hotline}
          </div>

          {/* Queue Status Color Key */}
          <div className="flex items-center space-x-6 text-[11px] font-semibold uppercase tracking-wider text-slate-600">
            <span className="inline-flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-emerald-700 shrink-0" />
              <span>Now Serving</span>
            </span>
            <span className="inline-flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 shrink-0" />
              <span>Next</span>
            </span>
            <span className="inline-flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-sm bg-slate-500 shrink-0" />
              <span>Waiting</span>
            </span>
          </div>

        </div>
      </footer>

    </div>
  );
}
