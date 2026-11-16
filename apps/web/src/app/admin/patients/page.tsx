'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  Search,
  UserPlus,
  Edit2,
  Trash2,
  CreditCard,
  FileText,
  Phone,
  Mail,
  Calendar,
  MapPin,
  User,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  X,
  Download,
  ShieldAlert,
  RotateCcw,
  Loader2,
  AlertCircle
  ,Upload
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PaginationControls } from '@/components/PaginationControls';
import { getApiErrorMessage } from '@/lib/client-response';

export type Patient = {
  id: string;
  patientNo: string;
  name: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  age: number;
  gender: 'Male' | 'Female';
  phone: string;
  email: string;
  address: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  rfidCard: string | null;
  cardStatus: 'Active' | 'Unassigned' | 'Revoked';
  registeredDate: string;
  lastVisit: string | null;
  totalVisits: number;
  bloodType: string;
  allergies: string[];
  vitals?: {
    bloodPressure: string;
    heartRate: number;
    temperature: number;
    weight: number;
    height: number;
    bmi: number;
    oxygenSaturation: number;
    respiratoryRate: number;
  };
};

export default function PatientsPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState('ALL');
  const [filterCardStatus, setFilterCardStatus] = useState('ALL');

  // Dialog states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [viewDetailsOpen, setViewDetailsOpen] = useState(false);
  const [assignCardModalOpen, setAssignCardModalOpen] = useState(false);

  // Active / Selected state
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [editChangeReason, setEditChangeReason] = useState('');
  const [patientToDelete, setPatientToDelete] = useState<Patient | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [newCardUidInput, setNewCardUidInput] = useState('');

  // Modal states for Validation, Delete Confirm, and Loading
  const [errorModal, setErrorModal] = useState<{ open: boolean; title: string; message: string; field?: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingText, setProcessingText] = useState('Pinoproseso ang kahilingan...');

  // Toast Notification state
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  // Patients dataset from database
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalPatients, setTotalPatients] = useState(0);

  const loadPatients = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError('');
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (filterGender !== 'ALL') params.set('gender', filterGender);
      if (filterCardStatus !== 'ALL') params.set('cardStatus', filterCardStatus.toUpperCase());
      const res = await fetch(`/api/patients?${params}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || data.error || 'Failed to load patients.');
      if (data.success && Array.isArray(data.patients)) {
        const mapped: Patient[] = data.patients.map((p: any) => ({
          id: p.id,
          patientNo: p.patientNo,
          name: p.name,
          firstName: p.firstName,
          lastName: p.lastName,
          dateOfBirth: p.dateOfBirth,
          age: p.dateOfBirth
            ? Math.max(0, new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear())
            : 30,
          gender: (p.gender === 'Female' ? 'Female' : 'Male') as 'Male' | 'Female',
          phone: p.phone,
          email: p.email || '',
          address: p.address,
          streetAddress: p.streetAddress,
          city: p.city,
          state: p.state,
          zipCode: p.zipCode,
          rfidCard: p.cardUid && p.cardUid !== 'NO_CARD' ? p.cardUid : null,
          cardStatus: p.cardUid && p.cardUid !== 'NO_CARD' ? 'Active' : 'Unassigned',
          registeredDate: p.lastVisit || new Date().toISOString().split('T')[0],
          lastVisit: p.lastVisit || null,
          totalVisits: 1,
          bloodType: p.bloodType || 'N/A',
          allergies: [],
          vitals: p.vitals,
        }));
        setPatients(mapped);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalPatients(data.pagination?.total || mapped.length);
      }
    } catch (err) {
      console.error('Error fetching patients:', err);
      setLoadError(err instanceof Error ? err.message : 'Failed to load patients.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, searchQuery, filterGender, filterCardStatus]);

  useEffect(() => {
    const timer = window.setTimeout(loadPatients, 250);
    return () => window.clearTimeout(timer);
  }, [loadPatients]);

  // Form state for New Patient
  const [newPatientForm, setNewPatientForm] = useState({
    name: '',
    dob: '',
    gender: 'Male' as 'Male' | 'Female',
    bloodType: 'N/A',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    allergies: '',
    conditions: '',
    rfidCard: ''
  });

  // Filtered dataset
  const filteredPatients = patients.filter(patient => {
    const q = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !q ||
      patient.name.toLowerCase().includes(q) ||
      patient.email.toLowerCase().includes(q) ||
      patient.phone.includes(q) ||
      (patient.rfidCard && patient.rfidCard.toLowerCase().includes(q)) ||
      patient.id.toLowerCase().includes(q) ||
      patient.patientNo.toLowerCase().includes(q);
    
    const matchesGender = filterGender === 'ALL' || patient.gender === filterGender;
    const matchesCardStatus = filterCardStatus === 'ALL' || patient.cardStatus === filterCardStatus;

    return matchesSearch && matchesGender && matchesCardStatus;
  });

  // 1. REGISTER NEW PATIENT HANDLER
  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameClean = newPatientForm.name.trim();
    const phoneClean = newPatientForm.phone.trim();
    const emailClean = newPatientForm.email.trim();
    const cardTrimmed = newPatientForm.rfidCard.trim().toUpperCase();

    // 1. Validate required fields
    if (!nameClean || !phoneClean) {
      setErrorModal({
        open: true,
        title: 'Kulang na Impormasyon',
        message: 'Kailangang ilagay ang buong pangalan at contact number ng pasyente bago magpatuloy.',
        field: 'required',
      });
      return;
    }

    // Names are not unique. The server compares name, birth date, phone, and
    // address together so different people with the same name are allowed.
    // Check duplicate contact number
    const phoneDigits = phoneClean.replace(/\D/g, '');
    const existingPhone = patients.find(p => {
      const pDigits = p.phone.replace(/\D/g, '');
      return (phoneDigits.length >= 7 && pDigits.endsWith(phoneDigits.slice(-10))) || pDigits === phoneDigits;
    });
    if (existingPhone) {
      setErrorModal({
        open: true,
        title: 'May Kaparehong Contact Number',
        message: `Ang contact number na "${phoneClean}" ay nakatala na kay ${existingPhone.name} (${existingPhone.patientNo}). Bawal ang magkaparehong numero sa registry.`,
        field: 'phone',
      });
      return;
    }

    // 4. Check duplicate email (if provided)
    if (emailClean) {
      const existingEmail = patients.find(p => p.email.toLowerCase() === emailClean.toLowerCase());
      if (existingEmail) {
        setErrorModal({
          open: true,
          title: 'May Kaparehong Email Address',
          message: `Ang email address na "${emailClean}" ay ginagamit na ni ${existingEmail.name} (${existingEmail.patientNo}). Bawal ang duplicate na email.`,
          field: 'email',
        });
        return;
      }
    }

    // 5. Check duplicate RFID Card (if provided)
    if (cardTrimmed) {
      const existingCard = patients.find(p => p.rfidCard && p.rfidCard.toUpperCase() === cardTrimmed);
      if (existingCard) {
        setErrorModal({
          open: true,
          title: 'Nagamit na ang RFID Card',
          message: `Ang RFID Card UID na "${cardTrimmed}" ay nakatali na kay ${existingCard.name} (${existingCard.patientNo}). Mangyaring gumamit ng ibang RFID card.`,
          field: 'card',
        });
        return;
      }
    }

    setIsProcessing(true);
    setProcessingText('Inirerehistro ang bagong pasyente sa database...');

    // Attempt to register via backend API
    try {
      const nameParts = nameClean.split(/\s+/);
      const firstName = nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nameParts[0];
      const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : 'Patient';

      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName,
          dateOfBirth: newPatientForm.dob || '1995-01-01',
          gender: newPatientForm.gender,
          bloodType: newPatientForm.bloodType,
          phoneNumber: phoneClean,
          email: emailClean || '',
          address: newPatientForm.address.trim() || 'Santa Cruz, Laguna',
          city: newPatientForm.city.trim() || 'Santa Cruz',
          state: newPatientForm.state.trim() || 'Laguna',
          zipCode: newPatientForm.zipCode.trim() || '4009',
          emergencyContactName: newPatientForm.emergencyContactName.trim() || 'Kamag-anak',
          emergencyContactPhone: newPatientForm.emergencyContactPhone.trim() || phoneClean,
          emergencyContactRelation: newPatientForm.emergencyContactRelation.trim() || 'Family',
          cardUid: cardTrimmed,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setIsProcessing(false);
        setErrorModal({
          open: true,
          title: 'Hindi Naituloy ang Rehistrasyon',
          message: getApiErrorMessage(data.error, 'May error sa pag-rehistro ng pasyente sa server.'),
          field: data.field,
        });
        return;
      }

      showToast(`Pasyente ${nameClean} ay matagumpay na nairehistro.`);
      setAddModalOpen(false);
      await loadPatients();
      setIsProcessing(false);

      // Reset form
      setNewPatientForm({
        name: '',
        dob: '',
        gender: 'Male',
        bloodType: 'O+',
        phone: '',
        email: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        emergencyContactRelation: '',
        allergies: '',
        conditions: '',
        rfidCard: '',
      });
      return;
    } catch (err) {
      console.error(err);
      setErrorModal({
        open: true,
        title: 'Hindi Maabot ang Server',
        message: 'Hindi na-save ang pasyente. Pakisuri ang koneksyon at subukan muli.',
      });
      setIsProcessing(false);
    }
  };

  // 2. OPEN EDIT MODAL
  const handleOpenEdit = (patient: Patient) => {
    setEditingPatient({ ...patient });
    setEditChangeReason('');
    setEditModalOpen(true);
  };

  // SAVE EDITED PATIENT
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPatient) return;

    const firstName = editingPatient.firstName.trim();
    const lastName = editingPatient.lastName.trim();
    const nameClean = `${firstName} ${lastName}`.trim();
    const phoneClean = editingPatient.phone.trim();
    const emailClean = editingPatient.email.trim();

    if (!firstName || !lastName || !phoneClean || !editingPatient.dateOfBirth || editChangeReason.trim().length < 5) {
      setErrorModal({
        open: true,
        title: 'Kulang na Impormasyon',
        message: 'Kailangan ang required demographics at change reason na hindi bababa sa 5 characters.',
      });
      return;
    }

    // Check duplicate phone among other patients. Full duplicate scoring is
    // authoritative on the API and also considers name, DOB, and address.
    const phoneDigits = phoneClean.replace(/\D/g, '');
    const existingPhone = patients.find(p => {
      if (p.id === editingPatient.id) return false;
      const pDigits = p.phone.replace(/\D/g, '');
      return (phoneDigits.length >= 7 && pDigits.endsWith(phoneDigits.slice(-10))) || pDigits === phoneDigits;
    });
    if (existingPhone) {
      setErrorModal({
        open: true,
        title: 'May Kaparehong Contact Number',
        message: `Ang contact number na "${phoneClean}" ay nakatala na kay ${existingPhone.name} (${existingPhone.patientNo}).`,
        field: 'phone',
      });
      return;
    }

    // Check duplicate email among other patients
    if (emailClean) {
      const existingEmail = patients.find(p => p.id !== editingPatient.id && p.email.toLowerCase() === emailClean.toLowerCase());
      if (existingEmail) {
        setErrorModal({
          open: true,
          title: 'May Kaparehong Email Address',
          message: `Ang email na "${emailClean}" ay nakatala na kay ${existingEmail.name} (${existingEmail.patientNo}).`,
          field: 'email',
        });
        return;
      }
    }

    setIsProcessing(true);
    setProcessingText(`Sine-save ang record ni ${nameClean}...`);
    try {
      const response = await fetch('/api/patients', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: editingPatient.id,
          firstName,
          lastName,
          dateOfBirth: editingPatient.dateOfBirth,
          gender: editingPatient.gender,
          bloodType: editingPatient.bloodType,
          phoneNumber: phoneClean,
          email: emailClean,
          address: editingPatient.streetAddress.trim(),
          city: editingPatient.city.trim(),
          state: editingPatient.state.trim(),
          zipCode: editingPatient.zipCode.trim(),
          changeReason: editChangeReason.trim(),
        }),
      });
      const body = await response.text();
      if (!body.trim()) throw new Error(`Walang tugon ang patient update API (${response.status}).`);
      let data: any;
      try { data = JSON.parse(body); }
      catch { throw new Error(`Hindi mabasa ang tugon ng patient update API (${response.status}).`); }
      if (!response.ok || !data.success) {
        const message = getApiErrorMessage(data.error, 'Hindi na-save ang pagbabago.');
        setErrorModal({ open: true, title: 'Hindi Naituloy ang Update', message });
        return;
      }

      await loadPatients();
      setEditModalOpen(false);
      if (selectedPatient?.id === editingPatient.id) {
        setSelectedPatient(null);
        setViewDetailsOpen(false);
      }
      showToast(`Record for ${nameClean} updated successfully.`);
    } catch (error) {
      console.error(error);
      setErrorModal({
        open: true,
        title: 'Hindi Maabot ang Server',
        message: 'Hindi na-save ang pagbabago. Pakisuri ang koneksyon at subukan muli.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. DELETE PATIENT CONFIRMATION
  const handleOpenDelete = (patient: Patient) => {
    setPatientToDelete(patient);
    setArchiveReason('');
    setDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!patientToDelete) return;
    const reason = archiveReason.trim();
    if (reason.length < 5) return;
    const deletedName = patientToDelete.name;
    const deletedId = patientToDelete.id;

    setIsProcessing(true);
    setProcessingText(`Ina-archive at dini-deactivate ang talaan ni ${deletedName}...`);

    try {
      const response = await fetch(`/api/patients?id=${deletedId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      const body = await response.text();
      if (!body.trim()) throw new Error(`Walang tugon ang archive API (${response.status}).`);
      let data: any;
      try { data = JSON.parse(body); }
      catch { throw new Error(`Hindi mabasa ang tugon ng archive API (${response.status}).`); }
      if (!response.ok || !data.success) {
        setErrorModal({
          open: true,
          title: 'Hindi Naituloy ang Archive',
          message: getApiErrorMessage(data.error, 'Hindi na-archive ang patient record.'),
        });
        return;
      }
      setPatients(prev => prev.filter(p => p.id !== deletedId));
      if (selectedPatient?.id === deletedId) { setViewDetailsOpen(false); setSelectedPatient(null); }
      setDeleteConfirmOpen(false);
      setPatientToDelete(null);
      showToast(`Pasyente ${deletedName} ay na-archive at na-deactivate.`, 'info');
    } catch (e) {
      setErrorModal({ open: true, title: 'Hindi Naituloy ang Archive', message: e instanceof Error ? e.message : 'Hindi na-archive ang patient record.' });
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. RFID CARD ACTIONS IN DETAILS MODAL
  const handleRevokeCard = (patient: Patient) => {
    const updated: Patient = {
      ...patient,
      cardStatus: 'Revoked'
    };
    setPatients(patients.map(p => p.id === updated.id ? updated : p));
    setSelectedPatient(updated);
    showToast(`Card ${patient.rfidCard} for ${patient.name} marked as Revoked.`, 'info');
  };

  const handleReactivateCard = (patient: Patient) => {
    const updated: Patient = {
      ...patient,
      cardStatus: 'Active'
    };
    setPatients(patients.map(p => p.id === updated.id ? updated : p));
    setSelectedPatient(updated);
    showToast(`Card ${patient.rfidCard} for ${patient.name} re-activated.`, 'success');
  };

  const handleOpenAssignCard = (patient: Patient) => {
    setSelectedPatient(patient);
    // Generate a realistic RFID UID like "C9D8E7F6"
    const randomHex = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).toUpperCase().padStart(8, '0');
    setNewCardUidInput(randomHex);
    setAssignCardModalOpen(true);
  };

  const handleConfirmAssignCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatient || !newCardUidInput.trim()) return;

    const uid = newCardUidInput.trim().toUpperCase();
    try {
      const response = await fetch('/api/patients/rfid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: selectedPatient.id,
          cardUid: uid,
          replaceExisting: Boolean(selectedPatient.rfidCard),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        showToast(getApiErrorMessage(data.error, 'Hindi na-assign ang RFID card.'), 'error');
        return;
      }

      const updated: Patient = {
        ...selectedPatient,
        rfidCard: data.card?.uid || uid,
        cardStatus: 'Active',
      };

      setPatients(patients.map(p => p.id === updated.id ? updated : p));
      setSelectedPatient(updated);
      setAssignCardModalOpen(false);
      showToast(`RFID Card ${updated.rfidCard} assigned to ${updated.name}.`, 'success');
    } catch {
      showToast('Hindi ma-contact ang server para i-assign ang RFID card.', 'error');
    }
  };

  // 5. NAVIGATE TO MEDICAL RECORDS
  const handleViewMedicalRecords = (patient: Patient) => {
    setViewDetailsOpen(false);
    showToast(`Opening medical records for ${patient.name}...`, 'info');
    router.push(isAdmin ? '/admin/medical-records' : '/medical-records');
  };

  // 6. EXPORT CSV
  const handleExportCSV = () => {
    window.location.href = '/api/admin/patients/export';
    showToast('Generating validated patient CSV export.');
    return;
    const headers = ['ID', 'Name', 'Age', 'Gender', 'Phone', 'Email', 'Address', 'RFID Card', 'Card Status', 'Total Visits', 'Last Visit', 'Blood Type', 'Allergies'];
    const rows = filteredPatients.map(p => [
      p.patientNo,
      `"${p.name}"`,
      p.age,
      p.gender,
      `"${p.phone}"`,
      `"${p.email}"`,
      `"${p.address.replace(/"/g, '""')}"`,
      p.rfidCard || 'N/A',
      p.cardStatus,
      p.totalVisits,
      p.lastVisit || 'Never',
      p.bloodType,
      `"${p.allergies.join('; ')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lagunamedical_patients_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${filteredPatients.length} patient records to CSV.`);
  };

  const handleImportCSV = async (file: File) => {
    const parseLine = (line: string) => { const values: string[] = []; let value = ''; let quoted = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { values.push(value); value = ''; } else value += char; } values.push(value); return values; };
    try {
      setIsProcessing(true); setProcessingText('Vina-validate at ini-import ang CSV...');
      const lines = (await file.text()).replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
      if (lines.length < 2) throw new Error('CSV file has no patient rows.');
      const headers = parseLine(lines[0]);
      const rows = lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header.trim(), parseLine(line)[index] || ''])));
      const response = await fetch('/api/admin/patients/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }) });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.rowErrors?.length ? `Validation failed on row ${data.rowErrors[0].row}.` : getApiErrorMessage(data.error, 'Import failed.'));
      showToast(`Imported ${data.imported} validated patient records.`); setPage(1); await loadPatients();
    } catch (error) { showToast(error instanceof Error ? error.message : 'Import failed.', 'error'); }
    finally { setIsProcessing(false); }
  };

  const handleViewDetails = (patient: Patient) => {
    setSelectedPatient(patient);
    setViewDetailsOpen(true);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 3)
      .join('');
  };

  const formatDateDisplay = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parts[0];
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      return `${month}/${day}/${year}`;
    }
    return new Date(dateStr).toLocaleDateString();
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
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ── PAGE HEADER ─────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-1 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Patient Registry</h1>
          <p className="text-[13px] text-slate-500 mt-0.5">
            Manage patient information and RFID card assignments
          </p>
        </div>

        {/* Primary Actions: Export CSV (Admin only) + Register Patient */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {isAdmin && (
            <>
              <label className="inline-flex cursor-pointer items-center space-x-1.5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-2xs hover:bg-slate-50" title="Import validated patient CSV">
                <Upload className="h-3.5 w-3.5 text-slate-500" /><span>Import CSV</span>
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleImportCSV(file); event.currentTarget.value = ''; }} />
              </label>
              <button
                type="button"
                onClick={handleExportCSV}
                title="Download CSV report"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded shadow-2xs transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
            </>
          )}

          <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded shadow-xs transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register Patient</span>
              </button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-300 rounded p-6 shadow-md">
              <DialogHeader className="border-b border-slate-200 pb-3">
                <DialogTitle className="text-lg font-semibold text-slate-900">
                  Register New Patient
                </DialogTitle>
              </DialogHeader>

              <form onSubmit={handleRegisterPatient} className="space-y-4 py-2 text-sm">
                {/* Personal Information */}
                <div className="space-y-2.5">
                  <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[13px]">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-700 font-medium mb-1 block text-[13px]">Full Name *</label>
                      <Input
                        required
                        value={newPatientForm.name}
                        onChange={(e) => setNewPatientForm({ ...newPatientForm, name: e.target.value })}
                        placeholder="e.g. Juan Dela Cruz"
                        className="h-8 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 font-medium mb-1 block text-[13px]">Date of Birth *</label>
                      <Input
                        type="date"
                        required
                        value={newPatientForm.dob}
                        onChange={(e) => setNewPatientForm({ ...newPatientForm, dob: e.target.value })}
                        className="h-8 text-sm bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-slate-700 font-medium mb-1 block text-[13px]">Gender *</label>
                      <Select
                        value={newPatientForm.gender}
                        onValueChange={(val: string) => setNewPatientForm({ ...newPatientForm, gender: val as 'Male' | 'Female' })}
                      >
                        <SelectTrigger className="h-8 text-sm bg-white">
                          <SelectValue placeholder="Select gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Male">Male</SelectItem>
                          <SelectItem value="Female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-slate-700 font-medium mb-1 block text-[13px]">Blood Type</label>
                      <Select
                        value={newPatientForm.bloodType}
                        onValueChange={(val) => setNewPatientForm({ ...newPatientForm, bloodType: val })}
                      >
                        <SelectTrigger className="h-8 text-sm bg-white">
                          <SelectValue placeholder="Select blood type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="N/A">N/A (Unknown / Hindi Alam)</SelectItem>
                          <SelectItem value="A+">A+</SelectItem>
                          <SelectItem value="A-">A-</SelectItem>
                          <SelectItem value="B+">B+</SelectItem>
                          <SelectItem value="B-">B-</SelectItem>
                          <SelectItem value="O+">O+</SelectItem>
                          <SelectItem value="O-">O-</SelectItem>
                          <SelectItem value="AB+">AB+</SelectItem>
                          <SelectItem value="AB-">AB-</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[13px]">
                    Contact Information
                  </h3>
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-slate-700 font-medium mb-1 block text-[13px]">Phone Number *</label>
                        <Input
                          required
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={11}
                          value={newPatientForm.phone}
                          onChange={(e) => setNewPatientForm({ ...newPatientForm, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                          placeholder="09171234567"
                          className="h-8 text-sm font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-slate-700 font-medium mb-1 block text-[13px]">Email Address</label>
                        <Input
                          type="email"
                          value={newPatientForm.email}
                          onChange={(e) => setNewPatientForm({ ...newPatientForm, email: e.target.value })}
                          placeholder="patient@email.com"
                          className="h-8 text-sm bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-slate-700 font-medium mb-1 block text-[13px]">Address *</label>
                      <Input
                        required
                        value={newPatientForm.address}
                        onChange={(e) => setNewPatientForm({ ...newPatientForm, address: e.target.value })}
                        placeholder="Street, Barangay, City, Province"
                        className="h-8 text-sm bg-white"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div><label className="text-slate-700 font-medium mb-1 block text-[13px]">City *</label><Input required value={newPatientForm.city} onChange={(e) => setNewPatientForm({ ...newPatientForm, city: e.target.value })} className="h-8 text-sm bg-white" /></div>
                      <div><label className="text-slate-700 font-medium mb-1 block text-[13px]">Province *</label><Input required value={newPatientForm.state} onChange={(e) => setNewPatientForm({ ...newPatientForm, state: e.target.value })} className="h-8 text-sm bg-white" /></div>
                      <div><label className="text-slate-700 font-medium mb-1 block text-[13px]">Postal Code *</label><Input required value={newPatientForm.zipCode} onChange={(e) => setNewPatientForm({ ...newPatientForm, zipCode: e.target.value })} className="h-8 text-sm bg-white" /></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div><label className="text-slate-700 font-medium mb-1 block text-[13px]">Emergency Contact *</label><Input required value={newPatientForm.emergencyContactName} onChange={(e) => setNewPatientForm({ ...newPatientForm, emergencyContactName: e.target.value })} className="h-8 text-sm bg-white" /></div>
                      <div><label className="text-slate-700 font-medium mb-1 block text-[13px]">Emergency Phone *</label><Input required inputMode="numeric" pattern="[0-9]*" maxLength={11} placeholder="09171234567" value={newPatientForm.emergencyContactPhone} onChange={(e) => setNewPatientForm({ ...newPatientForm, emergencyContactPhone: e.target.value.replace(/\D/g, '').slice(0, 11) })} className="h-8 text-sm font-mono bg-white" /></div>
                      <div><label className="text-slate-700 font-medium mb-1 block text-[13px]">Relationship *</label><Input required value={newPatientForm.emergencyContactRelation} onChange={(e) => setNewPatientForm({ ...newPatientForm, emergencyContactRelation: e.target.value })} className="h-8 text-sm bg-white" /></div>
                    </div>
                  </div>
                </div>

                {/* RFID Card Assignment */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <h3 className="font-semibold text-slate-800 uppercase tracking-wider text-[13px]">
                    RFID Card Assignment (Optional)
                  </h3>
                  <div>
                    <label className="text-slate-700 font-medium mb-1 block text-[13px]">Card UID</label>
                    <Input
                      value={newPatientForm.rfidCard}
                      onChange={(e) => setNewPatientForm({ ...newPatientForm, rfidCard: e.target.value })}
                      placeholder="e.g. B2C3D4E5 (Leave blank to assign card later)"
                      className="h-8 text-sm font-mono bg-white"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      If card UID is entered, status will automatically be set to Active.
                    </p>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAddModalOpen(false)}
                    className="h-8 text-sm"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="h-8 text-sm bg-slate-900 hover:bg-slate-800 text-white font-medium"
                  >
                    Register Patient
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* ── COMPACT KPI STRIP ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total Patients */}
        <div className="bg-white border border-slate-200 rounded p-3.5 shadow-2xs">
          <span className="text-[13px] font-medium text-slate-500 uppercase tracking-wider block">
            TOTAL PATIENTS
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-slate-900 tracking-tight">
              {patients.length}
            </span>
            <span className="text-xs text-slate-400 font-medium">Enrolled</span>
          </div>
        </div>

        {/* Active Cards */}
        <div className="bg-white border border-slate-200 rounded p-3.5 shadow-2xs">
          <span className="text-[13px] font-medium text-slate-500 uppercase tracking-wider block">
            ACTIVE CARDS
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-slate-900 tracking-tight">
              {patients.filter(p => p.cardStatus === 'Active').length}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
              Assigned
            </span>
          </div>
        </div>

        {/* Unassigned Cards */}
        <div className="bg-white border border-slate-200 rounded p-3.5 shadow-2xs">
          <span className="text-[13px] font-medium text-slate-500 uppercase tracking-wider block">
            UNASSIGNED CARDS
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-slate-900 tracking-tight">
              {patients.filter(p => p.cardStatus === 'Unassigned').length}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
              Pending
            </span>
          </div>
        </div>

        {/* New This Month */}
        <div className="bg-white border border-slate-200 rounded p-3.5 shadow-2xs">
          <span className="text-[13px] font-medium text-slate-500 uppercase tracking-wider block">
            NEW THIS MONTH
          </span>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="text-2xl font-semibold font-mono text-slate-900 tracking-tight">
              2
            </span>
            <span className="text-xs text-slate-400 font-medium">March 2024</span>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH TOOLBAR ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Field */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, email, phone, or card UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:border-slate-600"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Gender Filter */}
          <div className="w-full sm:w-36">
            <Select value={filterGender} onValueChange={setFilterGender}>
              <SelectTrigger className="h-8 text-sm bg-white border-slate-300">
                <SelectValue placeholder="All Genders" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Genders</SelectItem>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Card Status Filter */}
          <div className="w-full sm:w-44">
            <Select value={filterCardStatus} onValueChange={setFilterCardStatus}>
              <SelectTrigger className="h-8 text-sm bg-white border-slate-300">
                <SelectValue placeholder="All Card Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Card Status</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="Unassigned">Unassigned</SelectItem>
                <SelectItem value="Revoked">Revoked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Records Count */}
        <div className="text-[13px] text-slate-500 font-mono self-end sm:self-center">
          Showing {filteredPatients.length} of {totalPatients} records
        </div>
      </div>

      {/* ── PATIENT TABLE CONTAINER ─────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            {/* Column Headers */}
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Patient
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Contact
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  RFID Card
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Card Status
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs text-center">
                  Visits
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs">
                  Last Visit
                </th>
                <th className="py-2.5 px-4 font-medium text-slate-600 uppercase tracking-wider text-xs text-right">
                  Actions
                </th>
              </tr>
            </thead>

            {/* Table Rows */}
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredPatients.map((patient) => {
                const initials = getInitials(patient.name);

                return (
                  <tr key={patient.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Patient Name & Initials */}
                    <td className="py-2.5 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-7 h-7 rounded bg-slate-100 border border-slate-200 text-slate-700 font-medium text-xs flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(patient)}
                            className="font-medium text-slate-900 hover:text-blue-700 text-left truncate block text-sm"
                          >
                            {patient.name}
                          </button>
                          <div className="text-[13px] text-slate-500 font-normal">
                            {patient.age} years • {patient.gender}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Contact (Phone & Email) */}
                    <td className="py-2.5 px-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-1.5 text-slate-700 text-sm">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{patient.phone}</span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-slate-500 text-[13px]">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate max-w-[190px]">{patient.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* RFID Card Identifier */}
                    <td className="py-2.5 px-4">
                      {patient.rfidCard ? (
                        <span className="font-mono text-xs text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          {patient.rfidCard}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleOpenAssignCard(patient)}
                          className="text-slate-500 hover:text-slate-900 italic text-[13px] hover:underline"
                          title="Click to assign RFID card"
                        >
                          Not assigned (Assign)
                        </button>
                      )}
                    </td>

                    {/* Card Status */}
                    <td className="py-2.5 px-4">
                      {patient.cardStatus === 'Active' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                          <span>Active</span>
                        </span>
                      )}
                      {patient.cardStatus === 'Unassigned' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                          <span>Unassigned</span>
                        </span>
                      )}
                      {patient.cardStatus === 'Revoked' && (
                        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block" />
                          <span>Revoked</span>
                        </span>
                      )}
                    </td>

                    {/* Total Visits */}
                    <td className="py-2.5 px-4 text-center font-mono text-slate-700 text-sm">
                      {patient.totalVisits}
                    </td>

                    {/* Last Visit */}
                    <td className="py-2.5 px-4 text-slate-600 font-mono text-sm">
                      {formatDateDisplay(patient.lastVisit)}
                    </td>

                    {/* Actions */}
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center space-x-1">
                        <button
                          type="button"
                          onClick={() => handleViewDetails(patient)}
                          title="View Details"
                          className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(patient)}
                          title="Edit Patient"
                          className="p-1 text-slate-500 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleOpenDelete(patient)}
                            title="Archive Patient (Admin only)"
                            className="p-1 text-slate-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
        {loadError && <div role="alert" className="border-t border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{loadError} <button type="button" onClick={loadPatients} className="font-semibold underline">Retry</button></div>}
        {!loading && !loadError && filteredPatients.length === 0 && (
          <div className="text-center py-10 text-sm">
            <User className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-700 text-sm">No patients found</p>
            <p className="text-slate-500 mt-0.5 text-[13px]">Try adjusting your search query or filters</p>
          </div>
        )}
        <PaginationControls page={page} totalPages={totalPages} total={totalPatients} pageSize={pageSize} loading={loading} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
      </div>

      {/* ── EDIT PATIENT MODAL ──────────────────────────────────────── */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Edit Patient Record ({editingPatient?.patientNo})
            </DialogTitle>
          </DialogHeader>

          {editingPatient && (
            <form onSubmit={handleSaveEdit} className="space-y-4 py-2 text-sm">
              {/* Personal Information */}
              <div className="space-y-2.5">
                <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[13px] text-slate-700 font-medium mb-1 block">First Name *</label>
                    <Input
                      required
                      value={editingPatient.firstName}
                      onChange={(e) => setEditingPatient({ ...editingPatient, firstName: e.target.value })}
                      className="h-8 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[13px] text-slate-700 font-medium mb-1 block">Last Name *</label>
                    <Input
                      required
                      value={editingPatient.lastName}
                      onChange={(e) => setEditingPatient({ ...editingPatient, lastName: e.target.value })}
                      className="h-8 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[13px] text-slate-700 font-medium mb-1 block">Date of Birth *</label>
                    <Input
                      required
                      type="date"
                      max={new Date().toISOString().split('T')[0]}
                      value={editingPatient.dateOfBirth}
                      onChange={(e) => setEditingPatient({ ...editingPatient, dateOfBirth: e.target.value })}
                      className="h-8 text-sm bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[13px] text-slate-700 font-medium mb-1 block">Gender</label>
                    <Select
                      value={editingPatient.gender}
                      onValueChange={(val: string) => setEditingPatient({ ...editingPatient, gender: val as 'Male' | 'Female' })}
                    >
                      <SelectTrigger className="h-8 text-sm bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[13px] text-slate-700 font-medium mb-1 block">Blood Type</label>
                    <Select
                      value={editingPatient.bloodType}
                      onValueChange={(val) => setEditingPatient({ ...editingPatient, bloodType: val })}
                    >
                      <SelectTrigger className="h-8 text-sm bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A+">A+</SelectItem>
                        <SelectItem value="A-">A-</SelectItem>
                        <SelectItem value="B+">B+</SelectItem>
                        <SelectItem value="B-">B-</SelectItem>
                        <SelectItem value="O+">O+</SelectItem>
                        <SelectItem value="O-">O-</SelectItem>
                        <SelectItem value="AB+">AB+</SelectItem>
                        <SelectItem value="AB-">AB-</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                  Contact Information
                </h3>
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[13px] text-slate-700 font-medium mb-1 block">Phone Number *</label>
                      <Input
                        required
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={11}
                        placeholder="09171234567"
                        value={editingPatient.phone}
                        onChange={(e) => setEditingPatient({ ...editingPatient, phone: e.target.value.replace(/\D/g, '').slice(0, 11) })}
                        className="h-8 text-sm font-mono bg-white"
                      />
                    </div>
                    <div>
                      <label className="text-[13px] text-slate-700 font-medium mb-1 block">Email Address</label>
                      <Input
                        type="email"
                        value={editingPatient.email}
                        onChange={(e) => setEditingPatient({ ...editingPatient, email: e.target.value })}
                        className="h-8 text-sm bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[13px] text-slate-700 font-medium mb-1 block">Address</label>
                    <Input
                      value={editingPatient.streetAddress}
                      onChange={(e) => setEditingPatient({ ...editingPatient, streetAddress: e.target.value })}
                      className="h-8 text-sm bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <Input required value={editingPatient.city} onChange={(e) => setEditingPatient({ ...editingPatient, city: e.target.value })} placeholder="City" className="h-8 text-sm bg-white" />
                    <Input required value={editingPatient.state} onChange={(e) => setEditingPatient({ ...editingPatient, state: e.target.value })} placeholder="State / Province" className="h-8 text-sm bg-white" />
                    <Input required value={editingPatient.zipCode} onChange={(e) => setEditingPatient({ ...editingPatient, zipCode: e.target.value })} placeholder="ZIP code" className="h-8 text-sm bg-white" />
                  </div>
                </div>
              </div>

              {/* RFID Card Information */}
              <div className="space-y-2.5 pt-2 border-t border-slate-100">
                <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                  RFID Assignment & Status
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[13px] text-slate-700 font-medium mb-1 block">Card UID</label>
                    <Input
                      value={editingPatient.rfidCard || ''}
                      readOnly
                      aria-readonly="true"
                      placeholder="No card assigned"
                      className="h-8 text-sm font-mono bg-slate-50"
                    />
                  </div>
                  <div>
                    <label className="text-[13px] text-slate-700 font-medium mb-1 block">Card Status</label>
                    <Input value={editingPatient.cardStatus} readOnly aria-readonly="true" className="h-8 text-sm bg-slate-50" />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t border-slate-100">
                <label className="text-[13px] text-slate-700 font-medium block">Reason for demographic change *</label>
                <Input required minLength={5} maxLength={250} value={editChangeReason} onChange={(e) => setEditChangeReason(e.target.value)} placeholder="Example: Corrected address after identity verification" className="h-8 text-sm bg-white" />
                <p className="text-[11px] text-slate-500">This reason and the before/after values are retained in the demographic history.</p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditModalOpen(false)}
                  className="h-8 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isProcessing}
                  className="h-8 text-sm bg-slate-900 hover:bg-slate-800 text-white font-medium"
                >
                  {isProcessing ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── DELETE PATIENT CONFIRMATION DIALOG ──────────────────────── */}
      {/* ── QUICK ASSIGN RFID CARD MODAL ────────────────────────────── */}
      <Dialog open={assignCardModalOpen} onOpenChange={setAssignCardModalOpen}>
        <DialogContent className="max-w-md bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-slate-900 flex items-center space-x-2">
              <CreditCard className="w-4 h-4 text-slate-700" />
              <span>Assign RFID Card UID</span>
            </DialogTitle>
          </DialogHeader>

          {selectedPatient && (
            <form onSubmit={handleConfirmAssignCard} className="space-y-4 py-2 text-sm">
              <p className="text-slate-600">
                Assign a physical smart card to{' '}
                <strong className="text-slate-900 font-medium">{selectedPatient.name}</strong> ({selectedPatient.patientNo}).
              </p>

              <div>
                <label className="text-[13px] text-slate-700 font-medium mb-1 block">Card UID (Hexadecimal)</label>
                <div className="flex items-center space-x-2">
                  <Input
                    required
                    value={newCardUidInput}
                    onChange={(e) => setNewCardUidInput(e.target.value.toUpperCase())}
                    placeholder="e.g. C9D8E7F6"
                    className="h-8 text-sm font-mono bg-white uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const rand = Math.floor(Math.random() * 0xFFFFFFFF).toString(16).toUpperCase().padStart(8, '0');
                      setNewCardUidInput(rand);
                    }}
                    title="Generate test UID"
                    className="px-2 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded text-xs font-mono whitespace-nowrap"
                  >
                    Auto-scan
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Card status will be updated to Active upon assignment.
                </p>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAssignCardModalOpen(false)}
                  className="h-8 text-sm"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-8 text-sm bg-slate-900 hover:bg-slate-800 text-white font-medium"
                >
                  Assign Card
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── PATIENT DETAILS MODAL ────────────────────────────────────── */}
      <Dialog open={viewDetailsOpen} onOpenChange={setViewDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white border border-slate-300 rounded p-6 shadow-md">
          <DialogHeader className="border-b border-slate-200 pb-3">
            <DialogTitle className="text-lg font-semibold text-slate-900">
              Patient Record Details
            </DialogTitle>
          </DialogHeader>

          {selectedPatient && (
            <div className="space-y-4 py-2 text-sm">
              {/* Header profile banner */}
              <div className="flex items-start justify-between pb-3 border-b border-slate-200">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded bg-slate-100 border border-slate-200 text-slate-800 font-medium text-lg flex items-center justify-center">
                    {getInitials(selectedPatient.name)}
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{selectedPatient.name}</h2>
                    <div className="flex items-center space-x-2 text-slate-500 text-[13px] mt-0.5">
                      <span>{selectedPatient.age} years old</span>
                      <span>•</span>
                      <span>{selectedPatient.gender}</span>
                      <span>•</span>
                      <span>Blood Type: <strong className="text-slate-800 font-medium">{selectedPatient.bloodType}</strong></span>
                    </div>
                  </div>
                </div>

                <div>
                  {selectedPatient.cardStatus === 'Active' && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" />
                      <span>Card: Active</span>
                    </span>
                  )}
                  {selectedPatient.cardStatus === 'Unassigned' && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 inline-block" />
                      <span>Card: Unassigned</span>
                    </span>
                  )}
                  {selectedPatient.cardStatus === 'Revoked' && (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-600 inline-block" />
                      <span>Card: Revoked</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Contact Information */}
              <div className="space-y-2">
                <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                  Contact Information
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-1.5 text-sm">
                  <div className="flex items-center space-x-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-500 font-medium text-[13px]">Phone:</span>
                    <span className="text-slate-900 font-mono text-sm">{selectedPatient.phone}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="text-slate-500 font-medium text-[13px]">Email:</span>
                    <span className="text-slate-900 text-sm">{selectedPatient.email}</span>
                  </div>
                  <div className="flex items-start space-x-2">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                    <span className="text-slate-500 font-medium text-[13px]">Address:</span>
                    <span className="text-slate-900 text-sm">{selectedPatient.address}</span>
                  </div>
                </div>
              </div>

              {/* RFID Card Information */}
              <div className="space-y-2">
                <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                  RFID Card Assignment
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded p-3">
                  {selectedPatient.rfidCard ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs text-slate-500 block">Assigned Card UID</span>
                        <code className="text-sm font-mono font-medium text-slate-900">
                          {selectedPatient.rfidCard}
                        </code>
                      </div>
                      <div className="flex items-center space-x-2">
                        {selectedPatient.cardStatus === 'Active' ? (
                          <button
                            type="button"
                            onClick={() => handleRevokeCard(selectedPatient)}
                            className="px-2.5 py-1 text-xs border border-red-300 text-red-700 hover:bg-red-50 rounded font-medium transition-colors"
                          >
                            Revoke Card
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReactivateCard(selectedPatient)}
                            className="px-2.5 py-1 text-xs border border-emerald-300 text-emerald-700 hover:bg-emerald-50 rounded font-medium transition-colors"
                          >
                            Re-activate Card
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between py-1">
                      <span className="text-slate-500 italic text-sm">No RFID card currently assigned</span>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleOpenAssignCard(selectedPatient)}
                        className="h-8 text-sm bg-slate-900 hover:bg-slate-800 text-white font-medium"
                      >
                        Assign Card
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Baseline Vital Signs & Triage Panel */}
              <div className="space-y-2">
                <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                  Baseline Vital Signs (Triage Intake)
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white p-2 border border-slate-200 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Blood Pressure</span>
                      <span className="font-bold text-slate-900 font-mono text-sm">{selectedPatient.vitals?.bloodPressure || '120/80'}</span>
                      <span className="text-[10px] text-slate-400 ml-1">mmHg</span>
                    </div>
                    <div className="bg-white p-2 border border-slate-200 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Heart Rate</span>
                      <span className="font-bold text-slate-900 font-mono text-sm">{selectedPatient.vitals?.heartRate || 75}</span>
                      <span className="text-[10px] text-slate-400 ml-1">bpm</span>
                    </div>
                    <div className="bg-white p-2 border border-slate-200 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Temperature</span>
                      <span className="font-bold text-slate-900 font-mono text-sm">{selectedPatient.vitals?.temperature || 36.6}</span>
                      <span className="text-[10px] text-slate-400 ml-1">°C</span>
                    </div>
                    <div className="bg-white p-2 border border-slate-200 rounded">
                      <span className="text-slate-500 block text-[10px] uppercase font-semibold">Oxygen Sat. (SpO2)</span>
                      <span className="font-bold text-slate-900 font-mono text-sm">{selectedPatient.vitals?.oxygenSaturation || 98}</span>
                      <span className="text-[10px] text-slate-400 ml-1">%</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-white p-2 border border-slate-200 rounded flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Weight &amp; Height:</span>
                      <span className="font-semibold text-slate-900 font-mono text-[11px]">
                        {selectedPatient.vitals?.weight || 65} kg • {selectedPatient.vitals?.height || 165} cm
                      </span>
                    </div>
                    <div className="bg-white p-2 border border-slate-200 rounded flex items-center justify-between">
                      <span className="text-slate-500 text-[11px]">Computed BMI:</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                        {selectedPatient.vitals?.bmi || 23.9} kg/m² • Normal
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Clinical & Encounter Information */}
              <div className="space-y-2">
                <h3 className="font-medium text-slate-700 uppercase tracking-wider text-xs">
                  Clinical & Encounter History
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2.5">
                  <div>
                    <span className="text-xs text-slate-500 block mb-1">Documented Allergies</span>
                    {selectedPatient.allergies.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedPatient.allergies.map((allergy, idx) => (
                          <span
                            key={idx}
                            className="bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded text-xs font-medium"
                          >
                            {allergy}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-slate-400 italic text-sm">No known allergies documented</span>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <span className="text-slate-500 block text-xs">Total Visits</span>
                      <span className="text-xl font-semibold text-slate-900 font-mono">
                        {selectedPatient.totalVisits}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">Last Visit</span>
                      <span className="font-normal text-slate-900 font-mono text-sm">
                        {formatDateDisplay(selectedPatient.lastVisit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-xs">Registration Date</span>
                      <span className="font-normal text-slate-900 font-mono text-sm">
                        {formatDateDisplay(selectedPatient.registeredDate)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setViewDetailsOpen(false)}
                  className="h-8 text-sm"
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleViewMedicalRecords(selectedPatient)}
                  className="h-8 text-sm bg-slate-900 hover:bg-slate-800 text-white font-medium"
                >
                  View Medical Records
                </Button>
              </div>
            </div>
          )}
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

      {/* ── DELETE CONFIRMATION MODAL (Yes or No) ────────────────────── */}
      <Dialog
        open={deleteConfirmOpen}
        onOpenChange={(open) => {
          if (isProcessing) return;
          setDeleteConfirmOpen(open);
          if (!open) {
            setPatientToDelete(null);
            setArchiveReason('');
          }
        }}
      >
        <DialogContent className="max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white p-0 shadow-2xl">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleConfirmDelete();
            }}
          >
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-950">I-archive ang patient record?</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">
                    Ililipat ang record sa Patient Master Index at hindi na ito lalabas sa active registry.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Patient record</p>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-950">{patientToDelete?.name}</p>
                  <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px] font-semibold text-slate-600">
                    {patientToDelete?.patientNo}
                  </span>
                </div>
              </div>

              <div>
                <label htmlFor="archive-reason" className="text-xs font-bold text-slate-800">
                  Reason for archiving <span className="text-rose-600">*</span>
                </label>
                <p className="mt-1 text-[11px] text-slate-500">Ilalagay ito sa audit trail at demographic history.</p>
                <textarea
                  id="archive-reason"
                  autoFocus
                  required
                  minLength={5}
                  maxLength={300}
                  rows={4}
                  value={archiveReason}
                  onChange={(event) => setArchiveReason(event.target.value)}
                  placeholder="Halimbawa: Duplicate registration confirmed by records staff"
                  className="mt-2 w-full resize-none rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-sm text-slate-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-100"
                />
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className={archiveReason.trim().length > 0 && archiveReason.trim().length < 5 ? 'font-semibold text-rose-600' : 'text-slate-500'}>
                    Minimum 5 characters
                  </span>
                  <span className="text-slate-400">{archiveReason.length}/300</span>
                </div>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
                <p className="font-bold">Kapag itinuloy:</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-amber-800">
                  <li>Made-deactivate ang patient account at active sessions.</li>
                  <li>Made-revoke ang assigned RFID card.</li>
                  <li>Mananatili ang clinical history at maaari pang i-restore.</li>
                </ul>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={isProcessing}
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setPatientToDelete(null);
                  setArchiveReason('');
                }}
                className="h-10 px-4 text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isProcessing || archiveReason.trim().length < 5}
                className="h-10 bg-amber-700 px-5 text-xs font-bold text-white hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldAlert className="mr-2 h-4 w-4" />}
                Archive patient record
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── LOADING & PROCESSING MODAL ───────────────────────────────── */}
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
