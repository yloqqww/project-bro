'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  RefreshCw,
  Search,
  ChevronRight,
  Download,
} from 'lucide-react';

// Default Clean KPIs
const defaultKpiMetrics = [
  {
    id: 'patients-today',
    label: 'Mga Pasyente Ngayon',
    value: '0',
    secondary: '0 tapos • 0 nakapila • 0 naka-schedule',
    indicator: 'Live Update',
    status: 'neutral',
  },
  {
    id: 'queue-depth',
    label: 'Naghihintay sa Pila',
    value: '0',
    secondary: 'Kasalukuyang nasa waiting area',
    indicator: 'Normal',
    status: 'healthy',
  },
  {
    id: 'active-rooms',
    label: 'Mga Kwarto ng Doktor',
    value: '0 Active',
    secondary: 'Mga bukas na consultation room',
    indicator: 'Online',
    status: 'neutral',
  },
  {
    id: 'rfid-efficiency',
    label: 'Nakalistang Pasyente',
    value: '0',
    secondary: 'Kabuuang rehistrado sa clinic',
    indicator: 'Handa',
    status: 'healthy',
  },
];

const metricTitleMap: Record<string, string> = {
  'patients-today': 'Mga Pasyente Ngayon',
  'queue-depth': 'Naghihintay sa Pila',
  'active-rooms': 'Mga Kwarto ng Doktor',
  'rfid-efficiency': 'Nakalistang Pasyente',
};

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState(defaultKpiMetrics);
  const [rooms, setRooms] = useState<any[]>([]);
  const [records, setRecords] = useState<any[]>([]);
  const [filterQueue, setFilterQueue] = useState<'ALL' | 'WAITING' | 'IN_SESSION' | 'PRIORITY'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState('Ngayon lang');

  const loadDashboardData = async () => {
    try {
      setIsRefreshing(true);
      const [dashRes, queueRes] = await Promise.all([
        fetch('/api/admin/dashboard'),
        fetch('/api/queue'),
      ]);
      const dashData = await dashRes.json();
      const queueData = await queueRes.json();

      if (dashData.success && Array.isArray(dashData.kpiMetrics)) {
        const simplified = dashData.kpiMetrics.map((m: any) => ({
          ...m,
          label: metricTitleMap[m.id] || m.label,
        }));
        setMetrics(simplified);
        setRooms(dashData.consultationRooms || []);
      }

      if (queueData.success && Array.isArray(queueData.tickets)) {
        const formatted = queueData.tickets.map((t: any) => ({
          ticket: t.ticketNumber,
          patient: t.patientName,
          patientId: t.patientId,
          cardUid: t.cardUid,
          department: t.department,
          room: t.room,
          arrivalTime: t.timeIssued,
          status: t.status,
          priority: t.priority.toUpperCase(),
        }));
        setRecords(formatted);
      }
      setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleExportCSV = () => {
    const headers = ['Ticket', 'Pangalan ng Pasyente', 'Department', 'Room', 'Oras', 'Status', 'Priority'];
    const rows = records.map(r => [
      r.ticket,
      `"${r.patient}"`,
      `"${r.department}"`,
      r.room,
      r.arrivalTime,
      r.status,
      r.priority
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `talaan_ng_pila_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredQueue = records.filter(item => {
    if (filterQueue === 'WAITING' && item.status !== 'WAITING') return false;
    if (filterQueue === 'IN_SESSION' && item.status !== 'IN_CONSULTATION' && item.status !== 'CALLED') return false;
    if (filterQueue === 'PRIORITY' && item.priority !== 'SENIOR' && item.priority !== 'URGENT') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        item.ticket.toLowerCase().includes(q) ||
        item.patient.toLowerCase().includes(q) ||
        item.department.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const waitingCount = records.filter(r => r.status === 'WAITING').length;
  const inSessionCount = records.filter(r => r.status === 'IN_CONSULTATION' || r.status === 'CALLED').length;
  const priorityCount = records.filter(r => r.priority === 'SENIOR' || r.priority === 'URGENT').length;

  return (
    <div className="space-y-5">
      {/* 1. Simple Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Lagay ng Clinic Ngayon</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" />
              Live
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Huling update: {lastRefreshed}
          </p>
        </div>

        {/* Simple Actions */}
        <div className="flex items-center space-x-2">
          <button
            onClick={loadDashboardData}
            disabled={isRefreshing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-teal-700' : 'text-slate-500'}`} />
            <span>I-refresh</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-md text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>I-save ang Listahan</span>
          </button>
        </div>
      </div>

      {/* 2. Simple Summary Cards (4 Boxes) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {metrics.map((kpi) => (
          <div
            key={kpi.id}
            className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col justify-between shadow-2xs"
          >
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">{kpi.label}</span>
            <div className="my-2 flex items-baseline space-x-2">
              <span className="text-3xl font-bold font-mono text-slate-900 tracking-tight">{kpi.value}</span>
            </div>
            <div className="text-xs text-slate-500 pt-2 border-t border-slate-100">
              {kpi.secondary}
            </div>
          </div>
        ))}
      </div>

      {/* 3. Main 2-Column Monitoring: Mga Kwarto & Pila ng Pasyente */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        
        {/* Left Col: Consultation Rooms (5 cols) */}
        <div className="xl:col-span-5">
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div>
                <h2 className="text-base font-bold text-slate-900">Mga Kwarto ng Doktor</h2>
                <p className="text-xs text-slate-500">Sino ang naka-duty at may pasyente ngayon</p>
              </div>
              <Link
                href="/admin/staff"
                className="text-xs font-bold text-teal-800 hover:underline inline-flex items-center space-x-0.5"
              >
                <span>Mga Doktor</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100">
              {rooms.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 space-y-1">
                  <p className="font-bold text-slate-700">Walang nakatalagang kwarto sa ngayon.</p>
                  <p>Magdagdag ng Doktor sa Staff Management para makita rito.</p>
                </div>
              ) : (
                rooms.map((room) => {
                  const isSession = room.status === 'IN_SESSION';
                  const isIdle = room.status === 'IDLE';

                  return (
                    <div key={room.room} className="p-3.5 hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 text-sm">{room.room}</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-xs text-slate-500">{room.department}</span>
                        </div>

                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            isSession
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : isIdle
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border border-slate-200'
                          }`}
                        >
                          {isSession ? 'May Pasyente' : isIdle ? 'Bakante' : 'Walang Duty'}
                        </span>
                      </div>

                      <div className="text-sm font-semibold text-slate-800">{room.doctor}</div>

                      <div className="mt-2 text-xs bg-slate-50 border border-slate-200/70 rounded px-2.5 py-1.5 flex items-center justify-between">
                        <div className="flex items-center space-x-1.5 text-slate-700 min-w-0">
                          {isSession && (
                            <span className="font-mono font-bold text-slate-900 bg-white px-1.5 py-0.5 border border-slate-200 rounded text-[11px]">
                              #{room.currentTicket}
                            </span>
                          )}
                          <span className="truncate">{room.patientName}</span>
                        </div>

                        <div className="text-slate-500 font-semibold text-[11px] shrink-0">
                          {room.queueBehind} naghihintay
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Simple Live Queue Table (7 cols) */}
        <div className="xl:col-span-7">
          <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
            {/* Simple Filter Bar */}
            <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50/50">
              <div className="flex flex-wrap items-center gap-1 border border-slate-200 rounded-md p-0.5 bg-white self-start">
                {(['ALL', 'WAITING', 'IN_SESSION', 'PRIORITY'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setFilterQueue(tab)}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-colors cursor-pointer ${
                      filterQueue === tab
                        ? 'bg-teal-800 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab === 'ALL'
                      ? `Lahat (${records.length})`
                      : tab === 'WAITING'
                      ? `Naghihintay (${waitingCount})`
                      : tab === 'IN_SESSION'
                      ? `Nasa Loob (${inSessionCount})`
                      : `Priority (${priorityCount})`}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative w-full sm:w-56">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Maghanap ng pasyente o ticket..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:border-teal-700"
                />
              </div>
            </div>

            {/* Clean Queue Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <tr>
                    <th className="px-3.5 py-2.5">Ticket</th>
                    <th className="px-3.5 py-2.5">Pasyente</th>
                    <th className="px-3.5 py-2.5">Kagawaran / Kwarto</th>
                    <th className="px-3.5 py-2.5">Lagay sa Pila</th>
                    <th className="px-3.5 py-2.5 text-right">Tingnan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredQueue.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-xs">
                        Walang pasyente sa pila sa ngayon.
                      </td>
                    </tr>
                  ) : (
                    filteredQueue.map((item) => (
                      <tr key={item.ticket} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3.5 py-3 font-mono font-bold text-slate-900 text-sm">
                          #{item.ticket}
                        </td>
                        <td className="px-3.5 py-3">
                          <div className="font-bold text-slate-900 text-sm">{item.patient}</div>
                          {(item.priority === 'SENIOR' || item.priority === 'URGENT') && (
                            <span
                              className={`inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                item.priority === 'URGENT'
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {item.priority === 'URGENT' ? 'Urgent' : 'Senior / PWD'}
                            </span>
                          )}
                        </td>
                        <td className="px-3.5 py-3 text-slate-700">
                          <div className="font-semibold">{item.department}</div>
                          <div className="text-[11px] text-slate-500">{item.room}</div>
                        </td>
                        <td className="px-3.5 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                              item.status === 'IN_CONSULTATION'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : item.status === 'CALLED'
                                ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                : item.status === 'WAITING'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {item.status === 'IN_CONSULTATION'
                              ? 'Kinakausap na'
                              : item.status === 'CALLED'
                              ? 'Tinawag na'
                              : item.status === 'WAITING'
                              ? 'Naghihintay'
                              : 'Tapos na'}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 text-right">
                          <Link
                            href="/admin/patients"
                            className="text-xs text-teal-800 hover:bg-teal-50 font-bold px-2.5 py-1 rounded border border-teal-200 transition"
                          >
                            Detalye
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
              Kabuuang nakikita: <strong>{filteredQueue.length}</strong> pasyente
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
