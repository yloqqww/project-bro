'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import LogoutConfirmModal from '@/components/LogoutConfirmModal';
import {
  CreditCard,
  UserPlus,
  Clock,
  Printer,
  Radio,
  QrCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  LogOut,
  X,
  Pencil,
  Loader2,
  Key,
  Send,
  Stethoscope,
  HeartPulse,
  Activity,
  FileText,
  ArrowRight,
  BarChart3,
  Tv,
  RefreshCw,
  Bell,
  Volume2,
  VolumeX,
  Check,
  Settings,
  Search,
  ChevronLeft,
  ChevronRight,
  MessageSquareText,
} from 'lucide-react';
import WorkstationSettingsModal from '@/components/WorkstationSettingsModal';
import PatientMedicalRecordsModal from '@/components/PatientMedicalRecordsModal';
import { DoctorQueueAlertMonitor, type DoctorQueueControlState } from '@/components/DoctorQueueAlertMonitor';
import { getApiErrorMessage } from '@/lib/client-response';

interface StationNotification {
  id: string;
  title: string;
  message: string;
  timestamp: Date;
  type: 'TRIAGE' | 'QUEUE' | 'INFO';
  read: boolean;
  trgData?: any;
}

interface PatientRecord {
  id: string;
  patientNo: string;
  name: string;
  firstName?: string;
  lastName?: string;
  cardUid: string;
  dateOfBirth: string;
  gender: 'Male' | 'Female';
  bloodType: string;
  phone: string;
  address: string;
  emergencyContact: string;
  lastVisit?: string;
  allergies?: string;
  chronicConditions?: string;
  medicalRecords?: any[];
  vitals?: {
    bloodPressure?: string | number;
    heartRate?: string | number;
    temperature?: string | number;
    respiratoryRate?: string | number;
    oxygenSaturation?: string | number;
    weightKg?: string | number;
    weight?: string | number;
    heightCm?: string | number;
    height?: string | number;
    bmi?: string | number;
    recordedAt?: string;
  };
}

interface QueueTicketRecord {
  id: string;
  ticketNumber: string;
  queueNumber?: number;
  patientName: string;
  cardUid: string;
  department: string;
  doctor: string;
  doctorId?: string;
  room: string;
  priority: 'Regular' | 'Senior/PWD' | 'Urgent';
  reasonForVisit?: string;
  timeIssued: string;
  status: 'WAITING' | 'NOW SERVING' | 'COMPLETED' | 'CALLED' | 'IN_CONSULTATION';
}

interface DepartmentItem {
  id: string;
  name: string;
  doctor: string;
  doctorId: string;
  room: string;
  prefix: string;
  queueStatus?: 'OPEN' | 'PAUSED' | 'CLOSED';
  queueReason?: string | null;
}

const TRIAGE_PRESETS = [
  'Check-up sa Buntis (Prenatal Care)',
  'General Consultation / Check-up',
  'Lagnat at Trangkaso (Fever & Flu)',
  'Ubo at Sipon (Cough & Cold)',
  'Hypertension / BP Monitoring',
  'Pananakit ng Tiyan (Abdominal Pain)',
  'Pananakit ng Katawan / Kasukasuan',
  'Follow-up ng Lab Results',
  'Medical Certificate / Clearance',
  'Bakuna / Immunization',
];

const TRIAGE_PAGE_SIZE = 6;

