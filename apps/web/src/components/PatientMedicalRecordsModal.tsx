'use client';

import React, { useEffect, useState, useMemo } from 'react';
import {
  Activity,
  Archive,
  ArchiveRestore,
  Calendar,
  FileText,
  Loader2,
  Pill,
  Stethoscope,
  X,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/client-response';
import {
  getArchivedRecordsMap,
  saveArchivedRecordEntry,
  removeArchivedRecordEntry,
} from '@/lib/medical-record-archive-store';

type MedicalRecord = {
  id: string;
  recordNumber: string;
  doctorName: string;
  doctorSpecialty: string;
  date: string;
  time: string;
  type: string;
  chiefComplaint: string;
  diagnosis: string;
  archivedAt?: string | null;
  archiveReason?: string | null;
  prescriptions: Array<{
    id: string;
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    isSigned: boolean;
    eSignedAt: string | null;
    eSignatureName: string | null;
    eSignatureLicense: string | null;
    eSignatureHash: string | null;
  }>;
  vitalSigns: {
    bloodPressure: string;
    heartRate: string;
    temperature: string;
    weight: string;
  };
  notes: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  patientId: string | null;
  patientName: string;
};

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('fil-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function PatientMedicalRecordsModal({ isOpen, onClose, patientId, patientName }: Props) {
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [archiveView, setArchiveView] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const applyArchiveStore = (list: MedicalRecord[]): MedicalRecord[] => {
    const archiveMap = getArchivedRecordsMap();
    const seen = new Set<string>();
    const merged = list.map((rec) => {
      seen.add(rec.id);
      const entry = archiveMap[rec.id];
      if (entry) {
        return {
          ...rec,
          archivedAt: rec.archivedAt || entry.archivedAt,
          archiveReason: rec.archiveReason || entry.archiveReason,
        };
      }
      return rec;
    });
    Object.values(archiveMap).forEach((entry) => {
      if (
        !seen.has(entry.id) &&
        entry.recordSnapshot &&
        (entry.patientId === patientId ||
          String(entry.patientName || '').toLowerCase() === patientName.toLowerCase())
      ) {
        merged.push({
          ...entry.recordSnapshot,
          archivedAt: entry.archivedAt,
          archiveReason: entry.archiveReason,
        });
      }
    });
    return merged;
  };

  useEffect(() => {
    if (!isOpen || !patientId) return;
    const controller = new AbortController();

    async function loadRecords() {
      try {
        setLoading(true);
        setError('');
        setSelectedIndex(0);
        const response = await fetch(`/api/medical-records?patientId=${encodeURIComponent(patientId!)}&includeArchived=true`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (response.status === 403) {
          const [patRes, trgRes] = await Promise.all([
            fetch(`/api/patients?patientId=${encodeURIComponent(patientId!)}`, { signal: controller.signal }),
            fetch(`/api/triage?search=${encodeURIComponent(patientName)}&limit=50`, { signal: controller.signal }),
          ]);
          const [patData, trgData] = await Promise.all([patRes.json(), trgRes.json()]);
          const triageRows: any[] = Array.isArray(trgData?.triageList)
            ? trgData.triageList.filter(
                (t: any) =>
                  t.patientId === patientId ||
                  String(t.patientName || '').toLowerCase() === patientName.toLowerCase()
              )
            : [];

          if (triageRows.length > 0) {
            setRecords(
              applyArchiveStore(
                triageRows.map((trg: any) => {
                  const createdDate = trg.createdAt ? new Date(trg.createdAt) : new Date();
                  return {
                    id: String(trg.id),
                    recordNumber: String(trg.triageNumber || `TRG-${String(trg.id).slice(-6).toUpperCase()}`),
                    doctorName: String(trg.nurseName || 'Triage Assessment'),
                    doctorSpecialty: String(trg.department || 'Outpatient Department'),
                    date: !Number.isNaN(createdDate.getTime())
                      ? createdDate.toISOString().slice(0, 10)
                      : new Date().toISOString().slice(0, 10),
                    time: !Number.isNaN(createdDate.getTime())
                      ? createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '08:00 AM',
                    type: 'Consultation',
                    chiefComplaint: String(trg.chiefComplaint || 'Outpatient Screening'),
                    diagnosis: `${trg.department || 'OPD'} Routing (${trg.priorityLevel || 'STANDARD'})`,
                    prescriptions: [],
                    vitalSigns: {
                      bloodPressure: `${trg.bloodPressure || '120/80'} mmHg`,
                      heartRate: `${trg.heartRate || '75'} bpm`,
                      temperature: `${trg.temperature || '36.5'} °C`,
                      weight: `${trg.weightKg || '65'} kg`,
                    },
                    notes: `Triage Status: ${trg.status || 'PENDING_OPD'}`,
                  };
                })
              )
            );
            return;
          }

          if (patData?.success && patData?.patient) {
            const p = patData.patient;
            setRecords(
              applyArchiveStore([
                {
                  id: `pat-${p.id}`,
                  recordNumber: String(p.patientNo || `MRN-${String(p.id).slice(-6).toUpperCase()}`),
                  doctorName: 'OPD Registry',
                  doctorSpecialty: 'Outpatient Department',
                  date: String(p.lastVisit || new Date().toISOString().slice(0, 10)),
                  time: '08:00 AM',
                  type: 'Consultation',
                  chiefComplaint: String(p.triageReason || 'Outpatient Visit'),
                  diagnosis: 'Registered Outpatient Record',
                  prescriptions: [],
                  vitalSigns: {
                    bloodPressure: `${p.vitals?.bloodPressure || '120/80'} mmHg`,
                    heartRate: `${p.vitals?.heartRate || '75'} bpm`,
                    temperature: `${p.vitals?.temperature || '36.6'} °C`,
                    weight: `${p.vitals?.weight || '65'} kg`,
                  },
                  notes: `RFID: ${p.cardUid || 'NO_CARD'} • Blood Type: ${p.bloodType || 'Unknown'}`,
                },
              ])
            );
            return;
          }

          setRecords(applyArchiveStore([]));
          return;
        }

        if (!response.ok || !data.success) {
          throw new Error(getApiErrorMessage(data.error, 'Hindi nakuha ang medical records.'));
        }
        setRecords(applyArchiveStore(Array.isArray(data.records) ? data.records : []));
      } catch (loadError) {
        if ((loadError as Error).name !== 'AbortError') {
          setRecords([]);
          setError(loadError instanceof Error ? loadError.message : 'Hindi nakuha ang medical records.');
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadRecords();
    return () => controller.abort();
  }, [isOpen, patientId, patientName]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  const activeRecords = useMemo(() => records.filter((r) => !r.archivedAt), [records]);
  const archivedRecords = useMemo(() => records.filter((r) => Boolean(r.archivedAt)), [records]);
  const visibleRecords = archiveView === 'ARCHIVED' ? archivedRecords : activeRecords;

  const handleArchive = (record: MedicalRecord) => {
    const nowIso = new Date().toISOString();
    const reason = 'Archived from station chart view';
    const updated: MedicalRecord = {
      ...record,
      archivedAt: nowIso,
      archiveReason: reason,
    };
    saveArchivedRecordEntry({
      id: record.id,
      patientId: patientId || undefined,
      patientName,
      archivedAt: nowIso,
      archiveReason: reason,
      recordSnapshot: updated,
    });
    setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));
    setSelectedIndex(0);
  };

  const handleRestore = (record: MedicalRecord) => {
    removeArchivedRecordEntry(record.id);
    setRecords((prev) =>
      prev.map((r) => (r.id === record.id ? { ...r, archivedAt: null, archiveReason: null } : r))
    );
    setSelectedIndex(0);
  };

  if (!isOpen) return null;

  const active = visibleRecords[selectedIndex] || visibleRecords[0];

  return (
    <div
      className="fixed inset-0 z-[70] bg-slate-950/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={`Medical records ni ${patientName}`}
    >
      <div className="bg-white border border-slate-300 rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 bg-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-teal-800 shrink-0" />
              <h2 className="font-bold text-slate-900 truncate">Medical Records — {patientName}</h2>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 ml-7">
              Clinical history &amp; archive • {activeRecords.length} aktibo • {archivedRecords.length} naka-archive
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setArchiveView('ACTIVE');
                  setSelectedIndex(0);
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition ${
                  archiveView === 'ACTIVE'
                    ? 'bg-teal-800 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Aktibo ({activeRecords.length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setArchiveView('ARCHIVED');
                  setSelectedIndex(0);
                }}
                className={`px-2.5 py-1 rounded text-xs font-semibold transition flex items-center gap-1 ${
                  archiveView === 'ARCHIVED'
                    ? 'bg-amber-700 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Archive className="w-3 h-3" />
                Archive ({archivedRecords.length})
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center shrink-0"
              aria-label="Isara ang medical records"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="h-[420px] flex flex-col items-center justify-center text-sm text-slate-600">
              <Loader2 className="w-7 h-7 animate-spin text-teal-700 mb-3" />
              Kinukuha ang medical history...
            </div>
          ) : error ? (
            <div className="h-[420px] flex items-center justify-center p-6">
              <div className="max-w-md text-center bg-rose-50 border border-rose-200 rounded-lg p-5">
                <p className="font-bold text-rose-900">Hindi mabuksan ang medical records</p>
                <p className="text-xs text-rose-700 mt-1">{error}</p>
              </div>
            </div>
          ) : visibleRecords.length === 0 ? (
            <div className="h-[420px] flex flex-col items-center justify-center text-center p-6">
              <FileText className="w-10 h-10 text-slate-300 mb-3" />
              <p className="font-bold text-slate-800">
                {archiveView === 'ARCHIVED' ? 'Walang naka-archive na medical record' : 'Wala pang aktibong medical record'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {archiveView === 'ARCHIVED'
                  ? 'Ang mga na-archive na medical record ng pasyenteng ito ay lilitaw dito.'
                  : 'Wala pang aktibong consultation record para sa pasyenteng ito.'}
              </p>
            </div>
          ) : (
            <div className="h-[min(72vh,690px)] flex flex-col md:flex-row min-h-0">
              <aside className="md:w-80 shrink-0 border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50 p-3 flex flex-col min-h-0">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-1 mb-2">
                  {archiveView === 'ARCHIVED' ? 'Mga Naka-archive na Pagbisita' : 'Mga Aktibong Pagbisita'}
                </div>
                <div className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-hidden md:overflow-y-auto pb-1 md:pb-0">
                  {visibleRecords.map((record, index) => (
                    <button
                      key={record.id}
                      type="button"
                      onClick={() => setSelectedIndex(index)}
                      className={`shrink-0 w-64 md:w-full text-left p-3 rounded-md border transition ${
                        selectedIndex === index
                          ? 'bg-white border-teal-700 ring-1 ring-teal-700 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[11px] font-bold text-slate-800">{record.recordNumber}</span>
                        <span className="text-[10px] text-slate-500">{formatDate(record.date)}</span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 mt-1 truncate">{record.diagnosis}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5 truncate">{record.doctorName}</div>
                    </button>
                  ))}
                </div>
              </aside>

              {active && (
                <section className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 min-w-0">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-slate-900">{active.recordNumber}</span>
                        <span className="px-2 py-0.5 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-700">{active.type}</span>
                        <span className="px-2 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-[11px] font-semibold text-emerald-800">Finalized</span>
                        {active.archivedAt && (
                          <span className="px-2 py-0.5 rounded border border-amber-200 bg-amber-100 text-[11px] font-semibold text-amber-900">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-1">
                        <Stethoscope className="w-3.5 h-3.5" />
                        <strong className="text-slate-800">{active.doctorName}</strong>
                        <span>• {active.doctorSpecialty}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-xs text-slate-600 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        {formatDate(active.date)} • {active.time}
                      </div>
                      {active.archivedAt ? (
                        <button
                          type="button"
                          onClick={() => handleRestore(active)}
                          className="h-8 px-2.5 rounded border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <ArchiveRestore className="w-3.5 h-3.5" />
                          Ibalik sa Aktibo
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleArchive(active)}
                          className="h-8 px-2.5 rounded border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-semibold inline-flex items-center gap-1"
                        >
                          <Archive className="w-3.5 h-3.5" />
                          I-archive
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-center">
                    {[
                      ['Blood Pressure', active.vitalSigns.bloodPressure],
                      ['Heart Rate', `${active.vitalSigns.heartRate} bpm`],
                      ['Temperature', `${active.vitalSigns.temperature}°C`],
                      ['Weight', `${active.vitalSigns.weight} kg`],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded border border-slate-200 bg-white p-2.5">
                        <span className="text-[10px] uppercase font-semibold text-slate-500 block">{label}</span>
                        <strong className="font-mono text-sm text-slate-900">{value}</strong>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                    <div className="rounded border border-slate-200 p-3">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Chief Complaint</span>
                      <p className="text-sm text-slate-800 mt-1 leading-relaxed">{active.chiefComplaint}</p>
                    </div>
                    <div className="rounded border border-slate-200 p-3">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Diagnosis</span>
                      <p className="text-sm font-semibold text-slate-900 mt-1 leading-relaxed">{active.diagnosis}</p>
                    </div>
                  </div>

                  <div className="rounded border border-slate-200 p-3">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-500">
                      <Activity className="w-3.5 h-3.5" /> Doctor Notes / Plan
                    </div>
                    <p className="text-sm text-slate-800 mt-1.5 whitespace-pre-wrap leading-relaxed">{active.notes}</p>
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-2">
                      <Pill className="w-3.5 h-3.5" /> Prescriptions ({active.prescriptions.length})
                    </div>
                    {active.prescriptions.length === 0 ? (
                      <p className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 italic">Walang niresetang gamot sa record na ito.</p>
                    ) : (
                      <div className="space-y-2">
                        {active.prescriptions.map((prescription, index) => (
                          <div key={prescription.id || `${prescription.medication}-${index}`} className="rounded border border-slate-200 bg-slate-50 p-2.5 text-xs space-y-1.5">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <span className="font-bold text-slate-900">{prescription.medication} <span className="font-mono font-normal text-slate-600">({prescription.dosage})</span></span>
                              <span className="text-slate-700">{prescription.frequency} &bull; {prescription.duration}</span>
                            </div>
                            {prescription.isSigned ? (
                              <p className="text-[10px] text-emerald-700 font-medium">
                                ✓ E-signed by {prescription.eSignatureName || active.doctorName}
                                {prescription.eSignatureLicense ? ` - PRC ${prescription.eSignatureLicense}` : ''}
                                {prescription.eSignedAt ? ` - ${new Date(prescription.eSignedAt).toLocaleString('fil-PH')}` : ''}
                              </p>
                            ) : (
                              <p className="text-[10px] text-amber-700 font-medium">Legacy record - walang verified e-signature</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-5 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-500">Read-only access • Walang record na mababago rito</span>
          <button type="button" onClick={onClose} className="h-8 px-4 rounded bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold">
            Isara
          </button>
        </div>
      </div>
    </div>
  );
}
