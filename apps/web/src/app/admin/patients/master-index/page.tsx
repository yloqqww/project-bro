'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  CheckCircle2,
  FileClock,
  GitMerge,
  History,
  Loader2,
  MapPin,
  Merge,
  Phone,
  RefreshCw,
  UserRound,
  X,
} from 'lucide-react';
import { readJsonResponse } from '@/lib/client-response';

type PatientSummary = {
  id: string;
  mrn: string;
  name: string;
  dateOfBirth: string;
  phoneNumber: string;
  address: string;
};

type Candidate = {
  id: string;
  left: PatientSummary;
  right: PatientSummary;
  score: number;
  matchLevel: string;
  matchedOn: string[];
};

type InactivePatient = {
  id: string;
  patientNo: string;
  name: string;
  recordStatus: 'ACTIVE' | 'ARCHIVED' | 'MERGED';
  archiveReason?: string | null;
  mergedIntoId?: string | null;
};

const errorMessage = (data: any, fallback: string) =>
  typeof data?.error === 'string' ? data.error : data?.error?.message || fallback;

export default function PatientMasterIndexPage() {
  const [activeTab, setActiveTab] = useState<'duplicates' | 'archived'>('duplicates');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [inactive, setInactive] = useState<InactivePatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Merge confirm modal state (pre-filled reason so 1-click works)
  const [mergeConfirm, setMergeConfirm] = useState<{
    source: PatientSummary;
    target: PatientSummary;
  } | null>(null);
  const [mergeReason, setMergeReason] = useState('Pinagsama ang magkaparehong record ng pasyente');

  // History drawer/modal state (click directly from any row—no MRN typing needed)
  const [historyModal, setHistoryModal] = useState<{
    open: boolean;
    loading: boolean;
    patientName: string;
    patient: any | null;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [candidateResponse, patientResponse] = await Promise.all([
        fetch('/api/admin/patients/master-index'),
        fetch('/api/patients?includeInactive=true&page=1&pageSize=100'),
      ]);
      const [candidateData, patientData] = await Promise.all([
        readJsonResponse<any>(candidateResponse),
        readJsonResponse<any>(patientResponse),
      ]);
      if (!candidateResponse.ok) throw new Error(errorMessage(candidateData, 'Hindi ma-load ang duplicate check.'));
      if (!patientResponse.ok) throw new Error(errorMessage(patientData, 'Hindi ma-load ang mga naka-archive.'));

      const nextCandidates: Candidate[] = candidateData.candidates || [];
      const nextInactive: InactivePatient[] = (patientData.patients || []).filter(
        (patient: InactivePatient) => patient.recordStatus !== 'ACTIVE'
      );

      setCandidates(nextCandidates);
      setInactive(nextInactive);

      // Default to Archived tab when there are no duplicates to merge
      setActiveTab((current) => {
        if (nextCandidates.length === 0 && nextInactive.length > 0) return 'archived';
        return current;
      });
    } catch (caught) {
      setNotice({
        type: 'error',
        text: caught instanceof Error ? caught.message : 'Hindi ma-load ang Patient Master Index.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmMerge() {
    if (!mergeConfirm) return;
    const reason = mergeReason.trim();
    if (reason.length < 10) {
      setNotice({ type: 'error', text: 'Maglagay ng maikling dahilan (hindi bababa sa 10 letra).' });
      return;
    }

    setWorking(mergeConfirm.source.id);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/patients/master-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'MERGE',
          sourcePatientId: mergeConfirm.source.id,
          targetPatientId: mergeConfirm.target.id,
          reason,
        }),
      });
      const data = await readJsonResponse<any>(response);
      if (!response.ok) throw new Error(errorMessage(data, 'Hindi napagsama ang records.'));
      setMergeConfirm(null);
      setNotice({
        type: 'success',
        text: `Pinagsama na ang record ni ${mergeConfirm.target.name} (${mergeConfirm.target.mrn}).`,
      });
      await load();
    } catch (caught) {
      setNotice({
        type: 'error',
        text: caught instanceof Error ? caught.message : 'Hindi napagsama ang records.',
      });
    } finally {
      setWorking('');
    }
  }

  async function restorePatient(patient: InactivePatient) {
    setWorking(patient.id);
    setNotice(null);
    try {
      const response = await fetch('/api/admin/patients/master-index', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESTORE',
          patientId: patient.id,
          reason: 'Ibinalik ang profile ng pasyente sa active list',
        }),
      });
      const data = await readJsonResponse<any>(response);
      if (!response.ok) throw new Error(errorMessage(data, 'Hindi naibalik ang record.'));
      setNotice({
        type: 'success',
        text: `Ibinalik na sa active list si ${patient.name} (${patient.patientNo}).`,
      });
      await load();
    } catch (caught) {
      setNotice({
        type: 'error',
        text: caught instanceof Error ? caught.message : 'Hindi naibalik ang record.',
      });
    } finally {
      setWorking('');
    }
  }

  async function openHistory(patientId: string, patientName: string) {
    setHistoryModal({ open: true, loading: true, patientName, patient: null });
    try {
      const response = await fetch(`/api/admin/patients/master-index?patientId=${patientId}`);
      const data = await readJsonResponse<any>(response);
      if (!response.ok) throw new Error(errorMessage(data, 'Hindi makuha ang history.'));
      setHistoryModal({ open: true, loading: false, patientName, patient: data.patient });
    } catch (caught) {
      setHistoryModal(null);
      setNotice({
        type: 'error',
        text: caught instanceof Error ? caught.message : 'Hindi makuha ang history.',
      });
    }
  }

  const archivedList = inactive.filter((p) => p.recordStatus === 'ARCHIVED');
  const mergedList = inactive.filter((p) => p.recordStatus === 'MERGED');

  return (
    <div className="w-full space-y-5 text-slate-900">
      {/* Simple Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ayusin ang Duplicate &amp; Archive</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pagsamahin ang nadobleng pasyente o ibalik ang mga na-archive na profile nang hindi nabubura ang history.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 self-start sm:self-auto rounded-md border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-teal-700' : 'text-slate-500'}`} />
          <span>I-refresh</span>
        </button>
      </div>

      {/* Status Notice */}
      {notice && (
        <div
          role="status"
          className={`flex items-center justify-between gap-2 rounded-lg border px-4 py-2.5 text-xs font-semibold ${
            notice.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-rose-200 bg-rose-50 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button type="button" onClick={() => setNotice(null)} className="underline text-[11px] cursor-pointer">
            Isara
          </button>
        </div>
      )}

      {/* Simple 2-Tab Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-2 shadow-2xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('duplicates')}
            className={`inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'duplicates'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <GitMerge className="h-4 w-4" />
            <span>Mga Doble ({candidates.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('archived')}
            className={`inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-xs font-bold transition cursor-pointer ${
              activeTab === 'archived'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Archive className="h-4 w-4" />
            <span>Mga Na-archive ({archivedList.length + mergedList.length})</span>
          </button>
        </div>

        <span className="px-2 text-xs text-slate-500">
          Isang pindot lang para ibalik o pagsamahin — walang mabuburang check-up.
        </span>
      </div>

      {/* TAB 1: DUPLICATES */}
      {activeTab === 'duplicates' ? (
        <section className="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
            </div>
          ) : candidates.length === 0 ? (
            <div className="p-10 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" />
              <h2 className="mt-2.5 text-sm font-bold text-slate-900">Walang Nadobleng Pasyente</h2>
              <p className="mt-1 text-xs text-slate-500">
                Malinis ang listahan — bawat pasyente ay may iisang active record lang.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 p-4 space-y-4">
              {candidates.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-lg border border-slate-200">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
                    <span className="font-bold">Posibleng Magkapareho ({item.score}% Match)</span>
                    <span>Magkatugma sa: {item.matchedOn.join(', ')}</span>
                  </div>
                  <div className="grid md:grid-cols-2">
                    {[item.left, item.right].map((patient, index) => (
                      <div
                        key={patient.id}
                        className={`p-4 ${index === 0 ? 'border-b md:border-b-0 md:border-r border-slate-200' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                              <UserRound className="h-4 w-4" />
                            </div>
                            <div>
                              <p className="font-mono text-xs font-bold text-teal-800">{patient.mrn}</p>
                              <p className="text-sm font-bold text-slate-900">{patient.name}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void openHistory(patient.id, patient.name)}
                            className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                          >
                            <History className="h-3 w-3" /> History
                          </button>
                        </div>

                        <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                          <p>Birthday: {new Date(patient.dateOfBirth).toLocaleDateString('en-PH')}</p>
                          <p className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-slate-400" />
                            {patient.phoneNumber || 'Walang number'}
                          </p>
                          <p className="flex items-start gap-1.5">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            {patient.address || 'Walang address'}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={!!working}
                          onClick={() => {
                            const source = index === 0 ? item.right : item.left;
                            const target = index === 0 ? item.left : item.right;
                            setMergeReason('Pinagsama ang magkaparehong record ng pasyente');
                            setMergeConfirm({ source, target });
                          }}
                          className="mt-4 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md bg-teal-800 px-3 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50 cursor-pointer"
                        >
                          <Merge className="h-3.5 w-3.5" />
                          Itira ito ({patient.mrn})
                        </button>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      ) : (
        /* TAB 2: ARCHIVED & MERGED */
        <section className="rounded-lg border border-slate-200 bg-white shadow-2xs overflow-hidden">
          {loading ? (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
            </div>
          ) : inactive.length === 0 ? (
            <div className="p-10 text-center">
              <Archive className="mx-auto h-8 w-8 text-slate-300" />
              <h2 className="mt-2.5 text-sm font-bold text-slate-900">Walang Naka-archive na Pasyente</h2>
              <p className="mt-1 text-xs text-slate-500">
                Lilitaw rito ang mga pasyenteng na-archive o na-merge mula sa Patient Registry.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {inactive.map((patient) => (
                <article
                  key={patient.id}
                  className="flex flex-col gap-3 px-4 py-3.5 hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-teal-800">{patient.patientNo}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          patient.recordStatus === 'ARCHIVED'
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {patient.recordStatus === 'ARCHIVED' ? 'Naka-archive' : 'Pinagsama (Merged)'}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-sm font-bold text-slate-900">{patient.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Dahilan: {patient.archiveReason || 'Walang nakalagay na dahilan'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void openHistory(patient.id, patient.name)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <History className="h-3.5 w-3.5" /> History
                    </button>

                    {patient.recordStatus === 'ARCHIVED' && (
                      <button
                        type="button"
                        disabled={working === patient.id}
                        onClick={() => void restorePatient(patient)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-teal-800 px-3.5 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50 cursor-pointer"
                      >
                        {working === patient.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <ArchiveRestore className="h-3.5 w-3.5" />
                        )}
                        Ibalik sa Active
                      </button>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Clean Merge Confirmation Modal */}
      {mergeConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Pagsamahin ang Record?</h3>
                <p className="mt-1 text-xs text-slate-600">
                  Ililipat lahat ng records mula kay <strong>{mergeConfirm.source.mrn}</strong> papunta sa permanenteng
                  profile ni <strong>{mergeConfirm.target.mrn}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMergeConfirm(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dahilan (puwede i-edit)</label>
              <input
                type="text"
                value={mergeReason}
                onChange={(e) => setMergeReason(e.target.value)}
                className="h-9 w-full rounded-md border border-slate-300 px-3 text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setMergeConfirm(null)}
                className="h-9 rounded-md border border-slate-300 px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Kanselahin
              </button>
              <button
                type="button"
                disabled={!!working}
                onClick={() => void confirmMerge()}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-teal-800 px-4 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50 cursor-pointer"
              >
                {working ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Merge className="h-3.5 w-3.5" />}
                Oo, Pagsamahin
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clean History Modal */}
      {historyModal && historyModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-3.5">
              <div>
                <h3 className="text-sm font-bold text-slate-900">History ng Pagbabago — {historyModal.patientName}</h3>
                {historyModal.patient?.mrn && (
                  <p className="font-mono text-xs text-teal-800">{historyModal.patient.mrn}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setHistoryModal(null)}
                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto p-5">
              {historyModal.loading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-teal-700" />
                </div>
              ) : historyModal.patient?.demographicChanges?.length ? (
                <div className="space-y-2.5">
                  {historyModal.patient.demographicChanges.map((change: any) => (
                    <div key={change.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                      <div className="flex items-center justify-between gap-2 font-bold text-slate-800">
                        <span>{change.changedBy?.email || change.source}</span>
                        <span className="text-[11px] font-normal text-slate-500">
                          {new Date(change.createdAt).toLocaleString('en-PH')}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-600">
                        Binago: <strong>{change.changedFields.join(', ')}</strong>
                      </p>
                      <p className="mt-0.5 text-slate-500">Dahilan: {change.reason || 'Walang nakalagay'}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-500">
                  <FileClock className="mx-auto mb-2 h-6 w-6 text-slate-300" />
                  Walang naka-record na pagbabago sa profile na ito.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
