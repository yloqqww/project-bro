'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import LogoutConfirmModal from '@/components/LogoutConfirmModal';
import {
  Activity,
  HeartPulse,
  Thermometer,
  Stethoscope,
  Baby,
  User,
  Users,
  ShieldAlert,
  Clock,
  Printer,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  LogOut,
  RefreshCw,
  X,
  CreditCard,
  FileText,
  BadgeAlert,
  ChevronRight,
  Sparkles,
  BarChart3,
  Settings,
  Calendar,
  CalendarCheck,
  CalendarClock,
  UserCheck,
  Check,
  MessageSquareText,
  ChevronLeft,
} from 'lucide-react';
import { StaffWorkstationSidebar } from '@/components/StaffWorkstationSidebar';
import { DoctorQueueAlertMonitor } from '@/components/DoctorQueueAlertMonitor';
import WorkstationSettingsModal from '@/components/WorkstationSettingsModal';
import PatientMedicalRecordsModal from '@/components/PatientMedicalRecordsModal';
import { getApiErrorMessage } from '@/lib/client-response';

interface TriageRecord {
  id: string;
  triageNumber: string;
  patientId: string | null;
  patientName: string;
  age: number | null;
  gender: string | null;
  cardUid: string | null;
  bloodPressure: string | null;
  heartRate: string | null;
  temperature: string | null;
  respiratoryRate: string | null;
  oxygenSaturation: string | null;
  weightKg: string | null;
  heightCm: string | null;
  bmi: string | null;
  chiefComplaint: string;
  symptomsDuration: string | null;
  painScore: number;
  allergies?: string | null;
  chronicConditions?: string | null;
  department: string;
  priorityLevel: string;
  nurseName: string | null;
  status: string;
  createdAt: string;
}

interface IncomingAppointment {
  id: string;
  appointmentNumber: string;
  patientName: string;
  patientId: string;
  rawPatientId?: string;
  cardUid?: string | null;
  gender?: string;
  dateOfBirth?: string | null;
  phoneNumber?: string;
  doctorId: string;
  doctorName: string;
  doctorSpecialty: string;
  date: string;
  time: string;
  status: 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled' | 'No-Show' | 'Checked-In';
  type: 'Walk-in' | 'Scheduled' | 'Follow-up';
  reason: string;
}

function mapSpecialtyToDept(specialty: string): string {
  const s = (specialty || '').toLowerCase();
  if (s.includes('ob') || s.includes('gyn') || s.includes('buntis') || s.includes('maternity') || s.includes('prenatal')) return 'OB_GYN';
  if (s.includes('pedia') || s.includes('bata') || s.includes('pediatric')) return 'PEDIATRICS';
  if (s.includes('surg') || s.includes('wound') || s.includes('tahi')) return 'SURGERY';
  if (s.includes('eent') || s.includes('eye') || s.includes('ear') || s.includes('throat') || s.includes('nose')) return 'EENT';
  return 'INTERNAL_MEDICINE';
}

const DEPARTMENTS = [
  {
    id: 'OB_GYN',
    name: 'OB-GYN (Obstetrics & Gynecology)',
    shortName: 'OB-GYN',
    code: 'OB',
    description: 'Buntis, Prenatal, Labor, Pagdurugo, Sakit sa Pus-on, Women’s Health',
    badgeColor: 'bg-pink-50 text-pink-700 border-pink-200',
    headerColor: 'border-pink-500',
    targetDoctorType: 'Obstetrician / Gynecologist',
  },
  {
    id: 'PEDIATRICS',
    name: 'Pediatrics (Pedia)',
    shortName: 'Pedia',
    code: 'PED',
    description: 'Pambata (0-18 y/o), Lagnat ng bata, Ubo/Sipon, Bakuna, Well-baby checkup',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    headerColor: 'border-amber-500',
    targetDoctorType: 'Pediatrician',
  },
  {
    id: 'INTERNAL_MEDICINE',
    name: 'Internal Medicine (Adult)',
    shortName: 'Medicine',
    code: 'MED',
    description: 'Hypertension, Diabetes, Pananakit ng Dibdib, Lagnat, Ubo, Pang-matanda',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    headerColor: 'border-blue-500',
    targetDoctorType: 'Internist / Adult Physician',
  },
  {
    id: 'SURGERY',
    name: 'General Surgery',
    shortName: 'Surgery',
    code: 'SURG',
    description: 'Sugat, Hiwa, Bukol, Buni, Tahi, Appendicitis, Hernia, Trauma, Post-op',
    badgeColor: 'bg-red-50 text-red-700 border-red-200',
    headerColor: 'border-red-500',
    targetDoctorType: 'General Surgeon',
  },
  {
    id: 'EENT',
    name: 'EENT (Eye, Ear, Nose & Throat)',
    shortName: 'EENT',
    code: 'EENT',
    description: 'Pananakit ng Tenga, Sore Throat, Sinusitis, Pamumula ng Mata, Tonsils',
    badgeColor: 'bg-teal-50 text-teal-700 border-teal-200',
    headerColor: 'border-teal-500',
    targetDoctorType: 'EENT Specialist',
  },
];

const ALLERGY_PRESETS = [
  'Walang Alerhiya (NKDA)',
  'Penicillin',
  'Amoxicillin',
  'Aspirin / NSAIDs',
  'Paracetamol',
  'Seafood',
  'Sulfa drugs',
];

const CONDITION_PRESETS = [
  'Wala (None)',
  'Hypertension (HPN)',
  'Diabetes (DM)',
  'Asthma',
  'Heart Disease',
  'Kidney Disease (CKD)',
];

const COMPLAINT_PRESETS = [
  { label: 'Check-up sa Buntis / Prenatal', dept: 'OB_GYN' },
  { label: 'Check-up ng Bata / Bakuna', dept: 'PEDIATRICS' },
  { label: 'Lagnat / Ubo / Sipon', dept: 'INTERNAL_MEDICINE' },
  { label: 'BP Check / High Blood', dept: 'INTERNAL_MEDICINE' },
  { label: 'Sugat / Bukol / Sakit ng Tiyan', dept: 'SURGERY' },
];

const TRIAGE_LIST_PAGE_SIZE = 3;

