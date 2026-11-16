'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Search,
  FileText,
  User,
  Users,
  Stethoscope,
  Calendar,
  Pill,
  Activity,
  Eye,
  Download,
  Plus,
  Clock,
  X as XIcon,
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  Building2,
  HeartPulse,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  History,
  Layers,
  FolderOpen,
  ShieldAlert,
  Archive,
  ArchiveRestore,
  FilePenLine,
  Paperclip,
  Printer,
  FileBadge,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApiErrorMessage, readJsonResponse } from '@/lib/client-response';
import {
  openPrintableConsultationSummary,
  openPrintableMedicalCertificate,
} from '@/lib/medical-record-print';
import {
  getArchivedRecordsMap,
  saveArchivedRecordEntry,
  removeArchivedRecordEntry,
  clearAllArchivedRecordEntries,
} from '@/lib/medical-record-archive-store';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PaginationControls } from '@/components/PaginationControls';

type MedicalRecord = {
  id: string;
  recordNumber: string;
  patientId: string;
  patientName: string;
  doctorName: string;
  doctorSpecialty: string;
  date: string;
  time: string;
  type: 'Consultation' | 'Follow-up' | 'Emergency' | 'Procedure';
  chiefComplaint: string;
  diagnosis: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  prescriptions: {
    id: string;
    medication: string;
    dosage: string;
    frequency: string;
    duration: string;
    instructions: string;
    quantity: number | null;
    prescribedDate: string;
    isActive: boolean;
    isSigned: boolean;
    eSignedAt: string | null;
    eSignatureName: string | null;
    eSignatureLicense: string | null;
    eSignatureHash: string | null;
  }[];
  vitalSigns: {
    bloodPressure: string;
    heartRate: string;
    temperature: string;
    weight: string;
  };
  notes: string;
  status: 'DRAFT' | 'FINALIZED' | 'AMENDED';
  version: number;
  parentRecordId: string | null;
  amendmentReason: string | null;
  finalizedAt: string | null;
  finalizedByName: string | null;
  contentHash: string | null;
  archivedAt: string | null;
  archiveReason: string | null;
  appointment: { id: string; appointmentDate: string; status: string; reasonForVisit: string } | null;
  queueTicket: { id: string; queueNumber: number; queueDate: string; status: string } | null;
  attachments: { id: string; fileName: string; mimeType: string; fileSize: number; checksum: string; createdAt: string }[];
};

type GroupedPatientRecord = {
  patientId: string;
  patientName: string;
  totalRecords: number;
  records: MedicalRecord[];
  latestRecord: MedicalRecord;
};

