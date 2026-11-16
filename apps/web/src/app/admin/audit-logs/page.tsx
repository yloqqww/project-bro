'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Calendar, Filter, Download, Search, Shield, CheckCircle2 } from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  targetType: string;
  targetId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  station: string;
}

interface InvestigationSignals {
  failedLogins: Array<{ actorEmail: string | null; attempts: number }>;
  sensitiveAccess: Array<{ actorEmail: string | null; views: number }>;
  sharedSourceIps: Array<{ ipAddress: string | null; events: number; actors: number }>;
  sessionRevocations: number;
}

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionFilter, setActionFilter] = useState('ALL');
  const today = new Date().toISOString().split('T')[0];
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [searchQuery, setSearchQuery] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Not loaded');
  const [investigation, setInvestigation] = useState<InvestigationSignals | null>(null);
  const [investigationLoading, setInvestigationLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        setError('');
        const params = new URLSearchParams({ page: String(page), pageSize: '25', from: dateFrom, to: dateTo });
        if (actionFilter !== 'ALL') params.set('action', actionFilter);
        if (searchQuery.trim()) params.set('search', searchQuery.trim());
        const response = await fetch(`/api/admin/audit-logs?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Failed to load audit logs.');
        setLogs(data.logs || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotal(data.pagination?.total || 0);
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') setError(loadError instanceof Error ? loadError.message : 'Failed to load audit logs.');
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [page, actionFilter, dateFrom, dateTo, searchQuery]);

  const filteredLogs = logs;

  const handleExport = () => {
    const headers = ['Timestamp', 'Actor', 'Role', 'Action', 'Target_Type', 'Target_ID', 'Summary', 'IP', 'Device', 'Metadata'];
    const rows = filteredLogs.map(log => 
      [log.timestamp, log.actor, log.role, log.action, log.targetType, log.targetId || '', log.target, log.ipAddress || '', log.userAgent || '', JSON.stringify(log.metadata)].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')
    );
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `laguna-medical-center-audit-trail-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setShowToast(true);
    setTimeout(() => setShowToast(false), 3200);
  };

  const loadInvestigation = async () => {
    try {
      setInvestigationLoading(true);
      setError('');
      const response = await fetch('/api/admin/audit-logs?mode=investigation', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to generate investigation signals.');
      setInvestigation(data.signals);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to generate investigation signals.');
    } finally {
      setInvestigationLoading(false);
    }
  };

  const renderActionBadge = (action: string) => {
    switch (action) {
      case 'RFID_SCAN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-50 text-teal-800 border border-teal-200">
            RFID Scan
          </span>
        );
      case 'RECORD_VIEW':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Record View
          </span>
        );
      case 'RECORD_UPDATE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
            Record Update
          </span>
        );
      case 'CONFIG_CHANGE':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200">
            Config Change
          </span>
        );
      case 'LOGIN':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            Login
          </span>
        );
      case 'CARD_REVOKED':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-800 border border-red-200">
            Card Revoked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {action}
          </span>
        );
    }
  };

  const renderRoleLabel = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return (
          <span className="inline-block text-[11px] font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
            ADMIN
          </span>
        );
      case 'DOCTOR':
        return (
          <span className="inline-block text-[11px] font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
            DOCTOR
          </span>
        );
      case 'RECEPTIONIST':
        return (
          <span className="inline-block text-[11px] font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
            OPD
          </span>
        );
      case 'NURSE':
        return (
          <span className="inline-block text-[11px] font-mono font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
            TRIAGE
          </span>
        );
      default:
        return (
          <span className="inline-block text-[11px] font-mono font-medium text-slate-500">
            {role}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4">
      {/* Toast Notification for Export */}
      {showToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center space-x-2.5 px-4 py-2.5 bg-slate-900 border border-slate-700 text-white rounded text-xs font-medium shadow-md transition-opacity">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Audit trail CSV successfully generated and downloaded.</span>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Audit Trail</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">Complete system activity logs for compliance and security</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={loadInvestigation}
            variant="outline"
            disabled={investigationLoading}
            className="text-sm font-medium px-3 py-1.5 h-8 rounded"
          >
            <Shield className="mr-1.5 h-4 w-4" />
            {investigationLoading ? 'Analyzing...' : '24h Investigation'}
          </Button>
          <Button
            onClick={handleExport}
            className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-3 py-1.5 h-8 rounded shadow-2xs inline-flex items-center space-x-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Logs</span>
          </Button>
        </div>
      </div>

      {investigation ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-amber-950">Breach investigation signals - last 24 hours</h2>
              <p className="text-xs text-amber-800">Indicators require administrator review; they are not automatic breach determinations.</p>
            </div>
            <button type="button" onClick={() => setInvestigation(null)} className="text-xs font-semibold text-amber-900">Close</button>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <SignalCard title="Repeated failed logins" count={investigation.failedLogins.length} details={investigation.failedLogins.map((item) => `${item.actorEmail || 'Unknown'}: ${item.attempts}`)} />
            <SignalCard title="High-volume record access" count={investigation.sensitiveAccess.length} details={investigation.sensitiveAccess.map((item) => `${item.actorEmail || 'Unknown'}: ${item.views}`)} />
            <SignalCard title="Shared source IPs" count={investigation.sharedSourceIps.length} details={investigation.sharedSourceIps.map((item) => `${item.ipAddress || 'Unknown'}: ${item.actors} actors`)} />
            <SignalCard title="Session revocations" count={investigation.sessionRevocations} details={[]} />
          </div>
        </div>
      ) : null}

      {/* Data Privacy Compliance Notice */}
      <div className="bg-slate-50 border border-slate-200 rounded p-3 text-slate-700 flex items-start space-x-3">
        <Shield className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <h2 className="text-sm font-semibold text-slate-900">Data Privacy Compliance</h2>
          <p className="text-[13px] text-slate-600 leading-normal">
            This audit trail is maintained for compliance with the <strong>Data Privacy Act (RA 10173)</strong>. 
            All access to patient records, RFID scans, and system configurations are permanently logged with 
            timestamps, actor identity, and IP addresses for security and accountability purposes.
          </p>
        </div>
      </div>

      {/* Log Control Bar */}
      <div className="bg-white border border-slate-200 rounded p-3 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left Controls: Filter & Search */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Search Input */}
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search actor or target..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 h-8 text-sm bg-white border border-slate-300 rounded text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:border-slate-500"
              />
            </div>

            {/* Action Select */}
            <div className="min-w-[140px]">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full h-8 px-2.5 text-sm bg-white border border-slate-300 rounded text-slate-900 focus:outline-hidden focus:border-slate-500"
              >
                <option value="ALL">All Actions</option>
                <option value="LOGIN_SUCCESS">Login Success</option>
                <option value="LOGIN_FAILURE">Login Failure</option>
                <option value="LOGOUT">Logout</option>
                <option value="PATIENT_RECORD_VIEW">Patient Record View</option>
                <option value="PATIENT_RECORD_CREATE">Patient Record Create</option>
                <option value="PATIENT_RECORD_UPDATE">Patient Record Update</option>
                <option value="PATIENT_RECORD_DELETE">Patient Record Delete</option>
                <option value="PRESCRIPTION_ISSUED">Prescription Issued</option>
                <option value="PRESCRIPTION_CANCELLED">Prescription Cancelled</option>
                <option value="APPOINTMENT_STATUS_CHANGE">Appointment Status</option>
                <option value="QUEUE_STATUS_CHANGE">Queue Status</option>
                <option value="RFID_ASSIGNED">RFID Assigned</option>
                <option value="RFID_REVOKED">RFID Revoked</option>
                <option value="STAFF_UPDATE">Staff Update</option>
                <option value="SETTINGS_UPDATE">Settings Update</option>
              </select>
            </div>

            {/* Date Range Controls */}
            <div className="flex items-center space-x-1.5 text-xs text-slate-600">
              <div className="relative">
                <Calendar className="absolute left-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="pl-7 pr-2 h-8 text-xs font-mono bg-white border border-slate-300 rounded text-slate-800 focus:outline-hidden focus:border-slate-500"
                />
              </div>
              <span className="text-slate-400 font-medium text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-2 h-8 text-xs font-mono bg-white border border-slate-300 rounded text-slate-800 focus:outline-hidden focus:border-slate-500"
              />
            </div>
          </div>

          {/* Right Status Metadata */}
          <div className="flex items-center space-x-3 text-xs text-slate-500 shrink-0 self-end md:self-center">
            <div className="flex items-center space-x-1 font-medium text-slate-700">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              <span>{total} entries found</span>
            </div>
            <span className="text-slate-300">|</span>
            <div className="font-mono text-slate-500">
              Last updated: {lastUpdated}
            </div>
          </div>
        </div>
      </div>

      {/* Primary Audit Table */}
      <div className="bg-white border border-slate-200 rounded shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                <th scope="col" className="px-4 py-2.5 w-52 whitespace-nowrap">
                  Timestamp
                </th>
                <th scope="col" className="px-4 py-2.5 w-48 whitespace-nowrap">
                  Actor & Role
                </th>
                <th scope="col" className="px-4 py-2.5 w-36 whitespace-nowrap">
                  Action
                </th>
                <th scope="col" className="px-4 py-2.5 min-w-[240px]">
                  Target / Patient
                </th>
                <th scope="col" className="px-4 py-2.5 w-64 whitespace-nowrap">
                  Station / IP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">Loading audit trail...</td></tr>
              ) : error ? (
                <tr><td colSpan={5} className="px-4 py-12 text-center text-sm text-red-700">{error}</td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-slate-500">
                    <Shield className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-medium text-slate-700">No audit records recorded yet</p>
                    <p className="text-xs text-slate-400 mt-0.5">System activities, authentication events, and patient interactions will appear here in real-time.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Timestamp */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-xs font-mono text-slate-700">
                        {log.timestamp}
                      </span>
                    </td>

                    {/* Actor & Role */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium text-slate-900 leading-tight">
                          {log.actor}
                        </div>
                        <div>
                          {renderRoleLabel(log.role)}
                        </div>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {renderActionBadge(log.action)}
                    </td>

                    {/* Target / Patient */}
                    <td className="px-4 py-3">
                      <span className="block text-sm text-slate-800 font-normal leading-normal">
                        {log.target}
                      </span>
                      <span className="mt-1 block text-[11px] font-mono text-slate-500">{log.targetType}{log.targetId ? ` / ${log.targetId}` : ''}</span>
                      <details className="mt-2 text-xs text-slate-600">
                        <summary className="cursor-pointer font-medium text-slate-700">Before/after and request details</summary>
                        <div className="mt-2 space-y-2 rounded border border-slate-200 bg-slate-50 p-2">
                          <p><strong>Device:</strong> {log.userAgent || 'Not supplied'}</p>
                          <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px]">{JSON.stringify(log.metadata, null, 2)}</pre>
                        </div>
                      </details>
                    </td>

                    {/* Station / IP */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-block text-xs font-mono text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                        {log.station}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-center justify-between rounded border border-slate-200 bg-white px-3 py-2 text-sm">
        <span className="text-slate-600">Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((value) => value - 1)}>Previous</Button>
          <Button type="button" variant="outline" disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      </div>
    </div>
  );
}

function SignalCard({ title, count, details }: { title: string; count: number; details: string[] }) {
  return (
    <div className="rounded border border-amber-200 bg-white p-3">
      <div className="text-xs font-semibold text-slate-600">{title}</div>
      <div className="mt-1 text-2xl font-bold text-slate-950">{count}</div>
      {details.length ? <div className="mt-2 max-h-24 space-y-1 overflow-auto text-[11px] text-slate-600">{details.slice(0, 10).map((item) => <div key={item}>{item}</div>)}</div> : null}
    </div>
  );
}