export default function TriagePage() {
  const { data: session } = useSession();

  // Patient Info
  const [patientName, setPatientName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('FEMALE');
  const [cardUid, setCardUid] = useState('');
  const [patientId, setPatientId] = useState<string | null>(null);

  // Vitals
  const [bloodPressure, setBloodPressure] = useState('');
  const [heartRate, setHeartRate] = useState('');
  const [temperature, setTemperature] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [oxygenSaturation, setOxygenSaturation] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [computedBmi, setComputedBmi] = useState('0');

  // Kasaysayan at Alerhiya (Allergies & Medical History)
  const [allergies, setAllergies] = useState('');
  const [chronicConditions, setChronicConditions] = useState('');

  // Clinical Chief Complaint & Routing
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptomsDuration, setSymptomsDuration] = useState('2 days');
  const [painScore, setPainScore] = useState(0);
  const [selectedDept, setSelectedDept] = useState('OB_GYN');
  const [priorityLevel, setPriorityLevel] = useState<'STANDARD' | 'PRIORITY' | 'URGENT' | 'RESUSCITATION'>('STANDARD');

  // UI States
  const [submitting, setSubmitting] = useState(false);
  const [triageHistory, setTriageHistory] = useState<TriageRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historySearch, setHistorySearch] = useState('');
  const [selectedSlip, setSelectedSlip] = useState<TriageRecord | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [medicalRecordsPatient, setMedicalRecordsPatient] = useState<{ id: string; name: string } | null>(null);

  // Appointments Reception States
  const [rightPanelTab, setRightPanelTab] = useState<'appointments' | 'triaged'>('appointments');
  const [appointments, setAppointments] = useState<IncomingAppointment[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [appointmentsSearch, setAppointmentsSearch] = useState('');
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<'ALL' | 'ACTION' | 'DONE' | 'CANCELLED'>('ALL');
  const [appointmentPage, setAppointmentPage] = useState(1);
  const [historyStatusFilter, setHistoryStatusFilter] = useState<'ALL' | 'WAITING' | 'PROCESSED'>('ALL');
  const [historyPage, setHistoryPage] = useState(1);
  const [activeAppointment, setActiveAppointment] = useState<IncomingAppointment | null>(null);
  const prevAppointmentsCountRef = React.useRef(0);

  const filteredAppointments = useMemo(() => {
    const query = appointmentsSearch.toLowerCase().trim();
    return appointments.filter((appointment) => {
      const needsAction = appointment.status === 'Pending' || appointment.status === 'Confirmed';
      const done = appointment.status === 'Checked-In' || appointment.status === 'Completed';
      const cancelled = appointment.status === 'Cancelled' || appointment.status === 'No-Show';
      if (appointmentStatusFilter === 'ACTION' && !needsAction) return false;
      if (appointmentStatusFilter === 'DONE' && !done) return false;
      if (appointmentStatusFilter === 'CANCELLED' && !cancelled) return false;
      if (!query) return true;
      return [appointment.patientName, appointment.appointmentNumber, appointment.doctorName, appointment.doctorSpecialty, appointment.cardUid]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [appointmentStatusFilter, appointments, appointmentsSearch]);

  const appointmentPageCount = Math.max(1, Math.ceil(filteredAppointments.length / TRIAGE_LIST_PAGE_SIZE));
  const visibleAppointments = filteredAppointments.slice(
    (appointmentPage - 1) * TRIAGE_LIST_PAGE_SIZE,
    appointmentPage * TRIAGE_LIST_PAGE_SIZE
  );

  const filteredTriageHistory = useMemo(() => {
    const query = historySearch.toLowerCase().trim();
    return triageHistory.filter((record) => {
      const waiting = record.status === 'PENDING_OPD';
      if (historyStatusFilter === 'WAITING' && !waiting) return false;
      if (historyStatusFilter === 'PROCESSED' && waiting) return false;
      if (!query) return true;
      return [record.patientName, record.triageNumber, record.cardUid, record.department]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [historySearch, historyStatusFilter, triageHistory]);

  const historyPageCount = Math.max(1, Math.ceil(filteredTriageHistory.length / TRIAGE_LIST_PAGE_SIZE));
  const visibleTriageHistory = filteredTriageHistory.slice(
    (historyPage - 1) * TRIAGE_LIST_PAGE_SIZE,
    historyPage * TRIAGE_LIST_PAGE_SIZE
  );

  useEffect(() => {
    setAppointmentPage((page) => Math.min(page, appointmentPageCount));
  }, [appointmentPageCount]);

  useEffect(() => {
    setHistoryPage((page) => Math.min(page, historyPageCount));
  }, [historyPageCount]);

  // Settings modal states
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [triageRefreshInterval, setTriageRefreshInterval] = useState(10);
  const [triageSoundEnabled, setTriageSoundEnabled] = useState(true);

  // Play audio chime for triage
  const playTriageChime = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (_) {}
  }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Auto-calculate BMI
  useEffect(() => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm) / 100;
    if (w > 0 && h > 0) {
      const val = (w / (h * h)).toFixed(1);
      setComputedBmi(val);
    } else {
      setComputedBmi('0');
    }
  }, [weightKg, heightCm]);

  // Load Incoming Appointments
  const loadAppointments = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setLoadingAppointments(true);
      const res = await fetch('/api/appointments');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.appointments)) {
        setAppointments(data.appointments);
        if (
          prevAppointmentsCountRef.current > 0 &&
          data.appointments.length > prevAppointmentsCountRef.current &&
          triageSoundEnabled
        ) {
          playTriageChime();
          showToast('Bagong Online Appointment ang natanggap sa Triage Desk!', 'info');
        }
        prevAppointmentsCountRef.current = data.appointments.length;
      }
    } catch (e) {
      // Gracefully handle momentary network interruptions or server reload
      if (!isSilent) console.warn('Appointments service temporarily unreachable.');
    } finally {
      if (!isSilent) setLoadingAppointments(false);
    }
  }, [playTriageChime, showToast, triageSoundEnabled]);

  // Load Today's Triaged List
  const loadTriageHistory = useCallback(async () => {
    try {
      setLoadingHistory(true);
      const res = await fetch('/api/triage?limit=30');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.triageList)) {
        setTriageHistory(data.triageList);
      }
    } catch (e) {
      // Gracefully handle momentary network interruptions or server reload
      console.warn('Triage history service temporarily unreachable.');
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    loadAppointments();
    loadTriageHistory();
    const interval = setInterval(() => {
      loadAppointments(true);
      loadTriageHistory();
    }, triageRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [loadAppointments, loadTriageHistory, triageRefreshInterval]);

  // Load Appointment directly into Triage Form
  const handleSelectAppointment = (apt: IncomingAppointment) => {
    setActiveAppointment(apt);
    setPatientName(apt.patientName);
    setPatientId(apt.rawPatientId || null);
    setCardUid(apt.cardUid || '');

    if (apt.rawPatientId) {
      fetch(`/api/patients?patientId=${encodeURIComponent(apt.rawPatientId)}`)
        .then((r) => r.json())
        .then((d) => {
          if (d?.success && d?.patient) {
            const p = d.patient;
            if (p.allergies) {
              setAllergies(typeof p.allergies === 'string' ? p.allergies : Array.isArray(p.allergies) ? p.allergies.join(', ') : '');
            } else {
              setAllergies('');
            }
            if (p.chronicConditions) {
              setChronicConditions(typeof p.chronicConditions === 'string' ? p.chronicConditions : Array.isArray(p.chronicConditions) ? p.chronicConditions.join(', ') : '');
            } else {
              setChronicConditions('');
            }
          }
        })
        .catch((err) => console.error('Error fetching patient clinical history:', err));
    }
    if (apt.gender) {
      setGender(apt.gender.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE');
    }
    if (apt.dateOfBirth) {
      const birthYear = new Date(apt.dateOfBirth).getFullYear();
      const curYear = new Date().getFullYear();
      setAge(String(Math.max(0, curYear - birthYear)));
    } else {
      setAge('');
    }
    setChiefComplaint(apt.reason || 'General Consultation');
    setSelectedDept(mapSpecialtyToDept(apt.doctorSpecialty));
    showToast(`Naka-load sa Triage Form si ${apt.patientName} (${apt.appointmentNumber})`, 'info');
  };

  const handleClearActiveAppointment = () => {
    setActiveAppointment(null);
    setPatientName('');
    setPatientId(null);
    setCardUid('');
    setAge('');
    setChiefComplaint('');
    setBloodPressure('');
    setTemperature('');
    setHeartRate('');
    setWeightKg('');
    setHeightCm('');
    setComputedBmi('0');
    setAllergies('');
    setChronicConditions('');
  };

  // Quick preset click
  const handleSelectPreset = (preset: { label: string; dept: string }) => {
    setChiefComplaint(preset.label);
    setSelectedDept(preset.dept);
  };

  // RFID lookup simulation or search
  const handleLookupCard = async () => {
    if (!cardUid.trim()) return;
    try {
      const lookup = cardUid.trim();
      const lookupParam = /^[A-F0-9]{8}$/i.test(lookup) ? 'cardUid' : 'patientId';
      const res = await fetch(`/api/patients?${lookupParam}=${encodeURIComponent(lookup)}`);
      const data = await res.json();
      if (res.ok && data.success && data.patient) {
        const p = data.patient;
        setPatientName(`${p.firstName || ''} ${p.lastName || ''}`.trim() || p.name);
        setPatientId(p.id);
        if (p.cardUid && p.cardUid !== 'NO_CARD') setCardUid(p.cardUid);
        if (p.gender) setGender(p.gender.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE');
        if (p.dateOfBirth) {
          const birthYear = new Date(p.dateOfBirth).getFullYear();
          const curYear = new Date().getFullYear();
          setAge(String(Math.max(0, curYear - birthYear)));
        }
        if (p.allergies) {
          setAllergies(typeof p.allergies === 'string' ? p.allergies : Array.isArray(p.allergies) ? p.allergies.join(', ') : '');
        } else {
          setAllergies('');
        }
        if (p.chronicConditions) {
          setChronicConditions(typeof p.chronicConditions === 'string' ? p.chronicConditions : Array.isArray(p.chronicConditions) ? p.chronicConditions.join(', ') : '');
        } else {
          setChronicConditions('');
        }
        showToast(`Linked patient: ${p.firstName || p.name}`, 'info');
      } else {
        showToast('No existing patient record linked to this UID. Enter details manually.', 'info');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Submit Triage Assessment
  const handleSubmitTriage = async (e: React.FormEvent) => {
    e.preventDefault();

    // 1. Patient Demographics Validation
    if (!patientName.trim()) {
      showToast('Paki-lagay ang Pangalan ng pasyente bago mag-save.', 'error');
      return;
    }
    const ageNum = parseInt(age, 10);
    if (!age || isNaN(ageNum) || ageNum <= 0 || ageNum > 130) {
      showToast('Paki-lagay ang wastong Edad ng pasyente (1-130).', 'error');
      return;
    }
    if (!gender) {
      showToast('Paki-pili ang Kasarian ng pasyente.', 'error');
      return;
    }

    // 2. Vital Signs Validation (Must be non-empty and non-zero)
    const bpClean = bloodPressure.trim();
    if (!bpClean || bpClean === '0' || !bpClean.includes('/')) {
      showToast('Paki-lagay ang wastong Presyon (BP) ng pasyente (hal. 120/80).', 'error');
      return;
    }
    const tempNum = parseFloat(temperature);
    if (!temperature.trim() || temperature.trim() === '0' || isNaN(tempNum) || tempNum < 32 || tempNum > 45) {
      showToast('Paki-lagay ang wastong Temperatura ng pasyente (hal. 36.5 °C).', 'error');
      return;
    }
    const hrNum = parseInt(heartRate, 10);
    if (!heartRate.trim() || heartRate.trim() === '0' || isNaN(hrNum) || hrNum < 30 || hrNum > 250) {
      showToast('Paki-lagay ang wastong Pulso / Heart Rate ng pasyente (hal. 75 bpm).', 'error');
      return;
    }
    const wtNum = parseFloat(weightKg);
    if (!weightKg.trim() || weightKg.trim() === '0' || isNaN(wtNum) || wtNum <= 0 || wtNum > 350) {
      showToast('Paki-lagay ang Timbang ng pasyente (hal. 60 kg).', 'error');
      return;
    }
    const htNum = parseFloat(heightCm);
    if (!heightCm.trim() || heightCm.trim() === '0' || isNaN(htNum) || htNum <= 0 || htNum > 260) {
      showToast('Paki-lagay ang Taas ng pasyente (hal. 165 cm).', 'error');
      return;
    }

    // 3. Allergies & Chronic Conditions Validation
    if (!allergies.trim()) {
      showToast('Paki-lagay ang Alerhiya ng pasyente o i-click ang preset na "Walang Alerhiya (NKDA)".', 'error');
      return;
    }
    if (!chronicConditions.trim()) {
      showToast('Paki-lagay ang Karamdaman / Maintenance ng pasyente o i-click ang preset na "Wala (None)".', 'error');
      return;
    }

    // 4. Chief Complaint & Department Validation
    if (!chiefComplaint.trim()) {
      showToast('Paki-lagay ang Reklamo o Sintomas ng pasyente (Chief Complaint).', 'error');
      return;
    }
    if (!selectedDept) {
      showToast('Paki-pili ang Departamento ng pasyente.', 'error');
      return;
    }
    if (!priorityLevel) {
      showToast('Paki-pili ang Priority sa Pila.', 'error');
      return;
    }

    try {
      setSubmitting(true);
      const nurseName = session?.user?.name || session?.user?.email?.split('@')[0] || 'Triage Officer';

      const payload = {
        patientId,
        patientName: patientName.trim(),
        age: age ? parseInt(age, 10) : null,
        gender,
        cardUid: cardUid.trim() || null,
        bloodPressure,
        heartRate,
        temperature,
        respiratoryRate,
        oxygenSaturation,
        weightKg,
        heightCm,
        bmi: computedBmi,
        allergies: allergies.trim(),
        chronicConditions: chronicConditions.trim(),
        chiefComplaint: chiefComplaint.trim(),
        symptomsDuration,
        painScore,
        department: selectedDept,
        priorityLevel,
        nurseName,
      };

      const res = await fetch('/api/triage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success && data.triageAssessment) {
        showToast(`Triage assessment ${data.triageAssessment.triageNumber} recorded!`, 'success');
        setSelectedSlip(data.triageAssessment);

        // If this triage was linked to an appointment, mark appointment Checked-In
        if (activeAppointment) {
          try {
            await fetch(`/api/appointments/${activeAppointment.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ status: 'Checked-In' }),
            });
          } catch (e) {
            console.error('Failed to update appointment status:', e);
          }
          setActiveAppointment(null);
        }

        loadTriageHistory();
        loadAppointments(true);

        // Reset form for next patient
        setPatientName('');
        setAge('');
        setCardUid('');
        setPatientId(null);
        setChiefComplaint('');
        setSymptomsDuration('2 days');
        setPainScore(0);
        setBloodPressure('');
        setTemperature('');
        setHeartRate('');
        setRespiratoryRate('');
        setOxygenSaturation('');
        setWeightKg('');
        setHeightCm('');
        setComputedBmi('0');
        setAllergies('');
        setChronicConditions('');
        setPriorityLevel('STANDARD');
      } else {
        showToast(getApiErrorMessage(data.error, 'Failed to record triage'), 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Error recording triage assessment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedDeptObj = DEPARTMENTS.find((d) => d.id === selectedDept) || DEPARTMENTS[0];  const getDepartmentBadge = (deptId: string) => {
    const d = DEPARTMENTS.find((x) => x.id === deptId);
    return d ? (
      <span className={`inline-flex items-center px-2.5 py-1 rounded text-xs font-bold border ${d.badgeColor}`}>
        <span className="font-mono mr-1.5 text-xs font-black">[{d.code}]</span> {d.shortName}
      </span>
    ) : (
      <span className="px-2.5 py-1 rounded text-xs bg-slate-100 text-slate-700 font-semibold">{deptId}</span>
    );
  };

  const getPriorityBadge = (lvl: string) => {
    switch (lvl) {
      case 'RESUSCITATION':
        return <span className="px-2.5 py-1 rounded text-xs font-black bg-red-600 text-white animate-pulse">EMERGENCY</span>;
      case 'URGENT':
        return <span className="px-2.5 py-1 rounded text-xs font-bold bg-amber-500 text-white">URGENT</span>;
      case 'PRIORITY':
        return <span className="px-2.5 py-1 rounded text-xs font-bold bg-blue-600 text-white">PRIORITY (SR/PWD)</span>;
      default:
        return <span className="px-2.5 py-1 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">STANDARD</span>;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 antialiased flex flex-col font-sans">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center space-x-2 px-4 py-3 rounded-lg shadow-xl text-sm font-semibold text-white animate-in slide-in-from-top-2 duration-200 ${
            toast.type === 'error' ? 'bg-red-600' : toast.type === 'info' ? 'bg-blue-600' : 'bg-emerald-600'
          }`}
        >
          {toast.type === 'error' ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── TOP APP BAR (FULL SCREEN) ─────────────────────────── */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-30 shadow-2xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-teal-800 text-white font-bold flex items-center justify-center text-sm tracking-wider shadow-sm shrink-0">
              TRG
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">Laguna Medical Center</span>
                <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 font-bold text-xs rounded border border-teal-200 uppercase tracking-wider">
                  Station 1: Triage Assessment
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-tight mt-0.5">
                Screening, Vital Signs & Department Clinical Routing
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-sm">
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-700 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
              <span>TRIAGE STATION</span>
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

            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(true)}
              className="h-9 px-3 rounded-md border border-slate-300 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-300 text-slate-700 text-xs sm:text-sm font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── WORKSPACE BODY (WITH COLLAPSIBLE SIDEBAR) ────────────────── */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-5 flex-1">
        <div className="flex flex-col lg:flex-row items-start gap-4">
          <StaffWorkstationSidebar role="NURSE" />

          <div className="flex-1 min-w-0 w-full space-y-4">
            <DoctorQueueAlertMonitor />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* ── LEFT: SIMPLIFIED TRIAGE FORM (7 OF 12 COLS) ──────────── */}
        <section className="lg:col-span-7 xl:col-span-7 space-y-5">
          <form onSubmit={handleSubmitTriage} className="bg-white border border-slate-300 rounded-xl shadow-sm p-5 space-y-5">
            {/* Form Title Strip */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 text-teal-800 border border-teal-200 flex items-center justify-center font-bold">
                  <Activity className="w-5 h-5 text-teal-800" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900 leading-tight">Pagkuha ng Vitals (Triage)</h2>
                  <p className="text-xs text-slate-500">I-fill up at ipasa sa OPD Desk para mabigyan ng Queue Ticket</p>
                </div>
              </div>
              {patientId && (
                <button
                  type="button"
                  onClick={() => setMedicalRecordsPatient({ id: patientId, name: patientName || 'Pasyente' })}
                  className="h-8 px-3 rounded-md bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Medical Records
                </button>
              )}
            </div>

            {/* Active Appointment Link Banner */}
            {activeAppointment && (
              <div className="p-3.5 bg-teal-50 border border-teal-300 rounded-lg flex items-center justify-between shadow-2xs animate-in fade-in">
                <div className="flex items-start sm:items-center space-x-3">
                  <div className="w-8 h-8 rounded-full bg-teal-700 text-white flex items-center justify-center shrink-0">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold px-2 py-0.5 bg-teal-200 text-teal-900 rounded">
                        {activeAppointment.appointmentNumber}
                      </span>
                      <span className="text-xs font-bold text-teal-950">Naka-link sa Online Appointment</span>
                    </div>
                    <p className="text-xs text-teal-800 mt-0.5">
                      Pasyente: <strong>{activeAppointment.patientName}</strong> • Doktor: <strong>{activeAppointment.doctorName}</strong> ({activeAppointment.doctorSpecialty})
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearActiveAppointment}
                  className="text-xs font-semibold px-2.5 py-1 text-teal-900 hover:text-red-700 hover:bg-red-50 rounded border border-teal-300 transition-colors"
                >
                  I-clear
                </button>
              </div>
            )}

            {/* 1. Patient Identification (Clean & Direct) */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Pangalan ng Pasyente <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Hal. Maria Clara Santos"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full h-10 px-3 text-sm text-slate-900 font-medium bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-teal-700"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Edad <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  max="130"
                  placeholder="Hal. 28"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full h-10 px-3 text-sm text-slate-900 font-medium bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-teal-700"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Kasarian <span className="text-red-600">*</span>
                </label>
                <select
                  required
                  value={gender}
                  onChange={(e) => setGender(e.target.value as any)}
                  className="w-full h-10 px-2.5 text-sm font-medium bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-teal-700"
                >
                  <option value="FEMALE">Babae</option>
                  <option value="MALE">Lalaki</option>
                </select>
              </div>
            </div>

            {/* 2. Vital Signs */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                  <HeartPulse className="w-4 h-4 text-rose-600" />
                  <span>Vital Signs</span>
                </label>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block text-center mb-1">
                    Presyon (BP) <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="text"
                    required
                    value={bloodPressure}
                    onChange={(e) => setBloodPressure(e.target.value)}
                    placeholder="Hal. 120/80"
                    className="w-full h-9 bg-white px-2 text-sm font-mono font-bold text-slate-900 border border-slate-300 rounded text-center focus:outline-hidden focus:border-teal-700"
                  />
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block text-center mb-1">
                    Temp (°C) <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="32"
                    max="45"
                    required
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="Hal. 36.5"
                    className="w-full h-9 bg-white px-2 text-sm font-mono font-bold text-slate-900 border border-slate-300 rounded text-center focus:outline-hidden focus:border-teal-700"
                  />
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block text-center mb-1">
                    Pulso (bpm) <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="number"
                    min="30"
                    max="250"
                    required
                    value={heartRate}
                    onChange={(e) => setHeartRate(e.target.value)}
                    placeholder="Hal. 75"
                    className="w-full h-9 bg-white px-2 text-sm font-mono font-bold text-slate-900 border border-slate-300 rounded text-center focus:outline-hidden focus:border-teal-700"
                  />
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block text-center mb-1">
                    Timbang (kg) <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="1"
                    max="350"
                    required
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="Hal. 60"
                    className="w-full h-9 bg-white px-2 text-sm font-mono font-bold text-slate-900 border border-slate-300 rounded text-center focus:outline-hidden focus:border-teal-700"
                  />
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block text-center mb-1">
                    Taas (cm) · BMI {computedBmi || '0.0'} <span className="text-red-600">*</span>
                  </span>
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="260"
                    required
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="Hal. 165"
                    className="w-full h-9 bg-white px-2 text-sm font-mono font-bold text-slate-900 border border-slate-300 rounded text-center focus:outline-hidden focus:border-teal-700"
                  />
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-700 block text-center mb-1">
                    Antas ng Sakit <span className="text-red-600">*</span>
                  </span>
                  <select
                    required
                    value={painScore}
                    onChange={(e) => setPainScore(parseInt(e.target.value, 10))}
                    className="w-full h-9 bg-white px-2 text-xs font-bold text-slate-900 border border-slate-300 rounded text-center focus:outline-hidden focus:border-teal-700"
                  >
                    <option value="0">0 - Walang Sakit</option>
                    <option value="2">2 - Bahagya</option>
                    <option value="4">4 - Katamtaman</option>
                    <option value="6">6 - Masakit</option>
                    <option value="8">8 - Sobrang Sakit</option>
                    <option value="10">10 - Kritikal</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Kasaysayan ng Karamdaman at Alerhiya (Allergies & Medical History) */}
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Kasaysayan at Alerhiya (Allergies & Medical History)</span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">Mahalaga sa clinical assessment ng doktor</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Known Allergies */}
                <div className="bg-rose-50/70 p-3 rounded-lg border border-rose-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      Mga Alerhiya (Known Allergies) <span className="text-red-600">*</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setAllergies('No known drug allergies (NKDA)')}
                      className="text-[11px] font-semibold text-rose-700 hover:text-rose-900 underline cursor-pointer"
                    >
                      Walang Alerhiya (NKDA)
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {ALLERGY_PRESETS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          if (item === 'Walang Alerhiya (NKDA)') {
                            setAllergies('No known drug allergies (NKDA)');
                          } else {
                            setAllergies((prev) => {
                              const clean = prev.replace(/No known drug allergies \(NKDA\)/gi, '').trim();
                              const items = clean ? clean.split(',').map((s) => s.trim()).filter(Boolean) : [];
                              if (!items.includes(item)) items.push(item);
                              return items.join(', ');
                            });
                          }
                        }}
                        className="text-[10px] px-2 py-0.5 bg-white hover:bg-rose-100 text-rose-900 border border-rose-200 rounded font-medium transition-colors cursor-pointer"
                      >
                        + {item}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    required
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    placeholder="Hal. Penicillin, Seafood o i-click ang preset na 'Walang Alerhiya (NKDA)'"
                    className="w-full h-8.5 bg-white px-2.5 text-xs text-slate-900 font-medium border border-rose-200 rounded-md focus:outline-hidden focus:border-rose-400"
                  />
                </div>

                {/* Chronic Conditions */}
                <div className="bg-amber-50/70 p-3 rounded-lg border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                      <HeartPulse className="w-3.5 h-3.5 text-amber-600" />
                      Karamdaman / Maintenance (Chronic Conditions) <span className="text-red-600">*</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setChronicConditions('None reported')}
                      className="text-[11px] font-semibold text-amber-700 hover:text-amber-900 underline cursor-pointer"
                    >
                      Wala (None)
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {CONDITION_PRESETS.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          if (item === 'Wala (None)') {
                            setChronicConditions('None reported');
                          } else {
                            setChronicConditions((prev) => {
                              const clean = prev.replace(/None reported/gi, '').trim();
                              const items = clean ? clean.split(',').map((s) => s.trim()).filter(Boolean) : [];
                              if (!items.includes(item)) items.push(item);
                              return items.join(', ');
                            });
                          }
                        }}
                        className="text-[10px] px-2 py-0.5 bg-white hover:bg-amber-100 text-amber-900 border border-amber-200 rounded font-medium transition-colors cursor-pointer"
                      >
                        + {item}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    required
                    value={chronicConditions}
                    onChange={(e) => setChronicConditions(e.target.value)}
                    placeholder="Hal. Hypertension, Diabetes, Asthma o i-click ang preset na 'Wala (None)'"
                    className="w-full h-8.5 bg-white px-2.5 text-xs text-slate-900 font-medium border border-amber-200 rounded-md focus:outline-hidden focus:border-amber-400"
                  />
                </div>
              </div>
            </div>

            {/* 3. Chief Complaint (5 Quick Presets + Clean Textbox) */}
            <div className="space-y-2.5 pt-3 border-t border-slate-200">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block">
                Dahilan ng Pagpapatingin (Chief Complaint) <span className="text-red-600">*</span>
              </label>

              <div className="flex flex-wrap gap-1.5">
                {COMPLAINT_PRESETS.map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleSelectPreset(p)}
                    className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 border border-slate-200 rounded-md text-slate-700 font-medium transition-colors cursor-pointer"
                  >
                    + {p.label}
                  </button>
                ))}
              </div>

              <textarea
                required
                rows={2}
                placeholder="Isulat ang reklamo o nararamdaman ng pasyente..."
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                className="w-full p-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-lg focus:outline-hidden focus:border-teal-700 resize-none font-medium"
              />
            </div>

            {/* 4. Compact Department & Priority Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-200">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                  Departamento <span className="text-red-600">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {DEPARTMENTS.map((dept) => {
                    const isSelected = selectedDept === dept.id;
                    return (
                      <button
                        key={dept.id}
                        type="button"
                        onClick={() => setSelectedDept(dept.id)}
                        className={`px-3 py-2 rounded-md text-xs font-bold border transition cursor-pointer ${
                          isSelected
                            ? 'bg-teal-800 text-white border-teal-900 shadow-xs'
                            : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-white'
                        }`}
                      >
                        {dept.shortName}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 block mb-1.5">
                  Priority sa Pila <span className="text-red-600">*</span>
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'STANDARD', label: 'Regular', color: 'border-emerald-500 bg-emerald-50 text-emerald-900' },
                    { id: 'PRIORITY', label: 'Senior / PWD', color: 'border-blue-500 bg-blue-50 text-blue-900' },
                    { id: 'URGENT', label: 'Urgent', color: 'border-rose-500 bg-rose-50 text-rose-900' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPriorityLevel(p.id as any)}
                      className={`py-2 px-2 rounded-md text-xs font-bold border text-center transition cursor-pointer ${
                        priorityLevel === p.id || (priorityLevel === 'RESUSCITATION' && p.id === 'URGENT')
                          ? `ring-2 ring-teal-800 ${p.color}`
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Submit Action */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
                <span className="text-red-600 font-bold">*</span>
                <span>Lahat ng fields (Vitals, Alerhiya, Karamdaman, Reklamo) ay <strong>required</strong> bago maipasa sa OPD Desk.</span>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full sm:w-auto h-11 px-6 bg-teal-800 hover:bg-teal-900 text-white text-sm font-bold rounded-lg shadow-sm flex items-center justify-center space-x-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Sine-save...</span>
                  </>
                ) : (
                  <>
                    <span>I-save at Ipasa sa OPD</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </section>

        {/* ── RIGHT: INCOMING APPOINTMENTS & TODAY'S TRIAGED LIST ───── */}
        <section className="lg:col-span-5 xl:col-span-5 space-y-5">
          <div className="bg-white border border-slate-300 rounded-xl shadow-sm p-4 sm:p-5 flex flex-col h-full">
            
            {/* Dual Tabs Header */}
            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setRightPanelTab('appointments')}
                className={`py-2 px-2 rounded-md text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  rightPanelTab === 'appointments'
                    ? 'bg-white text-teal-950 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                <span className="truncate">Appointments</span>
                <span className="px-1.5 py-0.2 bg-teal-100 text-teal-900 rounded-full font-mono text-[10px] shrink-0">
                  {appointments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setRightPanelTab('triaged')}
                className={`py-2 px-2 rounded-md text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer ${
                  rightPanelTab === 'triaged'
                    ? 'bg-white text-teal-950 shadow-2xs border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                <span className="truncate">Na-triage Ngayon</span>
                <span className="px-1.5 py-0.2 bg-slate-200 text-slate-800 rounded-full font-mono text-[10px] shrink-0">
                  {triageHistory.length}
                </span>
              </button>
            </div>

            {/* TAB 1: INCOMING APPOINTMENTS FOR TRIAGE */}
            {rightPanelTab === 'appointments' && (
              <div className="flex-1 flex flex-col mt-3.5">
                {/* Search & Refresh */}
                <div className="flex items-center space-x-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                    <input
                      type="text"
                      placeholder="Maghanap ng appointment o pasyente..."
                      value={appointmentsSearch}
                      onChange={(e) => {
                        setAppointmentsSearch(e.target.value);
                        setAppointmentPage(1);
                      }}
                      className="w-full pl-9 pr-3.5 h-11 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:bg-white focus:border-teal-700 font-medium"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => loadAppointments(false)}
                    disabled={loadingAppointments}
                    className="p-2.5 text-slate-500 hover:text-slate-800 border border-slate-300 bg-white rounded-lg transition-colors cursor-pointer"
                    title="Refresh appointments"
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingAppointments ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="mt-2 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 border border-slate-200 p-1">
                  {([
                    ['ALL', `Lahat (${appointments.length})`],
                    ['ACTION', `Kailangang I-triage (${appointments.filter((item) => item.status === 'Pending' || item.status === 'Confirmed').length})`],
                    ['DONE', `Tapos (${appointments.filter((item) => item.status === 'Checked-In' || item.status === 'Completed').length})`],
                    ['CANCELLED', `Cancelled / No-show (${appointments.filter((item) => item.status === 'Cancelled' || item.status === 'No-Show').length})`],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setAppointmentStatusFilter(value);
                        setAppointmentPage(1);
                      }}
                      className={`min-h-8 px-2 rounded text-[10px] font-bold leading-tight transition ${
                        appointmentStatusFilter === value
                          ? 'bg-white text-teal-900 border border-slate-300 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Appointments List */}
                <div className="mt-3 space-y-2">
                  {filteredAppointments.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-xs">
                      <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">Walang naka-iskedyul na appointment</p>
                      <p className="text-xs text-slate-500 mt-1">Lilitaw rito ang bawat pasyenteng nag-book online o walk-in.</p>
                    </div>
                  ) : (
                    visibleAppointments.map((apt) => {
                        const isCurrent = activeAppointment?.id === apt.id;
                        const isCheckedIn = apt.status === 'Checked-In' || apt.status === 'Completed';
                        const isCancelled = apt.status === 'Cancelled' || apt.status === 'No-Show';

                        return (
                          <div
                            key={apt.id}
                            className={`p-3.5 rounded-lg transition-all border my-1 ${
                              isCurrent
                                ? 'bg-teal-50/60 border-teal-400 ring-1 ring-teal-400'
                                : 'bg-white hover:bg-slate-50 border-slate-200'
                            }`}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-1.5">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="font-bold text-slate-900 text-sm truncate">{apt.patientName}</span>
                                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                    {apt.appointmentNumber}
                                  </span>
                                </div>
                                <div className="text-xs text-slate-500 font-medium mt-0.5 flex items-center space-x-1.5">
                                  <span>{apt.date}</span>
                                  <span>•</span>
                                  <span className="font-mono text-slate-700">{apt.time}</span>
                                </div>
                              </div>

                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider ${
                                  isCheckedIn
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                    : isCancelled
                                    ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                    : apt.status === 'Confirmed'
                                    ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
                                {isCheckedIn ? 'Na-triage Na' : apt.status}
                              </span>
                            </div>

                            {/* Doctor & Reason */}
                            <div className="mt-2 text-xs text-slate-700 space-y-1">
                              <div className="flex items-center space-x-1 text-slate-800 font-medium">
                                <Stethoscope className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                <span>{apt.doctorName}</span>
                                <span className="text-slate-400 text-[11px]">({apt.doctorSpecialty})</span>
                              </div>
                              <p className="text-slate-600 line-clamp-1 italic text-[11px]">
                                &ldquo;{apt.reason}&rdquo;
                              </p>
                            </div>

                            {/* Badges & Action */}
                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                              {apt.cardUid ? (
                                <span className="inline-flex items-center space-x-1 text-[11px] font-mono font-semibold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                                  <CreditCard className="w-3 h-3 text-teal-700" />
                                  <span>{apt.cardUid}</span>
                                </span>
                              ) : (
                                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                  Walang RFID
                                </span>
                              )}

                              <div className="flex flex-wrap items-center justify-end gap-1.5">
                                {apt.rawPatientId && (
                                  <button
                                    type="button"
                                    onClick={() => setMedicalRecordsPatient({ id: apt.rawPatientId!, name: apt.patientName })}
                                    className="inline-flex items-center gap-1 px-2 py-1.5 border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold rounded-md"
                                    title="Tingnan ang medical history"
                                  >
                                    <FileText className="w-3 h-3" /> Records
                                  </button>
                                )}
                                {isCurrent ? (
                                  <span className="inline-flex items-center space-x-1 text-xs font-bold text-teal-800 bg-teal-100 px-2.5 py-1 rounded">
                                    <Sparkles className="w-3.5 h-3.5 animate-spin" />
                                    <span>Tina-triage</span>
                                  </span>
                                ) : isCheckedIn ? (
                                  <span className="inline-flex items-center space-x-1 text-xs font-medium text-slate-400">
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Tapos na</span>
                                  </span>
                                ) : isCancelled ? (
                                  <span className="inline-flex items-center space-x-1 text-xs font-medium text-rose-700 bg-rose-50 border border-rose-200 px-2 py-1 rounded">
                                    <X className="w-3.5 h-3.5" />
                                    <span>Hindi puwedeng i-triage</span>
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleSelectAppointment(apt)}
                                    className="inline-flex items-center space-x-1 px-3 py-1.5 bg-teal-800 hover:bg-teal-900 text-white text-xs font-semibold rounded-md shadow-2xs transition-colors cursor-pointer"
                                  >
                                    <span>I-triage</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    {filteredAppointments.length === 0
                      ? '0 appointment'
                      : `${(appointmentPage - 1) * TRIAGE_LIST_PAGE_SIZE + 1}-${Math.min(appointmentPage * TRIAGE_LIST_PAGE_SIZE, filteredAppointments.length)} sa ${filteredAppointments.length}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setAppointmentPage((page) => Math.max(1, page - 1))}
                      disabled={appointmentPage <= 1}
                      className="h-8 px-2.5 rounded border border-slate-300 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      Nakaraan
                    </button>
                    <span className="min-w-16 text-center text-[11px] font-semibold text-slate-600">
                      {appointmentPage} / {appointmentPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setAppointmentPage((page) => Math.min(appointmentPageCount, page + 1))}
                      disabled={appointmentPage >= appointmentPageCount}
                      className="h-8 px-2.5 rounded border border-slate-300 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      Susunod
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: TODAY'S TRIAGED HISTORY */}
            {rightPanelTab === 'triaged' && (
              <div className="flex-1 flex flex-col mt-3.5">
                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    placeholder="Maghanap sa na-triage na pasyente o slip..."
                    value={historySearch}
                    onChange={(e) => {
                      setHistorySearch(e.target.value);
                      setHistoryPage(1);
                    }}
                    className="w-full pl-9 pr-3.5 h-11 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-hidden focus:bg-white focus:border-teal-700 font-medium"
                  />
                </div>

                <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-slate-100 border border-slate-200 p-1">
                  {([
                    ['ALL', `Lahat (${triageHistory.length})`],
                    ['WAITING', `Nasa OPD (${triageHistory.filter((item) => item.status === 'PENDING_OPD').length})`],
                    ['PROCESSED', `Processed (${triageHistory.filter((item) => item.status !== 'PENDING_OPD').length})`],
                  ] as const).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setHistoryStatusFilter(value);
                        setHistoryPage(1);
                      }}
                      className={`min-h-8 px-1.5 rounded text-[10px] font-bold leading-tight transition ${
                        historyStatusFilter === value
                          ? 'bg-white text-teal-900 border border-slate-300 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {/* Patient List */}
                <div className="mt-3 space-y-2">
                  {filteredTriageHistory.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-xs">
                      <Activity className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                      <p className="font-bold text-slate-700">Wala pang pasyente na na-triage ngayon</p>
                      <p className="text-xs text-slate-500 mt-1">Lilitaw rito ang lahat ng ma-screen na pasyente.</p>
                    </div>
                  ) : (
                    visibleTriageHistory.map((t) => {
                        return (
                          <div
                            key={t.id}
                            className="py-3 px-2.5 hover:bg-slate-50 rounded-lg transition-colors group cursor-pointer border border-transparent hover:border-slate-200"
                            onClick={() => setSelectedSlip(t)}
                          >
                            <div className="flex flex-wrap items-start justify-between gap-1.5">
                              <div className="min-w-0">
                                <div className="flex items-center space-x-2 flex-wrap">
                                  <span className="font-bold text-slate-900 text-sm">{t.patientName}</span>
                                  {t.age && <span className="text-xs text-slate-500 font-mono">({t.age} y/o)</span>}
                                  {getPriorityBadge(t.priorityLevel)}
                                </div>
                                <span className="text-xs font-mono font-bold text-teal-900 bg-teal-50 px-2 py-0.5 rounded border border-teal-200 mt-1 inline-block">
                                  {t.triageNumber}
                                </span>
                              </div>

                              <div className="text-right">
                                <span className="text-xs text-slate-500 font-mono block">
                                  {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded inline-block mt-1">
                                  {t.status === 'PENDING_OPD' ? 'Waiting at OPD' : 'Processed'}
                                </span>
                              </div>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex flex-wrap items-center gap-2">
                                {getDepartmentBadge(t.department)}
                                {t.bloodPressure && (
                                  <span className="font-mono text-slate-600 font-semibold">BP: {t.bloodPressure}</span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                {t.patientId && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setMedicalRecordsPatient({ id: t.patientId!, name: t.patientName });
                                    }}
                                    className="text-[11px] font-bold text-slate-700 hover:text-teal-900 flex items-center gap-1 cursor-pointer"
                                  >
                                    <FileText className="w-3 h-3" /> Records
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setSelectedSlip(t);
                                  }}
                                  className="text-xs font-bold text-teal-800 hover:text-teal-950 flex items-center space-x-1 group-hover:underline cursor-pointer"
                                >
                                  <span>Slip</span>
                                  <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                <div className="mt-3 pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    {filteredTriageHistory.length === 0
                      ? '0 triage record'
                      : `${(historyPage - 1) * TRIAGE_LIST_PAGE_SIZE + 1}-${Math.min(historyPage * TRIAGE_LIST_PAGE_SIZE, filteredTriageHistory.length)} sa ${filteredTriageHistory.length}`}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                      disabled={historyPage <= 1}
                      className="h-8 px-2.5 rounded border border-slate-300 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      Nakaraan
                    </button>
                    <span className="min-w-16 text-center text-[11px] font-semibold text-slate-600">
                      {historyPage} / {historyPageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))}
                      disabled={historyPage >= historyPageCount}
                      className="h-8 px-2.5 rounded border border-slate-300 text-[11px] font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50"
                    >
                      Susunod
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Guidance */}
            <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg mt-3">
              <span className="font-bold text-slate-800 block mb-0.5">Daloy ng Sistema:</span>
              Ang bawat na-triage na appointment o pasyente ay agad na lilitaw sa <strong>OPD Desk</strong> para sa pag-isyu ng Queue Ticket at awtomatikong papasok sa pila ng Doktor.
            </div>
          </div>
        </section>
            </div>
          </div>
        </div>
      </main>

      {/* ── MODAL: OFFICIAL TRIAGE SLIP (PRINTABLE) ───────────────── */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-5 py-3.5 bg-teal-800 text-white flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-teal-200" />
                <span className="text-sm font-bold tracking-wide uppercase">Official Triage Routing Slip</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="text-teal-200 hover:text-white p-1 rounded cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Slip Paper Content (Print Area) */}
            <div id="printable-triage-slip" className="p-6 space-y-4 bg-white text-slate-900 text-sm">
              {/* Slip Header */}
              <div className="text-center border-b border-dashed border-slate-300 pb-3">
                <h4 className="font-extrabold text-base tracking-tight text-slate-900">LAGUNA MEDICAL CENTER</h4>
                <p className="text-xs text-slate-500">Provincial Health Office • Triage Assessment Unit</p>
                <div className="mt-2 inline-block px-4 py-1.5 bg-slate-100 rounded text-slate-900 font-mono font-bold text-sm tracking-wider border border-slate-300">
                  {selectedSlip.triageNumber}
                </div>
              </div>

              {/* Patient Basic Info */}
              <div className="grid grid-cols-2 gap-3 pb-3 border-b border-slate-200 text-sm">
                <div>
                  <span className="text-xs text-slate-500 block uppercase font-semibold">Pasyente</span>
                  <span className="font-bold text-slate-900 text-base">{selectedSlip.patientName}</span>
                </div>
                <div>
                  <span className="text-xs text-slate-500 block uppercase font-semibold">Edad / Kasarian</span>
                  <span className="font-semibold text-slate-800">
                    {selectedSlip.age ? `${selectedSlip.age} y/o` : 'N/A'} • {selectedSlip.gender || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Vital Signs Table */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-300 space-y-2 font-mono text-xs sm:text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Blood Pressure (BP):</span>
                  <strong className="text-slate-900">{selectedSlip.bloodPressure || 'N/A'} mmHg</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Temperature:</span>
                  <strong className="text-slate-900">{selectedSlip.temperature || 'N/A'} °C</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Heart Rate (Pulse):</span>
                  <strong className="text-slate-900">{selectedSlip.heartRate || 'N/A'} bpm</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Oxygen Saturation (SpO2):</span>
                  <strong className="text-slate-900">{selectedSlip.oxygenSaturation || 'N/A'} %</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-medium">Weight & Height (BMI):</span>
                  <strong className="text-slate-900">
                    {selectedSlip.weightKg || '--'}kg / {selectedSlip.heightCm || '--'}cm ({selectedSlip.bmi || '--'})
                  </strong>
                </div>
              </div>

              {/* Medical Alerts: Allergies & Chronic Conditions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
                  <span className="text-[10px] text-rose-800 font-bold uppercase block mb-0.5">Mga Alerhiya (Allergies)</span>
                  <span className="font-semibold text-slate-900">
                    {selectedSlip.allergies || 'Walang naiulat (NKDA)'}
                  </span>
                </div>
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="text-[10px] text-amber-800 font-bold uppercase block mb-0.5">Karamdaman (Conditions)</span>
                  <span className="font-semibold text-slate-900">
                    {selectedSlip.chronicConditions || 'Wala naiulat (None)'}
                  </span>
                </div>
              </div>

              {/* Chief Complaint & Routing */}
              <div className="space-y-2.5">
                <div>
                  <span className="text-xs text-slate-500 block uppercase font-semibold">Chief Complaint</span>
                  <p className="text-sm text-slate-900 font-medium mt-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    &quot;{selectedSlip.chiefComplaint}&quot;
                  </p>
                </div>

                <div className="p-3.5 bg-teal-50 border border-teal-300 rounded-lg">
                  <span className="text-xs font-bold text-teal-800 uppercase block tracking-wider">
                    TARGET DEPARTMENT (ROUTED TO)
                  </span>
                  <span className="text-base font-extrabold text-teal-950 block mt-1">
                    {DEPARTMENTS.find((d) => d.id === selectedSlip.department)?.name || selectedSlip.department}
                  </span>
                  <span className="text-xs text-teal-800 mt-1 block">
                    Priority Level: <strong>{selectedSlip.priorityLevel}</strong>
                  </span>
                </div>
              </div>

              {/* Footer instruction for patient */}
              <div className="border-t border-dashed border-slate-300 pt-3 text-center text-xs text-slate-500 space-y-1">
                <p className="font-bold text-slate-800">
                  Paalala: Dalhin ang slip na ito sa OPD Records Counter
                </p>
                <p>Para sa pag-retrieve ng inyong rekord at pagkuha ng opisyal na queue number.</p>
                <p className="font-mono text-xs text-slate-400 pt-1">
                  Issued: {new Date(selectedSlip.createdAt).toLocaleString()} • Officer: {selectedSlip.nurseName}
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="px-5 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedSlip(null)}
                className="px-4 py-2 text-sm text-slate-700 hover:text-slate-900 font-semibold cursor-pointer"
              >
                Isara
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2 bg-teal-800 hover:bg-teal-900 text-white text-sm font-bold rounded-lg shadow-sm flex items-center space-x-2 transition-colors cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>I-print ang Triage Slip</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── WORKSTATION & PROFILE SETTINGS MODAL ───────────────────── */}
      <PatientMedicalRecordsModal
        isOpen={Boolean(medicalRecordsPatient)}
        onClose={() => setMedicalRecordsPatient(null)}
        patientId={medicalRecordsPatient?.id || null}
        patientName={medicalRecordsPatient?.name || 'Pasyente'}
      />

      <WorkstationSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        stationName="Station 1: Triage Assessment"
        stationRole="Triage"
        currentRoom="Triage Booth 1"
        soundEnabled={triageSoundEnabled}
        onToggleSound={(val) => setTriageSoundEnabled(val)}
        onTestSound={playTriageChime}
        refreshInterval={triageRefreshInterval}
        onChangeRefreshInterval={(sec) => setTriageRefreshInterval(sec)}
        onProfileUpdated={loadTriageHistory}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        userName={session?.user?.name || session?.user?.email || 'Triage Staff'}
        userRole="TRIAGE"
        description="Sigurado ka bang nais mong mag-sign out mula sa Triage Station? Kakailanganin mong mag-log in muli upang makapagtala ng vital signs at clinical routing ng mga pasyente."
      />
    </div>
  );
}