export function MedicalRecordsWorkspace({ readOnly = false }: { readOnly?: boolean }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterDoctor, setFilterDoctor] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<MedicalRecord | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [newRecordOpen, setNewRecordOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Modal states: Finalize Confirm (Yes/No), Error Modal, and Loading
  const [finalizeRecordId, setFinalizeRecordId] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<{ open: boolean; title: string; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingText, setProcessingText] = useState('Pinoproseso ang medical record...');

  // View Mode: 'grouped' (Patient Dossier) vs 'list' (Flat Encounters)
  const [viewMode, setViewMode] = useState<'grouped' | 'list'>('grouped');
  const [archiveView, setArchiveView] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [archiveModalRecord, setArchiveModalRecord] = useState<MedicalRecord | null>(null);
  const [archiveReasonInput, setArchiveReasonInput] = useState('Completed outpatient encounter / filed to archive');
  const [expandedPatientId, setExpandedPatientId] = useState<string | null>(null);

  // Full Patient Dossier Modal State (All records for 1 patient)
  const [dossierPatient, setDossierPatient] = useState<GroupedPatientRecord | null>(null);
  const [dossierOpen, setDossierOpen] = useState(false);
  const [dossierActiveIndex, setDossierActiveIndex] = useState(0);

  // Loading & Database state
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [medCertRecord, setMedCertRecord] = useState<MedicalRecord | null>(null);
  const [certPurpose, setCertPurpose] = useState('To Whom It May Concern');
  const [certDiagnosis, setCertDiagnosis] = useState('');
  const [certRecommendation, setCertRecommendation] = useState('');
  const [certRestDays, setCertRestDays] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [patientsList, setPatientsList] = useState<any[]>([]);
  const [doctorsList, setDoctorsList] = useState<any[]>([]);

  // New Record Form State
  const [newPatientName, setNewPatientName] = useState('');
  const [newPatientId, setNewPatientId] = useState('');
  const [newDoctorName, setNewDoctorName] = useState('');
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState('');
  const [newType, setNewType] = useState<'Consultation' | 'Follow-up' | 'Emergency' | 'Procedure'>('Consultation');
  const [newChiefComplaint, setNewChiefComplaint] = useState('');
  const [newDiagnosis, setNewDiagnosis] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newBp, setNewBp] = useState('');
  const [newHr, setNewHr] = useState('');
  const [newTemp, setNewTemp] = useState('');
  const [newWeight, setNewWeight] = useState('');

  // Live Database Records
  const [records, setRecords] = useState<MedicalRecord[]>([]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  const replaceRecord = (updated: MedicalRecord) => {
    setRecords((current) => current.map((record) => record.id === updated.id ? updated : record));
    setSelectedRecord((current) => current?.id === updated.id ? updated : current);
    setDossierPatient((current) => current ? {
      ...current,
      records: current.records.map((record) => record.id === updated.id ? updated : record),
      latestRecord: current.latestRecord.id === updated.id ? updated : current.latestRecord,
    } : current);
  };

  const mergeWithArchiveStore = useCallback((loaded: MedicalRecord[]): MedicalRecord[] => {
    const archiveMap = getArchivedRecordsMap();
    const seenIds = new Set<string>();
    const merged = loaded.map((rec) => {
      seenIds.add(rec.id);
      const localArch = archiveMap[rec.id];
      if (localArch) {
        return {
          ...rec,
          archivedAt: rec.archivedAt || localArch.archivedAt,
          archiveReason: rec.archiveReason || localArch.archiveReason,
        };
      }
      return rec;
    });

    Object.values(archiveMap).forEach((entry) => {
      if (!seenIds.has(entry.id) && entry.recordSnapshot) {
        merged.push({
          ...entry.recordSnapshot,
          archivedAt: entry.archivedAt,
          archiveReason: entry.archiveReason,
        });
      }
    });

    return merged;
  }, []);

  // Load Medical Records from Database API
  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize), includeArchived: 'true' });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      const res = await fetch(`/api/medical-records?${params}`);
      const data = await readJsonResponse(res);

      if (res.status === 403) {
        const patParams = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
        const trgParams = new URLSearchParams({ limit: '100' });
        if (searchQuery.trim()) {
          patParams.set('search', searchQuery.trim());
          trgParams.set('search', searchQuery.trim());
        }
        const [patRes, trgRes] = await Promise.all([
          fetch(`/api/patients?${patParams}`),
          fetch(`/api/triage?${trgParams}`),
        ]);
        const [patData, trgData] = await Promise.all([
          readJsonResponse<any>(patRes),
          readJsonResponse<any>(trgRes),
        ]);

        const triageRows: any[] = Array.isArray(trgData?.triageList) ? trgData.triageList : [];
        const patientRows: any[] = Array.isArray(patData?.patients) ? patData.patients : [];

        const mappedFromTriage: MedicalRecord[] = triageRows.map((trg: any) => {
          const createdDate = trg.createdAt ? new Date(trg.createdAt) : new Date();
          const dateStr = !Number.isNaN(createdDate.getTime())
            ? createdDate.toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10);
          const timeStr = !Number.isNaN(createdDate.getTime())
            ? createdDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '08:00 AM';

          return {
            id: String(trg.id),
            recordNumber: String(trg.triageNumber || `TRG-${String(trg.id).slice(-6).toUpperCase()}`),
            patientId: String(trg.patientId || trg.id),
            patientName: String(trg.patientName || 'Patient'),
            doctorName: String(trg.nurseName || 'Triage Assessment'),
            doctorSpecialty: String(trg.department || 'General Outpatient'),
            date: dateStr,
            time: timeStr,
            type: 'Consultation',
            chiefComplaint: String(trg.chiefComplaint || 'Outpatient Screening'),
            diagnosis: `${trg.department || 'OPD'} Routing (${trg.priorityLevel || 'STANDARD'})`,
            subjective: String(trg.chiefComplaint || 'Outpatient Screening'),
            objective: `BP: ${trg.bloodPressure || '120/80'} mmHg, HR: ${trg.heartRate || '75'} bpm, Temp: ${trg.temperature || '36.5'} °C, Wt: ${trg.weightKg || '65'} kg`,
            assessment: `${trg.department || 'OPD'} (${trg.priorityLevel || 'STANDARD'})`,
            plan: 'Routed to Outpatient Department',
            prescriptions: [],
            vitalSigns: {
              bloodPressure: `${trg.bloodPressure || '120/80'} mmHg`,
              heartRate: `${trg.heartRate || '75'} bpm`,
              temperature: `${trg.temperature || '36.5'} °C`,
              weight: `${trg.weightKg || '65'} kg`,
            },
            notes: `Triage Status: ${trg.status || 'PENDING_OPD'}`,
            status: 'FINALIZED',
            version: 1,
            parentRecordId: null,
            amendmentReason: null,
            finalizedAt: trg.createdAt || null,
            finalizedByName: String(trg.nurseName || 'Triage Staff'),
            contentHash: null,
            archivedAt: null,
            archiveReason: null,
            appointment: null,
            queueTicket: null,
            attachments: [],
          };
        });

        const triagePatientIds = new Set(mappedFromTriage.map((r) => r.patientId));
        const mappedFromPatients: MedicalRecord[] = patientRows
          .filter((p: any) => !triagePatientIds.has(String(p.id)))
          .map((p: any) => ({
            id: `pat-${p.id}`,
            recordNumber: String(p.patientNo || `MRN-${String(p.id).slice(-6).toUpperCase()}`),
            patientId: String(p.id),
            patientName: String(p.name || 'Patient'),
            doctorName: 'OPD Registry',
            doctorSpecialty: 'Outpatient Department',
            date: String(p.lastVisit || new Date().toISOString().slice(0, 10)),
            time: '08:00 AM',
            type: 'Consultation',
            chiefComplaint: 'Outpatient Registration & Vitals',
            diagnosis: 'Registered Outpatient Profile',
            subjective: 'Outpatient Registration',
            objective: `BP: ${p.vitals?.bloodPressure || '120/80'} mmHg, HR: ${p.vitals?.heartRate || '75'} bpm, Temp: ${p.vitals?.temperature || '36.6'} °C, Wt: ${p.vitals?.weight || '65'} kg`,
            assessment: 'Active Patient Record',
            plan: 'Outpatient Monitoring',
            prescriptions: [],
            vitalSigns: {
              bloodPressure: `${p.vitals?.bloodPressure || '120/80'} mmHg`,
              heartRate: `${p.vitals?.heartRate || '75'} bpm`,
              temperature: `${p.vitals?.temperature || '36.6'} °C`,
              weight: `${p.vitals?.weight || '65'} kg`,
            },
            notes: `RFID: ${p.cardUid || 'NO_CARD'} • Blood Type: ${p.bloodType || 'Unknown'}`,
            status: 'FINALIZED',
            version: 1,
            parentRecordId: null,
            amendmentReason: null,
            finalizedAt: null,
            finalizedByName: 'OPD Registry',
            contentHash: null,
            archivedAt: null,
            archiveReason: null,
            appointment: null,
            queueTicket: null,
            attachments: [],
          }));

        const combined = mergeWithArchiveStore([...mappedFromTriage, ...mappedFromPatients]);
        setRecords(combined);
        setTotalPages(patData?.pagination?.totalPages || 1);
        setTotalRecords(combined.length);
        return;
      }

      if (!res.ok || !data.success) {
        const message = getApiErrorMessage(data.error, 'Failed to load medical records.');
        setLoadError(message);
        return;
      }
      if (data.success && Array.isArray(data.records)) {
        const merged = mergeWithArchiveStore(data.records);
        setRecords(merged);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalRecords(merged.length);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Hindi nakuha ang medical records.';
      showToast('Hindi nakuha ang medical records mula sa server', 'error');
      setLoadError(message);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, mergeWithArchiveStore]);

  // Load registered patients & doctors for New Record modal
  const loadAuxiliaryData = useCallback(async () => {
    try {
      const [patRes, docRes] = await Promise.all([
        fetch('/api/patients?pageSize=100'),
        fetch('/api/doctors'),
      ]);
      const [patData, docData] = await Promise.all([
        readJsonResponse<any>(patRes),
        readJsonResponse<any>(docRes),
      ]);
      if (!patRes.ok || !patData.success) return;
      if (!docRes.ok || !docData.success) return;
      if (patData.success && Array.isArray(patData.patients)) {
        setPatientsList(patData.patients);
        if (patData.patients.length > 0 && !newPatientId) {
          setNewPatientId(patData.patients[0].id);
          setNewPatientName(patData.patients[0].name);
        }
      }
      if (docData.success && Array.isArray(docData.doctors)) {
        setDoctorsList(docData.doctors);
        if (docData.doctors.length > 0 && !newDoctorName) {
          setNewDoctorName(docData.doctors[0].name);
          setNewDoctorSpecialty(docData.doctors[0].specialization || 'General Medicine');
        }
      }
    } catch {
      // Auxiliary dropdown data failed to load; modal will remain empty until retry.
    }
  }, [newPatientId, newDoctorName]);

  useEffect(() => {
    loadRecords();
    if (!readOnly) loadAuxiliaryData();
  }, [loadRecords, loadAuxiliaryData, readOnly]);

  const activeRecords = useMemo(() => records.filter((r) => !r.archivedAt), [records]);
  const archivedRecords = useMemo(() => records.filter((r) => Boolean(r.archivedAt)), [records]);
  const scopedRecords = archiveView === 'ARCHIVED' ? archivedRecords : activeRecords;

  const filteredRecords = scopedRecords.filter(record => {
    const matchesSearch = 
      record.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.recordNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.doctorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.diagnosis.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = filterType === 'ALL' || record.type === filterType;
    const matchesDoctor = filterDoctor === 'ALL' || record.doctorName === filterDoctor;
    const matchesStatus = filterStatus === 'ALL' || record.status === filterStatus;
    const matchesDate = !selectedDate || record.date === selectedDate;

    return matchesSearch && matchesType && matchesDoctor && matchesStatus && matchesDate;
  });

  // Group records strictly by patient name (normalized) so all check-ups for that patient are grouped together
  const groupedPatients: GroupedPatientRecord[] = useMemo(() => {
    const map = new Map<string, GroupedPatientRecord>();

    scopedRecords.forEach((record) => {
      // Group by patient name (case-insensitive) so that any checkups with the same patient name group together
      const nameKey = (record.patientName || '').trim().toLowerCase();
      const groupKey = nameKey || (record.patientId || '').trim();

      if (!map.has(groupKey)) {
        map.set(groupKey, {
          patientId: record.patientId || groupKey,
          patientName: record.patientName || 'Unknown Patient',
          totalRecords: 1,
          records: [record],
          latestRecord: record,
        });
      } else {
        const item = map.get(groupKey)!;
        item.records.push(record);
        item.totalRecords += 1;
        if (!item.patientId && record.patientId) {
          item.patientId = record.patientId;
        }
      }
    });

    // Sort records within each patient: latest encounter first
    map.forEach((item) => {
      item.records.sort((a, b) => {
        const dateA = new Date(`${a.date} ${a.time}`).getTime() || 0;
        const dateB = new Date(`${b.date} ${b.time}`).getTime() || 0;
        return dateB - dateA;
      });
      item.latestRecord = item.records[0];
    });

    // Sort patients by latest encounter
    return Array.from(map.values()).sort((a, b) => {
      const dateA = new Date(`${a.latestRecord.date} ${a.latestRecord.time}`).getTime() || 0;
      const dateB = new Date(`${b.latestRecord.date} ${b.latestRecord.time}`).getTime() || 0;
      return dateB - dateA;
    });
  }, [scopedRecords]);

  // Filter grouped patients
  const filteredGroupedPatients = useMemo(() => {
    return groupedPatients.filter((gp) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        gp.patientName.toLowerCase().includes(q) ||
        gp.patientId.toLowerCase().includes(q) ||
        gp.records.some(
          (r) =>
            r.recordNumber.toLowerCase().includes(q) ||
            r.doctorName.toLowerCase().includes(q) ||
            r.diagnosis.toLowerCase().includes(q) ||
            r.chiefComplaint.toLowerCase().includes(q)
        );

      const matchesDoctor =
        filterDoctor === 'ALL' ||
        gp.records.some((r) => r.doctorName === filterDoctor);

      const matchesType =
        filterType === 'ALL' ||
        gp.records.some((r) => r.type === filterType);

      const matchesStatus =
        filterStatus === 'ALL' ||
        gp.records.some((r) => r.status === filterStatus);

      const matchesDate =
        !selectedDate ||
        gp.records.some((r) => r.date === selectedDate);

      return matchesSearch && matchesDoctor && matchesType && matchesStatus && matchesDate;
    });
  }, [groupedPatients, searchQuery, filterDoctor, filterType, filterStatus, selectedDate]);

  const doctors = Array.from(new Set(records.map(r => r.doctorName)));

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

  const handleViewDetails = (record: MedicalRecord) => {
    setSelectedRecord(record);
    setActiveTab('overview');
    setDetailsOpen(true);
  };

  // Open Full Patient Medical Dossier
  const handleOpenPatientDossier = (patient: GroupedPatientRecord) => {
    setDossierPatient(patient);
    setDossierActiveIndex(0);
    setActiveTab('overview');
    setDossierOpen(true);
  };

  // Toggle inline accordion expansion for patient row
  const handleToggleExpandPatient = (patientId: string) => {
    setExpandedPatientId(prev => (prev === patientId ? null : patientId));
  };

  // Download entire patient history as consolidated file
  const handleDownloadPatientDossier = async (gp: GroupedPatientRecord) => {
    try {
      const res = await fetch(`/api/medical-records/pdf?patientId=${encodeURIComponent(gp.patientId)}`);
      if (res.ok && res.headers.get('content-type')?.includes('application/pdf')) {
        const pdfBlob = await res.blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const pdfLink = document.createElement('a');
        pdfLink.href = pdfUrl;
        pdfLink.download = `medical-chart-${gp.patientId}.pdf`;
        document.body.appendChild(pdfLink);
        pdfLink.click();
        document.body.removeChild(pdfLink);
        URL.revokeObjectURL(pdfUrl);
        showToast(`Na-download ang PDF chart ni ${gp.patientName}.`);
        return;
      }
    } catch {
      // Fall back to client-side dossier export below
    }
    const lines = [
      `================================================================`,
      `LAGUNA MEDICAL CENTER — COMPREHENSIVE PATIENT MEDICAL DOSSIER`,
      `================================================================`,
      `PATIENT: ${gp.patientName}`,
      `PATIENT ID: ${gp.patientId}`,
      `TOTAL RECORDED VISITS: ${gp.totalRecords}`,
      `DOSSIER GENERATED: ${new Date().toLocaleString()}`,
      `================================================================\n`,
    ];

    gp.records.forEach((r, idx) => {
      lines.push(
        `----------------------------------------------------------------`,
        `ENCOUNTER #${gp.records.length - idx} • RECORD: ${r.recordNumber} [${r.type.toUpperCase()}]`,
        `Date & Time: ${formatDateDisplay(r.date)} ${r.time} | Status: ${r.status}`,
        `Attending Physician: ${r.doctorName} (${r.doctorSpecialty})`,
        `Chief Complaint: ${r.chiefComplaint}`,
        `Clinical Diagnosis: ${r.diagnosis}`,
        `Vital Signs: BP: ${r.vitalSigns.bloodPressure} | HR: ${r.vitalSigns.heartRate} bpm | Temp: ${r.vitalSigns.temperature}°C | Wt: ${r.vitalSigns.weight} kg`,
        `Prescriptions: ${r.prescriptions.length > 0 ? r.prescriptions.map(p => `${p.medication} ${p.dosage} (${p.frequency})`).join(', ') : 'None'}`,
        `Physician Notes: ${r.notes || 'None recorded'}`,
        `----------------------------------------------------------------\n`
      );
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${gp.patientName.replace(/\s+/g, '_')}_Complete_Medical_Chart.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`In-export ang kumpletong chart ni ${gp.patientName} (${gp.totalRecords} records).`);
  };

  // Open Finalize Confirm Modal (Yes / No)
  const openFinalizeConfirm = (recordId: string) => {
    setFinalizeRecordId(recordId);
  };

  // Finalize Draft Record Execution
  const executeFinalizeRecord = async () => {
    if (!finalizeRecordId) return;
    const recordId = finalizeRecordId;

    setIsProcessing(true);
    setProcessingText('Finina-finalize ang medical record...');

    try {
      const response = await fetch(`/api/medical-records/${recordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'FINALIZE' }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) throw new Error(getApiErrorMessage(data.error, 'Hindi na-finalize ang record.'));
      replaceRecord(data.record);
      showToast('Medical record ay na-finalize at cryptographically sealed.');
      setFinalizeRecordId(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Hindi na-finalize ang medical record.', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const createAmendment = async (record: MedicalRecord) => {
    const reason = window.prompt('Ilagay ang specific reason for amendment (minimum 10 characters):');
    if (!reason) return;
    try {
      setIsProcessing(true);
      setProcessingText('Gumagawa ng versioned amendment...');
      const response = await fetch(`/api/medical-records/${record.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'AMEND', reason }),
      });
      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) throw new Error(getApiErrorMessage(data.error, 'Hindi nagawa ang amendment.'));
      setDetailsOpen(false);
      setDossierOpen(false);
      await loadRecords();
      showToast(`Amendment version ${data.record.version} created as draft. I-edit at i-finalize ito kapag kumpleto na.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Hindi nagawa ang amendment.', 'error');
    } finally { setIsProcessing(false); }
  };

  const scheduleFollowUp = async (record: MedicalRecord) => {
    const schedule = window.prompt('Follow-up date and time (example: 2026-10-20T09:00):');
    if (!schedule) return;
    const appointmentDate = new Date(schedule);
    if (Number.isNaN(appointmentDate.getTime())) { showToast('Invalid follow-up date and time.', 'error'); return; }
    const reasonForVisit = window.prompt('Reason for follow-up:', `Follow-up: ${record.diagnosis}`) || undefined;
    try {
      setIsProcessing(true);
      setProcessingText('Nagse-schedule ng follow-up appointment...');
      const response = await fetch(`/api/medical-records/${record.id}/follow-up`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointmentDate: appointmentDate.toISOString(), reasonForVisit }) });
      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) throw new Error(getApiErrorMessage(data.error, 'Hindi nagawa ang follow-up appointment.'));
      showToast(`Follow-up appointment scheduled for ${appointmentDate.toLocaleString('fil-PH')}.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Hindi nagawa ang follow-up appointment.', 'error');
    } finally { setIsProcessing(false); }
  };

  const openEditDraft = (record: MedicalRecord) => {
    setEditingRecordId(record.id);
    setNewPatientId(record.patientId);
    setNewPatientName(record.patientName);
    setNewDoctorName(record.doctorName);
    setNewDoctorSpecialty(record.doctorSpecialty);
    setNewType(record.type);
    setNewChiefComplaint(record.chiefComplaint);
    setNewDiagnosis(record.diagnosis);
    setNewNotes(record.plan || record.notes);
    setNewBp(record.vitalSigns.bloodPressure);
    setNewHr(record.vitalSigns.heartRate);
    setNewTemp(record.vitalSigns.temperature);
    setNewWeight(record.vitalSigns.weight);
    setDetailsOpen(false);
    setDossierOpen(false);
    setNewRecordOpen(true);
  };

  const archiveRecord = (record: MedicalRecord) => {
    setArchiveReasonInput('Completed outpatient encounter / filed to archive');
    setArchiveModalRecord(record);
  };

  const executeArchiveRecord = async () => {
    if (!archiveModalRecord) return;
    const record = archiveModalRecord;
    const reason = archiveReasonInput.trim();
    if (reason.length < 5) {
      showToast('Mangyaring maglagay ng dahilan ng pag-archive (minimum 5 characters).', 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    try {
      setIsProcessing(true);
      setProcessingText(`Ina-archive ang record ${record.recordNumber}...`);

      try {
        await fetch(`/api/medical-records/${record.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason }),
        });
      } catch {
        // Proceed with station archive store even if server endpoint is restricted to doctor
      }

      const archivedSnapshot: MedicalRecord = {
        ...record,
        archivedAt: nowIso,
        archiveReason: reason,
      };
      saveArchivedRecordEntry({
        id: record.id,
        patientId: record.patientId,
        patientName: record.patientName,
        archivedAt: nowIso,
        archiveReason: reason,
        recordSnapshot: archivedSnapshot,
      });

      replaceRecord(archivedSnapshot);
      setArchiveModalRecord(null);
      setDetailsOpen(false);
      setDossierOpen(false);
      showToast(`Matagumpay na na-archive ang ${record.recordNumber} (${record.patientName}).`);
    } finally {
      setIsProcessing(false);
    }
  };

  const restoreRecord = (record: MedicalRecord) => {
    removeArchivedRecordEntry(record.id);
    const restored: MedicalRecord = {
      ...record,
      archivedAt: null,
      archiveReason: null,
    };
    replaceRecord(restored);
    setDetailsOpen(false);
    setDossierOpen(false);
    showToast(`Naibalik sa Active Records ang ${record.recordNumber} (${record.patientName}).`);
  };

  const uploadAttachment = async (record: MedicalRecord, file: File) => {
    const formData = new FormData();
    formData.set('file', file);
    try {
      setUploadingAttachment(true);
      const response = await fetch(`/api/medical-records/${record.id}/attachments`, { method: 'POST', body: formData });
      const data = await readJsonResponse(response);
      if (!response.ok || !data.success) throw new Error(getApiErrorMessage(data.error, 'Hindi na-upload ang attachment.'));
      await loadRecords();
      setSelectedRecord((current) => current?.id === record.id ? { ...current, attachments: [...current.attachments, data.attachment] } : current);
      showToast('Clinical attachment uploaded and checksum recorded.');
    } catch (error) { showToast(error instanceof Error ? error.message : 'Hindi na-upload ang attachment.', 'error'); }
    finally { setUploadingAttachment(false); }
  };

  const handlePrintSummary = (record: MedicalRecord) => {
    const opened = openPrintableConsultationSummary(record);
    if (!opened) {
      showToast('Pakipayagan ang pop-up window sa browser para ma-print ang Consultation Summary.', 'error');
    }
  };

  const openMedCertModal = (record: MedicalRecord) => {
    setMedCertRecord(record);
    setCertPurpose('To Whom It May Concern');
    setCertDiagnosis(record.assessment || record.diagnosis || '');
    setCertRecommendation(record.plan || 'Advised adequate rest and follow-up as needed.');
    setCertRestDays('');
  };

  const handlePrintMedCert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!medCertRecord) return;
    const opened = openPrintableMedicalCertificate(medCertRecord, {
      purpose: certPurpose,
      diagnosis: certDiagnosis,
      recommendation: certRecommendation,
      restDays: certRestDays,
    });
    if (!opened) {
      showToast('Pakipayagan ang pop-up window sa browser para ma-print ang Medical Certificate.', 'error');
      return;
    }
    setMedCertRecord(null);
  };

  // Download/Export PDF Summary
  const handleDownloadRecord = async (record: MedicalRecord) => {
    try {
      const res = await fetch(`/api/medical-records/pdf?recordId=${encodeURIComponent(record.id)}`);
      if (res.ok && res.headers.get('content-type')?.includes('application/pdf')) {
        const pdfBlob = await res.blob();
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const pdfLink = document.createElement('a');
        pdfLink.href = pdfUrl;
        pdfLink.download = `medical-record-${record.recordNumber || record.id}.pdf`;
        document.body.appendChild(pdfLink);
        pdfLink.click();
        document.body.removeChild(pdfLink);
        URL.revokeObjectURL(pdfUrl);
        showToast(`Na-download ang PDF para sa ${record.recordNumber}.`);
        return;
      }
    } catch {
      // Fall back to client-side summary export below
    }
    const summary = [
      `LAGUNA MEDICAL CENTER EHR & RFID HUB — CLINICAL ENCOUNTER RECORD`,
      `Record Number: ${record.recordNumber}`,
      `Date & Time: ${formatDateDisplay(record.date)} ${record.time}`,
      `Status: ${record.status}`,
      `Type: ${record.type}`,
      `--------------------------------------------------`,
      `PATIENT INFORMATION`,
      `Name: ${record.patientName}`,
      `Patient ID: ${record.patientId}`,
      `--------------------------------------------------`,
      `ATTENDING PHYSICIAN`,
      `Physician: ${record.doctorName}`,
      `Department: ${record.doctorSpecialty}`,
      `--------------------------------------------------`,
      `CLINICAL OBSERVATIONS`,
      `Chief Complaint: ${record.chiefComplaint}`,
      `Diagnosis: ${record.diagnosis}`,
      `--------------------------------------------------`,
      `VITAL SIGNS`,
      `Blood Pressure: ${record.vitalSigns.bloodPressure}`,
      `Heart Rate: ${record.vitalSigns.heartRate}`,
      `Temperature: ${record.vitalSigns.temperature}`,
      `Weight: ${record.vitalSigns.weight}`,
      `--------------------------------------------------`,
      `PRESCRIPTIONS`,
      record.prescriptions.length > 0 
        ? record.prescriptions.map(p => [
            `- ${p.medication} ${p.dosage} | ${p.frequency} | ${p.duration}`,
            `  Status: ${p.isActive ? 'Active' : 'Voided'} | E-signature: ${p.isSigned ? 'Verified' : 'Legacy / Unsigned'}`,
            p.isSigned ? `  Signed by: ${p.eSignatureName || record.doctorName}${p.eSignatureLicense ? ` | PRC ${p.eSignatureLicense}` : ''}${p.eSignedAt ? ` | ${new Date(p.eSignedAt).toLocaleString('fil-PH')}` : ''}` : '',
            p.eSignatureHash ? `  Verification: ${p.eSignatureHash}` : '',
          ].filter(Boolean).join('\n')).join('\n')
        : 'None recorded.',
      `--------------------------------------------------`,
      `CLINICAL NOTES`,
      record.notes,
      `--------------------------------------------------`,
      `Document Generated: ${new Date().toLocaleString()}`,
    ].join('\n');

    const blob = new Blob([summary], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${record.recordNumber}_Clinical_Encounter.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported clinical documentation for ${record.recordNumber}.`);
  };

  // Create New Record Submission (Database Persisted)
  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiagnosis.trim() || !newChiefComplaint.trim()) {
      setErrorModal({
        open: true,
        title: 'Kulang na Impormasyon',
        message: 'Pakilagay ang Chief Complaint at Clinical Diagnosis bago i-save ang rekord sa sistema.',
      });
      return;
    }

    try {
      setIsSubmitting(true);
      const selectedDoc = doctorsList.find(d => d.name === newDoctorName);
      const res = await fetch(editingRecordId ? `/api/medical-records/${editingRecordId}` : '/api/medical-records', {
        method: editingRecordId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editingRecordId ? { action: 'UPDATE_DRAFT' } : {}),
          patientId: newPatientId,
          doctorId: selectedDoc?.userId || selectedDoc?.id,
          type: newType,
          chiefComplaint: newChiefComplaint,
          diagnosis: newDiagnosis,
          notes: newNotes,
          vitalSigns: {
            bloodPressure: newBp || '120/80',
            heartRate: parseInt(newHr, 10) || 75,
            temperature: parseFloat(newTemp) || 36.6,
            weight: parseFloat(newWeight) || 65,
          },
        }),
      });

      const data = await readJsonResponse(res);
      if (data.success) {
        setNewRecordOpen(false);
        setEditingRecordId(null);
        setNewChiefComplaint('');
        setNewDiagnosis('');
        setNewNotes('');
        showToast(editingRecordId ? 'Na-update ang draft medical record.' : 'Matagumpay na naitala ang bagong draft medical record sa database.');
        loadRecords();
      } else {
        showToast(getApiErrorMessage(data.error, 'Hindi na-save ang medical record.'), 'error');
      }
    } catch {
      showToast('Error habang sine-save ang medical record sa server.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const recordCounts = {
    total: records.length,
    consultation: records.filter(r => r.type === 'Consultation').length,
    followUp: records.filter(r => r.type === 'Follow-up').length,
    emergency: records.filter(r => r.type === 'Emergency').length,
    draft: records.filter(r => r.status === 'DRAFT').length
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
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Medical Records</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 font-mono font-medium">
              Live EHR Database
            </span>
            {readOnly && (
              <span className="text-xs px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200 font-semibold">
                Read-only Access
              </span>
            )}
          </div>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Patient consultation history, clinical SOAP notes, and prescription archives
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={loadRecords}
            disabled={loading}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-white border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-60 cursor-pointer shadow-2xs"
            title="I-refresh mula sa database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-slate-900' : 'text-slate-500'}`} />
            <span>{loading ? 'Syncing...' : 'Sync'}</span>
          </button>

          {!readOnly && (
            <button
              type="button"
              onClick={() => {
                setEditingRecordId(null);
                if (patientsList.length > 0 && !newPatientId) {
                  setNewPatientId(patientsList[0].id);
                  setNewPatientName(patientsList[0].name);
                }
                if (doctorsList.length > 0 && !newDoctorName) {
                  setNewDoctorName(doctorsList[0].name);
                  setNewDoctorSpecialty(doctorsList[0].specialization || 'General Medicine');
                }
                setNewRecordOpen(true);
              }}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Record</span>
            </button>
          )}
        </div>
      </div>

      {/* ── SUMMARY / KPI CARDS (SIMPLIFIED 3-BOX METRICS) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Unique Patients */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Mga Pasyente
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {groupedPatients.length}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-teal-50 text-teal-800">
              Unique Patients
            </span>
          </div>
        </div>

        {/* Total Encounters */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Kabuuang Check-up / Records
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
              {recordCounts.total}
            </span>
            <span className="text-xs text-slate-400 font-medium">All Encounters</span>
          </div>
        </div>

        {/* Archived Records */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
            Naka-archive na Records
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-bold font-mono text-amber-800 tracking-tight">
              {archivedRecords.length}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-800">
              Archived
            </span>
          </div>
        </div>
      </div>

      {/* ── FILTERS & SEARCH TOOLBAR (Enterprise Data Management) ───────── */}
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
              title="Ipakita ang mga aktibong medical records"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Aktibo ({activeRecords.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setArchiveView('ARCHIVED')}
              className={`inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                archiveView === 'ARCHIVED'
                  ? 'bg-amber-700 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Buksan ang Medical Records Archive"
            >
              <Archive className="w-3.5 h-3.5" />
              <span>Archive ({archivedRecords.length})</span>
            </button>
            {archiveView === 'ARCHIVED' && archivedRecords.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Sigurado ka bang nais mong linisin ang lahat ng naka-archive na medical records?')) {
                    clearAllArchivedRecordEntries();
                    setRecords((prev) => prev.filter((r) => !r.archivedAt));
                    showToast('Nalinis na ang lahat ng naka-archive na records.');
                  }
                }}
                className="ml-1 inline-flex items-center space-x-1 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-50 rounded transition cursor-pointer"
                title="Burahin ang laman ng archive"
              >
                <span>Linisin Archive</span>
              </button>
            )}
          </div>

          {/* View Mode Toggle: Group by Patient vs All Encounters */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                viewMode === 'grouped'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Pagsamahin ang records kada pasyente (Isang row bawat tao)"
            >
              <Users className="w-3.5 h-3.5 text-blue-600" />
              <span>Group by Patient ({filteredGroupedPatients.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`inline-flex items-center space-x-1 px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ilista ang lahat ng indibidwal na encounters"
            >
              <Layers className="w-3.5 h-3.5 text-slate-600" />
              <span>All Encounters ({filteredRecords.length})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by patient, record #, or diagnosis..."
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
          <div className="w-auto">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              aria-label="Filter by date"
              className="w-full py-1 px-2.5 bg-white border border-slate-300 rounded text-sm text-slate-700 focus:outline-hidden focus:border-slate-600 h-8"
            />
          </div>

          {/* Type Filter */}
          <div className="w-36">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-sm bg-white border-slate-300">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="Consultation">Consultation</SelectItem>
                <SelectItem value="Follow-up">Follow-up</SelectItem>
                <SelectItem value="Emergency">Emergency</SelectItem>
                <SelectItem value="Procedure">Procedure</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Doctor Filter */}
          <div className="w-44">
            <Select value={filterDoctor} onValueChange={setFilterDoctor}>
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

          {/* Status Filter */}
          <div className="w-32">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-sm bg-white border-slate-300">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="FINALIZED">Finalized</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="AMENDED">Amended</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters */}
          {(searchQuery || selectedDate || filterType !== 'ALL' || filterDoctor !== 'ALL' || filterStatus !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedDate('');
                setFilterType('ALL');
                setFilterDoctor('ALL');
                setFilterStatus('ALL');
              }}
              className="text-[13px] text-slate-600 hover:text-slate-900 underline font-medium px-1 self-center"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Counter */}
        <div className="text-[13px] text-slate-500 font-mono self-end sm:self-center whitespace-nowrap">
          {viewMode === 'grouped' ? (
            <span>Showing <strong>{filteredGroupedPatients.length}</strong> patients ({totalRecords} total records)</span>
          ) : (
            <span>Showing <strong>{filteredRecords.length}</strong> of <strong>{totalRecords}</strong> records</span>
          )}
        </div>
      </div>

      {/* ── MEDICAL RECORDS TABLE ────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          {viewMode === 'grouped' ? (
            /* ── GROUPED BY PATIENT VIEW (Patient Master Chart) ────────────── */
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                    Pasyente (Patient)
                  </th>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                    Kabuuang Records
                  </th>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                    Pinakabagong Bisita (Latest Visit)
                  </th>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                    Doktor & Departamento
                  </th>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                    Huling Diagnosis
                  </th>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs text-right">
                    Aksyon
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredGroupedPatients.map((gp) => {
                  const initials = getInitials(gp.patientName);
                  const isExpanded = expandedPatientId === gp.patientId || expandedPatientId === gp.patientName;
                  const latest = gp.latestRecord;

                  return (
                    <React.Fragment key={gp.patientName || gp.patientId}>
                      <tr className={`hover:bg-slate-50/80 transition-colors ${isExpanded ? 'bg-blue-50/30' : ''}`}>
                        {/* Patient info with initials */}
                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            <button
                              type="button"
                              onClick={() => handleToggleExpandPatient(gp.patientId || gp.patientName)}
                              className="p-1 text-slate-400 hover:text-slate-700 rounded transition-colors"
                              title={isExpanded ? 'I-collapse ang records' : 'I-expand ang kasaysayan'}
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            <div className="w-8 h-8 rounded bg-slate-100 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => handleOpenPatientDossier(gp)}
                                className="font-semibold text-slate-900 hover:text-blue-700 text-left truncate block text-sm"
                              >
                                {gp.patientName}
                              </button>
                              <div className="text-[12px] text-slate-500 font-mono">
                                ID: {gp.patientId}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Total Records count badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {gp.totalRecords > 1 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              {gp.totalRecords} Medical Records
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              1 Record
                            </span>
                          )}
                        </td>

                        {/* Latest Encounter Date & Time */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <div className="flex items-center space-x-1.5 text-slate-900 font-medium text-sm">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{formatDateDisplay(latest.date)}</span>
                            </div>
                            <div className="flex items-center space-x-1.5 text-slate-500 text-[12px]">
                              <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                              <span>{latest.time}</span>
                              <span className="text-slate-300">•</span>
                              <span className="font-mono text-[11px] text-slate-600 bg-slate-100 px-1 rounded">
                                {latest.recordNumber}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Attending Doctor */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div>
                            <span className="font-medium text-slate-900 block text-sm">{latest.doctorName}</span>
                            <span className="text-[12px] text-slate-500 block">{latest.doctorSpecialty}</span>
                          </div>
                        </td>

                        {/* Latest Diagnosis */}
                        <td className="py-3 px-4 max-w-xs xl:max-w-md">
                          <p className="text-sm text-slate-800 font-normal leading-normal line-clamp-2" title={latest.diagnosis}>
                            {latest.diagnosis}
                          </p>
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center space-x-2">
                            <button
                              type="button"
                              onClick={() => handleOpenPatientDossier(gp)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-medium transition-colors shadow-2xs cursor-pointer"
                              title="Buksan ang lahat ng rekord ng pasyenteng ito"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              <span>Tingnan Lahat ({gp.totalRecords})</span>
                            </button>
                            {latest.archivedAt ? (
                              <button
                                type="button"
                                onClick={() => restoreRecord(latest)}
                                title="Ibalik mula sa Archive"
                                className="inline-flex items-center space-x-1 px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <ArchiveRestore className="w-3.5 h-3.5" />
                                <span>Ibalik</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => archiveRecord(latest)}
                                title="I-archive ang pinakabagong medical record"
                                className="inline-flex items-center space-x-1 px-2 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded text-xs font-semibold transition-colors cursor-pointer"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>I-archive</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleDownloadPatientDossier(gp)}
                              title="I-download ang kumpletong chart file"
                              className="p-1.5 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Accordion / Expanded Sub-row of Visits */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={6} className="bg-slate-50/80 p-0 border-b border-slate-200">
                            <div className="p-4 space-y-2 border-l-4 border-l-blue-600 bg-slate-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                  <History className="w-3.5 h-3.5 text-blue-600" />
                                  Kasaysayan ng Konsultasyon ni {gp.patientName} ({gp.totalRecords} Encounters)
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenPatientDossier(gp)}
                                  className="text-xs font-medium text-blue-700 hover:text-blue-900 underline cursor-pointer"
                                >
                                  Buksan ang Interactive Chart &rarr;
                                </button>
                              </div>

                              <div className="space-y-1.5">
                                {gp.records.map((r, rIdx) => (
                                  <div
                                    key={r.id}
                                    className="bg-white border border-slate-200 rounded p-2.5 flex flex-col md:flex-row md:items-center justify-between gap-2 hover:border-slate-300 transition-colors"
                                  >
                                    <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                                        {r.recordNumber}
                                      </span>
                                      <span className="text-xs text-slate-500 font-medium">
                                        {formatDateDisplay(r.date)} • {r.time}
                                      </span>
                                      <span className="text-xs font-semibold text-slate-800">
                                        {r.doctorName} <span className="font-normal text-slate-500">({r.doctorSpecialty})</span>
                                      </span>
                                      <span className="text-[11px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-medium">
                                        {r.type}
                                      </span>
                                      {r.archivedAt && (
                                        <span className="text-[11px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200 font-semibold">
                                          Archived {r.archiveReason ? `• ${r.archiveReason}` : ''}
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex items-center space-x-3 text-xs">
                                      <span className="text-slate-600 truncate max-w-sm" title={r.diagnosis}>
                                        <strong className="text-slate-800">Dx:</strong> {r.diagnosis}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleViewDetails(r)}
                                        className="inline-flex items-center space-x-1 text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                                      >
                                        <Eye className="w-3.5 h-3.5" />
                                        <span>Detalyado</span>
                                      </button>
                                      {r.archivedAt ? (
                                        <button
                                          type="button"
                                          onClick={() => restoreRecord(r)}
                                          className="inline-flex items-center space-x-1 text-emerald-700 hover:text-emerald-900 font-semibold cursor-pointer"
                                        >
                                          <ArchiveRestore className="w-3.5 h-3.5" />
                                          <span>Ibalik</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => archiveRecord(r)}
                                          className="inline-flex items-center space-x-1 text-amber-700 hover:text-amber-900 font-semibold cursor-pointer"
                                        >
                                          <Archive className="w-3.5 h-3.5" />
                                          <span>I-archive</span>
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : (
            /* ── FLAT ENCOUNTERS LIST VIEW ─────────────────────────────────── */
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                    Record #
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
                    Diagnosis
                  </th>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                    Status
                  </th>
                  <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredRecords.map((record) => {
                  const initials = getInitials(record.patientName);

                  return (
                    <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-medium text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          {record.recordNumber}
                        </span>
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => handleViewDetails(record)}
                              className="font-medium text-slate-900 hover:text-blue-700 text-left truncate block text-sm"
                            >
                              {record.patientName}
                            </button>
                            <div className="text-[13px] text-slate-500 font-mono">
                              ID: {record.patientId}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div>
                          <span className="font-medium text-slate-900 block text-sm">{record.doctorName}</span>
                          <span className="text-[13px] text-slate-500 block">{record.doctorSpecialty}</span>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1.5 text-slate-900 font-medium text-sm">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{formatDateDisplay(record.date)}</span>
                          </div>
                          <div className="flex items-center space-x-1.5 text-slate-500 text-[13px]">
                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{record.time}</span>
                          </div>
                        </div>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {record.type}
                        </span>
                      </td>

                      <td className="py-2.5 px-4 max-w-xs xl:max-w-md">
                        <p className="text-sm text-slate-800 font-normal leading-normal line-clamp-2" title={record.diagnosis}>
                          {record.diagnosis}
                        </p>
                      </td>

                      <td className="py-2.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <RecordStatusBadge status={record.status} />
                          {record.archivedAt && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                              Archived
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(record)}
                            title="View Clinical Details"
                            className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {record.archivedAt ? (
                            <button
                              type="button"
                              onClick={() => restoreRecord(record)}
                              title="Ibalik mula sa Archive"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded transition-colors cursor-pointer"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5" />
                              <span>Ibalik</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => archiveRecord(record)}
                              title="I-archive ang Medical Record"
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-50 border border-amber-200 rounded transition-colors cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5" />
                              <span>I-archive</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDownloadRecord(record)}
                            title="Download Record Summary"
                            className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12 text-sm text-slate-500 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
            <p className="font-medium text-slate-700">Kinukuha ang Medical Records mula sa Database...</p>
          </div>
        )}

        {loadError && (
          <div role="alert" className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {loadError} <button type="button" onClick={loadRecords} className="font-semibold underline">Retry</button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !loadError && (viewMode === 'grouped' ? filteredGroupedPatients.length === 0 : filteredRecords.length === 0) && (
          <div className="text-center py-10 text-sm">
            <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-medium text-slate-700 text-sm">No medical records found</p>
            <p className="text-slate-500 mt-0.5 text-[13px]">
              {records.length === 0
                ? 'Ang medical records ay awtomatikong nalilikha kapag tinapos ng doktor ang konsultasyon sa Doctor Queue Desk (/doctor/queue) o maaaring gumawa gamit ang "New Record" button sa itaas.'
                : 'Subukang mag-clear ng filter o baguhin ang search query'}
            </p>
          </div>
        )}
        <PaginationControls page={page} totalPages={totalPages} total={totalRecords} pageSize={pageSize} loading={loading} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </div>

      {/* ── PATIENT MEDICAL DOSSIER MODAL (Consolidated Multi-Record View) ─── */}
      <Dialog open={dossierOpen} onOpenChange={setDossierOpen}>
        <DialogContent className="max-w-6xl w-full max-h-[92vh] h-[860px] overflow-hidden flex flex-col bg-white border border-slate-300 rounded-xl p-0 shadow-2xl">
          {/* Modal Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
            <div className="flex items-center space-x-3.5">
              <div className="w-11 h-11 rounded-full bg-blue-100 border border-blue-200 text-blue-800 font-bold text-base flex items-center justify-center shrink-0">
                {dossierPatient ? getInitials(dossierPatient.patientName) : 'PT'}
              </div>
              <div>
                <div className="flex items-center space-x-2.5 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                    {dossierPatient?.patientName}
                  </h2>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {dossierPatient?.totalRecords} {dossierPatient && dossierPatient.totalRecords > 1 ? 'Medical Records' : 'Medical Record'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  Patient ID: {dossierPatient?.patientId} • Magkakasama ang lahat ng nakaraang konsultasyon at reseta
                </p>
              </div>
            </div>

            {/* Header Action Button: Download all records */}
            <div className="flex items-center space-x-2 self-start sm:self-auto">
              {dossierPatient && (
                <button
                  type="button"
                  onClick={() => handleDownloadPatientDossier(dossierPatient)}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>I-download Lahat ({dossierPatient.totalRecords} Records)</span>
                </button>
              )}
            </div>
          </div>

          {/* Modal Body */}
          {dossierPatient && (
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0 bg-slate-100/50">
              {/* Left Column: Encounter list sidebar */}
              <div className="w-full md:w-84 md:min-w-[320px] md:max-w-[340px] border-b md:border-b-0 md:border-r border-slate-200 bg-slate-50/90 p-4 flex flex-col shrink-0">
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Mga Pagbisita ({dossierPatient.records.length})
                  </span>
                  <span className="text-[11px] text-slate-400">Pumili ng record</span>
                </div>

                <div className="space-y-2 overflow-y-auto max-h-[220px] md:max-h-none flex-1 pr-1">
                  {dossierPatient.records.map((r, index) => {
                    const isSelected = dossierActiveIndex === index;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setDossierActiveIndex(index);
                          setSelectedRecord(r);
                        }}
                        className={`w-full text-left p-3 rounded-md border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white border-blue-600 ring-2 ring-blue-500/20 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded border ${
                            isSelected ? 'bg-blue-50 text-blue-900 border-blue-200' : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}>
                            {r.recordNumber}
                          </span>
                          <span className="text-[11px] font-medium text-slate-500">
                            {formatDateDisplay(r.date)}
                          </span>
                        </div>

                        <div className="font-semibold text-slate-900 text-xs truncate">
                          {r.doctorName}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate mb-1.5">
                          {r.doctorSpecialty}
                        </div>

                        <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] gap-2">
                          <span className="text-slate-700 truncate" title={r.diagnosis}>
                            <strong className="text-slate-500">Dx:</strong> {r.diagnosis}
                          </span>
                          <span className="text-slate-400 font-mono text-[10px] shrink-0">{r.time}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Active Encounter Details */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-white space-y-5 min-w-0">
                {dossierPatient.records[dossierActiveIndex] && (() => {
                  const active = dossierPatient.records[dossierActiveIndex];
                  return (
                    <div className="space-y-4">
                      {/* Active Record Hero Banner */}
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-mono text-base font-bold text-slate-900">
                              {active.recordNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white text-slate-700 border border-slate-200">
                              {active.type}
                            </span>
                            <RecordStatusBadge status={active.status} />
                            <span className="px-2 py-0.5 rounded text-xs font-semibold bg-white text-slate-600 border border-slate-200">Version {active.version}</span>
                          </div>
                          <p className="text-xs text-slate-600">
                            Attending Physician: <strong className="text-slate-900">{active.doctorName}</strong> ({active.doctorSpecialty})
                          </p>
                        </div>
                        <div className="text-left sm:text-right text-xs text-slate-500 bg-white sm:bg-transparent p-2 sm:p-0 rounded border sm:border-0 border-slate-200">
                          <div className="font-semibold text-slate-800">{formatDateDisplay(active.date)}</div>
                          <div className="font-mono">{active.time}</div>
                        </div>
                      </div>

                      {/* Vital Signs Grid */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                          Vital Signs sa Konsultasyong Ito
                        </h4>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center text-xs">
                          <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                            <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Blood Pressure</span>
                            <span className="font-mono font-bold text-slate-900 text-sm">{active.vitalSigns.bloodPressure}</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                            <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Heart Rate</span>
                            <span className="font-mono font-bold text-slate-900 text-sm">{active.vitalSigns.heartRate} bpm</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                            <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Temperature</span>
                            <span className="font-mono font-bold text-slate-900 text-sm">{active.vitalSigns.temperature}°C</span>
                          </div>
                          <div className="bg-slate-50 border border-slate-200 rounded p-2.5">
                            <span className="text-[11px] font-medium text-slate-500 block mb-0.5">Weight</span>
                            <span className="font-mono font-bold text-slate-900 text-sm">{active.vitalSigns.weight} kg</span>
                          </div>
                        </div>
                      </div>

                      {/* Chief Complaint & Diagnosis */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1">
                          <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                            Chief Complaint
                          </span>
                          <p className="text-slate-800 text-sm leading-relaxed">{active.chiefComplaint}</p>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs space-y-1">
                          <span className="font-bold text-slate-700 uppercase tracking-wider text-[11px] block">
                            Clinical Diagnosis
                          </span>
                          <p className="text-slate-900 font-semibold text-sm leading-relaxed">{active.diagnosis}</p>
                        </div>
                      </div>

                      {/* Prescriptions */}
                      <div>
                        <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                          Niresetang Gamot ({active.prescriptions.length})
                        </h4>
                        {active.prescriptions.length > 0 ? (
                          <div className="space-y-1.5">
                            {active.prescriptions.map((rx, rxIdx) => (
                              <div key={rx.id || rxIdx} className="bg-slate-50 border border-slate-200 rounded p-2.5 text-xs flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                                <div className="space-y-1">
                                  <div className="flex items-center space-x-2">
                                    <Pill className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span className="font-bold text-slate-900">{rx.medication}</span>
                                    <span className="text-slate-500 font-mono">({rx.dosage})</span>
                                  </div>
                                  {rx.isSigned ? (
                                    <p className="text-[10px] text-emerald-700 font-medium">
                                      ✓ E-signed by {rx.eSignatureName || active.doctorName}
                                      {rx.eSignatureLicense ? ` - PRC ${rx.eSignatureLicense}` : ''}
                                      {rx.eSignedAt ? ` - ${new Date(rx.eSignedAt).toLocaleString('fil-PH')}` : ''}
                                    </p>
                                  ) : (
                                    <p className="text-[10px] text-amber-700 font-medium">Legacy record - walang verified e-signature</p>
                                  )}
                                </div>
                                <span className="text-slate-700 font-medium">{rx.frequency} &bull; {rx.duration}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic bg-slate-50 p-3 rounded border border-slate-200">
                            Walang gamot na nireseta sa pagbisitang ito.
                          </p>
                        )}
                      </div>

                      {/* Doctor Notes */}
                      {active.notes && (
                        <div>
                          <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                            Doktor&apos;s SOAP / Consultation Notes
                          </h4>
                          <p className="text-xs text-slate-800 whitespace-pre-line bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed font-normal">
                            {active.notes}
                          </p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-slate-200">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleDownloadRecord(active)}
                            className="text-xs h-8 bg-slate-900 hover:bg-slate-800 text-white font-medium cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5 mr-1.5" />
                            I-download ang Record na Ito ({active.recordNumber})
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrintSummary(active)}
                            className="text-xs h-8 border-teal-300 text-teal-800 hover:bg-teal-50 font-medium cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5 mr-1.5" />
                            Print Summary
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openMedCertModal(active)}
                            className="text-xs h-8 border-blue-300 text-blue-800 hover:bg-blue-50 font-medium cursor-pointer"
                          >
                            <FileBadge className="w-3.5 h-3.5 mr-1.5" />
                            Medical Certificate
                          </Button>
                          {active.archivedAt ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => restoreRecord(active)}
                              className="text-xs h-8 text-emerald-700 border-emerald-300 hover:bg-emerald-50 cursor-pointer"
                            >
                              <ArchiveRestore className="w-3.5 h-3.5 mr-1.5" />
                              Ibalik mula sa Archive
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => archiveRecord(active)}
                              className="text-xs h-8 text-amber-800 border-amber-300 hover:bg-amber-50 cursor-pointer"
                            >
                              <Archive className="w-3.5 h-3.5 mr-1.5" />
                              I-archive ang Record
                            </Button>
                          )}
                        </div>

                        {!readOnly && <div className="flex flex-wrap gap-2">
                          {active.status === 'DRAFT' && <>
                            <Button type="button" size="sm" variant="outline" onClick={() => openEditDraft(active)} className="text-xs h-8"><FilePenLine className="w-3.5 h-3.5 mr-1.5" />Edit Draft</Button>
                            <Button type="button" size="sm" onClick={() => openFinalizeConfirm(active.id)} className="text-xs h-8 bg-emerald-700 hover:bg-emerald-800 text-white font-medium"><FileCheck className="w-3.5 h-3.5 mr-1.5" />Finalize Record</Button>
                          </>}
                          {active.status === 'FINALIZED' && <><Button type="button" size="sm" variant="outline" onClick={() => void scheduleFollowUp(active)} className="text-xs h-8">Schedule Follow-up</Button><Button type="button" size="sm" variant="outline" onClick={() => void createAmendment(active)} className="text-xs h-8"><FilePenLine className="w-3.5 h-3.5 mr-1.5" />Create Amendment</Button></>}
                        </div>}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">
              Record {dossierActiveIndex + 1} of {dossierPatient?.records.length || 0}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDossierOpen(false)}
              className="text-xs h-8 px-4 ml-auto cursor-pointer"
            >
              Isara (Close)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MEDICAL RECORD DETAILS MODAL (Authentic Clinical Chart) ─────── */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Medical Record Encounter Details
            </DialogTitle>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4 py-2 text-sm">
              {/* Header Strip */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm font-semibold text-slate-900">
                      {selectedRecord.recordNumber}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      {selectedRecord.type}
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-500 mt-0.5">
                    Registration Reference #{selectedRecord.id}
                  </p>
                </div>

                <div className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <RecordStatusBadge status={selectedRecord.status} />
                    <span className="rounded border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">Version {selectedRecord.version}</span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Encounter: {formatDateDisplay(selectedRecord.date)} • {selectedRecord.time}
                  </p>
                </div>
              </div>

              {/* Enterprise Tabs Navigation */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-4 bg-slate-100 border border-slate-200 p-0.5 rounded">
                  <TabsTrigger value="overview" className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-2xs">
                    Overview
                  </TabsTrigger>
                  <TabsTrigger value="vitals" className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-2xs">
                    Vital Signs
                  </TabsTrigger>
                  <TabsTrigger value="prescriptions" className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-2xs">
                    Prescriptions ({selectedRecord.prescriptions.length})
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-2xs">
                    Clinical Notes
                  </TabsTrigger>
                </TabsList>

                {/* Tab: Overview */}
                <TabsContent value="overview" className="space-y-4 mt-3">
                  {/* Patient Info */}
                  <div className="space-y-1.5">
                    <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                      Patient Information
                    </h3>
                    <div className="bg-slate-50 border border-slate-200 rounded p-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium text-sm flex items-center justify-center shrink-0">
                          {getInitials(selectedRecord.patientName)}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{selectedRecord.patientName}</p>
                          <p className="text-[13px] text-slate-500 font-mono">Patient Record ID: {selectedRecord.patientId}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Doctor Info */}
                  <div className="space-y-1.5">
                    <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                      Attending Physician & Department
                    </h3>
                    <div className="bg-slate-50 border border-slate-200 rounded p-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900 text-sm">{selectedRecord.doctorName}</p>
                          <p className="text-[13px] text-slate-500">Department: {selectedRecord.doctorSpecialty}</p>
                        </div>
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-white border border-slate-200 text-slate-600">
                          {selectedRecord.doctorSpecialty === 'Cardiology' ? 'Room 204 • Heart Center' : 'Room 108 • Pediatric Wing'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Chief Complaint & Diagnosis */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                        Chief Complaint
                      </h3>
                      <div className="bg-slate-50 border border-slate-200 rounded p-3 min-h-[72px]">
                        <p className="text-slate-800 text-sm leading-normal">{selectedRecord.chiefComplaint}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                        Clinical Diagnosis
                      </h3>
                      <div className="bg-slate-50 border border-slate-200 rounded p-3 min-h-[72px]">
                        <p className="text-slate-800 font-normal text-sm leading-normal">{selectedRecord.diagnosis}</p>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Vital Signs */}
                <TabsContent value="vitals" className="space-y-3 mt-3">
                  <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                    Triage Vital Signs Readings
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-50 border border-slate-200 rounded p-3">
                      <span className="text-[13px] font-medium text-slate-500 block mb-1">Blood Pressure</span>
                      <span className="text-xl font-semibold text-slate-900 font-mono">{selectedRecord.vitalSigns.bloodPressure}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded p-3">
                      <span className="text-[13px] font-medium text-slate-500 block mb-1">Heart Rate</span>
                      <span className="text-xl font-semibold text-slate-900 font-mono">{selectedRecord.vitalSigns.heartRate}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded p-3">
                      <span className="text-[13px] font-medium text-slate-500 block mb-1">Temperature</span>
                      <span className="text-xl font-semibold text-slate-900 font-mono">{selectedRecord.vitalSigns.temperature}</span>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 rounded p-3">
                      <span className="text-[13px] font-medium text-slate-500 block mb-1">Weight</span>
                      <span className="text-xl font-semibold text-slate-900 font-mono">{selectedRecord.vitalSigns.weight}</span>
                    </div>
                  </div>
                </TabsContent>

                {/* Tab: Prescriptions */}
                <TabsContent value="prescriptions" className="space-y-3 mt-3">
                  <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                    Medication Orders & Regimen
                  </h3>
                  {selectedRecord.prescriptions.length > 0 ? (
                    <div className="space-y-2">
                      {selectedRecord.prescriptions.map((rx, idx) => (
                        <div key={rx.id || idx} className="bg-slate-50 border border-slate-200 rounded p-3 flex items-start space-x-3">
                          <Pill className="w-4 h-4 text-slate-500 mt-0.5 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">{rx.medication}</p>
                            <div className="grid grid-cols-3 gap-2 mt-1.5 text-xs">
                              <div>
                                <span className="text-slate-500 block">Dosage</span>
                                <span className="font-mono text-slate-800 font-medium text-[13px]">{rx.dosage}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Frequency</span>
                                <span className="text-slate-800 font-medium text-[13px]">{rx.frequency}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 block">Duration</span>
                                <span className="text-slate-800 font-medium text-[13px]">{rx.duration}</span>
                              </div>
                            </div>
                            <div className={`mt-2 rounded border px-2.5 py-2 text-xs ${rx.isSigned ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                              {rx.isSigned ? (
                                <>
                                  <p className="font-semibold">✓ Verified doctor e-signature</p>
                                  <p className="mt-0.5">
                                    {rx.eSignatureName || selectedRecord.doctorName}
                                    {rx.eSignatureLicense ? ` - PRC ${rx.eSignatureLicense}` : ''}
                                    {rx.eSignedAt ? ` - ${new Date(rx.eSignedAt).toLocaleString('fil-PH')}` : ''}
                                  </p>
                                  {rx.eSignatureHash && <p className="mt-1 font-mono text-[10px] break-all">Verification: {rx.eSignatureHash}</p>}
                                </>
                              ) : (
                                <p className="font-semibold">Legacy prescription - walang verified e-signature</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded text-sm">
                      <Pill className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                      <p className="text-slate-600 font-medium text-sm">No prescriptions recorded</p>
                      <p className="text-[13px] text-slate-500 mt-0.5">No active medications were issued for this encounter</p>
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Notes */}
                <TabsContent value="notes" className="space-y-3 mt-3">
                  <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                    Physician Consultation Notes & Assessment
                  </h3>
                  <div className="bg-slate-50 border border-slate-200 rounded p-3">
                    <p className="text-slate-800 whitespace-pre-line text-sm leading-relaxed">
                      {selectedRecord.notes}
                    </p>
                  </div>
                  <div className="rounded border border-slate-200 bg-white p-3 text-xs text-slate-600">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <p><strong>Lifecycle:</strong> {selectedRecord.status} · Version {selectedRecord.version}</p>
                      <p><strong>Encounter:</strong> {selectedRecord.appointment ? `Appointment ${selectedRecord.appointment.id}` : selectedRecord.queueTicket ? `Queue #${selectedRecord.queueTicket.queueNumber}` : 'Unlinked legacy encounter'}</p>
                      {selectedRecord.finalizedAt && <p><strong>Finalized:</strong> {new Date(selectedRecord.finalizedAt).toLocaleString('fil-PH')}</p>}
                      {selectedRecord.finalizedByName && <p><strong>Signer:</strong> {selectedRecord.finalizedByName}</p>}
                    </div>
                    {selectedRecord.amendmentReason && <p className="mt-2 rounded border border-blue-200 bg-blue-50 p-2 text-blue-900"><strong>Amendment reason:</strong> {selectedRecord.amendmentReason}</p>}
                    {selectedRecord.contentHash && <p className="mt-2 break-all font-mono text-[10px] text-slate-500">SHA-256: {selectedRecord.contentHash}</p>}
                  </div>
                  <div className="rounded border border-slate-200 bg-white p-3">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700"><Paperclip className="h-3.5 w-3.5" />Clinical attachments ({selectedRecord.attachments.length})</h3>
                      {!readOnly && selectedRecord.status === 'DRAFT' && <label className="cursor-pointer rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
                        {uploadingAttachment ? 'Uploading...' : 'Add PDF/Image'}
                        <input type="file" accept="application/pdf,image/jpeg,image/png" disabled={uploadingAttachment} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAttachment(selectedRecord, file); event.currentTarget.value = ''; }} />
                      </label>}
                    </div>
                    <div className="mt-2 space-y-2">
                      {selectedRecord.attachments.length ? selectedRecord.attachments.map((attachment) => <a key={attachment.id} href={`/api/medical-records/attachments/${attachment.id}`} className="flex items-center justify-between rounded border border-slate-200 bg-slate-50 p-2 text-xs hover:border-blue-300">
                        <span className="truncate font-medium text-blue-700">{attachment.fileName}</span><span className="ml-3 shrink-0 text-slate-500">{Math.ceil(attachment.fileSize / 1024)} KB</span>
                      </a>) : <p className="text-xs text-slate-500">No clinical attachments.</p>}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Action Buttons: Solid Professional Styling (No Gradients) */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-200">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleDownloadRecord(selectedRecord)}
                    className="h-8 text-sm bg-slate-900 hover:bg-slate-800 text-white font-medium"
                  >
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Download Summary
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handlePrintSummary(selectedRecord)}
                    className="h-8 text-sm border-teal-300 text-teal-800 hover:bg-teal-50 font-medium"
                  >
                    <Printer className="w-3.5 h-3.5 mr-1.5" />
                    Print Summary
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openMedCertModal(selectedRecord)}
                    className="h-8 text-sm border-blue-300 text-blue-800 hover:bg-blue-50 font-medium"
                  >
                    <FileBadge className="w-3.5 h-3.5 mr-1.5" />
                    Medical Certificate
                  </Button>

                  {!readOnly && selectedRecord.status === 'DRAFT' && (
                    <>
                      <Button type="button" size="sm" variant="outline" onClick={() => openEditDraft(selectedRecord)} className="h-8 text-sm"><FilePenLine className="w-3.5 h-3.5 mr-1.5" />Edit Draft</Button>
                      <Button type="button" size="sm" onClick={() => openFinalizeConfirm(selectedRecord.id)} className="h-8 text-sm bg-emerald-700 hover:bg-emerald-800 text-white font-medium"><FileCheck className="w-3.5 h-3.5 mr-1.5" />Finalize Record</Button>
                    </>
                  )}
                  {!readOnly && selectedRecord.status === 'FINALIZED' && <Button type="button" size="sm" variant="outline" onClick={() => void createAmendment(selectedRecord)} className="h-8 text-sm"><FilePenLine className="w-3.5 h-3.5 mr-1.5" />Create Amendment</Button>}
                  {selectedRecord.archivedAt ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => restoreRecord(selectedRecord)} className="h-8 text-sm text-emerald-700 border-emerald-300 hover:bg-emerald-50"><ArchiveRestore className="w-3.5 h-3.5 mr-1.5" />Ibalik mula sa Archive</Button>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => archiveRecord(selectedRecord)} className="h-8 text-sm text-amber-800 border-amber-300 hover:bg-amber-50"><Archive className="w-3.5 h-3.5 mr-1.5" />I-archive</Button>
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

      {/* ── NEW MEDICAL RECORD MODAL (Clinical Documentation Entry) ───── */}
      <Dialog open={newRecordOpen} onOpenChange={(open) => { setNewRecordOpen(open); if (!open) setEditingRecordId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              {editingRecordId ? 'Edit Draft Medical Record' : 'New Medical Record Documentation'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateRecord} className="space-y-4 py-2 text-sm">
            {/* Patient & Doctor Selection */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-medium text-slate-700 block mb-1">
                  Select Patient <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  disabled={Boolean(editingRecordId)}
                  value={newPatientId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setNewPatientId(id);
                    const found = patientsList.find(p => p.id === id);
                    if (found) setNewPatientName(found.name);
                  }}
                  className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-hidden focus:border-slate-600"
                >
                  {patientsList.length === 0 ? (
                    <option value="">Walang rehistradong pasyente</option>
                  ) : (
                    patientsList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.patientNo ? `(${p.patientNo})` : ''} {p.cardUid ? `• RFID: ${p.cardUid}` : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="text-[13px] font-medium text-slate-700 block mb-1">
                  Attending Physician
                </label>
                <select
                  disabled={Boolean(editingRecordId)}
                  value={newDoctorName}
                  onChange={(e) => {
                    const docName = e.target.value;
                    setNewDoctorName(docName);
                    const found = doctorsList.find(d => d.name === docName);
                    if (found) setNewDoctorSpecialty(found.specialization || 'General Medicine');
                  }}
                  className="w-full h-8 px-2 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-hidden focus:border-slate-600"
                >
                  {doctorsList.length === 0 ? (
                    <option value="Dr. Attending Physician">Dr. Attending Physician (General Practice)</option>
                  ) : (
                    doctorsList.map(d => (
                      <option key={d.id} value={d.name}>
                        {d.name} ({d.specialization || 'General Medicine'})
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Encounter Type */}
            <div>
              <label className="text-[13px] font-medium text-slate-700 block mb-1">
                Encounter Type
              </label>
              <div className="grid grid-cols-4 gap-2">
                {(['Consultation', 'Follow-up', 'Emergency', 'Procedure'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewType(t)}
                    className={`py-1.5 px-2 text-xs font-medium rounded border text-center transition-colors ${
                      newType === t
                        ? 'bg-slate-900 border-slate-900 text-white'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Chief Complaint */}
            <div>
              <label className="text-[13px] font-medium text-slate-700 block mb-1">
                Chief Complaint <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Mild palpitations and shortness of breath upon exertion"
                value={newChiefComplaint}
                onChange={(e) => setNewChiefComplaint(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-hidden focus:border-slate-600"
              />
            </div>

            {/* Diagnosis */}
            <div>
              <label className="text-[13px] font-medium text-slate-700 block mb-1">
                Clinical Diagnosis <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Essential Hypertension - Stage 1"
                value={newDiagnosis}
                onChange={(e) => setNewDiagnosis(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-hidden focus:border-slate-600"
              />
            </div>

            {/* Vitals Grid */}
            <div>
              <label className="text-[13px] font-medium text-slate-700 block mb-1">
                Vital Signs Readings
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div>
                  <span className="text-xs text-slate-500 block">BP (mmHg)</span>
                  <input
                    type="text"
                    value={newBp}
                    onChange={(e) => setNewBp(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">HR (bpm)</span>
                  <input
                    type="text"
                    value={newHr}
                    onChange={(e) => setNewHr(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Temp (°C)</span>
                  <input
                    type="text"
                    value={newTemp}
                    onChange={(e) => setNewTemp(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-slate-900"
                  />
                </div>
                <div>
                  <span className="text-xs text-slate-500 block">Weight (kg)</span>
                  <input
                    type="text"
                    value={newWeight}
                    onChange={(e) => setNewWeight(e.target.value)}
                    className="w-full px-2 py-1 bg-white border border-slate-300 rounded text-xs font-mono text-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-[13px] font-medium text-slate-700 block mb-1">
                Clinical Assessment Notes
              </label>
              <textarea
                rows={3}
                placeholder="Enter clinical examination notes, patient plan, or follow-up recommendations..."
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-hidden focus:border-slate-600"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setNewRecordOpen(false); setEditingRecordId(null); }}
                className="h-8 text-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="h-8 text-sm bg-slate-900 hover:bg-slate-800 text-white font-medium cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>{editingRecordId ? 'Save Draft Changes' : 'Save Draft Record'}</span>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── FINALIZE CONFIRMATION MODAL (Yes or No) ──────────────────── */}
      <Dialog open={!!finalizeRecordId} onOpenChange={(open) => !open && setFinalizeRecordId(null)}>
        <DialogContent className="max-w-md bg-white border border-slate-300 rounded-xl p-6 shadow-2xl">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
              <FileCheck className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <h3 className="text-base font-bold text-slate-900">
                Kumpirmahin ang Pag-finalize ng Record (Yes / No)
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Sigurado ka bang nais mong i-finalize ang medical record na ito? Kapag na-finalize na, ito ay magiging opisyal na clinical document at hindi na maaaring baguhin.
              </p>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessing}
              onClick={() => setFinalizeRecordId(null)}
              className="h-8 px-3.5 text-xs font-medium cursor-pointer"
            >
              Bumalik (No)
            </Button>
            <Button
              type="button"
              disabled={isProcessing}
              onClick={executeFinalizeRecord}
              className="h-8 px-4 text-xs font-semibold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer shadow-xs disabled:opacity-50"
            >
              Oo, I-finalize (Yes, Finalize)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── ARCHIVE MEDICAL RECORD MODAL ─────────────────────────────── */}
      <Dialog open={!!archiveModalRecord} onOpenChange={(open) => !open && setArchiveModalRecord(null)}>
        <DialogContent className="max-w-md bg-white border border-slate-300 rounded-xl p-6 shadow-2xl">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center shrink-0">
              <Archive className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 min-w-0 flex-1">
              <h3 className="text-base font-bold text-slate-900">
                I-archive ang Medical Record
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                Ililipat sa <strong>Medical Records Archive</strong> ang rekord na{' '}
                <strong className="font-mono text-slate-900">{archiveModalRecord?.recordNumber}</strong> ni{' '}
                <strong className="text-slate-900">{archiveModalRecord?.patientName}</strong>. Walang clinical data na mabubura at maaari pa rin itong tingnan o ibalik anumang oras.
              </p>
              <div className="pt-2 space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 block">
                  Dahilan ng Pag-archive (Reason) *
                </label>
                <div className="flex flex-wrap gap-1.5 mb-1.5">
                  {[
                    'Completed outpatient encounter / filed to archive',
                    'Old / previous consultation record',
                    'Duplicate triage / OPD intake entry',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setArchiveReasonInput(preset)}
                      className={`text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                        archiveReasonInput === preset
                          ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={archiveReasonInput}
                  onChange={(e) => setArchiveReasonInput(e.target.value)}
                  placeholder="Ilagay ang dahilan ng pag-archive..."
                  className="w-full h-9 px-3 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-hidden focus:border-amber-700"
                />
              </div>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessing}
              onClick={() => setArchiveModalRecord(null)}
              className="h-8 px-3.5 text-xs font-medium cursor-pointer"
            >
              Kanselahin
            </Button>
            <Button
              type="button"
              disabled={isProcessing}
              onClick={executeArchiveRecord}
              className="h-8 px-4 text-xs font-semibold bg-amber-700 hover:bg-amber-800 text-white cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Archive className="w-3.5 h-3.5 mr-1.5" />
              I-archive ang Record
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── ERROR & VALIDATION MODAL ─────────────────────────────────── */}
      <Dialog open={!!errorModal?.open} onOpenChange={(open) => !open && setErrorModal(null)}>
        <DialogContent className="max-w-md bg-white border border-red-200 rounded-xl p-6 shadow-2xl">
          <div className="flex items-start space-x-3.5">
            <div className="w-10 h-10 rounded-full bg-red-100 border border-red-200 text-red-600 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 min-w-0">
              <h3 className="text-base font-bold text-slate-900">
                {errorModal?.title || 'May Nakitang Problema'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                {errorModal?.message}
              </p>
            </div>
          </div>
          <div className="mt-5 pt-3 border-t border-slate-100 flex justify-end">
            <Button
              type="button"
              onClick={() => setErrorModal(null)}
              className="h-8 px-4 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer rounded-lg"
            >
              Naiintindihan Ko (Isara)
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

      {/* ── MEDICAL CERTIFICATE PRINT MODAL ─────────────────────────── */}
      <Dialog open={Boolean(medCertRecord)} onOpenChange={(open) => { if (!open) setMedCertRecord(null); }}>
        <DialogContent className="max-w-lg bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <FileBadge className="w-5 h-5 text-blue-700" />
              Issue &amp; Print Medical Certificate
            </DialogTitle>
          </DialogHeader>
          {medCertRecord && (
            <form onSubmit={handlePrintMedCert} className="space-y-3.5 py-2 text-sm">
              <div className="rounded border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 space-y-0.5">
                <p><strong>Patient:</strong> {medCertRecord.patientName} ({medCertRecord.patientId})</p>
                <p><strong>Encounter:</strong> {medCertRecord.recordNumber} &bull; {formatDateDisplay(medCertRecord.date)}</p>
                <p><strong>Physician:</strong> {medCertRecord.doctorName} ({medCertRecord.doctorSpecialty})</p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Salutation / Purpose
                </label>
                <Input
                  value={certPurpose}
                  onChange={(e) => setCertPurpose(e.target.value)}
                  placeholder="To Whom It May Concern"
                  className="h-9 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Clinical Impression / Diagnosis
                </label>
                <Input
                  required
                  value={certDiagnosis}
                  onChange={(e) => setCertDiagnosis(e.target.value)}
                  placeholder="Clinical diagnosis"
                  className="h-9 text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Remarks / Recommendation
                </label>
                <textarea
                  rows={3}
                  value={certRecommendation}
                  onChange={(e) => setCertRecommendation(e.target.value)}
                  placeholder="Fit to return to work / Advised rest and medication..."
                  className="w-full p-2.5 bg-white border border-slate-300 rounded text-sm text-slate-800 focus:outline-hidden focus:border-slate-600"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Recommended Rest Days (Optional)
                </label>
                <Input
                  type="number"
                  min={0}
                  max={90}
                  value={certRestDays}
                  onChange={(e) => setCertRestDays(e.target.value)}
                  placeholder="Hal. 3 (iwanang blangko kung wala)"
                  className="h-9 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <Button type="button" variant="outline" size="sm" onClick={() => setMedCertRecord(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-blue-700 hover:bg-blue-800 text-white">
                  <Printer className="w-3.5 h-3.5 mr-1.5" />
                  Print Medical Certificate
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RecordStatusBadge({ status }: { status: MedicalRecord['status'] }) {
  const style = status === 'FINALIZED'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : status === 'AMENDED'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : 'border-amber-200 bg-amber-50 text-amber-700';
  const dot = status === 'FINALIZED' ? 'bg-emerald-600' : status === 'AMENDED' ? 'bg-blue-600' : 'bg-amber-600';
  return <span className={`inline-flex items-center gap-1 rounded border px-2 py-0.5 text-xs font-medium ${style}`}><span className={`inline-block h-1.5 w-1.5 rounded-full ${dot}`} />{status === 'FINALIZED' ? 'Finalized' : status === 'AMENDED' ? 'Amended' : 'Draft'}</span>;
}
