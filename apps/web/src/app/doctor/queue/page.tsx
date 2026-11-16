'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSession, signOut } from 'next-auth/react';
import LogoutConfirmModal from '@/components/LogoutConfirmModal';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Activity,
  Clock,
  CheckCircle2,
  PhoneCall,
  RefreshCw,
  Pencil,
  X,
  Loader2,
  Stethoscope,
  LogOut,
  FileText,
  Search,
  Filter,
  Calendar,
  User,
  AlertCircle,
  AlertTriangle,
  HeartPulse,
  Thermometer,
  ShieldAlert,
  Pill,
  Trash2,
  Plus,
  BarChart3,
  Settings,
  MessageSquareText,
  ChevronLeft,
  ChevronRight,
  Radio,
  UserPlus,
} from 'lucide-react';
import WorkstationSettingsModal from '@/components/WorkstationSettingsModal';
import { useQueueRealtime } from '@/hooks/useQueueRealtime';
import { getApiErrorMessage } from '@/lib/client-response';

interface QueueTicket {
  id: string;
  ticketNumber: string;
  queueNumber: number;
  patientId: string;
  patientName: string;
  cardUid: string;
  department: string;
  doctor: string;
  doctorId: string;
  room: string;
  priority: 'Regular' | 'Senior/PWD' | 'Urgent';
  timeIssued: string;
  status: 'WAITING' | 'CALLED' | 'IN_CONSULTATION' | 'COMPLETED' | 'CANCELLED';
  reasonForVisit?: string;
  calledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

interface PatientDetails {
  id: string;
  patientNo: string;
  name: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  cardUid: string;
  triageReason?: string;
  dateOfBirth: string;
  age: number;
  gender: string;
  bloodType: string;
  phone: string;
  address: string;
  emergencyContact: string;
  allergies: string;
  chronicConditions: string;
  lastVisit: string;
  vitals: {
    bloodPressure: string;
    heartRate: number;
    temperature: number;
    respiratoryRate: number;
    oxygenSaturation: number;
    weight: number;
    height: number;
    bmi: number;
  };
  pastRecords?: Array<{
    id: string;
    date: string;
    doctor: string;
    diagnosis: string;
    subjective: string;
    plan: string;
  }>;
}

export default function DoctorQueue() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Filters State
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'WAITING' | 'ACTIVE' | 'COMPLETED'>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | 'Regular' | 'Senior/PWD' | 'Urgent'>('ALL');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Patient Details Modal State
  const [selectedPatientTicket, setSelectedPatientTicket] = useState<QueueTicket | null>(null);
  const [patientDetails, setPatientDetails] = useState<PatientDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Complete Consultation Modal State
  const [completingTicket, setCompletingTicket] = useState<QueueTicket | null>(null);
  const [completionForm, setCompletionForm] = useState({
    encounterDate: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    chiefComplaint: '',
    diagnosis: '',
    plan: '',
    prescriptions: '',
    disposition: 'Discharged / Consultation Completed',
  });
  const [savingEncounter, setSavingEncounter] = useState(false);

  // Clinical Prescription Station Modal State
  const [prescriptionModalTicket, setPrescriptionModalTicket] = useState<QueueTicket | null>(null);
  const [patientRxList, setPatientRxList] = useState<any[]>([]);
  const [rxLoading, setRxLoading] = useState(false);
  const [rxSubmitting, setRxSubmitting] = useState(false);
  const [rxSuccessMsg, setRxSuccessMsg] = useState('');
  const [rxForm, setRxForm] = useState({
    medicationName: '',
    dosage: '',
    frequency: '',
    duration: '7 days',
    quantity: '10',
    instructions: '',
  });
  const [rxSignaturePassword, setRxSignaturePassword] = useState('');
  const [rxSignatureConsent, setRxSignatureConsent] = useState(false);

