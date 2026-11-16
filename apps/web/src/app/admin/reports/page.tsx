'use client';

import { useCallback, useEffect, useState } from 'react';
import { Download, Loader2, RefreshCw, RotateCcw } from 'lucide-react';
import { PaginationControls } from '@/components/PaginationControls';

const today = new Date().toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 8)}01`;

type ApiError = string | { message?: string };

async function readJsonResponse<T>(response: Response, label: string): Promise<T> {
  const body = await response.text();
  if (!body.trim()) {
    throw new Error(`${label} returned an empty response (HTTP ${response.status}). Please try again.`);
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`${label} returned an invalid response (HTTP ${response.status}). Please try again.`);
  }
}

function errorMessage(error: ApiError | undefined, fallback: string) {
  if (typeof error === 'string') return error;
  if (error && typeof error.message === 'string') return error.message;
  return fallback;
}

export default function ReportsPage() {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [report, setReport] = useState<any>(null);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [emailPage, setEmailPage] = useState(1);
  const [emailPages, setEmailPages] = useState(1);
  const [emailTotal, setEmailTotal] = useState(0);
  const [emailStatus, setEmailStatus] = useState('ALL');
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const emailParams = new URLSearchParams({ page: String(emailPage), pageSize: '10' });
      if (emailStatus !== 'ALL') emailParams.set('status', emailStatus);
      const [reportRes, emailRes, notificationRes] = await Promise.all([
        fetch(`/api/admin/reports?from=${from}&to=${to}`),
        fetch(`/api/admin/email-deliveries?${emailParams}`),
        fetch('/api/admin/notifications?limit=10&page=1&status=read&includeArchived=true'),
      ]);
      const [reportBody, emailBody, notificationBody] = await Promise.all([
        readJsonResponse<any>(reportRes, 'Reports API'),
        readJsonResponse<any>(emailRes, 'Email delivery API'),
        readJsonResponse<any>(notificationRes, 'Notifications API'),
      ]);
      if (!reportRes.ok) throw new Error(errorMessage(reportBody.error, 'Failed to load report.'));
      if (!emailRes.ok) throw new Error(errorMessage(emailBody.error, 'Failed to load email deliveries.'));
      if (!notificationRes.ok) throw new Error(errorMessage(notificationBody.error, 'Failed to load notification history.'));
      setReport(reportBody.report); setDeliveries(emailBody.deliveries || []); setEmailPages(emailBody.pagination?.totalPages || 1); setEmailTotal(emailBody.pagination?.total || 0); setNotifications(notificationBody.notifications || []);
    } catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Failed to load operations data.'); }
    finally { setLoading(false); }
  }, [from, to, emailPage, emailStatus]);

  useEffect(() => { void load(); }, [load]);

  const retryDelivery = async (id: string) => {
    const temporaryPassword = window.prompt('Enter a new temporary password (minimum 12 characters) for this secure retry:');
    if (!temporaryPassword) return;
    try {
      const response = await fetch('/api/admin/email-deliveries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, temporaryPassword }) });
      const data = await readJsonResponse<any>(response, 'Email retry API');
      if (!response.ok || !data.success) throw new Error(errorMessage(data.error, 'Retry failed.'));
      await load();
    } catch (retryError) { setError(retryError instanceof Error ? retryError.message : 'Retry failed.'); }
  };

  const useCurrentMonth = () => {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    setFrom(start); setTo(end);
  };

  const useCurrentYear = () => {
    const year = new Date().getUTCFullYear();
    setFrom(`${year}-01-01`); setTo(`${year}-12-31`);
  };

  return <div className="space-y-5 text-slate-800">
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 lg:flex-row lg:items-end lg:justify-between">
      <div><h1 className="text-2xl font-semibold text-slate-900">Reports & Delivery Operations</h1><p className="mt-1 text-sm text-slate-500">Date-range summaries, PDF exports, notification history, and email delivery status.</p></div>
      <div className="flex flex-wrap items-end gap-2"><label className="text-xs font-medium">From<input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 block h-9 rounded border px-2" /></label><label className="text-xs font-medium">To<input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 block h-9 rounded border px-2" /></label><button onClick={load} className="inline-flex h-9 items-center gap-1 rounded border px-3 text-sm"><RefreshCw className="h-4 w-4" />Refresh</button><a href={`/api/admin/reports/pdf?from=${from}&to=${to}`} className="inline-flex h-9 items-center gap-1 rounded bg-slate-900 px-3 text-sm font-semibold text-white"><Download className="h-4 w-4" />PDF</a></div>
    </header>
    <div className="flex flex-wrap gap-2" aria-label="Report period presets">
      <button type="button" onClick={useCurrentMonth} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium">Current month</button>
      <button type="button" onClick={useCurrentYear} className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium">Current year</button>
    </div>
    {loading && <div className="rounded border bg-white p-12 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />Loading report...</div>}
    {error && <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
    {report && !loading && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Object.entries(report.summary).map(([label, value]) => <article key={label} className="rounded border border-slate-200 bg-white p-4"><p className="text-xs uppercase tracking-wide text-slate-500">{label.replace(/([A-Z])/g, ' $1')}</p><p className="mt-2 text-2xl font-semibold">{String(value)}</p></article>)}</section>
      <section className="rounded border border-slate-200 bg-white"><div className="border-b p-4"><h2 className="font-semibold">Daily activity</h2><p className="text-xs text-slate-500">{report.range.from} to {report.range.to} · {report.timezone}</p></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Date</th><th>Appointments</th><th>Queue tickets</th><th>Encounters</th></tr></thead><tbody>{report.daily.length ? report.daily.map((row: any) => <tr key={row.date} className="border-t"><td className="p-3 font-mono">{row.date}</td><td>{row.appointments}</td><td>{row.queueTickets}</td><td>{row.encounters}</td></tr>) : <tr><td colSpan={4} className="p-8 text-center text-slate-500">No activity in this period.</td></tr>}</tbody></table></div></section>
    </>}
    <section className="rounded border border-slate-200 bg-white"><div className="flex items-center justify-between border-b p-4"><div><h2 className="font-semibold">Email delivery queue</h2><p className="text-xs text-slate-500">Sent, failed, pending, and simulated dispatch attempts.</p></div><select value={emailStatus} onChange={(e) => { setEmailStatus(e.target.value); setEmailPage(1); }} className="h-9 rounded border px-2 text-sm"><option>ALL</option><option>PENDING</option><option>SENT</option><option>FAILED</option><option>SIMULATED</option></select></div><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-slate-50 text-left"><tr><th className="p-3">Recipient</th><th>Status</th><th>Provider</th><th>Attempts</th><th>Last error</th><th>Action</th></tr></thead><tbody>{deliveries.map((item) => <tr key={item.id} className="border-t"><td className="p-3">{item.recipient}</td><td>{item.status}</td><td>{item.provider || 'Waiting'}</td><td>{item.attempts}/{item.maxAttempts}</td><td className="max-w-md truncate text-xs text-slate-500">{item.lastError || '—'}</td><td>{item.status === 'FAILED' && item.attempts < item.maxAttempts ? <button type="button" onClick={() => void retryDelivery(item.id)} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700"><RotateCcw className="h-3.5 w-3.5" />Retry</button> : '—'}</td></tr>)}</tbody></table></div><PaginationControls page={emailPage} totalPages={emailPages} total={emailTotal} pageSize={10} loading={loading} onPageChange={setEmailPage} /></section>
    <section className="rounded border border-slate-200 bg-white p-4"><h2 className="font-semibold">Notification read history</h2><div className="mt-3 space-y-2">{notifications.length ? notifications.map((item) => <div key={item.id} className="flex items-start justify-between rounded border p-3 text-sm"><div><strong>{item.title}</strong><p className="text-xs text-slate-500">{item.message}</p></div><span className="text-xs text-slate-500">{item.readAt ? new Date(item.readAt).toLocaleString() : 'Unread'}</span></div>) : <p className="text-sm text-slate-500">No read notifications retained yet.</p>}</div></section>
  </div>;
}