export default function ReceptionCheckInPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'checkin' | 'register' | 'roster' | 'analytics'>('checkin');
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [departments, setDepartments] = useState<DepartmentItem[]>([]);
  const [cardSide, setCardSide] = useState<'front' | 'back'>('front');

  // OPD Analytics State (Same Page Integration)
  const [opdAnalytics, setOpdAnalytics] = useState<any>(null);
  const [isLoadingOpdAnalytics, setIsLoadingOpdAnalytics] = useState(false);
  const [analyticsLastRefreshed, setAnalyticsLastRefreshed] = useState('');

  const loadOpdAnalytics = useCallback(async () => {
    try {
      setIsLoadingOpdAnalytics(true);
      const res = await fetch('/api/analytics');
      const json = await res.json();
      if (json.success && json.opd) {
        setOpdAnalytics(json.opd);
        setAnalyticsLastRefreshed(
          new Date().toLocaleTimeString('fil-PH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      }
    } catch (err) {
      console.error('Error fetching OPD analytics:', err);
    } finally {
      setIsLoadingOpdAnalytics(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadOpdAnalytics();
    }
  }, [activeTab, loadOpdAnalytics]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab === 'checkin' || tab === 'register' || tab === 'roster' || tab === 'analytics') {
        setActiveTab(tab);
      }
    }
  }, []);

  // Sidebar collapse state
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // Scanner state
  const [scannedUid, setScannedUid] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [matchedPatient, setMatchedPatient] = useState<PatientRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Triage Purpose / Chief Complaint states
  const [triageReason, setTriageReason] = useState('Check-up sa Buntis (Prenatal Care)');
  const [triageBp, setTriageBp] = useState('0');
  const [triageTemp, setTriageTemp] = useState('0');
  const [triageHeartRate, setTriageHeartRate] = useState('0');
  const [triageWeight, setTriageWeight] = useState('0');
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Queue assignment state
  const [selectedDeptIndex, setSelectedDeptIndex] = useState(0);
  const [selectedPriority, setSelectedPriority] = useState<'Regular' | 'Senior/PWD' | 'Urgent'>('Regular');
  const [lastIssuedTicket, setLastIssuedTicket] = useState<QueueTicketRecord | null>(null);
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);

  // Incoming Triage Assessments from Triage Station
  const [incomingTriage, setIncomingTriage] = useState<any[]>([]);
  const [selectedTriage, setSelectedTriage] = useState<any | null>(null);
  const [registrationSourceTriage, setRegistrationSourceTriage] = useState<any | null>(null);
  const [linkingPatient, setLinkingPatient] = useState<any | null>(null);
  const [isOpdPrintModalOpen, setIsOpdPrintModalOpen] = useState(false);
  const [isMedicalRecordsOpen, setIsMedicalRecordsOpen] = useState(false);
  const [isLoadingTriage, setIsLoadingTriage] = useState(false);
  const [triageSearch, setTriageSearch] = useState('');
  const [triageCardFilter, setTriageCardFilter] = useState<'ALL' | 'NEEDS_RFID' | 'READY'>('ALL');
  const [triagePage, setTriagePage] = useState(1);

  const filteredIncomingTriage = useMemo(() => {
    const query = triageSearch.trim().toLowerCase();
    return incomingTriage.filter((trg) => {
      const hasNoCard = !trg.cardUid || trg.cardUid === 'NO_CARD';
      if (triageCardFilter === 'NEEDS_RFID' && !hasNoCard) return false;
      if (triageCardFilter === 'READY' && hasNoCard) return false;
      if (!query) return true;
      return [trg.patientName, trg.triageNumber, trg.cardUid, trg.department]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [incomingTriage, triageCardFilter, triageSearch]);

  const triagePageCount = Math.max(1, Math.ceil(filteredIncomingTriage.length / TRIAGE_PAGE_SIZE));
  const visibleIncomingTriage = filteredIncomingTriage.slice(
    (triagePage - 1) * TRIAGE_PAGE_SIZE,
    triagePage * TRIAGE_PAGE_SIZE
  );

  useEffect(() => {
    setTriagePage((current) => Math.min(current, triagePageCount));
  }, [triagePageCount]);

  // Notification System states
  const [notifications, setNotifications] = useState<StationNotification[]>([]);
  const [isNotifDropdownOpen, setIsNotifDropdownOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeToast, setActiveToast] = useState<StationNotification | null>(null);
  const seenTriageIdsRef = React.useRef<Set<string>>(new Set());
  const isInitialTriageLoadRef = React.useRef(true);
  const [desktopPermStatus, setDesktopPermStatus] = useState<string>('default');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [pollingIntervalSec, setPollingIntervalSec] = useState(7);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setDesktopPermStatus(Notification.permission);
    } else {
      setDesktopPermStatus('unsupported');
    }
  }, []);


  // Today's Queue Roster
  const [todayQueue, setTodayQueue] = useState<QueueTicketRecord[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(true);
  const [isLoadingQueue, setIsLoadingQueue] = useState(false);

  // New Patient Registration Form states
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newDob, setNewDob] = useState('1990-01-01');
  const [newGender, setNewGender] = useState<'Male' | 'Female'>('Male');
  const [newBloodType, setNewBloodType] = useState('N/A');
  const [newPhone, setNewPhone] = useState('09');
  const [newAddress, setNewAddress] = useState('Santa Cruz, Laguna');
  const [newEmergencyName, setNewEmergencyName] = useState('');
  const [newEmergencyPhone, setNewEmergencyPhone] = useState('09');
  const [newCardUid, setNewCardUid] = useState('');
  const [regSuccessMessage, setRegSuccessMessage] = useState('');

  // Modals (Error, Loading, and Yes/No Confirmation)
  const [errorModal, setErrorModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    field?: string;
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

  // Baseline Vital Signs Form states
  const [newBp, setNewBp] = useState('120/80');
  const [newHeartRate, setNewHeartRate] = useState('75');
  const [newTemp, setNewTemp] = useState('36.6');
  const [newWeight, setNewWeight] = useState('65');
  const [newHeight, setNewHeight] = useState('165');
  const [newSpo2, setNewSpo2] = useState('98');
  const [newRespiratoryRate, setNewRespiratoryRate] = useState('18');

  // Workstation profile state (Read-only for Receptionist, configured by Admin)
  const [userProfile, setUserProfile] = useState<{
    name: string;
    email: string;
    role: string;
    room: string;
    specialty: string;
    contact: string;
  }>({
    name: '',
    email: '',
    role: '',
    room: '',
    specialty: '',
    contact: '',
  });

  // Load current user profile from DB
  const loadUserProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/user/profile');
      const data = await res.json();
      if (data.success && data.profile) {
        setUserProfile({
          name: data.profile.name || '',
          email: data.profile.email || '',
          role: data.profile.role || '',
          room: data.profile.room || '',
          specialty: data.profile.specialty || '',
          contact: data.profile.contact || '',
        });
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
    }
  }, []);

  useEffect(() => {
    loadUserProfile();
  }, [loadUserProfile]);

  // Load Doctors from DB
  const loadDoctors = useCallback(async () => {
    try {
      setIsLoadingDoctors(true);
      const res = await fetch('/api/doctors');
      const data = await res.json();
      if (data.success && Array.isArray(data.doctors)) {
        const formattedDepts = data.doctors.map((doc: any) => ({
          id: doc.id,
          name: doc.specialization,
          doctor: doc.name,
          doctorId: doc.id,
          room: doc.roomNumber,
          prefix: doc.prefix,
          queueStatus: doc.queueStatus || 'OPEN',
          queueReason: doc.queueReason || null,
        }));
        setDepartments(formattedDepts);
      }
    } catch (err) {
      console.error('Error loading doctors:', err);
    } finally {
      setIsLoadingDoctors(false);
    }
  }, []);

  const handleDoctorQueueStatesUpdated = useCallback((states: DoctorQueueControlState[]) => {
    const map = new Map(states.map((s) => [s.doctorId, s]));
    setDepartments((prev) =>
      prev.map((dept) => {
        const match = map.get(dept.doctorId);
        if (!match) return dept;
        return {
          ...dept,
          queueStatus: match.status,
          queueReason: match.reason,
        };
      })
    );
  }, []);

  // Load Today's Queue from DB
  const loadQueue = useCallback(async () => {
    try {
      setIsLoadingQueue(true);
      const res = await fetch('/api/queue');
      const data = await res.json();
      if (data.success && Array.isArray(data.tickets)) {
        setTodayQueue(data.tickets);
      }
    } catch (err) {
      console.error('Error loading queue:', err);
    } finally {
      setIsLoadingQueue(false);
    }
  }, []);

  // Load Patients from DB
  const loadPatients = useCallback(async () => {
    try {
      const res = await fetch('/api/patients');
      const data = await res.json();
      if (data.success && Array.isArray(data.patients)) {
        setPatients(data.patients);
      }
    } catch (err) {
      console.error('Error loading patients:', err);
    }
  }, []);

  // Dual-tone hospital chime for incoming Triage alerts
  const playNotificationChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Tone 1: D5 (587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.2, now + 0.04);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Tone 2: A5 (880.00 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, now + 0.16);
      gain2.gain.setValueAtTime(0, now + 0.16);
      gain2.gain.linearRampToValueAtTime(0.25, now + 0.20);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.16);
      osc2.stop(now + 0.65);
    } catch (err) {
      console.warn('Audio chime error:', err);
    }
  }, [soundEnabled]);

  // Load Incoming Triaged Patients from Triage Station
  const loadIncomingTriage = useCallback(async () => {
    try {
      setIsLoadingTriage(true);
      const res = await fetch('/api/triage?status=PENDING_OPD&limit=100');
      const data = await res.json();
      if (data.success && Array.isArray(data.triageList)) {
        setIncomingTriage(data.triageList);

        if (isInitialTriageLoadRef.current) {
          data.triageList.forEach((trg: any) => {
            if (trg.id) seenTriageIdsRef.current.add(trg.id);
          });
          isInitialTriageLoadRef.current = false;
        } else {
          const newArrivals = data.triageList.filter(
            (trg: any) => trg.id && !seenTriageIdsRef.current.has(trg.id)
          );

          if (newArrivals.length > 0) {
            newArrivals.forEach((trg: any) => {
              seenTriageIdsRef.current.add(trg.id);
              const notif: StationNotification = {
                id: 'notif-' + trg.id + '-' + Date.now(),
                title: 'Bagong Pasyente Mula sa Triage',
                message: `${trg.patientName} (${trg.triageNumber || 'Triage'}) - Dept: ${trg.department?.replace('_', ' ') || 'General OPD'}`,
                timestamp: new Date(),
                type: 'TRIAGE',
                read: false,
                trgData: trg,
              };
              setNotifications((prev) => [notif, ...prev.slice(0, 29)]);
              setActiveToast(notif);
            });

            playNotificationChime();

            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              const latest = newArrivals[0];
              try {
                new Notification('Laguna Medical Center - Triage Alert', {
                  body: `Bagong pasyente: ${latest.patientName} (${latest.triageNumber || 'Station 1'})`,
                  icon: '/favicon.ico',
                });
              } catch (e) {
                // Ignore
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error loading incoming triage:', err);
    } finally {
      setIsLoadingTriage(false);
    }
  }, [playNotificationChime]);

  const handleSelectTriage = async (trg: any) => {
    setSelectedTriage(trg);
    setErrorMessage('');

    // Pre-fill Vitals from Triage
    if (trg.bloodPressure) setTriageBp(trg.bloodPressure);
    if (trg.temperature) setTriageTemp(trg.temperature);
    if (trg.heartRate) setTriageHeartRate(trg.heartRate);
    if (trg.weightKg) setTriageWeight(trg.weightKg);
    if (trg.chiefComplaint) setTriageReason(trg.chiefComplaint);

    if (trg.priorityLevel === 'URGENT' || trg.priorityLevel === 'RESUSCITATION') {
      setSelectedPriority('Urgent');
    } else if (trg.priorityLevel === 'PRIORITY') {
      setSelectedPriority('Senior/PWD');
    } else {
      setSelectedPriority('Regular');
    }

    // Match department to doctor
    const targetDept = trg.department;
    const matchedIdx = departments.findIndex((d) => {
      const name = d.name.toLowerCase();
      if (targetDept === 'OB_GYN') return name.includes('buntis') || name.includes('ob') || name.includes('gyne');
      if (targetDept === 'PEDIATRICS') return name.includes('pedia') || name.includes('bata');
      if (targetDept === 'SURGERY') return name.includes('surg');
      if (targetDept === 'EENT') return name.includes('eent') || name.includes('tenga') || name.includes('mata');
      return name.includes('medicine') || name.includes('general') || name.includes('adult');
    });
    if (matchedIdx !== -1) {
      setSelectedDeptIndex(matchedIdx);
    }

    // Try finding patient record in database via cardUid, patientId, or search by name
    if (trg.cardUid) {
      setScannedUid(trg.cardUid);
      performLookup(trg.cardUid);
    } else if (trg.patientId) {
      try {
        const res = await fetch(`/api/patients?patientId=${encodeURIComponent(trg.patientId)}`);
        const data = await res.json();
        if (data.success && data.patient) {
          setMatchedPatient(data.patient);
          playScannerBeep('success');
          return;
        }
      } catch (e) {
        console.error(e);
      }
    } else {
      try {
        const res = await fetch(`/api/patients?search=${encodeURIComponent(trg.patientName)}`);
        const data = await res.json();
        if (data.success && data.patients && data.patients.length > 0) {
          const p = data.patients[0];
          const detailRes = await fetch(`/api/patients?patientId=${encodeURIComponent(p.id)}`);
          const detailData = await detailRes.json();
          if (detailData.success && detailData.patient) {
            setMatchedPatient(detailData.patient);
            playScannerBeep('success');
            return;
          }
        }
      } catch (e) {
        console.error(e);
      }

      // Fallback patient record using Triage data
      setMatchedPatient({
        id: trg.id,
        patientNo: trg.triageNumber,
        name: trg.patientName,
        cardUid: trg.cardUid || 'NO_CARD',
        dateOfBirth: 'N/A',
        gender: trg.gender === 'FEMALE' ? 'Female' : 'Male',
        bloodType: 'Unknown',
        phone: 'N/A',
        address: 'Walk-in Triage Patient',
        emergencyContact: 'N/A',
        vitals: {
          bloodPressure: trg.bloodPressure,
          temperature: trg.temperature,
          heartRate: trg.heartRate,
          weight: trg.weightKg,
        },
      });
      playScannerBeep('success');
    }
  };

  // Transfer patient details directly into the Registration tab to issue an RFID Card
  const handleTransferToRegistration = (patientData: any) => {
    if (!patientData) return;
    setRegistrationSourceTriage(patientData.triageNumber ? patientData : null);
    if (patientData.triageNumber) {
      setSelectedTriage(patientData);
    }

    const rawName = patientData.patientName || patientData.name || '';
    const existingRecord = patients.find((p) => {
      if (patientData.patientId && p.id === patientData.patientId) return true;
      if (!patientData.triageNumber && patientData.id && p.id === patientData.id) return true;
      const pFull = (p.name || `${p.firstName || ''} ${p.lastName || ''}`).trim().toLowerCase();
      return rawName.trim() !== '' && pFull === rawName.trim().toLowerCase();
    });

    if (existingRecord && (!existingRecord.cardUid || existingRecord.cardUid === 'NO_CARD')) {
      setLinkingPatient(existingRecord);
    } else {
      setLinkingPatient(null);
    }

    const parts = rawName.trim().split(' ');
    const lastName = parts.length > 1 ? parts.pop() : '';
    const firstName = parts.join(' ') || rawName;

    setNewFirstName(firstName);
    setNewLastName(lastName || '');
    if (patientData.gender) {
      setNewGender(patientData.gender.toUpperCase().includes('FEMALE') ? 'Female' : 'Male');
    }
    if (patientData.dateOfBirth && patientData.dateOfBirth !== 'N/A') {
      try {
        const d = new Date(patientData.dateOfBirth);
        if (!isNaN(d.getTime())) {
          setNewDob(d.toISOString().split('T')[0]);
        }
      } catch (e) {}
    }
    if (patientData.phoneNumber || patientData.phone) {
      const p = patientData.phoneNumber || patientData.phone;
      if (p && p !== 'N/A') setNewPhone(p);
    }
    if (patientData.address && patientData.address !== 'N/A') {
      setNewAddress(patientData.address);
    }

    // Transfer vitals from Triage screening
    if (patientData.vitals) {
      if (patientData.vitals.bloodPressure) setNewBp(patientData.vitals.bloodPressure);
      if (patientData.vitals.heartRate) setNewHeartRate(String(patientData.vitals.heartRate));
      if (patientData.vitals.temperature) setNewTemp(String(patientData.vitals.temperature));
      if (patientData.vitals.weight) setNewWeight(String(patientData.vitals.weight));
    } else {
      if (patientData.bloodPressure) setNewBp(patientData.bloodPressure);
      if (patientData.heartRate) setNewHeartRate(String(patientData.heartRate));
      if (patientData.temperature) setNewTemp(String(patientData.temperature));
      if (patientData.weightKg) setNewWeight(String(patientData.weightKg));
    }

    // Blank out newCardUid so the receptionist can tap/scan a new physical RFID card
    setNewCardUid('');
    setRegSuccessMessage(`Pasyente: ${rawName}. I-tap o i-scan ang blangkong RFID card upang ma-link at ma-isyu bago mag-check in sa pila.`);
    setActiveTab('register');

    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    loadDoctors();
    loadQueue();
    loadPatients();
    loadIncomingTriage();
    const interval = setInterval(loadIncomingTriage, pollingIntervalSec * 1000);
    return () => clearInterval(interval);
  }, [loadDoctors, loadQueue, loadPatients, loadIncomingTriage, pollingIntervalSec]);

  // Auto-dismiss floating toast notification after 6.5s
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 6500);
    return () => clearTimeout(timer);
  }, [activeToast]);

  // Audio Beep for POS RFID Scanner simulation
  const playScannerBeep = (type: 'beep' | 'success' = 'beep') => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      if (type === 'beep') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1760, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.1);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(783.99, now + 0.12);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.35);
      }
    } catch (e) {
      console.warn('Audio context error:', e);
    }
  };

  // Perform card lookup in Database
  const performLookup = async (rawUid: string) => {
    const clean = rawUid.trim().toUpperCase();
    if (!clean) {
      setErrorMessage('Pakilagay ang Card UID ng pasyente o Triage Slip #.');
      setMatchedPatient(null);
      return;
    }

    // Support Triage Number lookup (TRG-...)
    if (clean.startsWith('TRG-')) {
      setIsScanning(true);
      setErrorMessage('');
      playScannerBeep('beep');
      try {
        const res = await fetch(`/api/triage?search=${encodeURIComponent(clean)}`);
        const data = await res.json();
        if (data.success && data.triageList && data.triageList.length > 0) {
          await handleSelectTriage(data.triageList[0]);
          playScannerBeep('success');
          setIsScanning(false);
          return;
        } else {
          setErrorMessage(`Hindi nakita ang Triage Slip (${clean}).`);
        }
      } catch (err) {
        console.error('Triage search error:', err);
        setErrorMessage('Hindi makakonekta sa database server.');
      } finally {
        setIsScanning(false);
      }
      return;
    }

    setIsScanning(true);
    setErrorMessage('');
    playScannerBeep('beep');

    try {
      const res = await fetch(`/api/patients?cardUid=${encodeURIComponent(clean)}`);
      const data = await res.json();
      if (res.ok && data.success && data.patient) {
        setMatchedPatient(data.patient);
        if (data.patient.vitals) {
          if (data.patient.vitals.bloodPressure) setTriageBp(String(data.patient.vitals.bloodPressure));
          if (data.patient.vitals.temperature) setTriageTemp(String(data.patient.vitals.temperature));
          if (data.patient.vitals.heartRate) setTriageHeartRate(String(data.patient.vitals.heartRate));
          if (data.patient.vitals.weight) setTriageWeight(String(data.patient.vitals.weight));
        }
        if (departments.length > 0 && departments[selectedDeptIndex]?.name?.toLowerCase().includes('buntis')) {
          setTriageReason('Check-up sa Buntis (Prenatal Care)');
        } else {
          setTriageReason('General Consultation / Check-up');
        }
        setErrorMessage('');
        playScannerBeep('success');
      } else {
        setMatchedPatient(null);
        setErrorMessage(
          getApiErrorMessage(data.error, `Hindi nakita ang RFID Card (${clean}). Pakisuri ang card o i-rehistro sa tab na "Magpalista ng Pasyente".`)
        );
      }
    } catch (err) {
      console.error('Lookup error:', err);
      setMatchedPatient(null);
      setErrorMessage('Hindi makakonekta sa database server.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSimulateScan = (uid: string) => {
    setScannedUid(uid);
    performLookup(uid);
  };

  // Generate a unique random hex UID for a blank card (e.g. B4E2A8C1)
  const handleGenerateBlankUid = () => {
    const chars = '0123456789ABCDEF';
    const existingUids = new Set(
      patients
        .map((p) => p.cardUid?.trim().toUpperCase())
        .filter((uid): uid is string => Boolean(uid))
    );

    let res = '';
    for (let attempt = 0; attempt < 25; attempt++) {
      let candidate = '';
      for (let i = 0; i < 8; i++) {
        candidate += chars[Math.floor(Math.random() * chars.length)];
      }
      if (!existingUids.has(candidate)) {
        res = candidate;
        break;
      }
    }

    if (!res) {
      res = Date.now().toString(16).toUpperCase().slice(-8).padStart(8, '0');
    }

    setNewCardUid(res);
    playScannerBeep('beep');
  };

  // Actual execution of ticket issuance
  const executeIssueTicket = async (dept: any) => {
    if (!matchedPatient) return;
    try {
      setIsSubmittingTicket(true);
      setIsProcessing(true);
      setProcessingText(`Iniisyu ang queue ticket para kay ${matchedPatient.name}...`);

      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: matchedPatient.id,
          cardUid: matchedPatient.cardUid,
          doctorId: dept.doctorId,
          priority: selectedPriority,
          reasonForVisit: triageReason.trim() || 'General Outpatient Consultation',
          vitals: {
            bloodPressure: triageBp.trim(),
            temperature: parseFloat(triageTemp) || 36.5,
            heartRate: parseInt(triageHeartRate, 10) || 75,
            weight: parseFloat(triageWeight) || 65,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setIsProcessing(false);
        setErrorModal({
          open: true,
          title: 'Hindi Na-issue ang Ticket',
          message: getApiErrorMessage(data.error, 'Hindi na-issue ang queue ticket sa sistema.'),
        });
        return;
      }

      setLastIssuedTicket(data.ticket);
      setIsTicketModalOpen(true);
      playScannerBeep('success');
      loadQueue();

      // Add success notification
      const ticketNotif: StationNotification = {
        id: 'ticket-' + (data.ticket?.id || Date.now()),
        title: 'Queue Ticket Inisyu',
        message: `Ticket #${data.ticket?.ticketNumber || ''} para kay ${matchedPatient.name} (${dept.name})`,
        timestamp: new Date(),
        type: 'QUEUE',
        read: false,
      };
      setNotifications((prev) => [ticketNotif, ...prev.slice(0, 29)]);

      // If patient came from Triage, mark triage as OPD_PROCESSED in DB
      if (selectedTriage?.id || selectedTriage?.triageNumber) {
        try {
          await fetch('/api/triage', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: selectedTriage.id,
              triageNumber: selectedTriage.triageNumber,
              status: 'OPD_PROCESSED',
              opdQueueTicketId: data.ticket?.id,
            }),
          });
          loadIncomingTriage();
        } catch (patchErr) {
          console.error('Failed to update triage status:', patchErr);
        }
      }
    } catch (err) {
      console.error('Error issuing ticket:', err);
      setErrorModal({
        open: true,
        title: 'Network / Database Error',
        message: 'Nagka-error sa pag-issue ng ticket sa database server.',
      });
    } finally {
      setIsSubmittingTicket(false);
      setIsProcessing(false);
    }
  };

  // Issue Queue Ticket to Matched Patient (Database Driven with Confirmation Modal)
  const handleIssueTicket = async () => {
    if (!matchedPatient) return;
    if (departments.length === 0) {
      setErrorModal({
        open: true,
        title: 'Walang Aktibong Doktor',
        message: 'Walang aktibong Doctor sa database. Mag-rehistro muna ang Admin ng Doctor sa /admin/staff.',
      });
      return;
    }
    const dept = departments[selectedDeptIndex];
    if (!dept) {
      setErrorModal({
        open: true,
        title: 'Pumili ng Doktor o Kagawaran',
        message: 'Mangyaring pumili ng Kagawaran o Doktor bago mag-issue ng ticket.',
      });
      return;
    }

    setConfirmModal({
      open: true,
      title: 'Kumpirmahin ang Pag-issue ng Ticket',
      message: `Nais mo bang mag-issue ng ${selectedPriority} ticket para kay "${matchedPatient.name}" patungo kay Dr. ${dept.doctor} (${dept.name})?`,
      confirmText: 'Oo, I-issue ang Ticket',
      cancelText: 'Kanselahin',
      variant: 'primary',
      onConfirm: () => {
        setConfirmModal(null);
        executeIssueTicket(dept);
      },
    });
  };

  // Link an RFID Card UID directly to an existing cardless patient record
  const executeLinkRfidToExistingPatient = async (targetPatient: any, cleanCard: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/patients/rfid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          patientId: targetPatient.id,
          cardUid: cleanCard,
          replaceExisting: false,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setIsProcessing(false);
        setErrorModal({
          open: true,
          title: 'Hindi Na-link ang RFID Card',
          message: getApiErrorMessage(data.error, 'Hindi nai-link ang RFID card sa existing patient record.'),
          field: 'cardUid',
        });
        return;
      }

      const updatedPatient = {
        ...targetPatient,
        cardUid: data.patient?.cardUid || cleanCard,
      };
      setMatchedPatient(updatedPatient);
      setScannedUid(updatedPatient.cardUid);
      setLinkingPatient(null);
      playScannerBeep('success');

      if (registrationSourceTriage?.id || registrationSourceTriage?.triageNumber) {
        const linkRes = await fetch('/api/triage', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: registrationSourceTriage.id,
            triageNumber: registrationSourceTriage.triageNumber,
            patientId: updatedPatient.id,
            cardUid: updatedPatient.cardUid,
          }),
        });
        const linkData = await linkRes.json();
        if (linkRes.ok && linkData.success) {
          const linkedTriage = {
            ...registrationSourceTriage,
            patientId: updatedPatient.id,
            cardUid: updatedPatient.cardUid,
          };
          setSelectedTriage(linkedTriage);
          setIncomingTriage((current) =>
            current.map((trg) => (trg.id === linkedTriage.id ? linkedTriage : trg))
          );
          setRegistrationSourceTriage(null);
        }
      }

      setRegSuccessMessage(
        `Matagumpay na na-link ang RFID Card (UID: ${updatedPatient.cardUid}) kay ${updatedPatient.name} (${updatedPatient.patientNo || updatedPatient.id})!`
      );
      setNewFirstName('');
      setNewLastName('');
      setNewCardUid('');

      await Promise.all([loadPatients(), loadIncomingTriage()]);
      setIsProcessing(false);

      setNotifications((prev) => [
        {
          id: 'rfid-link-' + (updatedPatient.id || Date.now()),
          title: 'Na-link ang RFID Card',
          message: `${updatedPatient.name} (Card UID: ${updatedPatient.cardUid})`,
          timestamp: new Date(),
          type: 'INFO',
          read: false,
        },
        ...prev.slice(0, 29),
      ]);

      setTimeout(() => {
        setActiveTab('checkin');
      }, 800);
    } catch (err) {
      console.error('Error linking RFID card:', err);
      setIsProcessing(false);
      setErrorModal({
        open: true,
        title: 'Network / Database Error',
        message: 'Hindi ma-contact ang server para i-link ang RFID card.',
      });
    }
  };

  // Register New Patient and Pair with Physical RFID Card (Database Driven with Duplicate Validation)
  const handleRegisterPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanFirst = newFirstName.trim();
    const cleanLast = newLastName.trim();
    const cleanCard = newCardUid.trim().toUpperCase();
    const cleanPhoneVal = newPhone.trim();

    // 1. Required fields check
    if (!cleanFirst || !cleanLast || !cleanCard) {
      setErrorModal({
        open: true,
        title: 'Kulang na Impormasyon',
        message: 'Pakilagay ang buong pangalan ng pasyente at i-scan ang blangkong RFID card UID bago magpatuloy.',
        field: 'required',
      });
      return;
    }

    // 1b. If linking directly to an existing cardless patient, verify card UID is unused and link immediately
    if (linkingPatient && (!linkingPatient.cardUid || linkingPatient.cardUid === 'NO_CARD')) {
      const cardOwner = patients.find(
        (p) => p.cardUid && p.cardUid.toUpperCase() === cleanCard
      );
      if (cardOwner) {
        setErrorModal({
          open: true,
          title: 'Nagamit na ang RFID Card UID',
          message: `Ang RFID UID na "${cleanCard}" ay nakatali na sa rekord ni ${cardOwner.name} (${cardOwner.patientNo || cardOwner.id}). Mangyaring gumamit ng ibang RFID card.`,
          field: 'cardUid',
        });
        return;
      }
      await executeLinkRfidToExistingPatient(linkingPatient, cleanCard);
      return;
    }

    // 2. Check duplicate name against currently loaded patients
    const fullNameTyped = `${cleanFirst} ${cleanLast}`.toLowerCase();
    const existingPatientByName = patients.find((p) => {
      const pFull = (p.name || `${p.firstName || ''} ${p.lastName || ''}`).trim().toLowerCase();
      return pFull === fullNameTyped;
    });

    if (existingPatientByName) {
      const isCardless = !existingPatientByName.cardUid || existingPatientByName.cardUid === 'NO_CARD';
      if (isCardless) {
        const cardOwner = patients.find(
          (p) => p.cardUid && p.cardUid.toUpperCase() === cleanCard
        );
        if (cardOwner) {
          setErrorModal({
            open: true,
            title: 'Nagamit na ang RFID Card UID',
            message: `Ang RFID UID na "${cleanCard}" ay nakatali na sa rekord ni ${cardOwner.name} (${cardOwner.patientNo || cardOwner.id}). Mangyaring gumamit ng ibang RFID card.`,
            field: 'cardUid',
          });
          return;
        }
        setConfirmModal({
          open: true,
          title: 'May Existing Record na Walang RFID Card',
          message: `Mayroon nang pasyenteng "${existingPatientByName.name}" (${existingPatientByName.patientNo || existingPatientByName.id}) sa sistema pero wala pa siyang RFID card. Gusto mo bang i-link ang RFID card na "${cleanCard}" sa existing record niya?`,
          confirmText: 'Oo, I-link ang RFID Card',
          cancelText: 'Kanselahin',
          variant: 'primary',
          onConfirm: () => {
            setConfirmModal(null);
            executeLinkRfidToExistingPatient(existingPatientByName, cleanCard);
          },
        });
        return;
      }

      setErrorModal({
        open: true,
        title: 'May Kaparehong Pangalan (Duplicate Patient)',
        message: `Mayroon nang nakarehistrong pasyente sa pangalang "${cleanFirst} ${cleanLast}" (${existingPatientByName.patientNo || existingPatientByName.id}, RFID: ${existingPatientByName.cardUid}). Bawal ang duplicate na pasyente sa sistema.`,
        field: 'name',
      });
      return;
    }

    // 3. Check duplicate phone number
    const phoneDigits = cleanPhoneVal.replace(/\D/g, '');
    if (phoneDigits.length >= 7) {
      const existingPatientByPhone = patients.find((p) => {
        const pDigits = (p.phone || '').replace(/\D/g, '');
        return (phoneDigits.length >= 7 && pDigits.endsWith(phoneDigits.slice(-10))) || pDigits === phoneDigits;
      });

      if (existingPatientByPhone) {
        setErrorModal({
          open: true,
          title: 'May Kaparehong Contact Number',
          message: `Ang contact number na "${cleanPhoneVal}" ay nakatala na kay ${existingPatientByPhone.name} (${existingPatientByPhone.patientNo || existingPatientByPhone.id}). Bawal ang duplicate na contact number.`,
          field: 'phone',
        });
        return;
      }
    }

    // 4. Check duplicate RFID Card UID
    const existingPatientByCard = patients.find(
      (p) => p.cardUid && p.cardUid.toUpperCase() === cleanCard
    );

    if (existingPatientByCard) {
      setErrorModal({
        open: true,
        title: 'Nagamit na ang RFID Card UID',
        message: `Ang RFID UID na "${cleanCard}" ay nakatali na sa rekord ni ${existingPatientByCard.name} (${existingPatientByCard.patientNo || existingPatientByCard.id}). Mangyaring gumamit ng ibang RFID card.`,
        field: 'cardUid',
      });
      return;
    }

    try {
      setIsProcessing(true);
      setProcessingText(`Inirerehistro si ${cleanFirst} ${cleanLast} at iniuugnay ang RFID UID (${cleanCard})...`);

      const weightNum = parseFloat(newWeight) || 65;
      const heightNum = parseFloat(newHeight) || 165;
      const heightM = heightNum / 100;
      const calculatedBmi = parseFloat((weightNum / (heightM * heightM)).toFixed(1));

      const validPhoneVal = phoneDigits.length >= 7 ? phoneDigits : '09170000000';
      const emergencyPhoneDigits = (newEmergencyPhone || '').replace(/\D/g, '');
      const validEmergencyPhone = emergencyPhoneDigits.length >= 7 ? emergencyPhoneDigits : validPhoneVal;

      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: cleanFirst,
          lastName: cleanLast,
          dateOfBirth: newDob || '1990-01-01',
          gender: newGender,
          bloodType: newBloodType,
          phoneNumber: validPhoneVal,
          email: '',
          address: (newAddress || '').trim().length >= 3 ? newAddress.trim() : 'Santa Cruz, Laguna',
          city: 'Santa Cruz',
          state: 'Laguna',
          zipCode: '4009',
          emergencyContactName: (newEmergencyName || '').trim() || 'Kamag-anak',
          emergencyContactPhone: validEmergencyPhone,
          emergencyContactRelation: 'Family',
          cardUid: cleanCard,
          allergies: registrationSourceTriage?.allergies || selectedTriage?.allergies || '',
          chronicConditions: registrationSourceTriage?.chronicConditions || selectedTriage?.chronicConditions || '',
          vitals: {
            bloodPressure: newBp || '120/80',
            heartRate: parseInt(newHeartRate, 10) || 75,
            temperature: parseFloat(newTemp) || 36.6,
            weight: weightNum,
            height: heightNum,
            bmi: calculatedBmi,
            oxygenSaturation: parseInt(newSpo2, 10) || 98,
            respiratoryRate: parseInt(newRespiratoryRate, 10) || 18,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setIsProcessing(false);
        setErrorModal({
          open: true,
          title: 'Hindi Naituloy ang Rehistrasyon',
          message: getApiErrorMessage(data.error, 'Hindi narehistro ang pasyente sa database server.'),
          field: data.field,
        });
        return;
      }

      const registered = data.patient;
      setMatchedPatient(registered);
      setScannedUid(registered.cardUid);
      playScannerBeep('success');

      if (registrationSourceTriage?.id || registrationSourceTriage?.triageNumber) {
        const linkRes = await fetch('/api/triage', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: registrationSourceTriage.id,
            triageNumber: registrationSourceTriage.triageNumber,
            patientId: registered.id,
            cardUid: registered.cardUid,
          }),
        });
        const linkData = await linkRes.json();
        if (!linkRes.ok || !linkData.success) {
          setRegSuccessMessage(
            `Narehistro si ${registered.name} at na-link ang RFID ${registered.cardUid}, ngunit hindi na-update ang Triage slip.`
          );
          setErrorModal({
            open: true,
            title: 'Narehistro, Ngunit Hindi Na-link sa Triage',
            message: getApiErrorMessage(linkData.error, 'I-refresh ang Triage queue at subukang muli ang pag-link bago mag-issue ng ticket.'),
          });
          await Promise.all([loadPatients(), loadIncomingTriage()]);
          setIsProcessing(false);
          return;
        }

        const linkedTriage = {
          ...registrationSourceTriage,
          patientId: registered.id,
          cardUid: registered.cardUid,
        };
        setSelectedTriage(linkedTriage);
        setIncomingTriage((current) => current.map((trg) => (
          trg.id === linkedTriage.id ? linkedTriage : trg
        )));
        setRegistrationSourceTriage(null);
      }

      setRegSuccessMessage(
        `Matagumpay na nairehistro si ${registered.name}! Ang Physical RFID Card (UID: ${registered.cardUid}) ay nakatali na sa kanyang rekord.`
      );

      setNewFirstName('');
      setNewLastName('');
      setNewCardUid('');

      await Promise.all([loadPatients(), loadIncomingTriage()]);
      setIsProcessing(false);

      // Add registration notification
      const regNotif: StationNotification = {
        id: 'reg-' + (registered.id || Date.now()),
        title: 'Bagong Pasyente Narehistro',
        message: `${registered.name} (Card UID: ${registered.cardUid})`,
        timestamp: new Date(),
        type: 'INFO',
        read: false,
      };
      setNotifications((prev) => [regNotif, ...prev.slice(0, 29)]);

      setTimeout(() => {
        setActiveTab('checkin');
        setRegSuccessMessage('');
      }, 1800);
    } catch (err) {
      console.error('Registration error:', err);
      setIsProcessing(false);
      setErrorModal({
        open: true,
        title: 'Database Connection Error',
        message: 'Nagka-error sa pakikipag-ugnayan sa server habang nagrerehistro.',
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col justify-between font-sans antialiased">
      
      {/* ── 1. COMPACT PROFESSIONAL HOSPITAL HEADER ──────────────────── */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-30">
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          
          {/* Identity: Hospital + Station */}
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-md bg-teal-800 flex items-center justify-center text-white font-bold text-sm tracking-wider shrink-0 shadow-sm">
              OPD
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-slate-900 tracking-tight">
                  Laguna Medical Center
                </span>
                <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 font-bold text-xs rounded border border-teal-200 uppercase tracking-wider">
                  Station 2: OPD Records Counter
                </span>
                <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300 font-semibold font-mono">
                  {userProfile.room || 'OPD Counter 1'}
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-tight mt-0.5">
                Patient Records Retrieval • DOH Consultation Form Printing • Doctor Queue Assignment
              </p>
            </div>
          </div>

          {/* Secondary Actions & Workstation Identity */}
          <div className="flex items-center space-x-2 text-xs sm:text-sm">
            {/* Audio Chime Notification Toggle */}
            <button
              type="button"
              onClick={() => setSoundEnabled((prev) => !prev)}
              className={`h-9 w-9 rounded-md border font-semibold flex items-center justify-center shadow-2xs transition-colors cursor-pointer shrink-0 ${
                soundEnabled
                  ? 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                  : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
              }`}
              title={soundEnabled ? 'Chime Alert: BUKAS (Pindutin para i-mute)' : 'Chime Alert: NAKA-MUTE (Pindutin para ibalik)'}
              aria-label={soundEnabled ? 'I-mute ang tunog ng alerto' : 'Buksan ang tunog ng alerto'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-teal-800" />
              ) : (
                <VolumeX className="w-4 h-4 text-amber-700" />
              )}
            </button>

            {/* Notification Bell with Badge & Dropdown Drawer */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsNotifDropdownOpen((prev) => !prev)}
                className={`relative h-9 w-9 rounded-md border font-semibold flex items-center justify-center shadow-2xs transition-colors cursor-pointer shrink-0 ${
                  isNotifDropdownOpen
                    ? 'bg-teal-800 text-white border-teal-900'
                    : 'border-slate-300 bg-white hover:bg-slate-50 text-slate-700'
                }`}
                title="Mga Alerto at Notipikasyon sa Station 2"
                aria-label="Mga Notipikasyon"
              >
                <Bell className={`w-4 h-4 ${isNotifDropdownOpen ? 'text-white' : 'text-slate-700'}`} />
                {notifications.filter((n) => !n.read).length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-rose-600 rounded-full animate-pulse shadow-xs">
                    {notifications.filter((n) => !n.read).length > 99
                      ? '99+'
                      : notifications.filter((n) => !n.read).length}
                  </span>
                )}
              </button>

              {/* Notification Popover Dropdown */}
              {isNotifDropdownOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-slate-300 z-50 overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-3.5 py-2.5 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Bell className="w-4 h-4 text-teal-800" />
                      <span className="text-xs font-bold text-slate-900">
                        Mga Abiso at Alerto (Station 2)
                      </span>
                      {notifications.filter((n) => !n.read).length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-bold border border-rose-200">
                          {notifications.filter((n) => !n.read).length} Bago
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1.5">
                      {notifications.length > 0 && (
                        <>
                          <button
                            type="button"
                            onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                            className="text-[11px] font-semibold text-teal-800 hover:text-teal-950 px-1.5 py-0.5 rounded hover:bg-slate-200/60 transition cursor-pointer"
                          >
                            Nabasa na
                          </button>
                          <button
                            type="button"
                            onClick={() => setNotifications([])}
                            className="text-[11px] font-semibold text-slate-500 hover:text-red-700 px-1.5 py-0.5 rounded hover:bg-red-50 transition cursor-pointer"
                            title="Tanggalin lahat ng abiso"
                          >
                            Linisin
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsNotifDropdownOpen(false)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                        aria-label="Isara"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 space-y-1">
                        <Activity className="w-6 h-6 text-slate-300 mx-auto" />
                        <p className="font-semibold text-slate-700">Walang bagong abiso</p>
                        <p className="text-[11px]">
                          Awtomatikong mag-aalarma rito kapag may dumarating na pasyente mula sa Triage (Station 1) o kapag may inisyung ticket.
                        </p>
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif.id}
                          className={`p-3 transition-colors ${
                            notif.read ? 'bg-white hover:bg-slate-50' : 'bg-teal-50/50 hover:bg-teal-50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start space-x-2 min-w-0">
                              <span
                                className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                                  notif.read ? 'bg-slate-300' : 'bg-teal-600'
                                }`}
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 leading-snug">
                                  {notif.title}
                                </div>
                                <div className="text-[11px] text-slate-600 mt-0.5 break-words">
                                  {notif.message}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-1">
                                  {notif.timestamp.toLocaleTimeString('fil-PH', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    second: '2-digit',
                                  })}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center space-x-1 shrink-0">
                              {notif.trgData && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveTab('checkin');
                                    handleSelectTriage(notif.trgData);
                                    setIsNotifDropdownOpen(false);
                                    setActiveToast(null);
                                  }}
                                  className="px-2 py-1 rounded bg-teal-800 hover:bg-teal-900 text-white text-[11px] font-bold transition cursor-pointer"
                                >
                                  I-proseso
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setNotifications((prev) => prev.filter((n) => n.id !== notif.id))}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded hover:bg-slate-200/50 transition cursor-pointer"
                                title="Tanggalin ang abiso"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="bg-slate-50 border-t border-slate-200 p-2.5 flex items-center justify-between text-[11px] text-slate-600">
                    <span>Auto-refresh: Bawat 7s</span>
                    {desktopPermStatus === 'granted' ? (
                      <span className="inline-flex items-center space-x-1 font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <Check className="w-3 h-3 text-emerald-700" />
                        <span>Desktop Alerto: Aktibo</span>
                      </span>
                    ) : desktopPermStatus === 'denied' ? (
                      <span className="text-slate-500 font-semibold text-[10px]" title="Naka-block sa browser settings ang notification">
                        Desktop Alerto: Naka-block
                      </span>
                    ) : desktopPermStatus === 'unsupported' ? (
                      <span className="text-slate-400 text-[10px]">Hindi suportado</span>
                    ) : (
                      <button
                        type="button"
                        onClick={async () => {
                          if (typeof window !== 'undefined' && 'Notification' in window) {
                            try {
                              const perm = await Notification.requestPermission();
                              setDesktopPermStatus(perm);
                              if (perm === 'granted') {
                                setNotifications((prev) => {
                                  if (prev.some((n) => n.id === 'perm-granted')) return prev;
                                  return [
                                    {
                                      id: 'perm-granted',
                                      title: 'Desktop Alerto Naka-enable',
                                      message: 'Makakatanggap ka na ng alerto sa screen kahit naka-minimize ang tab.',
                                      timestamp: new Date(),
                                      type: 'INFO',
                                      read: false,
                                    },
                                    ...prev,
                                  ];
                                });
                              }
                            } catch (e) {
                              console.warn('Desktop notification error:', e);
                            }
                          }
                        }}
                        className="font-semibold text-teal-800 hover:underline cursor-pointer"
                      >
                        I-enable Desktop Alerto
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Workstation & Profile Settings */}
            <button
              type="button"
              onClick={() => setIsSettingsModalOpen(true)}
              className="h-9 w-9 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold flex items-center justify-center shadow-2xs transition-colors cursor-pointer shrink-0"
              title="Mga Setting ng Workstation at Profile"
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </button>

            <div
              className="h-9 px-3 rounded-md border border-slate-300 bg-white text-slate-700 font-medium flex items-center space-x-2 shadow-2xs select-none"
              title="Aktibong Workstation Counter ng OPD (Itinalaga ng Admin)"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
              <span>
                {userProfile.role === 'RECEPTIONIST' ? 'OPD' : userProfile.role === 'NURSE' ? 'Triage' : userProfile.role || 'OPD'}: <strong>{userProfile.name || session?.user?.name || session?.user?.email?.split('@')[0]}</strong>
              </span>
              {userProfile.room && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono border border-slate-200 ml-0.5 font-semibold">
                  {userProfile.room}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className="h-9 px-3 rounded-md border border-slate-300 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-300 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
              title="Mag-log out sa Reception Workstation"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── REAL-TIME TOAST NOTIFICATION BANNER ────────────────────── */}
      {activeToast && (
        <div className="fixed top-18 right-4 sm:right-6 z-50 max-w-sm sm:max-w-md w-full bg-white border border-teal-600 rounded-lg shadow-2xl p-3.5 animate-in fade-in slide-in-from-top-4 duration-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start space-x-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-teal-100 border border-teal-300 flex items-center justify-center shrink-0 mt-0.5">
                <Bell className="w-4 h-4 text-teal-800 animate-bounce" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-teal-900 uppercase tracking-wide flex items-center gap-1.5">
                  <span>{activeToast.title}</span>
                  <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                </div>
                <div className="text-sm font-bold text-slate-900 mt-0.5 leading-snug">
                  {activeToast.message}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">
                  Kakarating lang mula sa Station 1 Triage
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded cursor-pointer shrink-0"
              aria-label="Isara ang toast"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {activeToast.trgData && (
            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setActiveToast(null)}
                className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded font-medium transition cursor-pointer"
              >
                I-dismiss
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('checkin');
                  handleSelectTriage(activeToast.trgData);
                  setActiveToast(null);
                }}
                className="px-3 py-1 bg-teal-800 hover:bg-teal-900 text-white rounded text-xs font-bold transition shadow-xs cursor-pointer flex items-center space-x-1"
              >
                <span>I-proseso Agad</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── 2. MAIN WORKSPACE WITH SIDEBAR (FULL SCREEN DESIGN) ────── */}
      <div className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 flex flex-col lg:flex-row gap-4 items-start">
        
        {/* ── COLLAPSIBLE SIDEBAR NAVIGATION ──────────────────────────── */}
        <aside
          className={`w-full shrink-0 space-y-3 transition-all duration-200 ${
            isSidebarCollapsed ? 'lg:w-16' : 'lg:w-72'
          }`}
        >
          {/* Main Reception Navigation Card */}
          <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden">
            <div
              className={`bg-slate-50 border-b border-slate-200 p-3 flex items-center ${
                isSidebarCollapsed ? 'justify-center' : 'justify-between'
              }`}
            >
              {!isSidebarCollapsed && (
                <div className="min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Reception Menu
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold border border-teal-200">
                      OPD Counter
                    </span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">
                    Mga Pangunahing Gawain
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

            <nav className="p-2 space-y-1.5" aria-label="Reception Menu">
              {/* Tab 1: Check-in */}
              <button
                type="button"
                onClick={() => setActiveTab('checkin')}
                title="I-tap ang RFID Card • Check-in sa Pila"
                className={`w-full text-left rounded-lg transition-all flex items-center cursor-pointer border p-2.5 ${
                  isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                } ${
                  activeTab === 'checkin'
                    ? 'bg-teal-800 text-white border-teal-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold ${
                    activeTab === 'checkin' ? 'bg-teal-900 text-white' : 'bg-teal-50 text-teal-800'
                  }`}
                >
                  <Radio className="w-5 h-5" />
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold leading-tight truncate">
                      I-tap ang RFID Card
                    </div>
                    <div
                      className={`text-xs mt-0.5 truncate ${
                        activeTab === 'checkin' ? 'text-teal-100' : 'text-slate-500'
                      }`}
                    >
                      Check-in sa Pila
                    </div>
                  </div>
                )}
              </button>

              {/* Tab 2: Register */}
              <button
                type="button"
                onClick={() => {
                  setRegistrationSourceTriage(null);
                  setActiveTab('register');
                }}
                title="Magpalista ng Pasyente • Bagong Pasyente & I-link ang RFID Card"
                className={`w-full text-left rounded-lg transition-all flex items-center cursor-pointer border p-2.5 ${
                  isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                } ${
                  activeTab === 'register'
                    ? 'bg-teal-800 text-white border-teal-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold ${
                    activeTab === 'register' ? 'bg-teal-900 text-white' : 'bg-teal-50 text-teal-800'
                  }`}
                >
                  <UserPlus className="w-5 h-5" />
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold leading-tight truncate">
                      Magpalista ng Pasyente
                    </div>
                    <div
                      className={`text-xs mt-0.5 truncate ${
                        activeTab === 'register' ? 'text-teal-100' : 'text-slate-500'
                      }`}
                    >
                      Bagong Pasyente & I-link ang RFID Card
                    </div>
                  </div>
                )}
              </button>

              {/* Tab 3: Roster */}
              <button
                type="button"
                onClick={() => setActiveTab('roster')}
                title={`Talaan ng Pila Ngayon (${todayQueue.length}) • Live Queue Monitoring`}
                className={`relative w-full text-left rounded-lg transition-all flex items-center cursor-pointer border p-2.5 ${
                  isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                } ${
                  activeTab === 'roster'
                    ? 'bg-teal-800 text-white border-teal-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div
                  className={`relative w-9 h-9 rounded-lg flex items-center justify-center shrink-0 font-bold ${
                    activeTab === 'roster' ? 'bg-teal-900 text-white' : 'bg-teal-50 text-teal-800'
                  }`}
                >
                  <Clock className="w-5 h-5" />
                  {isSidebarCollapsed && (
                    <span
                      className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-mono font-bold flex items-center justify-center ${
                        activeTab === 'roster'
                          ? 'bg-teal-200 text-teal-950'
                          : 'bg-teal-700 text-white'
                      }`}
                    >
                      {todayQueue.length}
                    </span>
                  )}
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="text-sm font-bold leading-tight truncate">
                        Talaan ng Pila Ngayon
                      </span>
                      <span
                        className={`text-xs font-mono px-2 py-0.5 rounded-full font-bold shrink-0 ${
                          activeTab === 'roster'
                            ? 'bg-teal-900 text-teal-100'
                            : 'bg-slate-200 text-slate-800'
                        }`}
                      >
                        {todayQueue.length}
                      </span>
                    </div>
                    <div
                      className={`text-xs mt-0.5 truncate ${
                        activeTab === 'roster' ? 'text-teal-100' : 'text-slate-500'
                      }`}
                    >
                      Live Queue Monitoring
                    </div>
                  </div>
                )}
              </button>

              {/* Medical Records Link */}
              <Link
                href="/medical-records"
                title="Medical Records • Live EHR Database (Lahat ng Pasyente)"
                className={`w-full text-left rounded-lg transition-all flex items-center cursor-pointer border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 p-2.5 ${
                  isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                }`}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-teal-50 text-teal-800">
                  <FileText className="w-5 h-5" />
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold leading-tight truncate">Medical Records</div>
                    <div className="text-xs mt-0.5 truncate text-slate-500">
                      Live EHR Database • Lahat ng Pasyente
                    </div>
                  </div>
                )}
              </Link>

              {/* Master Patient Registry Link */}
              <Link
                href="/patient-registry"
                title="Patient Registry • Listahan ng Lahat ng Pasyente & RFID Cards"
                className={`w-full text-left rounded-lg transition-all flex items-center cursor-pointer border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 p-2.5 ${
                  isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                }`}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-teal-50 text-teal-800">
                  <UserPlus className="w-5 h-5" />
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold leading-tight truncate">Patient Registry</div>
                    <div className="text-xs mt-0.5 truncate text-slate-500">
                      Lahat ng Pasyente &amp; RFID Cards
                    </div>
                  </div>
                )}
              </Link>

              {/* Messages Link */}
              <Link
                href="/messages"
                title="Messages • Patient Handoffs & Staff Announcements"
                className={`w-full text-left rounded-lg transition-all flex items-center cursor-pointer border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 p-2.5 ${
                  isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                }`}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-teal-50 text-teal-800">
                  <MessageSquareText className="w-5 h-5" />
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold leading-tight truncate">Messages</div>
                    <div className="text-xs mt-0.5 truncate text-slate-500">
                      Patient Handoffs &amp; Chat
                    </div>
                  </div>
                )}
              </Link>

              {/* Live Queue Monitor (TV) */}
              <Link
                href="/queue-tv"
                target="_blank"
                title="Live Queue Monitor • Buksan ang TV Display"
                className={`w-full text-left rounded-lg transition-all flex items-center cursor-pointer border bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300 p-2.5 ${
                  isSidebarCollapsed ? 'justify-center' : 'space-x-3'
                }`}
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 text-slate-700">
                  <Tv className="w-5 h-5" />
                </div>
                {!isSidebarCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold leading-tight truncate">Queue TV Display</div>
                    <div className="text-xs mt-0.5 truncate text-slate-500">
                      Buksan sa TV / Bagong Tab
                    </div>
                  </div>
                )}
              </Link>
            </nav>
          </div>

          {/* Workstation Status */}
          {isSidebarCollapsed ? (
            <div
              className="bg-white border border-slate-300 rounded-lg p-2.5 shadow-sm flex flex-col items-center justify-center space-y-1.5"
              title="OPD Desk Online • Station 2: OPD Records (Ground Flr)"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span className="text-[10px] font-bold text-emerald-800">OPD</span>
            </div>
          ) : (
            <div className="bg-white border border-slate-300 rounded-lg p-4 space-y-3 shadow-sm text-sm">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 pb-2 flex items-center justify-between">
                <span>Workstation Status</span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              </div>

              <div className="space-y-2 text-slate-700">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-sm">Workstation:</span>
                  <span className="font-semibold text-slate-800 text-sm">Station 2: OPD Records</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 text-sm">Staff Account:</span>
                  <span className="font-semibold text-slate-800 text-sm">
                    {session?.user?.name || session?.user?.email?.split('@')[0] || 'OPD Staff'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* ── MAIN WORKSPACE CONTENT ───────────────────────────────────── */}
        <main className="flex-1 min-w-0 w-full space-y-4">
        <DoctorQueueAlertMonitor onStatesUpdated={handleDoctorQueueStatesUpdated} />
        
        {/* ── TAB 1: STREAMLINED COMPACT CHECK-IN CONSOLE (MINIMAL SCROLL) ── */}
        {activeTab === 'checkin' && (
          <div className="space-y-3.5">
            {/* 1. INCOMING TRIAGE QUEUE STRIP (COMPACT HORIZONTAL BAR) */}
            <div className="bg-white border border-slate-300 rounded-lg p-3 shadow-2xs">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-600 animate-pulse" />
                  <span className="text-xs sm:text-sm font-bold text-slate-900">
                    Pasyente Mula sa Triage ({incomingTriage.length} Naghihintay sa OPD Counter)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={loadIncomingTriage}
                  disabled={isLoadingTriage}
                  className="text-xs font-semibold text-teal-800 hover:text-teal-950 px-2 py-0.5 rounded border border-teal-200 hover:bg-teal-50 transition cursor-pointer flex items-center gap-1"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoadingTriage ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              {incomingTriage.length === 0 ? (
                <div className="pt-3 text-center text-xs text-slate-500">
                  Walang nakapilang pasyente mula sa Triage sa kasalukuyan. Direktang i-tap ang RFID card sa scanner sa ibaba.
                </div>
              ) : (
                <div className="pt-3 space-y-2.5">
                  <div className="flex flex-col xl:flex-row gap-2 xl:items-center xl:justify-between">
                    <label className="relative block flex-1 max-w-xl">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                      <input
                        type="search"
                        value={triageSearch}
                        onChange={(event) => {
                          setTriageSearch(event.target.value);
                          setTriagePage(1);
                        }}
                        placeholder="Hanapin ang pangalan, Triage #, RFID, o department..."
                        className="w-full h-9 pl-8 pr-3 rounded border border-slate-300 bg-white text-xs text-slate-900 focus:outline-hidden focus:border-teal-700"
                      />
                    </label>
                    <div className="grid grid-cols-3 gap-1 rounded bg-slate-100 p-1 border border-slate-200">
                      {([
                        ['ALL', `Lahat (${incomingTriage.length})`],
                        ['NEEDS_RFID', 'Kailangang I-register'],
                        ['READY', 'Handa sa Check-in'],
                      ] as const).map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => {
                            setTriageCardFilter(value);
                            setTriagePage(1);
                          }}
                          className={`min-h-8 px-2 rounded text-[11px] font-bold transition ${
                            triageCardFilter === value
                              ? 'bg-white text-teal-900 border border-slate-300 shadow-2xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {visibleIncomingTriage.length === 0 ? (
                    <div className="rounded border border-dashed border-slate-300 bg-slate-50 py-5 text-center text-xs text-slate-500">
                      Walang tumutugma sa search o filter.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                      {visibleIncomingTriage.map((trg) => {
                        const isSelected = selectedTriage?.id === trg.id;
                        const hasNoCard = !trg.cardUid || trg.cardUid === 'NO_CARD';
                        const prioColor =
                          trg.priorityLevel === 'URGENT' || trg.priorityLevel === 'RESUSCITATION'
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : trg.priorityLevel === 'PRIORITY'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300';

                        return (
                          <div
                            key={trg.id}
                            className={`min-w-0 p-2.5 rounded-md border text-xs grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-2 sm:items-center transition ${
                              isSelected
                                ? 'bg-teal-50 border-teal-700 ring-1 ring-teal-700'
                                : 'bg-slate-50 border-slate-200 hover:bg-white'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 flex flex-wrap items-center gap-1.5">
                                <span className="truncate">{trg.patientName}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold ${prioColor}`}>
                                  {trg.priorityLevel || 'REGULAR'}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
                                <span className="font-mono">{trg.triageNumber}</span>
                                <span>&bull;</span>
                                {hasNoCard ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                                    Walang RFID (Bago)
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold border border-emerald-300">
                                    RFID: {trg.cardUid}
                                  </span>
                                )}
                              </div>
                            </div>

                            {hasNoCard ? (
                              <button
                                type="button"
                                onClick={() => handleTransferToRegistration(trg)}
                                className="w-full sm:w-auto min-h-8 px-3 rounded text-xs font-bold bg-amber-800 hover:bg-amber-900 text-white transition cursor-pointer shadow-2xs"
                              >
                                I-register & I-link
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSelectTriage(trg)}
                                className={`w-full sm:w-auto min-h-8 px-3 rounded text-xs font-bold transition cursor-pointer ${
                                  isSelected
                                    ? 'bg-teal-800 text-white'
                                    : 'bg-white border border-teal-700 text-teal-800 hover:bg-teal-800 hover:text-white'
                                }`}
                              >
                                {isSelected ? 'Napili' : 'I-process'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between border-t border-slate-200 pt-2">
                    <span className="text-[11px] text-slate-500">
                      {filteredIncomingTriage.length === 0
                        ? '0 pasyente'
                        : `${(triagePage - 1) * TRIAGE_PAGE_SIZE + 1}-${Math.min(triagePage * TRIAGE_PAGE_SIZE, filteredIncomingTriage.length)} sa ${filteredIncomingTriage.length}`}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTriagePage((page) => Math.max(1, page - 1))}
                        disabled={triagePage <= 1}
                        className="h-8 px-2.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" /> Nakaraan
                      </button>
                      <span className="min-w-16 text-center text-[11px] font-semibold text-slate-600">
                        Page {triagePage} / {triagePageCount}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTriagePage((page) => Math.min(triagePageCount, page + 1))}
                        disabled={triagePage >= triagePageCount}
                        className="h-8 px-2.5 rounded border border-slate-300 text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 flex items-center gap-1"
                      >
                        Susunod <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 2. DENSE 2-COLUMN OPERATIONAL CONSOLE */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 items-start">
              
              {/* ── LEFT COLUMN (5 COLS): SCANNER + VERIFIED PATIENT ── */}
              <div className="lg:col-span-5 space-y-3">
                {/* RFID Scanner & Quick Test Chips */}
                <div className="bg-white border border-slate-300 rounded-lg p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center">
                        1
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        USB RFID Card Reader
                      </span>
                    </div>
                    <span className="inline-flex items-center space-x-1 text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-300">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                      <span>Ready</span>
                    </span>
                  </div>

                  {/* Input Row */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      performLookup(scannedUid);
                    }}
                    className="flex items-center space-x-2"
                  >
                    <input
                      id="card-uid-input"
                      type="text"
                      value={scannedUid}
                      onChange={(e) => {
                        const val = e.target.value.toUpperCase();
                        setScannedUid(val);
                        if (val.length === 8) {
                          performLookup(val);
                        }
                      }}
                      placeholder="I-scan ang RFID (Hal. A1B2C3D4)"
                      className="flex-1 h-9 px-3 bg-white border border-slate-300 rounded text-sm font-mono font-bold text-slate-900 uppercase focus:outline-hidden focus:border-teal-700"
                    />
                    <button
                      type="submit"
                      disabled={isScanning}
                      className="h-9 px-3.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold rounded transition cursor-pointer flex items-center space-x-1.5 shrink-0"
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>{isScanning ? '...' : 'I-tap'}</span>
                    </button>
                  </form>

                  {/* Quick Test Demo Cards Row */}
                  <div className="pt-1 flex items-center gap-1.5 overflow-x-auto text-[11px]">
                    <span className="text-slate-400 font-medium shrink-0">Test Cards:</span>
                    {patients.filter((p) => p.cardUid && p.cardUid !== 'NO_CARD').length === 0 ? (
                      <span className="text-slate-400 italic">Wala pang naka-link na RFID card</span>
                    ) : (
                      patients
                        .filter((p) => p.cardUid && p.cardUid !== 'NO_CARD')
                        .slice(0, 4)
                        .map((p) => (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSimulateScan(p.cardUid)}
                            className={`px-2 py-0.5 rounded border text-[11px] font-medium transition cursor-pointer shrink-0 ${
                              matchedPatient?.cardUid === p.cardUid
                                ? 'bg-teal-800 text-white border-teal-900'
                                : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-300'
                            }`}
                            title={`I-tap si ${p.name}`}
                          >
                            {p.name.split(' ')[0]} ({p.cardUid})
                          </button>
                        ))
                    )}
                  </div>

                  {/* Cardless / New Patient Helper */}
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                    <span className="text-slate-500 text-[11px]">Walang hawak na RFID card ang pasyente?</span>
                    <button
                      type="button"
                      onClick={() => {
                        setRegistrationSourceTriage(null);
                        setActiveTab('register');
                      }}
                      className="font-bold text-teal-800 hover:text-teal-950 underline cursor-pointer text-xs"
                    >
                      Magpalista Muna (Registration) &rarr;
                    </button>
                  </div>

                  {errorMessage && (
                    <div className="p-2.5 bg-red-50 border border-red-200 rounded text-xs text-red-800 space-y-1.5">
                      <div className="flex items-center space-x-1.5">
                        <AlertCircle className="w-4 h-4 text-red-700 shrink-0" />
                        <span>{errorMessage}</span>
                      </div>
                      {scannedUid && (
                        <button
                          type="button"
                          onClick={() => {
                            setRegistrationSourceTriage(null);
                            setNewCardUid(scannedUid);
                            setActiveTab('register');
                          }}
                          className="px-2 py-1 bg-red-800 hover:bg-red-900 text-white rounded font-bold text-[11px] transition cursor-pointer"
                        >
                          I-rehistro ang Card UID na Ito ({scannedUid}) sa Bagong Pasyente &rarr;
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Verified Patient Card Details */}
                <div className="bg-white border border-slate-300 rounded-lg p-3.5 space-y-2.5 shadow-2xs">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 rounded bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center">
                        2
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        Rekord ng Pasyente
                      </span>
                    </div>

                    {matchedPatient ? (
                      <span className="inline-flex items-center space-x-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Verified</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400">Naghihintay ng Scan</span>
                    )}
                  </div>

                  {matchedPatient ? (
                    <div className="space-y-2.5 text-xs">
                      {/* Name & ID */}
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                            {matchedPatient.name}
                          </h3>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5 space-x-2">
                            <span>ID: <strong>{matchedPatient.patientNo}</strong></span>
                            <span>&bull;</span>
                            {matchedPatient.cardUid && matchedPatient.cardUid !== 'NO_CARD' ? (
                              <span>UID: <strong>{matchedPatient.cardUid}</strong></span>
                            ) : (
                              <span className="text-amber-800 font-bold bg-amber-100 px-1.5 py-0.2 rounded border border-amber-300">
                                Walang RFID Card (Bago)
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-300 rounded font-mono font-bold text-slate-800 text-[11px]">
                          Dugo: {matchedPatient.bloodType}
                        </span>
                      </div>

                      {/* Cardless Warning Banner if matched patient has NO_CARD */}
                      {(!matchedPatient.cardUid || matchedPatient.cardUid === 'NO_CARD') && (
                        <div className="p-3 bg-amber-50 border border-amber-300 rounded-md text-xs space-y-1.5">
                          <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
                            <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>Bawal Pang Pumila — Walang RFID Card!</span>
                          </div>
                          <p className="text-[11px] text-amber-800 leading-snug">
                            Bagong pasyente ito at wala pang nakataling Arduino RFID card. Magpalista muna at mag-isyu ng card bago mabigyan ng ticket sa doktor.
                          </p>
                          <button
                            type="button"
                            onClick={() => handleTransferToRegistration(matchedPatient)}
                            className="w-full py-1.5 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-2xs"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Magpalista Muna (I-link ang Card) &rarr;</span>
                          </button>
                        </div>
                      )}

              {/* Demographics Strip */}
              <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-50 rounded border border-slate-200 text-[11px]">
                <div>Kasarian: <strong>{matchedPatient.gender}</strong></div>
                <div>Kaarawan: <strong>{matchedPatient.dateOfBirth}</strong></div>
                <div>Contact: <strong>{matchedPatient.phone || 'N/A'}</strong></div>
              </div>

                      {/* Vitals Summary Pill Strip */}
                      {matchedPatient.vitals && (
                        <div className="grid grid-cols-4 gap-1 text-[11px] text-center font-mono">
                          <div className="bg-slate-100 p-1.5 rounded border border-slate-200">
                            <span className="block text-[9px] uppercase text-slate-500 font-sans">BP</span>
                            <strong className="text-slate-900">{matchedPatient.vitals.bloodPressure || '120/80'}</strong>
                          </div>
                          <div className="bg-slate-100 p-1.5 rounded border border-slate-200">
                            <span className="block text-[9px] uppercase text-slate-500 font-sans">Pulso</span>
                            <strong className="text-slate-900">{matchedPatient.vitals.heartRate || 75} bpm</strong>
                          </div>
                          <div className="bg-slate-100 p-1.5 rounded border border-slate-200">
                            <span className="block text-[9px] uppercase text-slate-500 font-sans">Temp</span>
                            <strong className="text-slate-900">{matchedPatient.vitals.temperature || 36.6}&deg;C</strong>
                          </div>
                          <div className="bg-slate-100 p-1.5 rounded border border-slate-200">
                            <span className="block text-[9px] uppercase text-slate-500 font-sans">SpO2</span>
                            <strong className="text-slate-900">{matchedPatient.vitals.oxygenSaturation || 98}%</strong>
                          </div>
                        </div>
                      )}

                      {/* Triage Link badge if selected */}
                      {selectedTriage && (
                        <div className="p-2 bg-teal-50 border border-teal-200 rounded text-[11px] flex items-center justify-between text-teal-900">
                          <span>Triage Slip: <strong>{selectedTriage.triageNumber}</strong> ({selectedTriage.department?.replace('_', ' ')})</span>
                          <span className="text-[10px] font-mono bg-teal-100 px-1.5 py-0.5 rounded border border-teal-300">
                            {selectedTriage.priorityLevel}
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setIsMedicalRecordsOpen(true)}
                          className="w-full min-h-8 px-3 bg-teal-800 hover:bg-teal-900 text-white font-semibold text-xs rounded transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Tingnan Medical Records</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsOpdPrintModalOpen(true)}
                          className="w-full min-h-8 px-3 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded transition flex items-center justify-center space-x-1.5 cursor-pointer shadow-2xs"
                        >
                          <Printer className="w-3.5 h-3.5 text-teal-400" />
                          <span>I-print ang OPD Form</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="py-6 text-center text-xs text-slate-400 space-y-1">
                      <p className="font-medium text-slate-600">Walang pasyenteng napili.</p>
                      <p>I-scan ang RFID card o pumili mula sa Triage list sa itaas.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* ── RIGHT COLUMN (7 COLS): ROUTING, PRIORITY, REASON & DISPATCH ── */}
              <div className="lg:col-span-7 space-y-3">
                <div className="bg-white border border-slate-300 rounded-lg p-3.5 space-y-3 shadow-2xs">
                  
                  {/* Step 3: Department & Doctor Selection */}
                  <div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center">
                          3
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                          Piliin ang Kagawaran at Attending Doctor
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {departments.length} Doctor Available
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {departments.map((dept, idx) => {
                        const isSelected = selectedDeptIndex === idx;
                        return (
                          <label
                            key={dept.id || dept.name}
                            onClick={() => setSelectedDeptIndex(idx)}
                            className={`flex items-center justify-between p-2.5 rounded-md border text-xs cursor-pointer transition ${
                              isSelected
                                ? 'bg-teal-50 border-teal-700 text-slate-900 font-bold ring-1 ring-teal-700'
                                : 'bg-slate-50 border-slate-200 hover:bg-white text-slate-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <input
                                type="radio"
                                name="hospital-dept"
                                checked={isSelected}
                                onChange={() => setSelectedDeptIndex(idx)}
                                className="w-3.5 h-3.5 text-teal-800 border-slate-300"
                              />
                              <div>
                                <div className="font-bold text-slate-900 flex items-center gap-1.5 flex-wrap">
                                  <span>{dept.name}</span>
                                  {dept.queueStatus === 'PAUSED' && (
                                    <span
                                      title={dept.queueReason || 'Naka-pause ang pila'}
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-mono font-bold"
                                    >
                                      PAUSED
                                    </span>
                                  )}
                                  {dept.queueStatus === 'CLOSED' && (
                                    <span
                                      title={dept.queueReason || 'Sarado ang pila'}
                                      className="text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 border border-rose-300 font-mono font-bold"
                                    >
                                      CLOSED
                                    </span>
                                  )}
                                </div>
                                <div className="text-[11px] text-slate-500 font-normal">{dept.doctor}</div>
                              </div>
                            </div>
                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-300 text-slate-700 font-semibold shrink-0">
                              {dept.room}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  {/* Step 4: Queue Priority */}
                  <div>
                    <div className="flex items-center space-x-2 pb-1.5 border-b border-slate-200 mb-2">
                      <span className="w-5 h-5 rounded bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center">
                        4
                      </span>
                      <span className="text-xs sm:text-sm font-bold text-slate-900">
                        Uri ng Pila / Priority Lane
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedPriority('Regular')}
                        className={`py-2 px-2 rounded-md border text-xs font-bold transition cursor-pointer text-center ${
                          selectedPriority === 'Regular'
                            ? 'bg-slate-800 text-white border-slate-900'
                            : 'bg-white border-slate-300 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        Regular Lane
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPriority('Senior/PWD')}
                        className={`py-2 px-2 rounded-md border text-xs font-bold transition cursor-pointer text-center ${
                          selectedPriority === 'Senior/PWD'
                            ? 'bg-blue-700 text-white border-blue-800'
                            : 'bg-white border-slate-300 hover:bg-blue-50 text-slate-700'
                        }`}
                      >
                        Senior / PWD (Lane A)
                      </button>

                      <button
                        type="button"
                        onClick={() => setSelectedPriority('Urgent')}
                        className={`py-2 px-2 rounded-md border text-xs font-bold transition cursor-pointer text-center ${
                          selectedPriority === 'Urgent'
                            ? 'bg-rose-700 text-white border-rose-800'
                            : 'bg-white border-slate-300 hover:bg-rose-50 text-slate-700'
                        }`}
                      >
                        Urgent (Fast-Track)
                      </button>
                    </div>
                  </div>

                  {/* Step 5: Chief Complaint / Reason */}
                  <div>
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-200 mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded bg-slate-900 text-white font-mono text-xs font-bold flex items-center justify-center">
                          5
                        </span>
                        <span className="text-xs sm:text-sm font-bold text-slate-900">
                          Dahilan ng Pagbisita / Reklamo
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">Makikita agad ng doktor</span>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        {TRIAGE_PRESETS.slice(0, 5).map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setTriageReason(preset)}
                            className={`text-[11px] px-2 py-0.5 rounded border transition cursor-pointer ${
                              triageReason === preset
                                ? 'bg-teal-800 text-white border-teal-800 font-semibold'
                                : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>

                      <input
                        type="text"
                        value={triageReason}
                        onChange={(e) => setTriageReason(e.target.value)}
                        placeholder="I-type ang reklamo o pakay ng pasyente..."
                        className="w-full h-8 px-2.5 bg-white border border-slate-300 rounded text-xs text-slate-900 focus:outline-hidden focus:border-teal-700"
                      />
                    </div>
                  </div>

                  {/* Routing Overview & Big Submit Button */}
                  <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="text-xs text-slate-600 leading-tight">
                      {matchedPatient ? (
                        <div>
                          Itatalaga si <strong className="text-slate-900">{matchedPatient.name}</strong> kay{' '}
                          <strong className="text-teal-900">
                            {departments[selectedDeptIndex]?.doctor || 'Doktor'} ({departments[selectedDeptIndex]?.room || 'Klinika'})
                          </strong>
                        </div>
                      ) : (
                        <div className="text-slate-400">Pumili ng pasyente upang mai-isyu ang ticket sa pila.</div>
                      )}
                    </div>

                    {matchedPatient && (!matchedPatient.cardUid || matchedPatient.cardUid === 'NO_CARD') ? (
                      <div className="w-full sm:w-auto flex flex-col sm:flex-row items-center gap-2">
                        <span className="text-[11px] text-amber-800 font-bold bg-amber-50 border border-amber-300 px-2 py-1 rounded">
                          Walang Card: Magpalista Muna
                        </span>
                        <button
                          type="button"
                          onClick={() => handleTransferToRegistration(matchedPatient)}
                          className="w-full sm:w-auto h-11 px-5 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs sm:text-sm rounded-md transition flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>Magpalista & I-link ang RFID Card &rarr;</span>
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleIssueTicket}
                        disabled={!matchedPatient || isSubmittingTicket}
                        className="w-full sm:w-auto h-11 px-6 bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white font-bold text-xs sm:text-sm rounded-md transition flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm"
                      >
                        {isSubmittingTicket ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Ipinapadala sa Doktor...</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4" />
                            <span>Ipadala sa Doktor & I-print ang Ticket</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                </div>
              </div>

            </div>
          </div>
        )}

        {/* ── TAB 2: NEW PATIENT REGISTRATION & CARD PAIRING (FULL SCREEN) ── */}
        {activeTab === 'register' && (
          <div className="w-full bg-white border border-slate-300 rounded-lg p-5 sm:p-6 space-y-5 shadow-2xs">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-slate-900">
                  2. Magpalista ng Bagong Pasyente & I-link ang RFID Card
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Ipasok ang impormasyon ng bagong pasyente at i-tap ang isang blangkong RFID card upang mai-link ang permanenteng Chip UID.
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-1 rounded bg-teal-50 border border-teal-200 text-teal-800 text-xs font-semibold self-start sm:self-auto font-mono">
                Full-Width Registration Console
              </span>
            </div>

            {linkingPatient && (
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-md text-xs sm:text-sm text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-start space-x-2.5">
                  <CreditCard className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold">
                      RFID Card Linking Mode: {linkingPatient.name} ({linkingPatient.patientNo || linkingPatient.id})
                    </p>
                    <p className="text-[11px] text-amber-800">
                      Naka-rehistro na ang pasyenteng ito pero wala pang RFID card. I-tap o i-simulate ang blangkong RFID card sa kanan at i-submit para ma-link sa existing record niya.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setLinkingPatient(null)}
                  className="px-2.5 py-1 bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold rounded text-xs shrink-0 cursor-pointer self-start sm:self-auto"
                >
                  Cancel Link
                </button>
              </div>
            )}

            {regSuccessMessage && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-md text-xs sm:text-sm text-emerald-900 font-medium flex items-center space-x-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
                <span>{regSuccessMessage}</span>
              </div>
            )}

            <form onSubmit={handleRegisterPatient} className="space-y-5 text-xs">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                {/* ── LEFT COLUMN (7 COLS): DEMOGRAPHICS ── */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-lg space-y-3.5">
                    <div className="border-b border-slate-200 pb-2">
                      <h3 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wider">
                        Pangunahing Impormasyon ng Pasyente
                      </h3>
                      <p className="text-[11px] text-slate-500">Demographic data para sa hospital master index</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 block">Pangalan (First Name) *</label>
                        <input
                          type="text"
                          required
                          value={newFirstName}
                          onChange={(e) => setNewFirstName(e.target.value)}
                          placeholder="Hal. Juan"
                          className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-hidden focus:border-teal-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 block">Apelyido (Last Name) *</label>
                        <input
                          type="text"
                          required
                          value={newLastName}
                          onChange={(e) => setNewLastName(e.target.value)}
                          placeholder="Hal. Dela Cruz"
                          className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-hidden focus:border-teal-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 block">Kaarawan (Date of Birth) *</label>
                        <input
                          type="date"
                          required
                          value={newDob}
                          onChange={(e) => setNewDob(e.target.value)}
                          className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-hidden focus:border-teal-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 block">Kasarian (Gender) *</label>
                        <select
                          value={newGender}
                          onChange={(e) => setNewGender(e.target.value as any)}
                          className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-hidden focus:border-teal-700"
                        >
                          <option value="Male">Lalaki (Male)</option>
                          <option value="Female">Babae (Female)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 block">Uri ng Dugo (Blood Type)</label>
                        <select
                          value={newBloodType}
                          onChange={(e) => setNewBloodType(e.target.value)}
                          className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-hidden focus:border-teal-700"
                        >
                          <option value="N/A">N/A (Hindi Alam / Unspecified)</option>
                          <option value="O+">O Positive (O+)</option>
                          <option value="O-">O Negative (O-)</option>
                          <option value="A+">A Positive (A+)</option>
                          <option value="A-">A Negative (A-)</option>
                          <option value="B+">B Positive (B+)</option>
                          <option value="B-">B Negative (B-)</option>
                          <option value="AB+">AB Positive (AB+)</option>
                          <option value="AB-">AB Negative (AB-)</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 block">Contact Number</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          maxLength={11}
                          value={newPhone}
                          onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
                          placeholder="09171234567"
                          className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-sm font-mono text-slate-900 focus:outline-hidden focus:border-teal-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-semibold text-slate-700 block">Tirahan (Address)</label>
                        <input
                          type="text"
                          value={newAddress}
                          onChange={(e) => setNewAddress(e.target.value)}
                          placeholder="Bayan, Lalawigan ng Laguna"
                          className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-sm text-slate-900 focus:outline-hidden focus:border-teal-700"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── RIGHT COLUMN (5 COLS): RFID CARD LINKING & SUBMIT ── */}
                <div className="lg:col-span-5 space-y-4">
                  {/* Blank RFID Card Pairing */}
                  <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-lg space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="font-bold text-teal-900 text-xs sm:text-sm block">
                        I-link ang Physical Blank RFID Card:
                      </label>
                      <span className="text-[11px] font-mono text-teal-800 font-semibold bg-teal-100 px-2 py-0.5 rounded border border-teal-300">
                        NFC / RFID Tag
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600">
                      I-click ang simulate tap para awtomatikong gumawa ng unique Card UID:
                    </p>

                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        required
                        readOnly
                        tabIndex={-1}
                        value={newCardUid}
                        placeholder="I-click ang Simulate Tap →"
                        aria-label="Generated RFID Card UID"
                        className="flex-1 h-10 px-3 bg-slate-100 border border-teal-300 rounded font-mono font-bold uppercase text-sm text-slate-700 cursor-not-allowed select-none focus:outline-hidden"
                      />
                      <button
                        type="button"
                        onClick={handleGenerateBlankUid}
                        className="h-10 px-3.5 bg-white border border-teal-300 hover:bg-teal-50 text-teal-800 font-bold rounded text-xs transition cursor-pointer shrink-0 shadow-2xs"
                      >
                        Simulate Blank Card Tap
                      </button>
                    </div>
                  </div>

                  {/* Submission Action Card */}
                  <div className="p-4 bg-slate-50/70 border border-slate-200 rounded-lg space-y-3">
                    <div className="text-xs text-slate-600 leading-relaxed">
                      Pagkatapos maitala, agad nang makakapag-tap ng RFID card ang pasyente sa Check-in Counter. Ang Vital Signs ay awtomatikong kinukuha mula sa Triage Station.
                    </div>

                    <button
                      type="submit"
                      className="w-full h-11 px-6 bg-teal-800 hover:bg-teal-900 active:bg-teal-950 text-white font-bold text-xs sm:text-sm rounded-md transition cursor-pointer shadow-sm"
                    >
                      {linkingPatient
                        ? 'I-link ang RFID Card sa Existing Patient'
                        : 'I-rehistro ang Pasyente & I-link ang RFID Card'}
                    </button>
                  </div>
                </div>

              </div>
            </form>
          </div>
        )}

        {/* ── TAB 3: TODAY'S LIVE QUEUE ROSTER ────────────────────────── */}
        {activeTab === 'roster' && (
          <div className="bg-white border border-slate-300 rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  3. Talaan ng Pila Ngayon ({todayQueue.length})
                </h2>
                <p className="text-xs text-slate-500">
                  Lahat ng pasyenteng naisyuhan ng ticket sa Reception Desk ngayong araw.
                </p>
              </div>

              <span className="text-[11px] font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-700">
                ACTIVE QUEUE
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">Ticket #</th>
                    <th className="py-2.5 px-3">Pangalan ng Pasyente</th>
                    <th className="py-2.5 px-3">Card UID</th>
                    <th className="py-2.5 px-3">Kagawaran</th>
                    <th className="py-2.5 px-3">Doktor & Silid</th>
                    <th className="py-2.5 px-3">Priority</th>
                    <th className="py-2.5 px-3">Oras</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {todayQueue.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-teal-900">{t.ticketNumber}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{t.patientName}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">{t.cardUid}</td>
                      <td className="py-2.5 px-3">{t.department}</td>
                      <td className="py-2.5 px-3 text-slate-600">{t.doctor} • <strong>{t.room}</strong></td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                          t.priority === 'Urgent'
                            ? 'bg-red-50 text-red-800 border border-red-200'
                            : t.priority === 'Senior/PWD'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {t.priority}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">{t.timeIssued}</td>
                      <td className="py-2.5 px-3">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                          t.status === 'NOW SERVING'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                            : 'bg-amber-50 text-amber-900 border border-amber-300'
                        }`}>
                          {t.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── TAB 4: OPD STATION ANALYTICS (SAME PAGE CONSOLE) ─────────── */}
        {activeTab === 'analytics' && (
          <div className="w-full bg-white border border-slate-300 rounded-lg p-5 sm:p-6 space-y-6 shadow-2xs">
            <div className="border-b border-slate-200 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900">
                    Station 2: OPD Records & Counter Analytics
                  </h2>
                  <span className="px-2 py-0.5 bg-teal-100 text-teal-800 font-bold text-xs rounded border border-teal-200 font-mono">
                    LIVE TELEMETRY
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Real-time Outpatient Queue Turnaround, Active RFID Cards & Registry Metrics
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-slate-500 font-mono hidden sm:inline">
                  Refreshed: {analyticsLastRefreshed || 'Just now'}
                </span>
                <button
                  type="button"
                  onClick={loadOpdAnalytics}
                  disabled={isLoadingOpdAnalytics}
                  className="h-8 px-3 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOpdAnalytics ? 'animate-spin' : ''}`} />
                  <span>I-refresh</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('checkin')}
                  className="h-8 px-3 rounded bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold flex items-center space-x-1 transition cursor-pointer"
                >
                  <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                  <span>Bumalik sa Check-in</span>
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-md border border-slate-200 bg-slate-50">
                <span className="text-xs font-bold uppercase text-slate-500 block">Queue Tickets Today</span>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                  {opdAnalytics?.totalTicketsToday ?? todayQueue.length}
                </div>
                <p className="text-xs text-slate-500 mt-1">Kabuuang all-time: {opdAnalytics?.totalTicketsAllTime || 0}</p>
              </div>

              <div className="p-4 rounded-md border border-amber-200 bg-amber-50">
                <span className="text-xs font-bold uppercase text-amber-800 block">Waiting sa Lobby</span>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-amber-800 font-mono">
                  {opdAnalytics?.statusBreakdown?.WAITING || 0}
                </div>
                <p className="text-xs text-amber-700 mt-1">Called: {opdAnalytics?.statusBreakdown?.CALLED || 0}</p>
              </div>

              <div className="p-4 rounded-md border border-sky-200 bg-sky-50">
                <span className="text-xs font-bold uppercase text-sky-800 block">Average Wait Time</span>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-sky-800 font-mono">
                  {opdAnalytics?.averageWaitMinutes || 0} <span className="text-xs font-sans font-medium">minuto</span>
                </div>
                <p className="text-xs text-sky-700 mt-1">Mula scan hanggang tawagin</p>
              </div>

              <div className="p-4 rounded-md border border-teal-200 bg-teal-50">
                <span className="text-xs font-bold uppercase text-teal-800 block">Active RFID Cards</span>
                <div className="mt-2 text-2xl sm:text-3xl font-extrabold text-teal-800 font-mono">
                  {opdAnalytics?.activeRfidCardsCount || 0}
                </div>
                <p className="text-xs text-teal-700 mt-1">Total Patients: {opdAnalytics?.totalPatientsCount || patients.length}</p>
              </div>
            </div>

            {/* Queue Funnel Distribution */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
              <h3 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wider">
                Outpatient Queue Funnel & Turnaround Status
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 bg-white border border-amber-300 rounded text-center">
                  <span className="text-[11px] font-bold text-amber-800 block">1. Waiting</span>
                  <span className="text-xl font-extrabold font-mono text-amber-900">{opdAnalytics?.statusBreakdown?.WAITING || 0}</span>
                </div>
                <div className="p-3 bg-white border border-sky-300 rounded text-center">
                  <span className="text-[11px] font-bold text-sky-800 block">2. Called</span>
                  <span className="text-xl font-extrabold font-mono text-sky-900">{opdAnalytics?.statusBreakdown?.CALLED || 0}</span>
                </div>
                <div className="p-3 bg-white border border-indigo-300 rounded text-center">
                  <span className="text-[11px] font-bold text-indigo-800 block">3. In Consultation</span>
                  <span className="text-xl font-extrabold font-mono text-indigo-900">{opdAnalytics?.statusBreakdown?.IN_CONSULTATION || 0}</span>
                </div>
                <div className="p-3 bg-white border border-emerald-300 rounded text-center">
                  <span className="text-[11px] font-bold text-emerald-800 block">4. Completed</span>
                  <span className="text-xl font-extrabold font-mono text-emerald-900">{opdAnalytics?.statusBreakdown?.COMPLETED || 0}</span>
                </div>
                <div className="p-3 bg-white border border-slate-300 rounded text-center">
                  <span className="text-[11px] font-bold text-slate-700 block">5. Cancelled</span>
                  <span className="text-xl font-extrabold font-mono text-slate-800">{opdAnalytics?.statusBreakdown?.CANCELLED || 0}</span>
                </div>
              </div>
            </div>

            {/* Priority & Registration Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wider">
                  Priority Lane Breakdown
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-white border border-slate-200 rounded flex items-center justify-between">
                    <span className="font-medium text-slate-700">Regular Lane</span>
                    <strong className="font-mono text-slate-900">{opdAnalytics?.priorityBreakdown?.Regular || 0}</strong>
                  </div>
                  <div className="p-2.5 bg-white border border-amber-200 rounded flex items-center justify-between">
                    <span className="font-medium text-amber-900">Senior Citizen & PWD (Lane A)</span>
                    <strong className="font-mono text-amber-900">{opdAnalytics?.priorityBreakdown?.['Senior/PWD'] || 0}</strong>
                  </div>
                  <div className="p-2.5 bg-white border border-rose-200 rounded flex items-center justify-between">
                    <span className="font-medium text-rose-900">Urgent (Fast-Track)</span>
                    <strong className="font-mono text-rose-900">{opdAnalytics?.priorityBreakdown?.Urgent || 0}</strong>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                <h3 className="font-bold text-slate-900 text-xs sm:text-sm uppercase tracking-wider">
                  Patient Records & Card Circulation
                </h3>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 bg-white border border-slate-200 rounded flex items-center justify-between">
                    <span className="font-medium text-slate-700">New Registrations Today</span>
                    <strong className="font-mono text-teal-800">{opdAnalytics?.newPatientsRegisteredToday || 0}</strong>
                  </div>
                  <div className="p-2.5 bg-white border border-slate-200 rounded flex items-center justify-between">
                    <span className="font-medium text-slate-700">Total Registered Patients</span>
                    <strong className="font-mono text-slate-900">{opdAnalytics?.totalPatientsCount || patients.length}</strong>
                  </div>
                  <div className="p-2.5 bg-white border border-teal-200 rounded flex items-center justify-between">
                    <span className="font-medium text-teal-900">Active RFID Cards In Circulation</span>
                    <strong className="font-mono text-teal-800">{opdAnalytics?.activeRfidCardsCount || 0}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
      </div>

      {/* ── 4. REAL-TIME CLINICAL DISPATCH & ROUTING CONFIRMATION MODAL ── */}
      {isTicketModalOpen && lastIssuedTicket && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-lg rounded-lg border border-slate-300 shadow-xl overflow-hidden my-6">
            
            {/* Real-time Dispatch Banner */}
            <div className="bg-emerald-700 px-5 py-4 text-white">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-800 flex items-center justify-center shrink-0 border border-emerald-500">
                  <CheckCircle2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold tracking-tight">
                      NAIPADALA NA SA DOKTOR!
                    </h3>
                    <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded bg-emerald-800 border border-emerald-500 text-emerald-100">
                      Live Broadcast Sent
                    </span>
                  </div>
                  <p className="text-xs text-emerald-100 mt-0.5">
                    Naka-sync sa Clinical Workstation • Pumasok na sa Waiting Queue ng Doktor
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Doctor Destination Card */}
              <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-md space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-teal-900 border-b border-teal-200 pb-1.5">
                  <div className="flex items-center space-x-1.5">
                    <Stethoscope className="w-4 h-4 text-teal-800" />
                    <span>Tumatanggap na Doktor & Silid:</span>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-teal-100 text-teal-900 font-bold">
                    Silid: {lastIssuedTicket.room}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-base font-bold text-slate-900">
                      {lastIssuedTicket.doctor}
                    </h4>
                    <p className="text-xs text-slate-600 font-medium">
                      Kagawaran: <strong>{lastIssuedTicket.department}</strong>
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-amber-50 text-amber-900 border border-amber-300">
                      Nasa Pila ng Doktor (Waiting)
                    </span>
                  </div>
                </div>
              </div>

              {/* Patient & Triage Summary */}
              <div className="grid grid-cols-2 gap-2 text-xs border border-slate-200 rounded-md p-3 bg-slate-50">
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Pasyente</span>
                  <span className="font-bold text-slate-900 text-sm">{lastIssuedTicket.patientName}</span>
                  <span className="text-[10px] text-slate-500 font-mono block">UID: {lastIssuedTicket.cardUid}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Numero sa Pila</span>
                  <span className="font-mono font-black text-2xl text-teal-900">{lastIssuedTicket.ticketNumber}</span>
                  <span className="text-[10px] text-slate-600 block">Priority: <strong>{lastIssuedTicket.priority}</strong></span>
                </div>
                <div className="col-span-2 pt-2 border-t border-slate-200">
                  <span className="text-[10px] uppercase font-semibold text-slate-500 block">Dahilan ng Pagbisita / Gagawin (Triage Reason)</span>
                  <p className="font-semibold text-slate-900 text-xs mt-0.5 bg-white p-2 rounded border border-slate-200">
                    {lastIssuedTicket.reasonForVisit || triageReason || 'General Consultation / Routine Checkup'}
                  </p>
                </div>
              </div>

              {/* Thermal Slip Simulation */}
              <div className="bg-slate-50 border border-dashed border-slate-300 rounded p-3 text-slate-800 font-mono space-y-1 text-center">
                <div className="text-[9px] text-slate-500 uppercase tracking-widest">
                  Laguna Medical Center • Official Queue Slip
                </div>
                <div className="text-2xl font-black text-slate-900 tracking-wider">
                  {lastIssuedTicket.ticketNumber}
                </div>
                <div className="text-[10px] text-slate-600">
                  Oras: {lastIssuedTicket.timeIssued} &bull; {lastIssuedTicket.department}
                </div>
                <div className="pt-1.5 flex flex-col items-center">
                  <QrCode className="w-10 h-10 text-slate-800" />
                  <span className="text-[8px] text-slate-500 mt-0.5">
                    lmc.ph/patient?card={lastIssuedTicket.cardUid}
                  </span>
                </div>
              </div>

              {/* Modal Action Buttons */}
              <div className="space-y-2 pt-1">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="w-full h-11 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs sm:text-sm rounded-md transition-colors flex items-center justify-center space-x-2 cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>I-print ang Thermal Ticket Slip</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsTicketModalOpen(false);
                    setMatchedPatient(null);
                    setScannedUid('');
                    setTriageReason('');
                  }}
                  className="w-full h-10 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-semibold text-xs sm:text-sm rounded-md transition-colors cursor-pointer"
                >
                  Tapusin at I-scan ang Susunod na Pasyente (Next) →
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── 3.5. PRINTABLE OPD CONSULTATION RECORD FORM MODAL (DOH / LMC STANDARD) ── */}
      {isOpdPrintModalOpen && matchedPatient && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white border border-slate-300 rounded-lg max-w-4xl w-full my-6 shadow-2xl flex flex-col max-h-[92vh]">
            
            {/* Modal Control Bar (Excluded from Print) */}
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between rounded-t-lg shrink-0 print:hidden">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-teal-400" />
                <div>
                  <h3 className="text-sm font-bold tracking-tight">
                    OPD Consultation Record Form (DOH Form)
                  </h3>
                  <p className="text-[11px] text-slate-300">
                    Laguna Medical Center • Outpatient Department Clinical Chart
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-9 px-4 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  <Printer className="w-4 h-4" />
                  <span>I-print ang Form (A4 / Letter)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsOpdPrintModalOpen(false)}
                  className="h-9 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded flex items-center space-x-1 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>Isara</span>
                </button>
              </div>
            </div>

            {/* Printable Document Container */}
            <div className="flex-1 overflow-y-auto p-6 sm:p-8 bg-white text-slate-900 font-sans" id="opd-consultation-form-print">
              
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-3 text-center space-y-1">
                <div className="text-[10px] uppercase tracking-widest text-slate-600 font-semibold">
                  Republic of the Philippines &bull; Department of Health &bull; Province of Laguna
                </div>
                <div className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-900">
                  Laguna Medical Center
                </div>
                <div className="text-xs text-slate-600">
                  Provincial Capitol Compound, Santa Cruz, Laguna &bull; Tel: (049) 545-8888
                </div>
                <div className="pt-2">
                  <span className="inline-block px-4 py-1 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-sm">
                    Outpatient Department (OPD) Consultation Record Form
                  </span>
                </div>
              </div>

              {/* Routing & Metadata Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs border-b border-slate-300 py-2.5 font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Triage Slip No:</span>
                  <strong className="text-slate-900">{selectedTriage?.triageNumber || 'WALK-IN / DIRECT'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Petsa at Oras:</span>
                  <strong className="text-slate-900">{new Date().toLocaleDateString('fil-PH')} {new Date().toLocaleTimeString('fil-PH', { hour: '2-digit', minute: '2-digit' })}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Kagawaran / Clinic:</span>
                  <strong className="text-teal-900">{departments[selectedDeptIndex]?.name || selectedTriage?.department?.replace('_', ' ') || 'Outpatient Clinic'}</strong>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block uppercase">Silid / Room:</span>
                  <strong className="text-slate-900">{departments[selectedDeptIndex]?.room || 'Doctor Room'}</strong>
                </div>
              </div>

              {/* Section 1: Patient Demographics */}
              <div className="py-3 border-b border-slate-300 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-100 px-2 py-1 rounded-xs">
                  I. Impormasyon ng Pasyente (Patient Demographic Profile)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="sm:col-span-2">
                    <span className="text-[10px] text-slate-500 uppercase block">Buong Pangalan:</span>
                    <span className="text-sm font-bold text-slate-900 uppercase">{matchedPatient.name}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Patient ID / Hospital No:</span>
                    <span className="font-mono font-bold text-slate-900">{matchedPatient.patientNo}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">RFID Card UID:</span>
                    <span className="font-mono font-bold text-slate-800">{matchedPatient.cardUid}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Kaarawan (DOB):</span>
                    <span className="font-semibold text-slate-900">{matchedPatient.dateOfBirth}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Kasarian:</span>
                    <span className="font-semibold text-slate-900">{matchedPatient.gender}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Uri ng Dugo:</span>
                    <span className="font-semibold text-slate-900">{matchedPatient.bloodType || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Telepono / Contact:</span>
                    <span className="font-semibold text-slate-900">{matchedPatient.phone}</span>
                  </div>
                  <div className="sm:col-span-3">
                    <span className="text-[10px] text-slate-500 uppercase block">Tirahan (Address):</span>
                    <span className="font-semibold text-slate-900">{matchedPatient.address}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Emergency Contact:</span>
                    <span className="font-semibold text-slate-900">{matchedPatient.emergencyContact}</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Clinical Vitals Recorded at Triage */}
              <div className="py-3 border-b border-slate-300 space-y-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-100 px-2 py-1 rounded-xs flex items-center justify-between">
                  <span>II. Triage Intake Vital Signs & Clinical Screening</span>
                  <span className="text-[10px] font-mono font-normal">Suri ng Triage Nurse</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs text-center">
                  <div className="border border-slate-200 p-2 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block">Presyon (BP)</span>
                    <strong className="text-sm font-mono text-slate-900">{triageBp || selectedTriage?.bloodPressure || '120/80'}</strong>
                    <span className="text-[9px] text-slate-400 block">mmHg</span>
                  </div>
                  <div className="border border-slate-200 p-2 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block">Temperatura</span>
                    <strong className="text-sm font-mono text-slate-900">{triageTemp || selectedTriage?.temperature || '36.5'}</strong>
                    <span className="text-[9px] text-slate-400 block">°C</span>
                  </div>
                  <div className="border border-slate-200 p-2 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block">Pulso / Heart Rate</span>
                    <strong className="text-sm font-mono text-slate-900">{triageHeartRate || selectedTriage?.heartRate || '75'}</strong>
                    <span className="text-[9px] text-slate-400 block">bpm</span>
                  </div>
                  <div className="border border-slate-200 p-2 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block">Timbang (Weight)</span>
                    <strong className="text-sm font-mono text-slate-900">{triageWeight || selectedTriage?.weightKg || '65'}</strong>
                    <span className="text-[9px] text-slate-400 block">kg</span>
                  </div>
                  <div className="border border-slate-200 p-2 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block">Oxygen (SpO2)</span>
                    <strong className="text-sm font-mono text-slate-900">{selectedTriage?.oxygenSaturation || '98'}</strong>
                    <span className="text-[9px] text-slate-400 block">%</span>
                  </div>
                  <div className="border border-slate-200 p-2 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block">Pain Scale (0-10)</span>
                    <strong className="text-sm font-mono text-slate-900">{selectedTriage?.painScale ?? 0} / 10</strong>
                    <span className="text-[9px] text-slate-400 block">Wong-Baker</span>
                  </div>
                </div>
              </div>

              {/* Section 3: Reason for Consultation / Chief Complaint */}
              <div className="py-3 border-b border-slate-300 space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-100 px-2 py-1 rounded-xs">
                  III. Pangunahing Reklamo / Pakay ng Pasyente (Chief Complaint)
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 font-medium">
                  {triageReason || selectedTriage?.chiefComplaint || 'General Outpatient Medical Consultation'}
                </div>
              </div>

              {/* Section 4: Past Medical History & Allergies */}
              <div className="py-3 border-b border-slate-300 space-y-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-100 px-2 py-1 rounded-xs">
                  IV. Kasaysayan ng Karamdaman at Alerhiya (Medical History & Allergies)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2 border border-slate-200 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Mga Alerhiya (Allergies):</span>
                    <span className="font-medium text-slate-800">{matchedPatient.allergies || selectedTriage?.allergies || 'Walang naiulat na alerhiya (No Known Allergies)'}</span>
                  </div>
                  <div className="p-2 border border-slate-200 rounded">
                    <span className="text-[10px] text-slate-500 uppercase block font-semibold">Mga Karamdaman / Maintenance:</span>
                    <span className="font-medium text-slate-800">{matchedPatient.chronicConditions || selectedTriage?.chronicConditions || 'Wala / Regular maintenance'}</span>
                  </div>
                </div>
              </div>

              {/* Section 5: Physician Consultation & Clinical Notes (SOAP Format) */}
              <div className="py-3 space-y-3">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-800 bg-slate-100 px-2 py-1 rounded-xs flex items-center justify-between">
                  <span>V. Pagsusuri ng Doktor (Physician&apos;s SOAP Notes & Orders)</span>
                  <span className="text-[10px] text-slate-500 italic">Sasagutan ng Attending Doctor</span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="border border-slate-300 rounded p-2.5 min-h-[50px]">
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">S - Subjective / History of Present Illness (HPI):</span>
                    <div className="border-b border-dashed border-slate-300 mt-5" />
                  </div>

                  <div className="border border-slate-300 rounded p-2.5 min-h-[50px]">
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">O - Objective / Physical Examination Findings (PE):</span>
                    <div className="border-b border-dashed border-slate-300 mt-5" />
                  </div>

                  <div className="border border-slate-300 rounded p-2.5 min-h-[50px]">
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">A - Assessment / Clinical Impression / ICD-10 Diagnosis:</span>
                    <div className="border-b border-dashed border-slate-300 mt-5" />
                  </div>

                  <div className="border border-slate-300 rounded p-2.5 min-h-[60px]">
                    <span className="text-[10px] uppercase font-bold text-slate-600 block">P - Plan & Management / Prescriptions (Rx) / Diagnostic Orders:</span>
                    <div className="border-b border-dashed border-slate-300 mt-4" />
                    <div className="border-b border-dashed border-slate-300 mt-4" />
                  </div>
                </div>

                {/* Attending Physician Signature Area */}
                <div className="pt-6 grid grid-cols-2 gap-8 text-xs">
                  <div className="text-center pt-8 border-t border-slate-400">
                    <span className="block font-bold text-slate-900">{session?.user?.name || 'OPD Reception Staff'}</span>
                    <span className="text-[10px] text-slate-500 uppercase block">OPD Admitting Officer / Nurse</span>
                  </div>
                  <div className="text-center pt-8 border-t border-slate-400">
                    <span className="block font-bold text-slate-900">{departments[selectedDeptIndex]?.doctor || 'Attending Physician'}</span>
                    <span className="text-[10px] text-slate-500 uppercase block">Lic. No. / PTR / S2 No.</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Modal Footer Controls */}
            <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between rounded-b-lg shrink-0 print:hidden text-xs">
              <span className="text-slate-600 font-medium">
                Pasyente: <strong>{matchedPatient.name}</strong> ({matchedPatient.patientNo})
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsOpdPrintModalOpen(false)}
                  className="h-9 px-4 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                >
                  Isara
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-9 px-5 rounded bg-teal-800 hover:bg-teal-900 text-white font-bold flex items-center space-x-1.5 cursor-pointer shadow-xs"
                >
                  <Printer className="w-4 h-4" />
                  <span>I-print ang OPD Form</span>
                </button>
              </div>
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
                <p className="text-xs text-rose-100 mt-0.5">Pagpapatunay sa Sistema (System Validation)</p>
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

      {/* ── WORKSTATION & PROFILE SETTINGS MODAL ───────────────────── */}
      <PatientMedicalRecordsModal
        isOpen={isMedicalRecordsOpen}
        onClose={() => setIsMedicalRecordsOpen(false)}
        patientId={matchedPatient?.id || null}
        patientName={matchedPatient?.name || 'Pasyente'}
      />

      <WorkstationSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        stationName="Station 2: OPD Records Counter"
        stationRole="OPD"
        currentRoom={userProfile.room || 'OPD Counter 1'}
        soundEnabled={soundEnabled}
        onToggleSound={(val) => setSoundEnabled(val)}
        onTestSound={playNotificationChime}
        refreshInterval={pollingIntervalSec}
        onChangeRefreshInterval={(sec) => setPollingIntervalSec(sec)}
        onProfileUpdated={loadUserProfile}
      />

      {/* ── 4. PROFESSIONAL FOOTER ───────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-300 py-2.5 px-4 sm:px-6 lg:px-8 text-[11px] text-slate-500 text-center w-full">
        Laguna Medical Center • Hospital Information Management System (HIMS) • Santa Cruz, Laguna
      </footer>

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        userName={userProfile.name || (session?.user?.name || 'OPD Staff')}
        userRole="OPD"
        description="Sigurado ka bang nais mong mag-sign out mula sa OPD Workstation? Kakailanganin mong mag-log in muli upang makapag-check-in ng mga pasyente o makapag-isyu ng RFID card."
      />
    </div>
  );
}
