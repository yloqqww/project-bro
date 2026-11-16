'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar as CalendarIcon,
  Search,
  Download,
  Clock,
  User,
  Stethoscope,
  Eye,
  X as XIcon,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Building2,
  Check,
  Ban,
  RefreshCw,
  Loader2,
  ShieldAlert,
  Archive,
  ArchiveRestore,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { PaginationControls } from '@/components/PaginationControls';

export type Appointment = {
  id: string;
  appointmentNumber: string;
  patientName: string;
  patientId: string;
  doctorName: string;
  doctorSpecialty: string;
  date: string;
  time: string;
  status: 'Pending' | 'Confirmed' | 'Checked-In' | 'Completed' | 'Cancelled' | 'No-Show';
  type: 'Walk-in' | 'Scheduled' | 'Follow-up';
  reason: string;
  queueNumber: string | null;
  checkedInAt: string | null;
  completedAt: string | null;
  archivedAt?: string | null;
  archiveReason?: string | null;
};

export default function AppointmentsPage() {
  const [archiveView, setArchiveView] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterDoctor, setFilterDoctor] = useState('ALL');
  const [filterType, setFilterType] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Modal states for Confirm Action (Yes/No) and Loading
  const [confirmModal, setConfirmModal] = useState<{ open: boolean; type: 'confirm' | 'cancel' | 'archive' | 'restore'; appointment: Appointment } | null>(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingText, setProcessingText] = useState('Pinoproseso ang appointment...');

  // Toast feedback state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Appointments dataset
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAppointments, setTotalAppointments] = useState(0);

  const loadAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), includeArchived: 'true' });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (filterStatus !== 'ALL') params.set('status', filterStatus);
      if (selectedDate) { params.set('from', selectedDate); params.set('to', selectedDate); }
      const res = await fetch(`/api/appointments?${params}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load appointments.');
      if (data.success && Array.isArray(data.appointments)) {
        setAppointments(data.appointments);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalAppointments(data.pagination?.total || data.appointments.length);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
      showToast('Failed to load appointments from server', 'error');
      setLoadError(err instanceof Error ? err.message : 'Failed to load appointments.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, filterStatus, selectedDate]);

  useEffect(() => {
    loadAppointments();
  }, [loadAppointments]);

  // Doctors list for filtering
  const doctors = Array.from(new Set(appointments.map(a => a.doctorName)));

  const activeAppointments = appointments.filter((a) => !a.archivedAt);
  const archivedAppointments = appointments.filter((a) => Boolean(a.archivedAt));
  const scopedAppointments = archiveView === 'ARCHIVED' ? archivedAppointments : activeAppointments;

  // Filter appointments
  const filteredAppointments = scopedAppointments.filter(apt => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !q ||
      apt.patientName.toLowerCase().includes(q) ||
      apt.appointmentNumber.toLowerCase().includes(q) ||
      apt.doctorName.toLowerCase().includes(q) ||
      apt.patientId.toLowerCase().includes(q);
    
    const matchesStatus = filterStatus === 'ALL' || apt.status === filterStatus;
    const matchesDoctor = filterDoctor === 'ALL' || apt.doctorName === filterDoctor;
    const matchesType = filterType === 'ALL' || apt.type === filterType;
    const matchesDate = !selectedDate || apt.date === selectedDate;

    return matchesSearch && matchesStatus && matchesDoctor && matchesType && matchesDate;
  });

  // Calculate dynamic metrics from active appointments
  const statusCounts = {
    total: activeAppointments.length,
    pending: activeAppointments.filter(a => a.status === 'Pending').length,
    confirmed: activeAppointments.filter(a => a.status === 'Confirmed' || a.status === 'Checked-In').length,
    completed: activeAppointments.filter(a => a.status === 'Completed').length,
    cancelled: activeAppointments.filter(a => a.status === 'Cancelled').length,
    noShow: activeAppointments.filter(a => a.status === 'No-Show').length
  };

  const handleArchiveToggle = async (appointment: Appointment, action: 'ARCHIVE' | 'RESTORE') => {
    setIsProcessing(true);
    setProcessingText(action === 'ARCHIVE' ? 'Ina-archive ang appointment...' : 'Ibinabalik ang appointment...');
    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: action === 'ARCHIVE' ? 'Archived by admin' : undefined,
        }),
      });
      if (!res.ok) throw new Error('Hindi na-update ang appointment archive.');
      showToast(
        action === 'ARCHIVE'
          ? `Na-archive na ang appointment ${appointment.appointmentNumber}.`
          : `Ibinalik na sa aktibo ang appointment ${appointment.appointmentNumber}.`,
        'success'
      );
      await loadAppointments();
      if (selectedAppointment?.id === appointment.id) {
        setDetailsOpen(false);
        setSelectedAppointment(null);
      }
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Hindi na-update ang archive.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleViewDetails = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setDetailsOpen(true);
  };

  // Trigger Confirm Modal (Yes / No)
  const openConfirmAction = (appointment: Appointment, type: 'confirm' | 'cancel' | 'archive' | 'restore') => {
    setCancellationReason('');
    setConfirmModal({ open: true, type, appointment });
  };

  // Execute Appointment Action
  const executeConfirmAction = async () => {
    if (!confirmModal?.appointment) return;
    const { appointment, type } = confirmModal;

    if (type === 'archive' || type === 'restore') {
      setConfirmModal(null);
      await handleArchiveToggle(appointment, type === 'archive' ? 'ARCHIVE' : 'RESTORE');
      return;
    }

    const targetStatus = type === 'confirm' ? 'Confirmed' : 'Cancelled';
    if (type === 'cancel' && cancellationReason.trim().length < 3) { showToast('Maglagay ng malinaw na cancellation reason.', 'error'); return; }

    setIsProcessing(true);
    setProcessingText(type === 'confirm' ? 'Kinukumpirma ang appointment...' : 'Kinakansela ang appointment...');

    try {
      const res = await fetch(`/api/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: targetStatus, reason: type === 'cancel' ? cancellationReason.trim() : undefined }),
      });
      if (res.ok) {
        showToast(
          type === 'confirm'
            ? `Appointment ${appointment.appointmentNumber} confirmed para kay ${appointment.patientName}.`
            : `Appointment ${appointment.appointmentNumber} ay matagumpay na nakansela.`,
          type === 'confirm' ? 'success' : 'info'
        );
        await loadAppointments();
        if (selectedAppointment?.id === appointment.id) {
          setSelectedAppointment({ ...selectedAppointment, status: targetStatus });
        }
      } else {
        showToast('Hindi nagtagumpay ang pag-update ng appointment', 'error');
      }
    } catch (e) {
      showToast('Error sa pag-update ng appointment', 'error');
    } finally {
      setIsProcessing(false);
      setConfirmModal(null);
    }
  };

  // Export CSV Report
  const handleExportReport = () => {
    const headers = ['Appointment #', 'Patient ID', 'Patient Name', 'Doctor', 'Specialty', 'Date', 'Time', 'Type', 'Status', 'Queue', 'Reason'];
    const rows = filteredAppointments.map(a => [
      a.appointmentNumber,
      a.patientId,
      `"${a.patientName}"`,
      `"${a.doctorName}"`,
      `"${a.doctorSpecialty}"`,
      a.date,
      a.time,
      a.type,
      a.status,
      a.queueNumber || '-',
      `"${a.reason.replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lagunamedical_appointments_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filteredAppointments.length} appointment records to CSV.`);
  };

  // Format Date for display: YYYY-MM-DD to M/D/YYYY
  const formatDateDisplay = (dateStr: string) => {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return `${month}/${day}/${year}`;
    }
    return new Date(dateStr).toLocaleDateString();
  };

  // Initials generator
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 3)
      .join('');
  };

  return (
    <div className="space-y-4 text-slate-800">
      {/* ── TOAST NOTIFICATION BANNER ───────────────────────────────── */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center space-x-2 px-3.5 py-2 bg-slate-900 border border-slate-700 text-white rounded text-xs shadow-lg animate-fade-in">
          {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          {toastMessage.type === 'info' && <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />}
          {toastMessage.type === 'error' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
          <span className="font-medium">{toastMessage.text}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-slate-400 hover:text-white"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Appointments</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Manage and monitor all patient appointments
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadAppointments}
            disabled={loading}
            title="Refresh appointments list from database"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded shadow-2xs transition-colors disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportReport}
            title="Download appointments report in CSV format"
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Report</span>
          </button>
        </div>
      </div>

      {/* ── SUMMARY / KPI INFORMATION BLOCKS (Zero Gradients, Enterprise Density) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total */}
        <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs">
          <span className="text-[13px] font-medium text-slate-500 uppercase tracking-wider block">
            TOTAL
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-slate-900 tracking-tight">
              {statusCounts.total}
            </span>
            <span className="text-xs text-slate-400 font-medium">All</span>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs">
          <span className="text-[13px] font-medium text-slate-500 uppercase tracking-wider block">
            PENDING
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-amber-700 tracking-tight">
              {statusCounts.pending}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
              Action
            </span>
          </div>
        </div>

        {/* Confirmed */}
        <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs">
          <span className="text-[13px] font-medium text-slate-500 uppercase tracking-wider block">
            CONFIRMED
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-slate-900 tracking-tight">
              {statusCounts.confirmed}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Active
            </span>
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs">
          <span className="text-[13px] font-medium text-slate-500 uppercase tracking-wider block">
            COMPLETED
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-slate-900 tracking-tight">
              {statusCounts.completed}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              Done
            </span>
          </div>
        </div>

        {/* Cancelled */}
        <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs">
          <span className="text-[13px] font-medium text-slate-500 uppercase tracking-wider block">
            CANCELLED
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-slate-600 tracking-tight">
              {statusCounts.cancelled}
            </span>
            <span className="text-xs text-slate-400 font-medium">Void</span>
          </div>
        </div>

        {/* No-Show */}
        <div className="bg-white border border-slate-200 rounded p-3 shadow-2xs">
          <span className="text-[13px] font-medium text-slate-500 uppercase tracking-wider block">
            NO-SHOW
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-red-700 tracking-tight">
              {statusCounts.noShow}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
              Missed
            </span>
          </div>
        </div>
      </div>

      {/* ── FILTERS & SEARCH TOOLBAR ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-wrap">
          {/* Active vs Archived Toggle */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setArchiveView('ACTIVE')}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                archiveView === 'ACTIVE'
                  ? 'bg-teal-800 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5" />
              <span>Aktibo ({activeAppointments.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setArchiveView('ARCHIVED')}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                archiveView === 'ARCHIVED'
                  ? 'bg-amber-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archive ({archivedAppointments.length})</span>
            </button>
          </div>

          {/* Search Field */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by patient, appointment #, or doctor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <XIcon className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Date Filter */}
          <div className="w-full sm:w-36">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-700 focus:outline-hidden focus:border-slate-600"
            />
          </div>

          {/* All Status Filter */}
          <div className="w-full sm:w-36">
            <Select value={filterStatus} onValueChange={(val: string) => setFilterStatus(val)}>
              <SelectTrigger className="h-8 text-sm bg-white border-slate-300">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="Pending">Pending</SelectItem>
                <SelectItem value="Confirmed">Confirmed</SelectItem>
                <SelectItem value="Checked-In">Checked-In</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
                <SelectItem value="No-Show">No-Show</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* All Doctors Filter */}
          <div className="w-full sm:w-44">
            <Select value={filterDoctor} onValueChange={(val: string) => setFilterDoctor(val)}>
              <SelectTrigger className="h-8 text-sm bg-white border-slate-300">
                <SelectValue placeholder="All Doctors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Doctors</SelectItem>
                {doctors.map(doc => (
                  <SelectItem key={doc} value={doc}>{doc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* All Types Filter */}
          <div className="w-full sm:w-36">
            <Select value={filterType} onValueChange={(val: string) => setFilterType(val)}>
              <SelectTrigger className="h-8 text-sm bg-white border-slate-300">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="Scheduled">Scheduled</SelectItem>
                <SelectItem value="Walk-in">Walk-in</SelectItem>
                <SelectItem value="Follow-up">Follow-up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters Button */}
          {(searchQuery || selectedDate || filterStatus !== 'ALL' || filterDoctor !== 'ALL' || filterType !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedDate('');
                setFilterStatus('ALL');
                setFilterDoctor('ALL');
                setFilterType('ALL');
              }}
              className="text-[13px] text-slate-600 hover:text-slate-900 underline font-medium px-1 self-center"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Records Count */}
        <div className="text-[13px] text-slate-500 font-mono self-end sm:self-center whitespace-nowrap">
          Showing {filteredAppointments.length} of {totalAppointments} appointments
        </div>
      </div>

      {/* ── APPOINTMENTS TABLE CONTAINER (Zero Gradients, Enterprise Data Table) ── */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            {/* Column Headers */}
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Appointment
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Patient
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Doctor
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Date & Time
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Type
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Status
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Queue
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs text-right">
                  Actions
                </th>
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredAppointments.map((apt) => {
                const initials = getInitials(apt.patientName);

                return (
                  <tr key={apt.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Appointment ID */}
                    <td className="py-2.5 px-4">
                      <span className="font-mono text-xs text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-medium">
                        {apt.appointmentNumber}
                      </span>
                    </td>

                    {/* Patient Column (Neutral Initials Avatar, Strong Name, Subdued ID) */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(apt)}
                            className="font-medium text-slate-900 hover:text-blue-700 text-left truncate block text-sm"
                          >
                            {apt.patientName}
                          </button>
                          <div className="text-[13px] text-slate-500 font-mono">
                            ID: {apt.patientId}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Doctor Column (Prominent Name, Secondary Department) */}
                    <td className="py-2.5 px-4">
                      <div>
                        <span className="font-medium text-slate-900 block text-sm">{apt.doctorName}</span>
                        <span className="text-[13px] text-slate-500 block">{apt.doctorSpecialty}</span>
                      </div>
                    </td>

                    {/* Date & Time (Easy Scanning) */}
                    <td className="py-2.5 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 text-slate-900 font-medium text-sm">
                          <CalendarIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{formatDateDisplay(apt.date)}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-slate-500 text-[13px]">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{apt.time}</span>
                        </div>
                      </div>
                    </td>

                    {/* Type Column (Simple Text or Subtle Labels) */}
                    <td className="py-2.5 px-4">
                      {apt.type === 'Scheduled' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          Scheduled
                        </span>
                      )}
                      {apt.type === 'Walk-in' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                          Walk-in
                        </span>
                      )}
                      {apt.type === 'Follow-up' && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-700 border border-teal-200">
                          Follow-up
                        </span>
                      )}
                    </td>

                    {/* Status Column (Subtle status styling, NO gradients) */}
                    <td className="py-2.5 px-4">
                      {apt.status === 'Confirmed' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                          <span>Confirmed</span>
                        </span>
                      )}
                      {apt.status === 'Checked-In' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 inline-block" />
                          <span>Checked-In</span>
                        </span>
                      )}
                      {apt.status === 'Completed' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                          <span>Completed</span>
                        </span>
                      )}
                      {apt.status === 'Pending' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 inline-block" />
                          <span>Pending</span>
                        </span>
                      )}
                      {apt.status === 'Cancelled' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                          <span>Cancelled</span>
                        </span>
                      )}
                      {apt.status === 'No-Show' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block" />
                          <span>No-Show</span>
                        </span>
                      )}
                    </td>

                    {/* Queue Column (Subtle Monospace) */}
                    <td className="py-2.5 px-4 font-mono">
                      {apt.queueNumber ? (
                        <span className="font-mono text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          {apt.queueNumber}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </td>

                    {/* Actions Column (Compact enterprise buttons) */}
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(apt)}
                          title="View Details"
                          className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {apt.status === 'Pending' && (
                          <button
                            type="button"
                            onClick={() => openConfirmAction(apt, 'confirm')}
                            title="Confirm Appointment"
                            className="p-1 text-emerald-600 hover:text-emerald-800 rounded hover:bg-emerald-50 transition-colors cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {(apt.status === 'Pending' || apt.status === 'Confirmed') && !apt.archivedAt && (
                          <button
                            type="button"
                            onClick={() => openConfirmAction(apt, 'cancel')}
                            title="Cancel Appointment"
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {apt.archivedAt ? (
                          <button
                            type="button"
                            onClick={() => openConfirmAction(apt, 'restore')}
                            title="Ibalik mula sa Archive"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded transition-colors cursor-pointer"
                          >
                            <ArchiveRestore className="w-3.5 h-3.5" />
                            <span>Ibalik</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openConfirmAction(apt, 'archive')}
                            title="I-archive ang appointment"
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded transition-colors cursor-pointer"
                          >
                            <Archive className="w-3.5 h-3.5" />
                            <span>I-archive</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Empty State */}
        {loadError && <div role="alert" className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError} <button type="button" onClick={loadAppointments} className="font-semibold underline">Retry</button></div>}
        {!loading && !loadError && filteredAppointments.length === 0 && (
          <div className="text-center py-10 text-sm">
            <CalendarIcon className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-medium text-slate-700 text-sm">No appointments found</p>
            <p className="text-slate-500 mt-0.5 text-[13px]">Try adjusting your search query or filters</p>
          </div>
        )}
        <PaginationControls page={page} totalPages={totalPages} total={totalAppointments} pageSize={pageSize} loading={loading} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </div>

      {/* ── APPOINTMENT DETAILS DIALOG (Restrained Hospital Clinical Sheet) ── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Appointment Encounter Details
            </DialogTitle>
          </DialogHeader>

          {selectedAppointment && (
            <div className="space-y-4 py-2 text-sm">
              {/* Header Info */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-semibold text-slate-900">
                      {selectedAppointment.appointmentNumber}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {selectedAppointment.type}
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-500 mt-0.5">
                    Registration Reference #{selectedAppointment.id}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {selectedAppointment.queueNumber && (
                    <div className="text-right">
                      <span className="text-xs text-slate-500 block uppercase font-medium">Triage Queue</span>
                      <span className="font-mono text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded inline-block">
                        {selectedAppointment.queueNumber}
                      </span>
                    </div>
                  )}

                  <div>
                    {selectedAppointment.status === 'Confirmed' && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                        <span>Confirmed</span>
                      </span>
                    )}
                    {selectedAppointment.status === 'Checked-In' && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-teal-600 inline-block" />
                        <span>Checked-In</span>
                      </span>
                    )}
                    {selectedAppointment.status === 'Completed' && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600 inline-block" />
                        <span>Completed</span>
                      </span>
                    )}
                    {selectedAppointment.status === 'Pending' && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600 inline-block" />
                        <span>Pending</span>
                      </span>
                    )}
                    {selectedAppointment.status === 'Cancelled' && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                        <span>Cancelled</span>
                      </span>
                    )}
                    {selectedAppointment.status === 'No-Show' && (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block" />
                        <span>No-Show</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Patient Information */}
              <div className="space-y-2">
                <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                  Patient Information
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium text-sm flex items-center justify-center shrink-0">
                      {getInitials(selectedAppointment.patientName)}
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{selectedAppointment.patientName}</p>
                      <p className="text-[13px] text-slate-500 font-mono">Patient Record ID: {selectedAppointment.patientId}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Doctor Information */}
              <div className="space-y-2">
                <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                  Assigned Attending Physician
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{selectedAppointment.doctorName}</p>
                      <p className="text-[13px] text-slate-500">Department: {selectedAppointment.doctorSpecialty}</p>
                    </div>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white border border-slate-200 text-slate-600">
                      {selectedAppointment.doctorSpecialty === 'Cardiology' ? 'Room 204 • Heart Center' : 'Room 108 • Pediatric Wing'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Schedule Details */}
              <div className="space-y-2">
                <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                  Appointment Schedule
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded p-3 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-500 block text-xs">Encounter Date</span>
                    <span className="font-medium text-slate-900 text-sm">
                      {new Date(selectedAppointment.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-xs">Slot Time</span>
                    <span className="font-medium text-slate-900 text-sm">
                      {selectedAppointment.time}
                    </span>
                  </div>
                </div>
              </div>

              {/* Clinical Reason for Visit */}
              <div className="space-y-2">
                <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                  Reason for Visit & Notes
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  <p className="text-slate-700 leading-normal text-sm">{selectedAppointment.reason}</p>
                </div>
              </div>

              {/* Timeline (if present) */}
              {(selectedAppointment.checkedInAt || selectedAppointment.completedAt) && (
                <div className="space-y-2">
                  <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                    Encounter Milestones
                  </h3>
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5 font-mono text-xs">
                    {selectedAppointment.checkedInAt && (
                      <div className="flex items-center space-x-2 text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Checked In: {selectedAppointment.checkedInAt}</span>
                      </div>
                    )}
                    {selectedAppointment.completedAt && (
                      <div className="flex items-center space-x-2 text-slate-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Completed: {selectedAppointment.completedAt}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div className="flex items-center space-x-2">
                  {selectedAppointment.status === 'Pending' && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openConfirmAction(selectedAppointment, 'confirm')}
                      className="h-8 text-sm bg-slate-900 hover:bg-slate-800 text-white font-medium cursor-pointer"
                    >
                      Confirm Appointment
                    </Button>
                  )}
                  {(selectedAppointment.status === 'Pending' || selectedAppointment.status === 'Confirmed') && !selectedAppointment.archivedAt && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openConfirmAction(selectedAppointment, 'cancel')}
                      className="h-8 text-sm text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 cursor-pointer"
                    >
                      Cancel Appointment
                    </Button>
                  )}
                  {selectedAppointment.archivedAt ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openConfirmAction(selectedAppointment, 'restore')}
                      className="h-8 text-sm text-teal-800 border-teal-200 hover:bg-teal-50 cursor-pointer"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5 mr-1.5" />
                      Ibalik sa Aktibo
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openConfirmAction(selectedAppointment, 'archive')}
                      className="h-8 text-sm text-amber-800 border-amber-200 hover:bg-amber-50 cursor-pointer"
                    >
                      <Archive className="w-3.5 h-3.5 mr-1.5" />
                      I-archive
                    </Button>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDetailsOpen(false)}
                  className="h-8 text-sm"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── APPOINTMENT ACTION CONFIRMATION MODAL (Yes or No) ────────── */}
      <Dialog open={!!confirmModal?.open} onOpenChange={(open) => !open && setConfirmModal(null)}>
        <DialogContent className="max-w-md bg-white border border-slate-300 rounded-xl p-6 shadow-2xl">
          <div className="flex items-start space-x-3.5">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
              confirmModal?.type === 'confirm' || confirmModal?.type === 'restore'
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                : confirmModal?.type === 'archive'
                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                : 'bg-red-100 text-red-600 border border-red-200'
            }`}>
              {confirmModal?.type === 'confirm' ? (
                <Check className="w-5 h-5" />
              ) : confirmModal?.type === 'archive' ? (
                <Archive className="w-5 h-5" />
              ) : confirmModal?.type === 'restore' ? (
                <ArchiveRestore className="w-5 h-5" />
              ) : (
                <Ban className="w-5 h-5" />
              )}
            </div>
            <div className="space-y-1.5 min-w-0">
              <h3 className="text-base font-bold text-slate-900">
                {confirmModal?.type === 'confirm'
                  ? 'Kumpirmahin ang Appointment (Yes / No)'
                  : confirmModal?.type === 'archive'
                  ? 'I-archive ang Appointment? (Yes / No)'
                  : confirmModal?.type === 'restore'
                  ? 'Ibalik sa Aktibo? (Yes / No)'
                  : 'Kanselahin ang Appointment (Yes / No)'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {confirmModal?.type === 'confirm' ? (
                  <>
                    Nais mo bang kumpirmahin ang appointment ni <strong className="text-slate-900">{confirmModal?.appointment.patientName}</strong> kay {confirmModal?.appointment.doctorName} sa {confirmModal?.appointment.date} ({confirmModal?.appointment.time})?
                  </>
                ) : confirmModal?.type === 'archive' ? (
                  <>
                    Sigurado ka bang nais mong i-archive ang appointment <strong className="text-slate-900">{confirmModal?.appointment.appointmentNumber}</strong> para kay {confirmModal?.appointment.patientName}? Mawawala ito sa active list pero mananatili sa Archive tab.
                  </>
                ) : confirmModal?.type === 'restore' ? (
                  <>
                    Nais mo bang ibalik sa active list ang appointment <strong className="text-slate-900">{confirmModal?.appointment.appointmentNumber}</strong> para kay {confirmModal?.appointment.patientName}?
                  </>
                ) : (
                  <>
                    Sigurado ka bang nais mong kanselahin ang appointment <strong className="text-slate-900">{confirmModal?.appointment.appointmentNumber}</strong> para kay {confirmModal?.appointment.patientName}?
                  </>
                )}
              </p>
            </div>
          </div>
          {confirmModal?.type === 'cancel' && <label className="mt-4 block text-xs font-medium text-slate-700">Cancellation reason<textarea value={cancellationReason} onChange={(event) => setCancellationReason(event.target.value)} rows={3} maxLength={300} className="mt-1.5 w-full rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Required for the audit trail and patient history" /></label>}
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessing}
              onClick={() => setConfirmModal(null)}
              className="h-8 px-3.5 text-xs font-medium cursor-pointer"
            >
              Hindi (No)
            </Button>
            <Button
              type="button"
              disabled={isProcessing || (confirmModal?.type === 'cancel' && cancellationReason.trim().length < 3)}
              onClick={executeConfirmAction}
              className={`h-8 px-4 text-xs font-semibold text-white cursor-pointer shadow-xs disabled:opacity-50 ${
                confirmModal?.type === 'confirm' || confirmModal?.type === 'restore'
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : confirmModal?.type === 'archive'
                  ? 'bg-amber-700 hover:bg-amber-800'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {confirmModal?.type === 'confirm'
                ? 'Oo, Kumpirmahin (Yes)'
                : confirmModal?.type === 'archive'
                ? 'Oo, I-archive (Yes)'
                : confirmModal?.type === 'restore'
                ? 'Oo, Ibalik (Yes)'
                : 'Oo, Kanselahin (Yes)'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── LOADING MODAL ────────────────────────────────────────────── */}
      <Dialog open={isProcessing} onOpenChange={() => {}}>
        <DialogContent className="max-w-xs bg-white border border-slate-200 rounded-xl p-6 shadow-2xl text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-slate-800 animate-spin" />
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-slate-900">
                Pinoproseso ang Kahilingan...
              </h4>
              <p className="text-xs text-slate-500">
                {processingText}
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