  // Modal Dialog States (Errors, Loading, and Confirmations)
  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    message: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingText, setProcessingText] = useState('Pinoproseso...');
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'primary' | 'danger';
    onConfirm: () => void;
  } | null>(null);

  // Doctor Profile & Settings States
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [docSoundEnabled, setDocSoundEnabled] = useState(true);
  const [docRefreshInterval, setDocRefreshInterval] = useState(5);
  const [queueControl, setQueueControl] = useState<{ status: 'OPEN' | 'PAUSED' | 'CLOSED'; reason?: string | null }>({ status: 'OPEN' });
  const [queueControlModal, setQueueControlModal] = useState<{
    open: boolean;
    targetStatus: 'OPEN' | 'PAUSED' | 'CLOSED';
  } | null>(null);
  const [queueControlReason, setQueueControlReason] = useState('');
  const [queueControlSubmitting, setQueueControlSubmitting] = useState(false);

  const [transferDoctors, setTransferDoctors] = useState<Array<{ id: string; name: string; specialization: string }>>([]);
  const [transferModal, setTransferModal] = useState<{
    open: boolean;
    ticket: QueueTicket;
    targetDoctorId: string;
    targetDoctorName: string;
  } | null>(null);
  const [transferReason, setTransferReason] = useState('');
  const [transferSubmitting, setTransferSubmitting] = useState(false);

  const playDoctorChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (_) {}
  }, []);
  const [profileSaving, setProfileSaving] = useState(false);
  const [showDocPassword, setShowDocPassword] = useState(false);
  const [docSuccessMsg, setDocSuccessMsg] = useState('');
  const [profile, setProfile] = useState<{
    name: string;
    email: string;
    room: string;
    specialty: string;
    contact: string;
    prcLicense: string;
    password?: string;
  }>({
    name: '',
    email: '',
    room: '',
    specialty: '',
    contact: '',
    prcLicense: '',
    password: '',
  });

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user/profile');
      const data = await res.json();
      if (data.success && data.profile) {
        setProfile({
          name: data.profile.name || '',
          email: data.profile.email || '',
          room: data.profile.room || '',
          specialty: data.profile.specialty || '',
          contact: data.profile.contact || '',
          prcLicense: data.profile.prcLicense || '',
          password: '',
        });
      }
    } catch (err) {
      console.error('Error fetching doctor profile:', err);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setProfileSaving(true);
      setDocSuccessMsg('');
      const payload: any = {
        name: profile.name.trim(),
        room: profile.room.trim(),
        specialty: profile.specialty.trim(),
        contact: profile.contact.trim(),
        prcLicense: profile.prcLicense.trim(),
      };
      if (profile.password && profile.password.trim()) {
        payload.password = profile.password.trim();
      }

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorModal({
          open: true,
          title: 'Error sa Pag-update ng Profile',
          message: getApiErrorMessage(data.error, 'Hindi na-update ang profile sa server.'),
        });
        return;
      }

      setDocSuccessMsg('Profile and consultation room successfully updated');
      setTimeout(() => {
        setIsEditAccountOpen(false);
        setDocSuccessMsg('');
      }, 1400);
      loadProfile();
    } catch (err) {
      console.error('Error saving doctor profile:', err);
      setErrorModal({
        open: true,
        title: 'Network / Server Error',
        message: 'Nagka-error sa pakikipag-ugnayan sa server habang ina-update ang profile.',
      });
    } finally {
      setProfileSaving(false);
    }
  };

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/queue');
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        setTickets(data.tickets);
      }
      const controlRes = await fetch('/api/queue/control');
      const controlData = await controlRes.json();
      if (controlData.success && controlData.state) setQueueControl(controlData.state);
      const doctorsRes = await fetch('/api/doctors');
      const doctorsData = await doctorsRes.json();
      if (doctorsData.success && Array.isArray(doctorsData.doctors)) setTransferDoctors(doctorsData.doctors.map((doctor: any) => ({ id: doctor.id, name: doctor.name, specialization: doctor.specialization })));
    } catch (err) {
      console.error('Error fetching doctor queue:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') {
      loadQueue();
    }
  }, [status, loadQueue]);
  useQueueRealtime(loadQueue, { enabled: status === 'authenticated', fallbackMs: Math.max(30_000, docRefreshInterval * 1000) });

  // Open Patient Details Modal (Can be viewed before calling!)
  const handleViewPatientDetails = async (ticket: QueueTicket) => {
    setSelectedPatientTicket(ticket);
    setDetailsLoading(true);
    setPatientDetails(null);
    try {
      const url = ticket.patientId
        ? `/api/patients?patientId=${ticket.patientId}`
        : `/api/patients?cardUid=${ticket.cardUid}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.patient) {
        setPatientDetails(data.patient);
      } else {
        setErrorModal({
          open: true,
          title: 'Hindi Mabuksan ang Chart',
          message: getApiErrorMessage(data.error, 'Hindi mahanap ang clinical chart para sa pasyenteng ito.'),
        });
      }
    } catch (err) {
      console.error('Error loading patient details:', err);
      setErrorModal({
        open: true,
        title: 'Network Error',
        message: 'Nagka-error sa pagkonekta sa medical records server.',
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  // Update Ticket Status (CALL, START CONSULTATION)
  const updateTicketStatus = async (
    ticketId: string,
    newStatus: 'CALLED' | 'IN_CONSULTATION' | 'COMPLETED',
    extraPayload?: any
  ) => {
    try {
      setActionLoading(ticketId);
      const bodyPayload = {
        status: newStatus,
        ...extraPayload,
      };

      const res = await fetch(`/api/queue/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
      });

      const data = await res.json();
      if (data.success) {
        await loadQueue();
        // If modal was open, refresh selected ticket status
        if (selectedPatientTicket && selectedPatientTicket.id === ticketId) {
          setSelectedPatientTicket({ ...selectedPatientTicket, status: newStatus });
        }
      } else {
        setErrorModal({
          open: true,
          title: 'Error sa Pag-update ng Ticket',
          message: getApiErrorMessage(data.error, 'Hindi na-update ang status ng queue ticket.'),
        });
      }
    } catch (err) {
      console.error('Error updating status:', err);
      setErrorModal({
        open: true,
        title: 'Network Error',
        message: 'May problema sa koneksyon habang ina-update ang ticket.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const recallPatient = async (ticketId: string) => {
    try {
      setActionLoading(ticketId);
      const res = await fetch(`/api/queue/${ticketId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'RECALL' }) });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Hindi na-recall ang pasyente.');
      playDoctorChime();
      await loadQueue();
    } catch (error) {
      setErrorModal({ open: true, title: 'Recall Failed', message: error instanceof Error ? error.message : 'Hindi na-recall ang pasyente.' });
    } finally { setActionLoading(null); }
  };

  const queuePausePresets = [
    'Emergency / ER Consultation',
    'Short Break / Meal Break',
    'Ward Rounds / Clinical Handoff',
    'Room Sanitization / Setup',
  ];

  const queueClosePresets = [
    'Outpatient Clinic Hours Ended',
    'Daily Patient Cut-off Reached',
    'Emergency Procedure / Operating Room',
    'Attending Physician Off-Duty',
  ];

  const changeQueueControl = (nextStatus: 'OPEN' | 'PAUSED' | 'CLOSED') => {
    setQueueControlReason(nextStatus === 'OPEN' ? '' : queueControl.reason || '');
    setQueueControlModal({
      open: true,
      targetStatus: nextStatus,
    });
  };

  const handleConfirmQueueControl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueControlModal) return;
    const nextStatus = queueControlModal.targetStatus;
    const trimmedReason = queueControlReason.trim();

    if (nextStatus !== 'OPEN' && trimmedReason.length < 3) {
      setErrorModal({
        open: true,
        title: 'Kailangan ang Dahilan (Reason Required)',
        message:
          nextStatus === 'PAUSED'
            ? 'Pakilagay ang dahilan kung bakit pansamantalang ipo-pause ang pila (minimum 3 characters).'
            : 'Pakilagay ang dahilan kung bakit isasara ang pila ng konsultasyon (minimum 3 characters).',
      });
      return;
    }

    try {
      setQueueControlSubmitting(true);
      const res = await fetch('/api/queue/control', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: nextStatus,
          reason: nextStatus === 'OPEN' ? undefined : trimmedReason,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setQueueControl(data.state);
        setQueueControlModal(null);
        setQueueControlReason('');
      } else {
        setErrorModal({
          open: true,
          title: 'Queue Control Failed',
          message: data.error || 'Hindi na-update ang queue control.',
        });
      }
    } catch (error) {
      setErrorModal({
        open: true,
        title: 'Network Error',
        message: 'Nagka-error sa pakikipag-ugnayan sa server habang binabago ang status ng pila.',
      });
    } finally {
      setQueueControlSubmitting(false);
    }
  };

  const transferPatient = (ticketId: string, targetDoctorId: string) => {
    if (!targetDoctorId) return;
    const ticket = tickets.find((t) => t.id === ticketId);
    const targetDoc = transferDoctors.find((d) => d.id === targetDoctorId);
    if (!ticket || !targetDoc) return;
    setTransferReason('');
    setTransferModal({
      open: true,
      ticket,
      targetDoctorId,
      targetDoctorName: `${targetDoc.name} (${targetDoc.specialization})`,
    });
  };

  const handleConfirmTransferPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferModal) return;
    const trimmedReason = transferReason.trim();
    if (trimmedReason.length < 3) {
      setErrorModal({
        open: true,
        title: 'Kailangan ang Dahilan ng Transfer',
        message: 'Pakilagay ang klinikal na dahilan sa paglipat ng pasyente (minimum 3 characters).',
      });
      return;
    }
    try {
      setTransferSubmitting(true);
      setActionLoading(transferModal.ticket.id);
      const res = await fetch(`/api/queue/${transferModal.ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'TRANSFER',
          targetDoctorId: transferModal.targetDoctorId,
          reason: trimmedReason,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Hindi na-transfer ang pasyente.');
      setTransferModal(null);
      setTransferReason('');
      await loadQueue();
    } catch (error) {
      setErrorModal({
        open: true,
        title: 'Transfer Failed',
        message: error instanceof Error ? error.message : 'Hindi na-transfer ang pasyente.',
      });
    } finally {
      setTransferSubmitting(false);
      setActionLoading(null);
    }
  };

  // Open Completion Modal before marking COMPLETED
  const handleOpenCompleteModal = (ticket: QueueTicket) => {
    const now = new Date();
    const currentHours = String(now.getHours()).padStart(2, '0');
    const currentMins = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHours}:${currentMins}`;

    // Derive start time if available from ticket
    let startStr = currentTimeStr;
    if (ticket.startedAt) {
      const sDate = new Date(ticket.startedAt);
      startStr = `${String(sDate.getHours()).padStart(2, '0')}:${String(sDate.getMinutes()).padStart(2, '0')}`;
    } else if (ticket.calledAt) {
      const cDate = new Date(ticket.calledAt);
      startStr = `${String(cDate.getHours()).padStart(2, '0')}:${String(cDate.getMinutes()).padStart(2, '0')}`;
    }

    setCompletingTicket(ticket);
    setCompletionForm({
      encounterDate: now.toISOString().split('T')[0],
      startTime: startStr,
      endTime: currentTimeStr,
      chiefComplaint: `Consultation at ${ticket.department || 'Outpatient Clinic'}`,
      diagnosis: '',
      plan: '',
      prescriptions: '',
      disposition: 'Discharged / Consultation Completed',
    });
  };

  // Actual completion execution
  const executeCompleteConsultation = async () => {
    if (!completingTicket) return;
    try {
      setSavingEncounter(true);
      setIsProcessing(true);
      setProcessingText(`Itinatala ang opisyal na konsultasyon para kay ${completingTicket.patientName}...`);

      // Build full timestamps from date and times
      const datePart = completionForm.encounterDate;
      const startDateTime = new Date(`${datePart}T${completionForm.startTime}:00`);
      const endDateTime = new Date(`${datePart}T${completionForm.endTime}:00`);

      const payload = {
        status: 'COMPLETED',
        startedAt: startDateTime.toISOString(),
        completedAt: endDateTime.toISOString(),
        chiefComplaint: completionForm.chiefComplaint.trim(),
        diagnosis: completionForm.diagnosis.trim(),
        plan: completionForm.plan.trim(),
        prescriptions: completionForm.prescriptions.trim(),
        notes: `Disposition: ${completionForm.disposition}. Plan: ${completionForm.plan}`,
      };

      await updateTicketStatus(completingTicket.id, 'COMPLETED', payload);
      setCompletingTicket(null);
    } catch (err) {
      console.error('Error completing consultation:', err);
      setErrorModal({
        open: true,
        title: 'Error sa Pag-save ng Konsultasyon',
        message: 'May naganap na error habang itinatala ang natapos na konsultasyon sa server.',
      });
    } finally {
      setSavingEncounter(false);
      setIsProcessing(false);
    }
  };

  // Submit Completed Consultation with Timeline & Clinical Notes (Triggers Yes/No Confirmation)
  const handleConfirmCompleteConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completingTicket) return;

    if (!completionForm.diagnosis.trim()) {
      setErrorModal({
        open: true,
        title: 'Kulang na Diagnosis',
        message: 'Pakilagay ang Diagnosis o Clinical Assessment bago tapusin ang konsultasyon.',
      });
      return;
    }

    setConfirmModal({
      open: true,
      title: 'Kumpirmahin ang Pagtatapos ng Konsultasyon',
      message: `Sigurado ka bang nais mong tapusin at i-record ang konsultasyon para kay "${completingTicket.patientName}"? Ang rekord na ito ay maipapadala sa medical records archive.`,
      confirmText: 'Oo, Tapusin ang Konsultasyon',
      cancelText: 'Bumalik',
      variant: 'primary',
      onConfirm: () => {
        setConfirmModal(null);
        executeCompleteConsultation();
      },
    });
  };

  // Prescription Station Handlers
  const rxPresets = [
    { medicationName: 'Ferrous Sulfate + Folic Acid', dosage: '60mg / 400mcg', frequency: '1 tab OD after meals', duration: '30 days', quantity: '30', instructions: 'Inumin na may tubig pagkatapos kumain.' },
    { medicationName: 'Calcium Carbonate', dosage: '500mg', frequency: '1 tab BID with meals', duration: '30 days', quantity: '60', instructions: 'Inumin kasabay ng pagkain.' },
    { medicationName: 'Multivitamins with Iron', dosage: '1 capsule', frequency: '1 cap OD in the morning', duration: '30 days', quantity: '30', instructions: 'Inumin sa umaga pagkatapos mag-almusal.' },
    { medicationName: 'Amoxicillin', dosage: '500mg', frequency: '1 capsule every 8 hours', duration: '7 days', quantity: '21', instructions: 'Ubusin ang 7-day course kahit bumuti na ang pakiramdam.' },
    { medicationName: 'Paracetamol', dosage: '500mg', frequency: '1 tab every 4 hours PRN', duration: '3 days', quantity: '10', instructions: 'Inumin kapag may lagnat o pananakit lamang (PRN).' },
    { medicationName: 'Mefenamic Acid', dosage: '500mg', frequency: '1 cap TID after meals PRN', duration: '3 days', quantity: '10', instructions: 'Inumin pagkatapos kumain kapag may matinding pananakit.' },
  ];

  const handleOpenPrescriptionModal = (ticket: QueueTicket) => {
    setPrescriptionModalTicket(ticket);
    setRxSuccessMsg('');
    setRxForm({
      medicationName: '',
      dosage: '',
      frequency: '',
      duration: '7 days',
      quantity: '10',
      instructions: '',
    });
    setRxSignaturePassword('');
    setRxSignatureConsent(false);
    loadPatientPrescriptions(ticket);
  };

  const loadPatientPrescriptions = async (ticket: QueueTicket) => {
    try {
      setRxLoading(true);
      const param = ticket.patientId ? `patientId=${ticket.patientId}` : `cardUid=${ticket.cardUid}`;
      const res = await fetch(`/api/prescriptions?${param}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.prescriptions)) {
        setPatientRxList(data.prescriptions);
      }
    } catch (err) {
      console.error('Error loading prescriptions:', err);
    } finally {
      setRxLoading(false);
    }
  };

  const handleSavePrescription = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prescriptionModalTicket) return;
    if (!rxForm.medicationName.trim() || !rxForm.dosage.trim() || !rxForm.frequency.trim()) {
      setErrorModal({
        open: true,
        title: 'Kulang na Detalye ng Reseta',
        message: 'Pakilagay ang Medication Name, Dosage, at Frequency bago i-save ang reseta.',
      });
      return;
    }
    if (!rxSignatureConsent || !rxSignaturePassword) {
      setErrorModal({
        open: true,
        title: 'Kailangan ang E-signature',
        message: 'Basahin at lagyan ng check ang consent, pagkatapos ilagay ang kasalukuyang password bago ma-issue ang reseta.',
      });
      return;
    }

    try {
      setRxSubmitting(true);
      setIsProcessing(true);
      setProcessingText(`Inirerehistro ang reseta para kay ${prescriptionModalTicket.patientName}...`);
      setRxSuccessMsg('');

      const res = await fetch('/api/prescriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: prescriptionModalTicket.patientId,
          cardUid: prescriptionModalTicket.cardUid,
          doctorId: profile.room ? session?.user?.id : undefined,
          medicationName: rxForm.medicationName.trim(),
          dosage: rxForm.dosage.trim(),
          frequency: rxForm.frequency.trim(),
          duration: rxForm.duration.trim(),
          instructions: rxForm.instructions.trim(),
          quantity: rxForm.quantity.trim(),
          signaturePassword: rxSignaturePassword,
          signatureConsent: rxSignatureConsent,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setRxSuccessMsg(`Na-e-sign at na-issue ang reseta para kay ${prescriptionModalTicket.patientName}. Makikita na ito sa Doctor, Medical Records, at Patient Portal.`);
        setRxForm({
          medicationName: '',
          dosage: '',
          frequency: '',
          duration: '7 days',
          quantity: '10',
          instructions: '',
        });
        setRxSignaturePassword('');
        setRxSignatureConsent(false);
        loadPatientPrescriptions(prescriptionModalTicket);
      } else {
        setErrorModal({
          open: true,
          title: 'Hindi Na-save ang Reseta',
          message: getApiErrorMessage(data.error, 'Hindi naitala ang reseta sa database.'),
        });
      }
    } catch (err) {
      console.error('Error saving prescription:', err);
      setErrorModal({
        open: true,
        title: 'Network Error',
        message: 'Nagka-error sa pakikipag-ugnayan sa server habang sine-save ang reseta.',
      });
    } finally {
      setRxSubmitting(false);
      setIsProcessing(false);
    }
  };

  const handleDeletePrescription = (rxId: string) => {
    setConfirmModal({
      open: true,
      title: 'Kumpirmahin ang Pagtanggal ng Reseta',
      message: 'Sigurado ba kayong nais tanggalin ang resetang ito sa rekord ng pasyente?',
      confirmText: 'Oo, Tanggalin',
      cancelText: 'Kanselahin',
      variant: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          setIsProcessing(true);
          setProcessingText('Tinatanggal ang reseta mula sa database...');
          const res = await fetch(`/api/prescriptions?id=${rxId}`, { method: 'DELETE' });
          const data = await res.json();
          if (data.success && prescriptionModalTicket) {
            loadPatientPrescriptions(prescriptionModalTicket);
          } else if (!data.success) {
            setErrorModal({
              open: true,
              title: 'Hindi Natanggal',
              message: getApiErrorMessage(data.error, 'Hindi natanggal ang reseta.'),
            });
          }
        } catch (err) {
          console.error('Error deleting prescription:', err);
          setErrorModal({
            open: true,
            title: 'Network Error',
            message: 'Nagka-error sa pagbura ng reseta sa database.',
          });
        } finally {
          setIsProcessing(false);
        }
      },
    });
  };

  // Summary Counts
  const waitingCount = tickets.filter((t) => t.status === 'WAITING').length;
  const inProgressCount = tickets.filter(
    (t) => t.status === 'CALLED' || t.status === 'IN_CONSULTATION'
  ).length;
  const completedCount = tickets.filter((t) => t.status === 'COMPLETED').length;

  // Next Waiting Patient
  const nextWaitingPatient = tickets.find((t) => t.status === 'WAITING');

  // Unique Departments for filter
  const departments = useMemo(() => {
    const list = Array.from(new Set(tickets.map((t) => t.department).filter(Boolean)));
    return list;
  }, [tickets]);

  // Filtered Tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Status Filter
      if (statusFilter === 'WAITING' && t.status !== 'WAITING') return false;
      if (statusFilter === 'ACTIVE' && t.status !== 'CALLED' && t.status !== 'IN_CONSULTATION') return false;
      if (statusFilter === 'COMPLETED' && t.status !== 'COMPLETED') return false;

      // Priority Filter
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;

      // Department Filter
      if (departmentFilter !== 'ALL' && t.department !== departmentFilter) return false;

      // Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = t.patientName.toLowerCase().includes(q);
        const matchesTicket = t.ticketNumber.toLowerCase().includes(q);
        const matchesRfid = t.cardUid.toLowerCase().includes(q);
        if (!matchesName && !matchesTicket && !matchesRfid) return false;
      }

      return true;
    });
  }, [tickets, statusFilter, priorityFilter, departmentFilter, searchQuery]);

  // Calculate consultation duration helper
  const getDurationText = (start?: string | null, end?: string | null) => {
    if (!start) return null;
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const diffMins = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    if (diffMins < 1) return '< 1 min';
    return `${diffMins} min${diffMins > 1 ? 's' : ''}`;
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return '--:--';
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDisplayConditions = (raw?: string | null): string => {
    if (!raw || !raw.trim()) return 'None reported';
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.length > 0 ? parsed.join(', ') : 'None reported';
      }
      if (parsed && typeof parsed === 'object') {
        if (parsed.conditions) {
          return Array.isArray(parsed.conditions)
            ? (parsed.conditions.length > 0 ? parsed.conditions.join(', ') : 'None reported')
            : String(parsed.conditions);
        }
        if (parsed.chronicConditions) {
          return Array.isArray(parsed.chronicConditions)
            ? (parsed.chronicConditions.length > 0 ? parsed.chronicConditions.join(', ') : 'None reported')
            : String(parsed.chronicConditions);
        }
        if (parsed.vitals || parsed.bloodPressure || parsed.temperature) {
          return 'None reported';
        }
      }
    } catch (_) {
      if (!raw.startsWith('{') && !raw.startsWith('[')) return raw;
    }
    return 'None reported';
  };

  const formatDisplayAllergies = (raw?: string | null): string => {
    if (!raw || !raw.trim()) return 'No known drug allergies (NKDA)';
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.length > 0 ? parsed.join(', ') : 'No known drug allergies (NKDA)';
      }
      if (typeof parsed === 'string' && parsed.trim()) return parsed;
    } catch (_) {
      if (!raw.startsWith('{') && !raw.startsWith('[')) return raw;
    }
    return 'No known drug allergies (NKDA)';
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 text-sm font-medium">
        <Loader2 className="w-4 h-4 animate-spin mr-2 text-teal-700" />
        <span>Loading workstation session...</span>
      </div>
    );
  }

  const doctorDisplayName = profile.name || session?.user?.name || 'Dr. Jake Santos';
  const doctorDisplayRoom = profile.room || 'Consultation Room 1';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased">
      {/* ── 1. CLINICAL WORKSTATION HEADER ──────────────────────────── */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
            {/* Workstation Title & Role */}
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-md bg-teal-800 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-lg font-bold text-slate-900 leading-tight">
                    Laguna Medical Center
                  </h1>
                  <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 font-bold text-xs rounded border border-teal-200 uppercase tracking-wider">
                    Station 3: Doctor Consultation Room
                  </span>
                </div>
                <p className="text-xs text-slate-500 leading-tight mt-0.5">
                  Clinical Workstation &bull; Patient Consultations, SOAP Notes & E-Prescriptions
                </p>
              </div>
            </div>

            {/* Doctor Account & Consultation Room Identity */}
            <div className="flex items-center space-x-3 self-end sm:self-center">
              <div className="text-right">
                <div className="flex items-center justify-end space-x-1.5">
                  <span className="text-sm font-semibold text-slate-900">
                    {doctorDisplayName}
                  </span>
                </div>
                <div className="text-xs text-slate-600 font-medium">
                  {doctorDisplayRoom}
                  {profile.specialty ? ` • ${profile.specialty}` : ''}
                </div>
              </div>

              <div className="h-7 w-[1px] bg-slate-300 hidden sm:block" />

              {/* Doctor Workstation & Profile Settings */}
              <button
                type="button"
                onClick={() => {
                  loadProfile();
                  setIsEditAccountOpen(true);
                }}
                className="h-9 w-9 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center justify-center shadow-2xs transition-colors cursor-pointer shrink-0"
                title="Mga Setting ng Workstation at Profile ng Doktor"
                aria-label="Doctor Settings"
              >
                <Settings className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(true)}
                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-300 text-xs font-medium text-slate-700 transition cursor-pointer"
                title="Sign out of consultation desk"
              >
                <LogOut className="w-3.5 h-3.5 text-slate-500" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── 2. MAIN WORKSTATION WORKSPACE (WITH COLLAPSIBLE SIDEBAR) ── */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex flex-col lg:flex-row items-start gap-4">
          {/* ── COLLAPSIBLE SIDEBAR (Navigation & Quick Access) ── */}
          <aside
            className={`transition-all duration-200 shrink-0 w-full ${
              isSidebarCollapsed ? 'lg:w-16' : 'lg:w-72'
            }`}
          >
            <div className="space-y-3 sticky top-20">
            <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
              {/* Sidebar Header & Collapse Toggle */}
              <div
                className={`p-3 bg-slate-50 border-b border-slate-200 flex items-center ${
                  isSidebarCollapsed ? 'justify-center' : 'justify-between'
                }`}
              >
                {!isSidebarCollapsed && (
                  <div className="min-w-0">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold border border-teal-200 uppercase tracking-wider">
                      Doctor Desk
                    </span>
                    <div className="text-sm font-bold text-slate-900 mt-1 truncate">
                      Navigasyon &amp; Talaan
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed((prev) => !prev)}
                  className="w-8 h-8 rounded-md border border-slate-300 bg-white hover:bg-teal-50 hover:border-teal-300 text-slate-600 hover:text-teal-800 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
                  title={isSidebarCollapsed ? 'Palawakin ang Sidebar (Expand)' : 'I-collapse ang Sidebar'}
                  aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {isSidebarCollapsed ? (
                    <ChevronRight className="w-4 h-4" />
                  ) : (
                    <ChevronLeft className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Sidebar Links */}
              <nav className="p-2 space-y-1.5" aria-label="Doctor Menu">
                {/* Active Pila (Active consultation workspace) */}
                <button
                  type="button"
                  className={`w-full text-left rounded-lg transition-all flex items-center border p-2.5 bg-teal-800 text-white border-teal-900 shadow-sm ${
                    isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                  }`}
                  title="Pila ng Konsultasyon (Active)"
                >
                  <div className="w-9 h-9 rounded-lg bg-teal-900 text-white flex items-center justify-center shrink-0 font-bold">
                    <Stethoscope className="w-5 h-5" />
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold leading-tight">Pila ng Konsultasyon</div>
                      <div className="text-xs text-teal-100 mt-0.5">Live Queue Desk</div>
                    </div>
                  )}
                </button>

                {/* Medical Records */}
                <Link
                  href="/medical-records"
                  title="Medical Records • Live EHR Database"
                  className={`w-full text-left rounded-lg transition-all flex items-center cursor-pointer border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 p-2.5 ${
                    isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold leading-tight">Medical Records</div>
                      <div className="text-xs text-slate-500 mt-0.5">Live EHR Database</div>
                    </div>
                  )}
                </Link>

                {/* Patient Registry */}
                <Link
                  href="/patient-registry"
                  title="Patient Registry • Listahan ng Pasyente & RFID Cards"
                  className={`w-full text-left rounded-lg transition-all flex items-center cursor-pointer border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 p-2.5 ${
                    isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center shrink-0">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold leading-tight">Patient Registry</div>
                      <div className="text-xs text-slate-500 mt-0.5">Master Patient Index</div>
                    </div>
                  )}
                </Link>

                {/* Aking Schedule */}
                <Link
                  href="/doctor/schedule"
                  title="Aking Schedule • Clinic Duty & Availability"
                  className={`w-full text-left rounded-lg transition-all flex items-center cursor-pointer border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 p-2.5 ${
                    isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold leading-tight">Aking Schedule</div>
                      <div className="text-xs text-slate-500 mt-0.5">Clinic Duty &amp; Hours</div>
                    </div>
                  )}
                </Link>

                {/* Messages */}
                <Link
                  href="/messages"
                  title="Messages • Patient Handoffs & Staff Announcements"
                  className={`w-full text-left rounded-lg transition-all flex items-center cursor-pointer border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 p-2.5 ${
                    isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-800 flex items-center justify-center shrink-0">
                    <MessageSquareText className="w-5 h-5" />
                  </div>
                  {!isSidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold leading-tight">Messages</div>
                      <div className="text-xs text-slate-500 mt-0.5">Patient Handoffs &amp; Chat</div>
                    </div>
                  )}
                </Link>
              </nav>
            </div>

            {/* Queue Status Control at bottom of Sidebar */}
            {isSidebarCollapsed ? (
              <div
                className="bg-white border border-slate-300 rounded-lg p-2.5 shadow-sm flex flex-col items-center justify-center space-y-1.5"
                title={queueControl.reason ? `${queueControl.status}: ${queueControl.reason}` : `Queue Status: ${queueControl.status}`}
              >
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    queueControl.status === 'OPEN'
                      ? 'bg-emerald-600'
                      : queueControl.status === 'PAUSED'
                      ? 'bg-amber-500'
                      : 'bg-rose-600'
                  }`}
                />
                <span className="text-[10px] font-bold text-slate-700">{queueControl.status}</span>
              </div>
            ) : (
              <div
                className="bg-white border border-slate-300 rounded-lg p-3.5 shadow-sm space-y-2.5"
                title={queueControl.reason ? `${queueControl.status}: ${queueControl.reason}` : `Queue is ${queueControl.status.toLowerCase()}`}
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Queue Status
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold tracking-wide ${
                      queueControl.status === 'OPEN'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : queueControl.status === 'PAUSED'
                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        queueControl.status === 'OPEN'
                          ? 'bg-emerald-600'
                          : queueControl.status === 'PAUSED'
                          ? 'bg-amber-500'
                          : 'bg-rose-600'
                      }`}
                    />
                    {queueControl.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {queueControl.status !== 'OPEN' && (
                    <button
                      type="button"
                      onClick={() => changeQueueControl('OPEN')}
                      className="rounded bg-emerald-700 hover:bg-emerald-800 px-2.5 py-1.5 text-xs font-bold text-white transition cursor-pointer"
                    >
                      Open
                    </button>
                  )}
                  {queueControl.status !== 'PAUSED' && (
                    <button
                      type="button"
                      onClick={() => changeQueueControl('PAUSED')}
                      className="rounded bg-amber-100 hover:bg-amber-200 border border-amber-200 px-2.5 py-1.5 text-xs font-bold text-amber-900 transition cursor-pointer"
                    >
                      Pause
                    </button>
                  )}
                  {queueControl.status !== 'CLOSED' && (
                    <button
                      type="button"
                      onClick={() => changeQueueControl('CLOSED')}
                      className="rounded bg-rose-100 hover:bg-rose-200 border border-rose-200 px-2.5 py-1.5 text-xs font-bold text-rose-800 transition cursor-pointer"
                    >
                      Close
                    </button>
                  )}
                </div>
              </div>
            )}
            </div>
          </aside>

          {/* ── MAIN CONTENT (Queue Console) ── */}
          <div className="flex-1 min-w-0 space-y-4 w-full">
        {/* Page Introduction & Live Sync Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border border-slate-300 rounded p-3 sm:px-4">
          <div>
            <p className="text-xs sm:text-sm text-slate-700 font-medium">
              Patients checked-in at Reception Desk appear here in real-time.
            </p>
            <div className="flex items-center space-x-2 mt-1">
              <span className="inline-flex items-center space-x-1 text-[11px] text-slate-600 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
                <span>Live sync</span>
                <span>•</span>
                <span>Connected</span>
              </span>
              {nextWaitingPatient && (
                <span className="text-[11px] text-teal-900 bg-teal-50 border border-teal-200 px-2 py-0.2 rounded font-medium">
                  Next patient to call: Ticket {nextWaitingPatient.ticketNumber} ({nextWaitingPatient.patientName})
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={loadQueue}
            disabled={loading}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-medium text-slate-800 transition cursor-pointer self-start sm:self-auto shrink-0 disabled:opacity-60"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Queue</span>
          </button>
        </div>

        {/* ── 3. COMPACT CLINICAL SUMMARY BLOCKS ─────────────────────── */}
        <section aria-label="Queue Summary" className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* WAITING */}
          <div className="bg-white border border-slate-300 rounded p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                WAITING
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Naghihintay</span>
            </div>
            <div className="flex items-baseline space-x-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">
                {waitingCount}
              </span>
              <span className="text-xs text-slate-600 font-medium">
                {waitingCount === 1 ? 'patient' : 'patients'}
              </span>
            </div>
          </div>

          {/* IN CONSULTATION */}
          <div className="bg-white border border-slate-300 rounded p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                IN CONSULTATION
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Kasalukuyang Ginagamot</span>
            </div>
            <div className="flex items-baseline space-x-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">
                {inProgressCount}
              </span>
              <span className="text-xs text-slate-600 font-medium">
                {inProgressCount === 1 ? 'patient' : 'patients'}
              </span>
            </div>
          </div>

          {/* COMPLETED TODAY */}
          <div className="bg-white border border-slate-300 rounded p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                COMPLETED TODAY
              </span>
              <span className="text-[11px] text-slate-500 font-medium">Natapos Ngayong Araw</span>
            </div>
            <div className="flex items-baseline space-x-2 mt-0.5">
              <span className="text-2xl sm:text-3xl font-bold font-mono text-slate-900">
                {completedCount}
              </span>
              <span className="text-xs text-slate-600 font-medium">
                {completedCount === 1 ? 'patient' : 'patients'}
              </span>
            </div>
          </div>
        </section>

        {/* ── 4. QUEUE CONTROLS & PRACTICAL FILTERS BAR ─────────────── */}
        <section aria-label="Queue Filters" className="bg-white border border-slate-300 rounded p-3 space-y-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search patient name, ticket (e.g. S-01), or RFID UID..."
                className="w-full h-8 pl-8 pr-3 rounded border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:outline-teal-800"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5">
                <Filter className="w-3.5 h-3.5 text-slate-500" />
                <span className="font-semibold text-slate-700">Filters:</span>
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e: any) => setStatusFilter(e.target.value)}
                aria-label="Filter by Status"
                className="h-8 px-2 rounded border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-teal-800"
              >
                <option value="ALL">All Statuses</option>
                <option value="WAITING">Waiting (Naghihintay)</option>
                <option value="ACTIVE">Called / In Session</option>
                <option value="COMPLETED">Completed (Tapos na)</option>
              </select>

              {/* Priority Filter */}
              <select
                value={priorityFilter}
                onChange={(e: any) => setPriorityFilter(e.target.value)}
                aria-label="Filter by Priority"
                className="h-8 px-2 rounded border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-teal-800"
              >
                <option value="ALL">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="Senior/PWD">Senior/PWD</option>
                <option value="Regular">Regular</option>
              </select>

              {/* Department Filter */}
              {departments.length > 0 && (
                <select
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  aria-label="Filter by Department"
                  className="h-8 px-2 rounded border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-teal-800"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              )}

              {/* Reset Filters */}
              {(statusFilter !== 'ALL' || priorityFilter !== 'ALL' || departmentFilter !== 'ALL' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter('ALL');
                    setPriorityFilter('ALL');
                    setDepartmentFilter('ALL');
                    setSearchQuery('');
                  }}
                  className="h-8 px-2.5 rounded border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ── 5. MAIN PATIENT QUEUE TABLE & LIST ────────────────────── */}
        <section aria-label="Patient Queue Table" className="bg-white border border-slate-300 rounded">
          {/* Section Header */}
          <div className="px-4 py-3 border-b border-slate-300 flex items-center justify-between bg-slate-50">
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-900">
                Today&apos;s Patient Queue
              </h2>
              <span className="text-xs text-slate-600 font-mono bg-slate-200 px-2 py-0.5 rounded">
                Showing {filteredTickets.length} of {tickets.length} patients
              </span>
            </div>
            <span className="text-xs font-mono text-slate-500">Live Database Sync</span>
          </div>

          {/* Empty State */}
          {filteredTickets.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <p className="text-sm font-semibold text-slate-800">
                {tickets.length === 0 ? 'No patients waiting' : 'No patients match the selected filters'}
              </p>
              <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                {tickets.length === 0
                  ? 'Patients checked-in at reception will appear here automatically.'
                  : 'Try adjusting your search query or reset the filters above.'}
              </p>
            </div>
          ) : (
            <>
              {/* DESKTOP & TABLET STRUCTURED CLINICAL TABLE */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-300 uppercase tracking-wider text-[11px] sticky top-0 z-10">
                    <tr>
                      <th className="py-3 px-4 font-semibold w-24">Queue</th>
                      <th className="py-3 px-4 font-semibold min-w-[200px]">Patient</th>
                      <th className="py-3 px-4 font-semibold w-28">Priority</th>
                      <th className="py-3 px-4 font-semibold w-36">Department</th>
                      <th className="py-3 px-4 font-semibold w-40">Room</th>
                      <th className="py-3 px-4 font-semibold w-48">Timeline & Duration</th>
                      <th className="py-3 px-4 font-semibold w-32">Status</th>
                      <th className="py-3 px-4 font-semibold text-right min-w-[220px]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredTickets.map((patient) => {
                      const isCurrentAction = actionLoading === patient.id;
                      const isCompleted = patient.status === 'COMPLETED';
                      const isInConsultation = patient.status === 'IN_CONSULTATION';
                      const isCalled = patient.status === 'CALLED';
                      const isWaiting = patient.status === 'WAITING';

                      const durationStr = getDurationText(
                        patient.startedAt || (isInConsultation ? patient.calledAt : null),
                        patient.completedAt
                      );

                      return (
                        <tr
                          key={patient.id}
                          className={`transition-colors ${
                            isInConsultation
                              ? 'bg-blue-50/50'
                              : isCalled
                              ? 'bg-amber-50/40'
                              : isCompleted
                              ? 'bg-slate-50 text-slate-600'
                              : 'hover:bg-slate-50'
                          }`}
                        >
                          {/* Queue Number */}
                          <td className="py-3 px-4 align-middle">
                            <span className="font-mono font-bold text-sm text-slate-900">
                              {patient.ticketNumber}
                            </span>
                          </td>

                          {/* Patient Name & RFID Hierarchy */}
                          <td className="py-3 px-4 align-middle">
                            <div className="font-semibold text-slate-900 text-sm">
                              {patient.patientName}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 mt-0.5">
                              RFID: {patient.cardUid || 'N/A'}
                            </div>
                            {patient.reasonForVisit && (
                              <div className="text-[11px] text-teal-900 font-medium mt-0.5 truncate max-w-[220px]" title={patient.reasonForVisit}>
                                Pakay: <span className="font-semibold">{patient.reasonForVisit}</span>
                              </div>
                            )}
                          </td>

                          {/* Priority */}
                          <td className="py-3 px-4 align-middle">
                            {patient.priority === 'Urgent' ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                                Urgent
                              </span>
                            ) : patient.priority === 'Senior/PWD' ? (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                                Senior/PWD
                              </span>
                            ) : (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                Regular
                              </span>
                            )}
                          </td>

                          {/* Department */}
                          <td className="py-3 px-4 align-middle text-slate-800 font-medium">
                            {patient.department || 'General'}
                          </td>

                          {/* Consultation Room */}
                          <td className="py-3 px-4 align-middle text-slate-800">
                            {patient.room || 'Consultation Room 1'}
                          </td>

                          {/* Date & Time Tracking / Duration */}
                          <td className="py-3 px-4 align-middle text-[11px]">
                            <div className="space-y-0.5 text-slate-700">
                              <div>
                                <span className="text-slate-500">Check-in: </span>
                                <span className="font-mono font-medium">{patient.timeIssued || '--:--'}</span>
                              </div>
                              {patient.startedAt && (
                                <div>
                                  <span className="text-slate-500">Started: </span>
                                  <span className="font-mono font-medium">{formatTime(patient.startedAt)}</span>
                                </div>
                              )}
                              {patient.completedAt && (
                                <div>
                                  <span className="text-slate-500">Ended: </span>
                                  <span className="font-mono font-medium">{formatTime(patient.completedAt)}</span>
                                </div>
                              )}
                              {durationStr && (
                                <div className="text-[10px] text-teal-800 font-medium font-mono">
                                  Duration: {durationStr}
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4 align-middle">
                            {isWaiting && (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-300">
                                WAITING
                              </span>
                            )}
                            {isCalled && (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-900 border border-amber-300">
                                CALLED
                              </span>
                            )}
                            {isInConsultation && (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-50 text-teal-800 border border-teal-300">
                                IN SESSION
                              </span>
                            )}
                            {isCompleted && (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                Tapos na
                              </span>
                            )}
                            {patient.status === 'CANCELLED' && (
                              <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                                CANCELLED
                              </span>
                            )}
                          </td>

                          {/* Actions: View Details (Before Calling) + Clinical Next Step */}
                          <td className="py-3 px-4 align-middle text-right">
                            <div className="inline-flex items-center justify-end space-x-1.5">
                              {/* 1. View Patient Details / Chart (Always accessible, even before calling!) */}
                              <button
                                type="button"
                                onClick={() => handleViewPatientDetails(patient)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-medium text-xs transition cursor-pointer"
                                title="View Patient Clinical Summary & Vitals before calling"
                              >
                                <FileText className="w-3.5 h-3.5 text-slate-600" />
                                <span>View Chart</span>
                              </button>

                              {/* 2. Issue Prescription (Reseta / Rx) - Accessible in all stages */}
                              <button
                                type="button"
                                onClick={() => handleOpenPrescriptionModal(patient)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded border border-teal-700 bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs transition cursor-pointer"
                                title="Magreseta ng Gamot (Issue Prescription / Rx)"
                              >
                                <Pill className="w-3.5 h-3.5" />
                                <span>Reseta (Rx)</span>
                              </button>

                              {/* 2. State-matching Clinical Action Button */}
                              {isWaiting && (
                                <button
                                  type="button"
                                  onClick={() => updateTicketStatus(patient.id, 'CALLED')}
                                  disabled={isCurrentAction}
                                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs transition cursor-pointer disabled:opacity-50"
                                >
                                  <PhoneCall className="w-3.5 h-3.5" />
                                  <span>{isCurrentAction ? 'Calling...' : 'Call Patient'}</span>
                                </button>
                              )}

                              {isCalled && (
                                <button type="button" onClick={() => recallPatient(patient.id)} disabled={isCurrentAction} className="inline-flex items-center space-x-1 px-3 py-1.5 rounded border border-amber-300 bg-amber-50 text-amber-900 font-medium text-xs disabled:opacity-50">
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  <span>Call Again</span>
                                </button>
                              )}

                              {isCalled && (
                                <button
                                  type="button"
                                  onClick={() => updateTicketStatus(patient.id, 'IN_CONSULTATION')}
                                  disabled={isCurrentAction}
                                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs transition cursor-pointer disabled:opacity-50"
                                >
                                  <Activity className="w-3.5 h-3.5" />
                                  <span>Start</span>
                                </button>
                              )}

                              {isInConsultation && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCompleteModal(patient)}
                                  disabled={isCurrentAction}
                                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs transition cursor-pointer disabled:opacity-50"
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>Complete...</span>
                                </button>
                              )}

                              {!isCompleted && !isInConsultation && transferDoctors.some((doctor) => doctor.id !== patient.doctorId) && (
                                <select defaultValue="" onChange={(event) => { const target = event.target.value; event.currentTarget.value = ''; void transferPatient(patient.id, target); }} disabled={isCurrentAction} className="rounded border border-slate-300 bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
                                  <option value="" disabled>Transfer...</option>
                                  {transferDoctors.filter((doctor) => doctor.id !== patient.doctorId).map((doctor) => <option key={doctor.id} value={doctor.id}>{doctor.name} — {doctor.specialization}</option>)}
                                </select>
                              )}

                              {isCompleted && (
                                <span className="text-xs text-slate-500 font-medium px-2 py-1">
                                  Completed
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* MOBILE & TABLET COMPACT STRUCTURED LIST */}
              <div className="lg:hidden divide-y divide-slate-200">
                {filteredTickets.map((patient) => {
                  const isCurrentAction = actionLoading === patient.id;
                  const isCompleted = patient.status === 'COMPLETED';
                  const isInConsultation = patient.status === 'IN_CONSULTATION';
                  const isCalled = patient.status === 'CALLED';
                  const isWaiting = patient.status === 'WAITING';

                  const durationStr = getDurationText(
                    patient.startedAt || (isInConsultation ? patient.calledAt : null),
                    patient.completedAt
                  );

                  return (
                    <div
                      key={patient.id}
                      className={`p-3.5 space-y-3 ${
                        isInConsultation
                          ? 'bg-blue-50/40'
                          : isCalled
                          ? 'bg-amber-50/40'
                          : isCompleted
                          ? 'bg-slate-50 text-slate-600'
                          : 'bg-white'
                      }`}
                    >
                      {/* Top Row: Ticket Number, Patient Name & RFID */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-base text-slate-900">
                            {patient.ticketNumber}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-900 text-sm leading-tight">
                              {patient.patientName}
                            </p>
                            <p className="font-mono text-[11px] text-slate-500">
                              RFID: {patient.cardUid || 'N/A'}
                            </p>
                            {patient.reasonForVisit && (
                              <p className="text-[11px] text-teal-900 font-medium mt-0.5" title={patient.reasonForVisit}>
                                Pakay: <span className="font-semibold">{patient.reasonForVisit}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div>
                          {patient.priority === 'Urgent' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold bg-rose-50 text-rose-800 border border-rose-200">
                              Urgent
                            </span>
                          ) : patient.priority === 'Senior/PWD' ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-blue-800 border border-blue-200">
                              Senior/PWD
                            </span>
                          ) : (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              Regular
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Structured Details Grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200">
                        <div>
                          <span className="text-[11px] text-slate-500 block">Department</span>
                          <span className="font-medium text-slate-800">{patient.department}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Room</span>
                          <span className="text-slate-800">{patient.room}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Check-in</span>
                          <span className="font-mono text-slate-800">{patient.timeIssued}</span>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 block">Timeline</span>
                          <span className="font-mono text-slate-800 text-[11px]">
                            {patient.startedAt ? `Started: ${formatTime(patient.startedAt)}` : 'Waiting'}
                            {durationStr && ` (${durationStr})`}
                          </span>
                        </div>
                      </div>

                      {/* Action Buttons: View Chart + Reseta (Rx) + State Action */}
                      <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-slate-200">
                        <button
                          type="button"
                          onClick={() => handleViewPatientDetails(patient)}
                          className="w-full py-1.5 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 font-medium text-xs flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5 text-slate-600" />
                          <span>Chart</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenPrescriptionModal(patient)}
                          className="w-full py-1.5 rounded border border-teal-700 bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs flex items-center justify-center space-x-1 cursor-pointer"
                        >
                          <Pill className="w-3.5 h-3.5" />
                          <span>Reseta</span>
                        </button>

                        <div>
                          {isWaiting && (
                            <button
                              type="button"
                              onClick={() => updateTicketStatus(patient.id, 'CALLED')}
                              disabled={isCurrentAction}
                              className="w-full py-1.5 rounded bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs transition flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                            >
                              <PhoneCall className="w-3.5 h-3.5" />
                              <span>{isCurrentAction ? 'Calling...' : 'Call'}</span>
                            </button>
                          )}

                          {isCalled && (
                            <button
                              type="button"
                              onClick={() => updateTicketStatus(patient.id, 'IN_CONSULTATION')}
                              disabled={isCurrentAction}
                              className="w-full py-1.5 rounded bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs transition flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                            >
                              <Activity className="w-3.5 h-3.5" />
                              <span>Start</span>
                            </button>
                          )}

                          {isInConsultation && (
                            <button
                              type="button"
                              onClick={() => handleOpenCompleteModal(patient)}
                              disabled={isCurrentAction}
                              className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-900 text-white font-medium text-xs transition flex items-center justify-center space-x-1 cursor-pointer disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Complete...</span>
                            </button>
                          )}

                          {isCompleted && (
                            <div className="text-center py-1.5 text-xs text-slate-500 font-medium bg-slate-100 rounded">
                              Completed
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </section>
        </div>
        </div>
      </main>

      {/* ── 6. PATIENT CLINICAL SUMMARY MODAL (PRE-CALL INSPECTION) ─── */}
      {selectedPatientTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-300 rounded max-w-2xl w-full p-5 space-y-4 my-8 shadow-md">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-sm bg-slate-200 text-slate-900 px-2 py-0.5 rounded">
                    {selectedPatientTicket.ticketNumber}
                  </span>
                  <h3 className="text-base font-semibold text-slate-900 leading-tight">
                    {selectedPatientTicket.patientName}
                  </h3>
                  <span className="text-xs text-slate-500 font-mono">
                    (RFID: {selectedPatientTicket.cardUid})
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Department: <strong>{selectedPatientTicket.department}</strong> &bull; Room: <strong>{selectedPatientTicket.room}</strong> &bull; Check-in: <strong>{selectedPatientTicket.timeIssued}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatientTicket(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailsLoading ? (
              <div className="py-12 text-center text-slate-600 text-xs flex items-center justify-center space-x-2">
                <Loader2 className="w-4 h-4 animate-spin text-teal-800" />
                <span>Loading patient clinical chart & triage vitals...</span>
              </div>
            ) : patientDetails ? (
              <div className="space-y-4 text-xs">
                {/* Demographics & Patient Record ID */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">Record No.</span>
                    <span className="font-mono font-bold text-slate-900">{patientDetails.patientNo}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">Age & Sex</span>
                    <span className="font-medium text-slate-900">{patientDetails.age} y/o &bull; {patientDetails.gender}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">Blood Type</span>
                    <span className="font-mono font-bold text-slate-900">{patientDetails.bloodType}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-slate-500 block">Contact Phone</span>
                    <span className="font-mono text-slate-900">{patientDetails.phone}</span>
                  </div>
                </div>

                {/* Dahilan ng Pagbisita / Chief Complaint from Triage Intake */}
                <div className="p-3 bg-teal-50/70 border border-teal-200 rounded space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5 text-teal-950 font-semibold">
                      <Stethoscope className="w-3.5 h-3.5 text-teal-800" />
                      <span>Dahilan ng Pagbisita / Triage Intake (Chief Complaint)</span>
                    </div>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-teal-100 text-teal-900 border border-teal-300">
                      Triage Intake
                    </span>
                  </div>
                  <p className="text-slate-900 font-medium text-xs leading-relaxed">
                    {patientDetails.triageReason || selectedPatientTicket.reasonForVisit || 'General Consultation / Routine Checkup'}
                  </p>
                </div>

                {/* Medical Alerts: Allergies & Chronic Conditions */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded">
                    <div className="flex items-center space-x-1.5 text-rose-900 font-semibold mb-1">
                      <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
                      <span>Known Allergies</span>
                    </div>
                    <p className="text-slate-800 font-medium">
                      {formatDisplayAllergies(patientDetails.allergies)}
                    </p>
                  </div>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded">
                    <div className="flex items-center space-x-1.5 text-amber-900 font-semibold mb-1">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                      <span>Chronic Conditions</span>
                    </div>
                    <p className="text-slate-800 font-medium">
                      {formatDisplayConditions(patientDetails.chronicConditions)}
                    </p>
                  </div>
                </div>

                {/* Triage Vital Signs */}
                <div>
                  <h4 className="font-semibold text-slate-800 mb-1.5 flex items-center space-x-1.5">
                    <HeartPulse className="w-4 h-4 text-teal-800" />
                    <span>Triage Vital Signs (Recorded at Reception / Kiosk)</span>
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div className="p-2 border border-slate-200 rounded bg-white">
                      <span className="text-[10px] text-slate-500 block">Blood Pressure</span>
                      <span className="text-sm font-mono font-bold text-slate-900">
                        {patientDetails.vitals?.bloodPressure || '120/80'} <span className="text-[10px] font-normal text-slate-500">mmHg</span>
                      </span>
                    </div>
                    <div className="p-2 border border-slate-200 rounded bg-white">
                      <span className="text-[10px] text-slate-500 block">Heart Rate</span>
                      <span className="text-sm font-mono font-bold text-slate-900">
                        {patientDetails.vitals?.heartRate || 75} <span className="text-[10px] font-normal text-slate-500">bpm</span>
                      </span>
                    </div>
                    <div className="p-2 border border-slate-200 rounded bg-white">
                      <span className="text-[10px] text-slate-500 block">Body Temperature</span>
                      <span className="text-sm font-mono font-bold text-slate-900">
                        {patientDetails.vitals?.temperature || 36.6} <span className="text-[10px] font-normal text-slate-500">&deg;C</span>
                      </span>
                    </div>
                    <div className="p-2 border border-slate-200 rounded bg-white">
                      <span className="text-[10px] text-slate-500 block">Oxygen Sat (SpO2)</span>
                      <span className="text-sm font-mono font-bold text-slate-900">
                        {patientDetails.vitals?.oxygenSaturation || 98} <span className="text-[10px] font-normal text-slate-500">%</span>
                      </span>
                    </div>
                    <div className="p-2 border border-slate-200 rounded bg-white">
                      <span className="text-[10px] text-slate-500 block">Respiratory Rate</span>
                      <span className="text-sm font-mono font-bold text-slate-900">
                        {patientDetails.vitals?.respiratoryRate || 18} <span className="text-[10px] font-normal text-slate-500">cpm</span>
                      </span>
                    </div>
                    <div className="p-2 border border-slate-200 rounded bg-white">
                      <span className="text-[10px] text-slate-500 block">Weight & Height</span>
                      <span className="text-sm font-mono font-bold text-slate-900">
                        {patientDetails.vitals?.weight || 65}kg / {patientDetails.vitals?.height || 165}cm
                      </span>
                    </div>
                    <div className="p-2 border border-slate-200 rounded bg-white col-span-2">
                      <span className="text-[10px] text-slate-500 block">Body Mass Index (BMI)</span>
                      <span className="text-sm font-mono font-bold text-slate-900">
                        {patientDetails.vitals?.bmi || 23.9} <span className="text-[10px] font-normal text-slate-500 font-sans">(Normal Range)</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Emergency Contact & Address */}
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-700">
                  <p><strong>Address:</strong> {patientDetails.address}</p>
                  <p className="mt-0.5"><strong>Emergency Contact:</strong> {patientDetails.emergencyContact}</p>
                </div>

                {/* Previous Medical History Records */}
                {patientDetails.pastRecords && patientDetails.pastRecords.length > 0 && (
                  <div>
                    <h4 className="font-semibold text-slate-800 mb-1.5">Previous Consultations / Records</h4>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {patientDetails.pastRecords.map((rec) => (
                        <div key={rec.id} className="p-2 bg-slate-50 border border-slate-200 rounded text-[11px]">
                          <div className="flex justify-between items-center font-medium text-slate-800">
                            <span>{rec.date} &bull; {rec.doctor}</span>
                            <span className="font-semibold text-teal-900">{rec.diagnosis}</span>
                          </div>
                          {rec.plan && <p className="text-slate-600 mt-0.5">Plan: {rec.plan}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 py-4 text-center">No additional chart data available.</p>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setSelectedPatientTicket(null)}
                  className="h-8 px-3 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs cursor-pointer"
                >
                  Close Chart
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const t = selectedPatientTicket;
                    setSelectedPatientTicket(null);
                    handleOpenPrescriptionModal(t);
                  }}
                  className="h-8 px-3 rounded border border-teal-700 bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <Pill className="w-3.5 h-3.5" />
                  <span>Reseta (Rx)</span>
                </button>
              </div>

              {/* Direct call or start action from within the modal */}
              {selectedPatientTicket.status === 'WAITING' && (
                <button
                  type="button"
                  onClick={() => {
                    updateTicketStatus(selectedPatientTicket.id, 'CALLED');
                    setSelectedPatientTicket(null);
                  }}
                  className="h-8 px-4 rounded bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Patient Now</span>
                </button>
              )}

              {selectedPatientTicket.status === 'CALLED' && (
                <button
                  type="button"
                  onClick={() => {
                    updateTicketStatus(selectedPatientTicket.id, 'IN_CONSULTATION');
                    setSelectedPatientTicket(null);
                  }}
                  className="h-8 px-4 rounded bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs transition flex items-center space-x-1.5 cursor-pointer"
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Start Consultation Now</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 7. CONSULTATION COMPLETION & CLINICAL NOTES MODAL ────────── */}
      {completingTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-300 rounded max-w-xl w-full p-5 space-y-4 my-8 shadow-md">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-sm bg-slate-200 text-slate-900 px-2 py-0.5 rounded">
                    {completingTicket.ticketNumber}
                  </span>
                  <h3 className="text-base font-semibold text-slate-900 leading-tight">
                    Complete Consultation &bull; {completingTicket.patientName}
                  </h3>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Verify encounter date, start and end times, and document clinical diagnosis before closing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCompletingTicket(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmCompleteConsultation} className="space-y-3 text-xs">
              {/* Encounter Timeline Fields (Date, Start Time, End Time) */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2.5">
                <div className="flex items-center space-x-1.5 font-semibold text-slate-800">
                  <Clock className="w-4 h-4 text-teal-800" />
                  <span>Consultation Encounter Timeline</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Encounter Date</label>
                    <input
                      type="date"
                      required
                      value={completionForm.encounterDate}
                      onChange={(e) => setCompletionForm({ ...completionForm, encounterDate: e.target.value })}
                      className="w-full h-8 px-2 rounded border border-slate-300 bg-white font-mono text-slate-900 text-xs focus:outline-teal-800"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Time Started (Simula) *</label>
                    <input
                      type="time"
                      required
                      value={completionForm.startTime}
                      onChange={(e) => setCompletionForm({ ...completionForm, startTime: e.target.value })}
                      className="w-full h-8 px-2 rounded border border-slate-300 bg-white font-mono text-slate-900 text-xs focus:outline-teal-800"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 block mb-1">Time Ended (Natapos) *</label>
                    <input
                      type="time"
                      required
                      value={completionForm.endTime}
                      onChange={(e) => setCompletionForm({ ...completionForm, endTime: e.target.value })}
                      className="w-full h-8 px-2 rounded border border-slate-300 bg-white font-mono text-slate-900 text-xs focus:outline-teal-800"
                    />
                  </div>
                </div>

                <div className="text-[11px] text-slate-600 flex justify-between items-center pt-1 border-t border-slate-200 font-mono">
                  <span>Check-in: {completingTicket.timeIssued}</span>
                  <span className="text-teal-800 font-semibold">
                    Estimated Duration: {
                      (() => {
                        if (!completionForm.startTime || !completionForm.endTime) return '--';
                        const [sH, sM] = completionForm.startTime.split(':').map(Number);
                        const [eH, eM] = completionForm.endTime.split(':').map(Number);
                        const totalMins = (eH * 60 + eM) - (sH * 60 + sM);
                        return totalMins > 0 ? `${totalMins} minuto / minutes` : '0 minutes';
                      })()
                    }
                  </span>
                </div>
              </div>

              {/* Chief Complaint / Reason for visit */}
              <div>
                <label className="font-medium text-slate-700 block mb-1">
                  Chief Complaint / Subjective Symptoms
                </label>
                <input
                  type="text"
                  value={completionForm.chiefComplaint}
                  onChange={(e) => setCompletionForm({ ...completionForm, chiefComplaint: e.target.value })}
                  placeholder="e.g. Follow-up prenatal check-up, headache, fever for 2 days"
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-slate-900 bg-white text-xs focus:outline-teal-800"
                />
              </div>

              {/* Clinical Assessment / Diagnosis (Required) */}
              <div>
                <label className="font-medium text-slate-700 block mb-1">
                  Clinical Diagnosis / Assessment *
                </label>
                <input
                  type="text"
                  required
                  value={completionForm.diagnosis}
                  onChange={(e) => setCompletionForm({ ...completionForm, diagnosis: e.target.value })}
                  placeholder="e.g. Upper Respiratory Tract Infection, Essential Hypertension"
                  className="w-full h-8 px-2.5 rounded border border-slate-300 text-slate-900 bg-white font-medium text-xs focus:outline-teal-800"
                />
              </div>

              {/* Plan & Physician Orders */}
              <div>
                <label className="font-medium text-slate-700 block mb-1">
                  Treatment Plan & Doctor Advice
                </label>
                <textarea
                  rows={2}
                  value={completionForm.plan}
                  onChange={(e) => setCompletionForm({ ...completionForm, plan: e.target.value })}
                  placeholder="e.g. Oral hydration, bed rest, return if fever persists after 48 hours"
                  className="w-full p-2 rounded border border-slate-300 text-slate-900 bg-white text-xs focus:outline-teal-800"
                />
              </div>

              {/* Prescriptions */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-medium text-slate-700">
                    Prescriptions / Iniresetang Gamot (Rx)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const t = completingTicket;
                      setCompletingTicket(null);
                      handleOpenPrescriptionModal(t);
                    }}
                    className="text-[11px] font-semibold text-teal-800 hover:text-teal-950 hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <Pill className="w-3 h-3" />
                    <span>Buksan ang Rx Station</span>
                  </button>
                </div>
                <div className="rounded border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                  Ang reseta ay hiwalay na ini-issue sa Rx Station at kailangan munang e-sign gamit ang password ng doktor.
                </div>
              </div>

              {/* Disposition */}
              <div>
                <label className="font-medium text-slate-700 block mb-1">
                  Patient Disposition / Next Action
                </label>
                <select
                  value={completionForm.disposition}
                  onChange={(e) => setCompletionForm({ ...completionForm, disposition: e.target.value })}
                  className="w-full h-8 px-2 rounded border border-slate-300 text-slate-900 bg-white text-xs font-medium focus:outline-teal-800"
                >
                  <option value="Discharged / Consultation Completed">Discharged / Consultation Completed (Tapos na)</option>
                  <option value="Referred to Diagnostic Laboratory">Referred to Diagnostic Laboratory</option>
                  <option value="Follow-up Required in 1 Week">Follow-up Required in 1 Week</option>
                  <option value="For Admission / Emergency Transfer">For Admission / Emergency Transfer</option>
                </select>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCompletingTicket(null)}
                  disabled={savingEncounter}
                  className="h-8 px-3 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEncounter}
                  className="h-8 px-4 rounded bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {savingEncounter ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Record & Completing...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Confirm & Mark Completed</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 8. WORKSTATION & PROFILE SETTINGS MODAL ───────────────── */}
      <WorkstationSettingsModal
        isOpen={isEditAccountOpen}
        onClose={() => setIsEditAccountOpen(false)}
        stationName="Station 3: Doctor Consultation Room"
        stationRole="Doctor"
        currentRoom={doctorDisplayRoom}
        soundEnabled={docSoundEnabled}
        onToggleSound={(val) => setDocSoundEnabled(val)}
        onTestSound={playDoctorChime}
        refreshInterval={docRefreshInterval}
        onChangeRefreshInterval={(sec) => setDocRefreshInterval(sec)}
        onProfileUpdated={loadProfile}
      />

      {/* ── 9. PRESCRIPTION STATION MODAL (RESETA / RX) ─────────────── */}
      {prescriptionModalTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-300 rounded max-w-2xl w-full p-5 space-y-4 my-8 shadow-md">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-200 pb-3">
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-sm bg-teal-800 text-white px-2 py-0.5 rounded">
                    Rx
                  </span>
                  <span className="font-mono font-bold text-sm bg-slate-200 text-slate-900 px-2 py-0.5 rounded">
                    {prescriptionModalTicket.ticketNumber}
                  </span>
                  <h3 className="text-base font-semibold text-slate-900 leading-tight">
                    Reseta ng Gamot &bull; {prescriptionModalTicket.patientName}
                  </h3>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  RFID: <span className="font-mono font-bold text-slate-800">{prescriptionModalTicket.cardUid || 'N/A'}</span> &bull; Kagawaran: <span className="font-medium text-slate-800">{prescriptionModalTicket.department}</span> &bull; Attending: <span className="font-medium text-slate-800">{profile.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPrescriptionModalTicket(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success Alert */}
            {rxSuccessMsg && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded text-emerald-900 text-xs font-medium flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>{rxSuccessMsg}</span>
              </div>
            )}

            {/* Quick Clinical Preset Chips */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-slate-700">Mabilis na Preset (Quick 1-Click Fill):</span>
                <span className="text-[11px] text-slate-500">I-click para awtomatikong punan</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rxPresets.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setRxForm({
                        medicationName: preset.medicationName,
                        dosage: preset.dosage,
                        frequency: preset.frequency,
                        duration: preset.duration,
                        quantity: preset.quantity,
                        instructions: preset.instructions,
                      });
                    }}
                    className="px-2.5 py-1 rounded border border-slate-300 bg-slate-50 hover:bg-teal-50 hover:border-teal-400 text-slate-800 text-[11px] font-medium transition cursor-pointer"
                  >
                    + {preset.medicationName} ({preset.dosage})
                  </button>
                ))}
              </div>
            </div>

            {/* Prescription Form */}
            <form onSubmit={handleSavePrescription} className="space-y-3 pt-2 border-t border-slate-200">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">
                    Pangalan ng Gamot (Medication Name) *
                  </label>
                  <input
                    type="text"
                    required
                    value={rxForm.medicationName}
                    onChange={(e) => setRxForm({ ...rxForm, medicationName: e.target.value })}
                    placeholder="hal. Paracetamol, Amoxicillin, Ferrous Sulfate"
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-900 text-xs focus:outline-teal-800 font-medium"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">
                    Dosage / Strength *
                  </label>
                  <input
                    type="text"
                    required
                    value={rxForm.dosage}
                    onChange={(e) => setRxForm({ ...rxForm, dosage: e.target.value })}
                    placeholder="hal. 500mg tableta, 250mg/5mL susp"
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-900 text-xs focus:outline-teal-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-medium text-slate-700 block mb-1">
                    Dalas ng Pag-inom (Frequency) *
                  </label>
                  <input
                    type="text"
                    required
                    value={rxForm.frequency}
                    onChange={(e) => setRxForm({ ...rxForm, frequency: e.target.value })}
                    placeholder="hal. Bawat 8 oras, 1x sa isang araw"
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-900 text-xs focus:outline-teal-800"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">
                    Tagal (Duration)
                  </label>
                  <input
                    type="text"
                    value={rxForm.duration}
                    onChange={(e) => setRxForm({ ...rxForm, duration: e.target.value })}
                    placeholder="hal. 7 araw, 1 buwan"
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-900 text-xs focus:outline-teal-800"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">
                    Bilang / Quantity
                  </label>
                  <input
                    type="text"
                    value={rxForm.quantity}
                    onChange={(e) => setRxForm({ ...rxForm, quantity: e.target.value })}
                    placeholder="hal. 21 pcs, 1 bote"
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-900 text-xs focus:outline-teal-800 font-mono"
                  />
                </div>
              </div>

              <div className="text-xs">
                <label className="font-medium text-slate-700 block mb-1">
                  Tagubilin ng Doktor (Special Instructions / Signs)
                </label>
                <input
                  type="text"
                  value={rxForm.instructions}
                  onChange={(e) => setRxForm({ ...rxForm, instructions: e.target.value })}
                  placeholder="hal. Inumin pagkatapos kumain. Ubusin ang gamot sa loob ng 7 araw kahit mawala ang lagnat."
                  className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-900 text-xs focus:outline-teal-800"
                />
              </div>

              <div className="rounded border border-teal-200 bg-teal-50 p-3 space-y-2.5 text-xs">
                <div>
                  <p className="font-semibold text-teal-950">E-signature ng Doktor</p>
                  <p className="text-[11px] text-teal-800 mt-0.5">
                    Pipirma bilang {profile.name || 'naka-login na doktor'}{profile.prcLicense ? ` - PRC ${profile.prcLicense}` : ''}. Hindi sine-save ang password.
                  </p>
                </div>
                <label className="flex items-start gap-2 text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rxSignatureConsent}
                    onChange={(e) => setRxSignatureConsent(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-teal-800"
                  />
                  <span>Kinukumpirma kong tama ang gamot, dosage, dalas, tagal, at tagubilin sa resetang ito.</span>
                </label>
                <div>
                  <label className="font-medium text-slate-700 block mb-1">Kasalukuyang Password *</label>
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={rxSignaturePassword}
                    onChange={(e) => setRxSignaturePassword(e.target.value)}
                    placeholder="Ilagay ang password para pumirma"
                    className="w-full h-8 px-2.5 rounded border border-slate-300 bg-white text-slate-900 text-xs focus:outline-teal-800"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={rxSubmitting || !rxSignatureConsent || !rxSignaturePassword}
                  className="h-8 px-4 rounded bg-teal-800 hover:bg-teal-900 text-white font-medium text-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {rxSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Itinatala sa Record...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>E-sign at Ibigay ang Reseta</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* List of Active Prescriptions for this Patient */}
            <div className="pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-slate-800">
                  Mga Naitalang Reseta ng Pasyente ({patientRxList.length})
                </h4>
                <span className="text-[11px] text-slate-500">Live sync sa Patient Portal & Pharmacy</span>
              </div>

              {rxLoading ? (
                <div className="p-4 text-center text-xs text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin inline-block mr-1 text-teal-800" />
                  Kinukuha ang mga reseta...
                </div>
              ) : patientRxList.length === 0 ? (
                <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded">
                  Walang aktibong reseta para sa pasyenteng ito. Gamitin ang form sa itaas upang magreseta.
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {patientRxList.map((rx) => (
                    <div
                      key={rx.id}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs flex items-start justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-slate-900 text-sm">
                            {rx.medicationName || rx.medication}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-teal-100 text-teal-900 text-[11px] font-medium border border-teal-200">
                            {rx.dosage}
                          </span>
                          {rx.quantity && (
                            <span className="text-[11px] font-mono text-slate-600">
                              #{rx.quantity}
                            </span>
                          )}
                        </div>
                        <p className="text-slate-700 text-[11px]">
                          <strong>Dalas:</strong> {rx.frequency} &bull; <strong>Tagal:</strong> {rx.duration || 'N/A'}
                        </p>
                        {rx.instructions && (
                          <p className="text-slate-600 text-[11px] italic">
                            &ldquo;{rx.instructions}&rdquo;
                          </p>
                        )}
                        <p className="text-[10px] text-slate-500 font-mono">
                          Inireseta noong: {rx.prescribedDate ? new Date(rx.prescribedDate).toLocaleDateString('fil-PH') : 'Kamakailan'} &bull; {rx.doctorName || profile.name || 'Attending Physician'}
                        </p>
                        {rx.isSigned ? (
                          <p className="text-[10px] text-emerald-700 font-medium">
                            ✓ E-signed {rx.eSignedAt ? new Date(rx.eSignedAt).toLocaleString('fil-PH') : ''}
                            {rx.eSignatureLicense ? ` • PRC ${rx.eSignatureLicense}` : ''}
                            {rx.eSignatureHash ? ` • ${rx.eSignatureHash.slice(0, 10)}…` : ''}
                          </p>
                        ) : (
                          <p className="text-[10px] text-amber-700 font-medium">Legacy record • walang e-signature</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeletePrescription(rx.id)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                        title="I-void / tanggalin ang resetang ito"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setPrescriptionModalTicket(null)}
                className="h-8 px-4 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 font-medium text-xs cursor-pointer"
              >
                Isara (Done)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ERROR VALIDATION MODAL ─────────────────────────────────── */}
      {errorModal && errorModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-rose-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-gradient-to-r from-rose-500 to-red-600 px-6 py-4 flex items-center space-x-3 text-white">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-base leading-tight">{errorModal.title}</h3>
                <p className="text-xs text-rose-100 mt-0.5">Clinical Notification & Validation</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-slate-700 leading-relaxed font-normal">{errorModal.message}</p>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setErrorModal(null)}
                  className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm transition-colors cursor-pointer shadow-sm"
                >
                  Naiintindihan ko (Close)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── LOADING PROGRESS MODAL ───────────────────────────────────── */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-7 max-w-sm w-full text-center shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center mx-auto mb-4">
              <Loader2 className="w-7 h-7 animate-spin text-teal-700" />
            </div>
            <h4 className="text-base font-bold text-slate-900">Pinoproseso...</h4>
            <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">{processingText}</p>
            <div className="mt-4 flex justify-center">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-teal-50 text-teal-700 border border-teal-200">
                Huwag isara ang window
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRMATION MODAL (YES / NO) ────────────────────────────── */}
      {confirmModal && confirmModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6">
              <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 leading-snug">{confirmModal.title}</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{confirmModal.message}</p>
              <div className="mt-6 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors cursor-pointer"
                >
                  {confirmModal.cancelText || 'Kanselahin'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const action = confirmModal.onConfirm;
                    action();
                  }}
                  className={`px-5 py-2.5 rounded-lg text-white font-semibold text-sm transition-colors cursor-pointer shadow-sm ${
                    confirmModal.variant === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-teal-700 hover:bg-teal-800'
                  }`}
                >
                  {confirmModal.confirmText || 'Oo, Magpatuloy'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── QUEUE CONTROL MODAL (OPEN / PAUSE / CLOSE) ───────────────── */}
      {queueControlModal && queueControlModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-300 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Top Banner */}
            <div
              className={`px-5 py-4 border-b flex items-start justify-between gap-3 ${
                queueControlModal.targetStatus === 'PAUSED'
                  ? 'bg-amber-50 border-amber-200'
                  : queueControlModal.targetStatus === 'CLOSED'
                  ? 'bg-rose-50 border-rose-200'
                  : 'bg-teal-50 border-teal-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 font-bold shadow-2xs ${
                    queueControlModal.targetStatus === 'PAUSED'
                      ? 'bg-amber-500 text-white'
                      : queueControlModal.targetStatus === 'CLOSED'
                      ? 'bg-rose-600 text-white'
                      : 'bg-teal-800 text-white'
                  }`}
                >
                  {queueControlModal.targetStatus === 'PAUSED' ? (
                    <Clock className="w-5 h-5" />
                  ) : queueControlModal.targetStatus === 'CLOSED' ? (
                    <AlertTriangle className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                        queueControlModal.targetStatus === 'PAUSED'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : queueControlModal.targetStatus === 'CLOSED'
                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}
                    >
                      {queueControl.status} &rarr; {queueControlModal.targetStatus}
                    </span>
                    <span className="text-xs font-mono text-slate-600">{doctorDisplayRoom}</span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900 mt-1 leading-snug">
                    {queueControlModal.targetStatus === 'PAUSED'
                      ? 'Pansamantalang I-pause ang Pila (Pause Queue)'
                      : queueControlModal.targetStatus === 'CLOSED'
                      ? 'Isara ang Pila ng Konsultasyon (Close Queue)'
                      : 'Buksan Muli ang Pila (Reopen Consultation Queue)'}
                  </h3>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {queueControlModal.targetStatus === 'PAUSED'
                      ? 'Mananatili sa pila ang mga naghihintay na pasyente habang naka-pause ang pagtawag.'
                      : queueControlModal.targetStatus === 'CLOSED'
                      ? 'ihihinto na ang pagtanggap ng bagong pila para sa consultation room na ito.'
                      : 'Magiging aktibo na muli ang iyong consultation room para sa pagtawag ng pasyente.'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setQueueControlModal(null)}
                disabled={queueControlSubmitting}
                className="p-1 rounded-md text-slate-500 hover:text-slate-800 hover:bg-white/70 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleConfirmQueueControl} className="p-5 space-y-4 text-xs">
              {queueControlModal.targetStatus === 'OPEN' ? (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                    <p className="font-semibold text-sm flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>Handa nang tumanggap at tumawag muli ng pasyente</span>
                    </p>
                    <p className="text-xs text-emerald-800 leading-relaxed">
                      Makikita agad sa Nurse Triage, OPD Reception, at Queue TV na <strong>OPEN</strong> na ulit ang <strong>{doctorDisplayRoom}</strong> ({doctorDisplayName}).
                    </p>
                  </div>
                  {queueControl.reason && (
                    <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-slate-700">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                        Dating nakatalang dahilan ({queueControl.status}):
                      </span>
                      <p className="mt-1 font-medium text-slate-900">&ldquo;{queueControl.reason}&rdquo;</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {/* Quick 1-Click Reason Presets */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-slate-700">
                        Mabilis na Pagpili ng Dahilan (Quick Select):
                      </span>
                      <span className="text-[11px] text-slate-500">I-click para punan</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(queueControlModal.targetStatus === 'PAUSED'
                        ? queuePausePresets
                        : queueClosePresets
                      ).map((preset) => {
                        const isSelected = queueControlReason === preset;
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setQueueControlReason(preset)}
                            className={`px-2.5 py-1.5 rounded-md border text-[11px] font-medium transition cursor-pointer ${
                              isSelected
                                ? queueControlModal.targetStatus === 'PAUSED'
                                  ? 'bg-amber-100 border-amber-400 text-amber-950 font-semibold'
                                  : 'bg-rose-100 border-rose-400 text-rose-950 font-semibold'
                                : 'bg-slate-50 border-slate-300 text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {preset}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Reason Input */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-semibold text-slate-800">
                        {queueControlModal.targetStatus === 'PAUSED'
                          ? 'Dahilan ng Pag-pause ng Pila (Reason for Pausing) *'
                          : 'Dahilan ng Pagsasara ng Pila (Reason for Closing) *'}
                      </label>
                      <span className="text-[11px] font-mono text-slate-500">
                        {queueControlReason.length}/300
                      </span>
                    </div>
                    <textarea
                      rows={3}
                      required
                      maxLength={300}
                      autoFocus
                      value={queueControlReason}
                      onChange={(e) => setQueueControlReason(e.target.value)}
                      placeholder={
                        queueControlModal.targetStatus === 'PAUSED'
                          ? 'Hal. Emergency ward round, 15-minute break, clinical handoff...'
                          : 'Hal. Tapos na ang clinic hours, naabot na ang cut-off, emergency procedure...'
                      }
                      className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs focus:outline-teal-800"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Makikita ang mensaheng ito sa Triage Station, OPD Reception, at Patient Queue status.
                    </p>
                  </div>
                </>
              )}

              {/* Footer Actions */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setQueueControlModal(null)}
                  disabled={queueControlSubmitting}
                  className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs transition cursor-pointer"
                >
                  Kanselahin (Cancel)
                </button>
                <button
                  type="submit"
                  disabled={
                    queueControlSubmitting ||
                    (queueControlModal.targetStatus !== 'OPEN' &&
                      queueControlReason.trim().length < 3)
                  }
                  className={`h-9 px-4 rounded-lg text-white font-semibold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-2xs disabled:opacity-50 ${
                    queueControlModal.targetStatus === 'PAUSED'
                      ? 'bg-amber-600 hover:bg-amber-700'
                      : queueControlModal.targetStatus === 'CLOSED'
                      ? 'bg-rose-600 hover:bg-rose-700'
                      : 'bg-emerald-700 hover:bg-emerald-800'
                  }`}
                >
                  {queueControlSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Ina-update...</span>
                    </>
                  ) : queueControlModal.targetStatus === 'PAUSED' ? (
                    <>
                      <Clock className="w-3.5 h-3.5" />
                      <span>Kumpirmahin ang Pause</span>
                    </>
                  ) : queueControlModal.targetStatus === 'CLOSED' ? (
                    <>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Kumpirmahin ang Pagsasara</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Buksan Muli ang Pila</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── PATIENT TRANSFER MODAL ────────────────────────────────────── */}
      {transferModal && transferModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-300 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-teal-800 text-white px-2 py-0.5 rounded">
                    {transferModal.ticket.ticketNumber}
                  </span>
                  <h3 className="text-base font-bold text-slate-900">
                    Ilipat ang Pasyente (Transfer Patient)
                  </h3>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Pasyente: <strong className="text-slate-900">{transferModal.ticket.patientName}</strong> &rarr; Lilipat kay <strong className="text-teal-900">{transferModal.targetDoctorName}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTransferModal(null)}
                disabled={transferSubmitting}
                className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmTransferPatient} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-800 block mb-1">
                  Klinikal na Dahilan sa Paglipat (Reason for Transfer) *
                </label>
                <textarea
                  rows={3}
                  required
                  autoFocus
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="Hal. Kailangan ng Cardiology specialist evaluation, co-management..."
                  className="w-full p-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 text-xs focus:outline-teal-800"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setTransferModal(null)}
                  disabled={transferSubmitting}
                  className="h-9 px-4 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs cursor-pointer"
                >
                  Kanselahin
                </button>
                <button
                  type="submit"
                  disabled={transferSubmitting || transferReason.trim().length < 3}
                  className="h-9 px-4 rounded-lg bg-teal-800 hover:bg-teal-900 text-white font-semibold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {transferSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Inililipat...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Kumpirmahin ang Transfer</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        userName={doctorDisplayName || (session?.user?.name || 'Doctor')}
        userRole="ATTENDING PHYSICIAN"
        description="Sigurado ka bang nais mong mag-sign out mula sa Doctor Consultation Desk? Ang mga pasyenteng kasalukuyang nakapila sa inyong klinika ay mananatili sa queue."
      />
    </div>
  );
}
