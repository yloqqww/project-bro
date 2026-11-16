'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  User,
  Stethoscope,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  CalendarCheck,
  Check,
  Printer,
  QrCode,
  MapPin,
  Phone,
  FileText,
} from 'lucide-react';

interface DoctorItem {
  id: string;
  name: string;
  specialization: string;
  roomNumber?: string;
  availableFrom?: string;
  availableTo?: string;
  licenseNumber?: string;
}

interface AvailableSlot {
  start: string;
  end: string;
  label: string;
}

const DEFAULT_PUBLIC_SETTINGS = {
  clinicName: 'Laguna Medical Center',
  shortName: 'LMC',
  hotline: '(049) 545-8888',
  address: 'Santa Cruz, Laguna, Philippines',
  emergencyNotice: '',
};

export default function OnlineBookingPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Doctors & Department State
  const [doctors, setDoctors] = useState<DoctorItem[]>([]);
  const [loadingDoctors, setLoadingDoctors] = useState(true);
  const [clinicSettings, setClinicSettings] = useState(DEFAULT_PUBLIC_SETTINGS);
  const [selectedSpecialty, setSelectedSpecialty] = useState('ALL');
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorItem | null>(null);

  // Step 2: Date & Time State
  const todayStr = new Date().toISOString().split('T')[0];
  const [appointmentDate, setAppointmentDate] = useState(todayStr);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('');
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availabilityMessage, setAvailabilityMessage] = useState('');
  const [timePeriodFilter, setTimePeriodFilter] = useState<'ALL' | 'MORNING' | 'AFTERNOON' | 'EVENING'>('ALL');

  // Step 3: Patient Info & RFID State
  const [hasRfidCard, setHasRfidCard] = useState(false);
  const [cardUid, setCardUid] = useState('');
  const [rfidVerified, setRfidVerified] = useState(false);
  const [verifyingRfid, setVerifyingRfid] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [privacyAcknowledged, setPrivacyAcknowledged] = useState(false);
  const [gender, setGender] = useState<'MALE' | 'FEMALE'>('MALE');
  const [address, setAddress] = useState('Brgy. Poblacion, Sta. Cruz, Laguna');
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [appointmentType, setAppointmentType] = useState('Consultation');

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmedBooking, setConfirmedBooking] = useState<any>(null);

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

  // Load doctors from API
  useEffect(() => {
    async function loadDoctors() {
      try {
        setLoadingDoctors(true);
        const [res, settingsRes] = await Promise.all([fetch('/api/doctors'), fetch('/api/settings')]);
        const data = await res.json();
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.settings) setClinicSettings(settingsData.settings);
        if (data.success && Array.isArray(data.doctors)) {
          setDoctors(data.doctors);
          if (data.doctors.length > 0) {
            setSelectedDoctor(data.doctors[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load doctors:', err);
      } finally {
        setLoadingDoctors(false);
      }
    }
    loadDoctors();
  }, []);

  useEffect(() => {
    if (!selectedDoctor || !appointmentDate) return;
    let cancelled = false;
    async function loadAvailability() {
      try {
        setLoadingSlots(true);
        setAvailabilityMessage('');
        const res = await fetch(`/api/doctors/${encodeURIComponent(selectedDoctor!.id)}/availability?date=${encodeURIComponent(appointmentDate)}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Hindi ma-load ang available slots.');
        if (cancelled) return;
        const slots: AvailableSlot[] = Array.isArray(data.slots) ? data.slots : [];
        setAvailableSlots(slots);
        setSelectedTimeSlot((current) => slots.some((slot) => slot.label === current) ? current : (slots[0]?.label || ''));
        if (!data.configured) setAvailabilityMessage('Wala pang booking schedule ang doktor na ito.');
        else if (slots.length === 0) setAvailabilityMessage('Walang available na oras sa petsang ito. Pumili ng ibang araw.');
      } catch (error) {
        if (cancelled) return;
        setAvailableSlots([]);
        setSelectedTimeSlot('');
        setAvailabilityMessage(error instanceof Error ? error.message : 'Hindi ma-load ang available slots.');
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    loadAvailability();
    return () => { cancelled = true; };
  }, [selectedDoctor, appointmentDate]);

  const specialties = ['ALL', ...Array.from(new Set(doctors.map((d) => d.specialization)))];

  const filteredDoctors = doctors.filter((doc) => {
    if (selectedSpecialty === 'ALL') return true;
    return doc.specialization === selectedSpecialty;
  });

  // Verify RFID Card and auto-fill patient profile
  const handleVerifyRfid = async () => {
    if (!cardUid.trim()) return;
    try {
      setVerifyingRfid(true);
      setErrorMessage('');
      const res = await fetch(`/api/patients?cardUid=${encodeURIComponent(cardUid.trim().toUpperCase())}`);
      const data = await res.json();
      if (res.ok && data.success && data.patient) {
        const p = data.patient;
        setFirstName(p.firstName || p.name?.split(' ')[0] || '');
        setLastName(p.lastName || p.name?.split(' ').slice(1).join(' ') || '');
        setPhoneNumber(p.phone || '');
        if (p.dateOfBirth) setDateOfBirth(p.dateOfBirth);
        if (p.gender) setGender(p.gender.toUpperCase() === 'FEMALE' ? 'FEMALE' : 'MALE');
        if (p.address) setAddress(p.address);
        setRfidVerified(true);
      } else {
        setErrorMessage('Walang nahanap na record para sa RFID UID na ito. Maaari kang magpatuloy sa manual encoding.');
        setRfidVerified(false);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage('Hindi makakonekta sa verification server.');
    } finally {
      setVerifyingRfid(false);
    }
  };

  // Actual booking execution after user confirmation
  const executeBooking = async () => {
    if (!selectedDoctor) return;
    try {
      setIsSubmitting(true);
      setIsProcessing(true);
      setProcessingText(`Inirerehistro ang inyong appointment kay ${selectedDoctor.name}...`);
      setErrorMessage('');

      const selectedSlot = availableSlots.find((slot) => slot.label === selectedTimeSlot);
      if (!selectedSlot) throw new Error('Hindi na available ang napiling oras. Pumili ulit ng slot.');
      const combinedDate = new Date(selectedSlot.start);

      const payload = {
        doctorId: selectedDoctor.id,
        appointmentDate: combinedDate.toISOString(),
        cardUid: hasRfidCard ? cardUid.trim().toUpperCase() : null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        dateOfBirth,
        gender,
        address,
        reasonForVisit: reasonForVisit.trim() || 'General Medical Consultation',
        type: appointmentType,
        privacyAcknowledged,
        notes: `Online Outpatient Booking • Time Slot: ${selectedTimeSlot}`,
      };

      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success && data.appointment) {
        setConfirmedBooking({
          ...data.appointment,
          accountClaim: data.accountClaim,
          selectedTimeSlot,
          appointmentDateFormatted: combinedDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
        });
        setStep(4);
      } else {
        setErrorModal({
          open: true,
          title: 'Hindi Naituloy ang Pag-book',
          message: data.error || 'Hindi natapos ang pag-book. Pakisubukan muli.',
        });
        setErrorMessage(data.error || 'Hindi natapos ang pag-book. Pakisubukan muli.');
      }
    } catch (err) {
      console.error(err);
      setErrorModal({
        open: true,
        title: 'Error sa Koneksyon',
        message: 'May naganap na error sa koneksyon sa ospital server. Pakisubukan muli.',
      });
      setErrorMessage('May naganap na error sa koneksyon. Pakisubukan muli.');
    } finally {
      setIsSubmitting(false);
      setIsProcessing(false);
    }
  };

  // Submit appointment booking (Triggers Yes/No Confirmation Modal)
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor) {
      setErrorModal({
        open: true,
        title: 'Pumili ng Doktor',
        message: 'Mangyaring pumili ng Doktor para sa inyong konsultasyon bago magpatuloy.',
      });
      return;
    }
    if (!selectedTimeSlot) {
      setErrorModal({
        open: true,
        title: 'Pumili ng Available na Oras',
        message: 'Walang napiling available appointment slot.',
      });
      return;
    }
    if (!firstName.trim() || !lastName.trim() || !phoneNumber.trim() || !dateOfBirth || !privacyAcknowledged) {
      setErrorModal({
        open: true,
        title: 'Kulang na Impormasyon',
        message: 'Kumpletuhin ang required patient details at basahin at tanggapin ang privacy acknowledgement bago kumpirmahin ang appointment.',
      });
      return;
    }

    setConfirmModal({
      open: true,
      title: 'Kumpirmahin ang Inyong Appointment',
      message: `Nais mo bang i-book ang appointment para kay ${firstName.trim()} ${lastName.trim()} kay ${selectedDoctor.name} (${selectedDoctor.specialization}) sa darating na ${appointmentDate} alas-${selectedTimeSlot}?`,
      confirmText: 'Oo, I-book ang Appointment',
      cancelText: 'Bumalik at Baguhin',
      variant: 'primary',
      onConfirm: () => {
        setConfirmModal(null);
        executeBooking();
      },
    });
  };

  const slotHour = (slot: AvailableSlot) => Number(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', hour: '2-digit', hour12: false,
  }).format(new Date(slot.start)));
  const morningSlots = availableSlots.filter((slot) => slotHour(slot) < 12);
  const afternoonSlots = availableSlots.filter((slot) => slotHour(slot) >= 12 && slotHour(slot) < 18);
  const eveningSlots = availableSlots.filter((slot) => slotHour(slot) >= 18);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans antialiased">
      {/* ── HOSPITAL SYSTEM HEADER (Compact, credible, institutional) ── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-xs tracking-wider shrink-0">
              {clinicSettings.shortName}
            </div>
            <div className="leading-tight">
              <span className="font-semibold text-slate-900 text-sm tracking-tight block">
                {clinicSettings.clinicName}
              </span>
              <span className="text-xs text-slate-500 font-normal block">
                Online Clinic Appointment & RFID Hub
              </span>
            </div>
          </div>

          <div className="text-xs text-slate-500 hidden sm:flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
            <span className="font-medium text-slate-600">Outpatient Booking System</span>
          </div>
        </div>
      </header>
      {clinicSettings.emergencyNotice && (
        <div className="bg-rose-50 border-b border-rose-200 text-rose-950 px-4 py-2 text-center text-xs font-medium">
          {clinicSettings.emergencyNotice} {clinicSettings.hotline && `• Hotline: ${clinicSettings.hotline}`}
        </div>
      )}

      {/* ── 4-STEP BOOKING PROGRESS INDICATOR ── */}
      <nav aria-label="Booking Progress" className="bg-white border-b border-slate-200 py-3 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          {/* Desktop & Tablet Indicator */}
          <ol className="hidden sm:grid grid-cols-4 gap-3">
            {[
              { num: '01', label: 'Doctor', fil: 'Doktor' },
              { num: '02', label: 'Date & Time', fil: 'Petsa at Oras' },
              { num: '03', label: 'Patient & RFID', fil: 'Pasyente & RFID' },
              { num: '04', label: 'Confirmation', fil: 'Kumpirmasyon' },
            ].map((s, idx) => {
              const stepIndex = (idx + 1) as 1 | 2 | 3 | 4;
              const isCurrent = step === stepIndex;
              const isCompleted = step > stepIndex;

              return (
                <li
                  key={s.num}
                  className={`flex items-center space-x-2.5 pb-1 border-b-2 transition-colors ${
                    isCurrent
                      ? 'border-slate-900 text-slate-900 font-semibold'
                      : isCompleted
                      ? 'border-teal-700 text-teal-800'
                      : 'border-transparent text-slate-400'
                  }`}
                >
                  <span
                    className={`w-6 h-6 rounded text-xs font-semibold flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-slate-900 text-white'
                        : isCompleted
                        ? 'bg-teal-700 text-white'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : s.num}
                  </span>
                  <div className="min-w-0">
                    <span className="text-xs block leading-tight truncate font-semibold">
                      {s.fil}
                    </span>
                    <span className="text-[11px] text-slate-400 block leading-tight truncate">
                      {s.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Mobile Compact Progress Bar */}
          <div className="sm:hidden flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-[11px]">
                Hakbang {step} ng 4
              </span>
              <span className="font-semibold text-slate-900">
                {step === 1 && 'Pumili ng Doktor'}
                {step === 2 && 'Petsa at Oras'}
                {step === 3 && 'Pasyente & RFID'}
                {step === 4 && 'Kumpirmasyon'}
              </span>
            </div>

            <div className="flex items-center space-x-1.5" aria-hidden="true">
              {[1, 2, 3, 4].map((s) => (
                <span
                  key={s}
                  className={`h-1.5 rounded-full transition-all ${
                    s === step
                      ? 'w-6 bg-slate-900'
                      : s < step
                      ? 'w-2 bg-teal-700'
                      : 'w-2 bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </nav>

      {/* ── MAIN CONTENT CONTAINER ── */}
      <main className="max-w-4xl mx-auto w-full p-4 sm:p-6 flex-1">
        {errorMessage && (
          <div
            role="alert"
            className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded text-xs sm:text-sm flex items-start space-x-2"
          >
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STEP 1: SELECT DOCTOR & SPECIALTY                                   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 1 && (
          <section aria-labelledby="step1-heading" className="space-y-6">
            {/* Page Title & Clinical Description */}
            <div className="space-y-1">
              <h1 id="step1-heading" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Pumili ng Departamento at Doktor
              </h1>
              <p className="text-sm text-slate-600 leading-normal">
                Pumili ng espesyalista para sa inyong nararamdaman o nakatakdang konsultasyon.
              </p>
            </div>

            {/* Specialty Filter Segmented Control */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                I-filter ayon sa Departamento / Specialty:
              </label>

              <div className="flex flex-wrap gap-2">
                {specialties.map((spec) => {
                  const isSelected = selectedSpecialty === spec;
                  return (
                    <button
                      key={spec}
                      type="button"
                      onClick={() => setSelectedSpecialty(spec)}
                      className={`min-h-[40px] px-3.5 py-1.5 rounded text-xs font-medium border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-slate-900 border-slate-900 text-white shadow-2xs font-semibold'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                      }`}
                    >
                      {spec === 'ALL' ? 'Lahat ng Specialty' : spec}
                    </button>
                  );
                })}
              </div>

            </div>

            {/* Scannable Doctor Selection List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Mga Available na Doktor ({filteredDoctors.length})</span>
                <span>Pumili ng isa para magpatuloy</span>
              </div>

              {loadingDoctors ? (
                <div className="py-12 bg-white border border-slate-200 rounded text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-5 h-5 animate-spin text-slate-700" />
                  <span>Kinukuha ang listahan ng mga doktor mula sa database...</span>
                </div>
              ) : filteredDoctors.length === 0 ? (
                <div className="py-12 bg-white border border-slate-200 rounded text-center text-xs text-slate-500">
                  Walang doktor sa napiling specialty sa kasalukuyan.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredDoctors.map((doc) => {
                    const isSelected = selectedDoctor?.id === doc.id;

                    return (
                      <div
                        key={doc.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => setSelectedDoctor(doc)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedDoctor(doc);
                          }
                        }}
                        className={`p-4 rounded border text-left transition-colors cursor-pointer select-none ${
                          isSelected
                            ? 'bg-teal-50/40 border-teal-800 ring-1 ring-teal-800'
                            : 'bg-white border-slate-300 hover:border-slate-400 hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Left: Radio Indicator & Doctor Hierarchy */}
                          <div className="flex items-start space-x-3.5">
                            {/* Standard Restrained Radio Indicator */}
                            <div className="pt-0.5 shrink-0" aria-hidden="true">
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                                  isSelected
                                    ? 'border-teal-800 bg-teal-800'
                                    : 'border-slate-400 bg-white'
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            </div>

                            {/* Scannable Hierarchy */}
                            <div className="space-y-0.5">
                              {/* 1. Doctor Name */}
                              <h3 className="font-semibold text-slate-900 text-base leading-snug">
                                {doc.name}
                              </h3>

                              {/* 2. Specialty */}
                              <div className="text-sm font-medium text-teal-900 leading-tight">
                                {doc.specialization}
                              </div>

                              {/* 3. Consultation Room & Available Hours */}
                              <div className="text-xs text-slate-500 font-mono pt-1 flex items-center space-x-2">
                                <span>{doc.roomNumber || 'Consultation Room 101'}</span>
                                <span className="text-slate-300">•</span>
                                <span>
                                  {doc.availableFrom || '06:00 AM'} – {doc.availableTo || '10:00 PM'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Right: Selected Status Indicator */}
                          {isSelected && (
                            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-100 text-teal-900 border border-teal-200">
                              Napili
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Next Action Button (Accessible touch target, solid, no gradients) */}
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                disabled={!selectedDoctor}
                onClick={() => {
                  if (!selectedDoctor) {
                    setErrorMessage('Pumili muna ng doktor bago magpatuloy.');
                    return;
                  }
                  setErrorMessage('');
                  setStep(2);
                }}
                className="w-full sm:w-auto min-h-[46px] px-6 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm rounded shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>Susunod: Pumili ng Petsa & Oras</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STEP 2: SELECT DATE & TIME SLOT                                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 2 && (
          <section aria-labelledby="step2-heading" className="space-y-6">
            {/* Heading & Selected Context */}
            <div className="space-y-1">
              <h1 id="step2-heading" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Pagtatakda ng Petsa at Oras
              </h1>
              <p className="text-sm text-slate-600">
                Pumili ng araw at oras ng inyong pagbisita sa konsultasyon.
              </p>
            </div>

            {/* Selected Doctor Summary Header */}
            <div className="p-3.5 bg-white border border-slate-300 rounded text-xs space-y-1">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Nakatakdang Espesyalista
              </span>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <span className="font-bold text-slate-900 text-sm">
                  {selectedDoctor?.name}
                </span>
                <span className="text-slate-600 font-mono">
                  {selectedDoctor?.specialization} • {selectedDoctor?.roomNumber || 'Room 101'}
                </span>
              </div>
            </div>

            {/* Date Input Field */}
            <div className="bg-white p-4 sm:p-5 border border-slate-300 rounded space-y-4">
              <div>
                <label htmlFor="appointment-date-input" className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Petsa ng Konsultasyon (Appointment Date):
                </label>
                <div className="max-w-xs">
                  <input
                    id="appointment-date-input"
                    type="date"
                    min={todayStr}
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className="w-full h-11 px-3 bg-white border border-slate-300 rounded text-sm text-slate-900 font-medium focus:outline-none focus:ring-1 focus:ring-slate-900 focus:border-slate-900"
                  />
                </div>
              </div>

              {/* Period Filter Tabs */}
              <div className="pt-2 border-t border-slate-200">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                  Oras ng Konsultasyon (Pumili mula 06:00 AM hanggang 10:00 PM):
                </span>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {[
                    { id: 'ALL', label: 'Lahat ng Oras (6:00 AM – 10:00 PM)' },
                    { id: 'MORNING', label: 'Umaga (6:00 AM – 11:30 AM)' },
                    { id: 'AFTERNOON', label: 'Hapon (1:00 PM – 5:30 PM)' },
                    { id: 'EVENING', label: 'Gabi (6:00 PM – 10:00 PM)' },
                  ].map((tab) => {
                    const isTabActive = timePeriodFilter === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setTimePeriodFilter(tab.id as any)}
                        className={`h-9 px-3 rounded text-xs font-semibold border transition-colors cursor-pointer ${
                          isTabActive
                            ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                            : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {loadingSlots && (
                <div className="flex items-center gap-2 text-sm text-slate-600 p-3 bg-slate-50 border border-slate-200 rounded">
                  <Loader2 className="w-4 h-4 animate-spin" /> Kinukuha ang available appointment slots...
                </div>
              )}
              {!loadingSlots && availabilityMessage && (
                <div className="text-sm text-amber-900 p-3 bg-amber-50 border border-amber-200 rounded">
                  {availabilityMessage}
                </div>
              )}

              {/* Morning Slots */}
              {(timePeriodFilter === 'ALL' || timePeriodFilter === 'MORNING') && (
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                    <span>Pang-Umaga (06:00 AM – 11:30 AM)</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {morningSlots.map((slot) => {
                      const isSelected = selectedTimeSlot === slot.label;
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setSelectedTimeSlot(slot.label)}
                          className={`h-11 px-2.5 rounded border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center space-x-1.5 ${
                            isSelected
                              ? 'bg-slate-900 border-slate-900 text-white font-semibold shadow-2xs'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5 opacity-70 shrink-0" />
                          <span>{slot.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Afternoon Slots */}
              {(timePeriodFilter === 'ALL' || timePeriodFilter === 'AFTERNOON') && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                    <span>Pang-Hapon (01:00 PM – 05:30 PM)</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {afternoonSlots.map((slot) => {
                      const isSelected = selectedTimeSlot === slot.label;
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setSelectedTimeSlot(slot.label)}
                          className={`h-11 px-2.5 rounded border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center space-x-1.5 ${
                            isSelected
                              ? 'bg-slate-900 border-slate-900 text-white font-semibold shadow-2xs'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5 opacity-70 shrink-0" />
                          <span>{slot.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Evening Slots */}
              {(timePeriodFilter === 'ALL' || timePeriodFilter === 'EVENING') && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 inline-block" />
                    <span>Pang-Gabi (06:00 PM – 10:00 PM)</span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                    {eveningSlots.map((slot) => {
                      const isSelected = selectedTimeSlot === slot.label;
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          onClick={() => setSelectedTimeSlot(slot.label)}
                          className={`h-11 px-2.5 rounded border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center space-x-1.5 ${
                            isSelected
                              ? 'bg-slate-900 border-slate-900 text-white font-semibold shadow-2xs'
                              : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50 hover:border-slate-400'
                          }`}
                        >
                          <Clock className="w-3.5 h-3.5 opacity-70 shrink-0" />
                          <span>{slot.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="min-h-[44px] px-4 text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer flex items-center"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                <span>Bumalik sa Doktor</span>
              </button>

              <button
                type="button"
                onClick={() => setStep(3)}
                disabled={!selectedTimeSlot || loadingSlots}
                className="min-h-[44px] px-6 bg-slate-900 hover:bg-slate-800 text-white text-xs sm:text-sm font-semibold rounded shadow-xs transition-colors cursor-pointer flex items-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span>Susunod: Impormasyon ng Pasyente</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </button>
            </div>
          </section>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STEP 3: PATIENT INFORMATION & RFID INTEGRATION                       */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 3 && (
          <form onSubmit={handleConfirmBooking} className="space-y-6">
            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Hakbang 3: Impormasyon ng Pasyente at RFID Card
              </h1>
              <p className="text-sm text-slate-600">
                Ilagay ang inyong mga detalye at i-link ang inyong Arduino RFID card kung mayroon na.
              </p>
            </div>

            {/* RFID Card Segmented Control */}
            <div className="bg-white p-4 sm:p-5 border border-slate-300 rounded space-y-3">
              <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                Mayroon ka na bang Arduino RFID Patient Card?
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHasRfidCard(true);
                    setRfidVerified(false);
                  }}
                  className={`h-11 px-3 rounded text-xs font-semibold border transition-colors cursor-pointer flex items-center justify-center space-x-2 ${
                    hasRfidCard
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Oo, May RFID Card Ako</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setHasRfidCard(false);
                    setCardUid('');
                    setRfidVerified(false);
                  }}
                  className={`h-11 px-3 rounded text-xs font-semibold border transition-colors cursor-pointer flex items-center justify-center space-x-2 ${
                    !hasRfidCard
                      ? 'bg-slate-900 border-slate-900 text-white'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Wala Pa (Bagong Pasyente)</span>
                </button>
              </div>

              {/* Guidance for New / Uncarded Patient */}
              {!hasRfidCard && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs space-y-1">
                  <div className="flex items-center space-x-1.5 text-amber-900 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Paalala para sa Bagong Pasyente:</span>
                  </div>
                  <p className="text-amber-800 leading-relaxed text-[11px]">
                    Dahil bago ka pa lamang at wala pang RFID card, <strong>hindi mo kailangang mag-tap sa card reader</strong>. Pagdating sa ospital sa araw ng appointment, magtungo muna sa <strong>OPD Reception / Registration Desk</strong> upang opisyal na magpalista at mabigyan ng inyong <strong>Arduino RFID Patient Card</strong> bago pumasok sa pila ng doktor.
                  </p>
                </div>
              )}

              {/* RFID Input Field if Yes */}
              {hasRfidCard && (
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <label className="text-xs text-slate-600 font-medium block">
                    I-enter ang Card UID (hal. <code className="font-mono font-bold text-slate-800">A1B2C3D4</code>):
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Hal. A1B2C3D4"
                      value={cardUid}
                      onChange={(e) => setCardUid(e.target.value.toUpperCase())}
                      className="flex-1 h-10 px-3 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 uppercase focus:outline-none focus:border-slate-800"
                    />
                    <button
                      type="button"
                      disabled={verifyingRfid || !cardUid.trim()}
                      onClick={handleVerifyRfid}
                      className="min-h-[40px] text-xs bg-slate-900 hover:bg-slate-800 text-white font-medium px-4 rounded transition-colors disabled:opacity-50 cursor-pointer flex items-center justify-center"
                    >
                      {verifyingRfid ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'I-verify ang Card'}
                    </button>
                  </div>

                  {rfidVerified && (
                    <p className="text-xs text-emerald-800 font-semibold flex items-center pt-1">
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-700 shrink-0" />
                      Napatunayan: Naka-link na ang iyong RFID card sa rekord.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Patient Personal Details Form */}
            <div className="bg-white p-4 sm:p-5 border border-slate-300 rounded space-y-4">
              <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block border-b border-slate-200 pb-2">
                Personal na Impormasyon ng Pasyente
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Pangalan (First Name) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="hal. Juan"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Apelyido (Last Name) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="hal. Dela Cruz"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Contact Phone Number <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={11}
                    required
                    placeholder="09171234567"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Kaarawan (Date of Birth) <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Kasarian (Gender)
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value as any)}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                  >
                    <option value="MALE">Lalaki (Male)</option>
                    <option value="FEMALE">Babae (Female)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Tirahan (Home Address)
                </label>
                <input
                  type="text"
                  placeholder="Barangay, Bayan o Lungsod, Lalawigan"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2 border-t border-slate-200">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Uri ng Pagbisita (Visit Type)
                  </label>
                  <select
                    value={appointmentType}
                    onChange={(e) => setAppointmentType(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                  >
                    <option value="Consultation">General Consultation</option>
                    <option value="Follow-up">Follow-up Checkup</option>
                    <option value="Prenatal">Prenatal Care (Buntis)</option>
                    <option value="Routine Checkup">Routine Physical Exam</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    Dahilan ng Pagpapatingin / Sintomas <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="hal. Pananakit ng dibdib, check-up, ubo at lagnat..."
                    value={reasonForVisit}
                    onChange={(e) => setReasonForVisit(e.target.value)}
                    className="w-full h-10 px-3 bg-white border border-slate-300 rounded text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>
            </div>

            {/* Restrained Hospital Summary Notice */}
            <div className="p-3.5 bg-slate-100 border border-slate-300 rounded text-xs text-slate-700 space-y-1">
              <span className="font-semibold text-slate-900 block">Buod ng Naka-set na Appointment:</span>
              <p>
                Doktor: <strong>{selectedDoctor?.name}</strong> ({selectedDoctor?.specialization})
              </p>
              <p>
                Petsa at Oras: <strong>{appointmentDate}</strong> sa ganap na <strong>{selectedTimeSlot}</strong>
              </p>
            </div>

            <label className="flex items-start gap-3 rounded border border-slate-300 bg-white p-3 text-xs leading-5 text-slate-700">
              <input type="checkbox" checked={privacyAcknowledged} onChange={(event) => setPrivacyAcknowledged(event.target.checked)} required className="mt-1 h-4 w-4 accent-teal-800" />
              <span>Nabasa ko at tinatanggap ko na gagamitin ng klinika ang impormasyong ito para sa appointment, identity verification, treatment coordination, at kinakailangang audit trail. Maaaring bawiin ang consent para sa optional processing nang hindi binubura ang legally required clinical records.</span>
            </label>

            {/* Submit and Back Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="min-h-[44px] px-4 text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer flex items-center"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                <span>Bumalik sa Petsa</span>
              </button>

              <button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] px-6 bg-teal-800 hover:bg-teal-900 text-white text-xs sm:text-sm font-semibold rounded shadow-xs cursor-pointer flex items-center space-x-2 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                    <span>Sine-save ang Appointment...</span>
                  </>
                ) : (
                  <>
                    <CalendarCheck className="w-4 h-4 mr-1.5" />
                    <span>Kumpirmahin at I-book ang Appointment</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* STEP 4: DIGITAL APPOINTMENT CONFIRMATION SLIP                        */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {step === 4 && confirmedBooking && (
          <section aria-labelledby="step4-heading" className="max-w-2xl mx-auto space-y-6">
            {/* Confirmation Header */}
            <div className="text-center space-y-1.5 pb-2">
              <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center mx-auto mb-2">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h1 id="step4-heading" className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                Matagumpay na Naka-iskedyul ang Appointment
              </h1>
              <p className="text-xs sm:text-sm text-slate-600">
                Nakatala na ang inyong appointment sa sistema ng ospital. Pakitago ang reference slip sa ibaba.
              </p>
            </div>

            {/* Official Hospital Appointment Slip (Print-friendly, clean borders, zero gradients) */}
            <div id="printable-booking-slip" className="bg-white border border-slate-300 rounded-lg p-5 sm:p-6 shadow-xs space-y-4">
              {/* Slip Hospital Identity */}
              <div className="flex items-start justify-between border-b border-slate-200 pb-3">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm tracking-tight uppercase">
                    {clinicSettings.clinicName}
                  </h2>
                  <p className="text-xs text-slate-500">Outpatient Department (OPD) Appointment Slip</p>
                  <p className="text-[10px] text-slate-400">{clinicSettings.address} • {clinicSettings.hotline}</p>
                </div>
                <div className="text-right">
                  <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 border border-slate-300 px-2 py-1 rounded inline-block">
                    {confirmedBooking.appointmentNumber || 'APT-2026-CONF'}
                  </span>
                  <span className="text-[10px] text-teal-800 font-bold uppercase tracking-wider block mt-1">
                    STATUS: CONFIRMED
                  </span>
                </div>
              </div>

              {/* Patient and Visit Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                <div className="space-y-0.5">
                  <span className="text-slate-500 block">Pangalan ng Pasyente:</span>
                  <span className="font-semibold text-slate-900 text-sm">
                    {confirmedBooking.patientName || `${firstName} ${lastName}`}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-slate-500 block">Contact Phone Number:</span>
                  <span className="font-mono font-medium text-slate-800 text-sm">{phoneNumber}</span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-slate-500 block">Nakatakdang Doktor:</span>
                  <span className="font-semibold text-slate-900">{confirmedBooking.doctorName}</span>
                  <span className="text-slate-500 block">{confirmedBooking.doctorSpecialty}</span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-slate-500 block">Consultation Room:</span>
                  <span className="font-semibold text-slate-900">
                    {confirmedBooking.roomNumber || selectedDoctor?.roomNumber || 'Consultation Room 1'}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-slate-500 block">Petsa ng Konsultasyon:</span>
                  <span className="font-semibold text-slate-900">
                    {confirmedBooking.appointmentDateFormatted || appointmentDate}
                  </span>
                </div>

                <div className="space-y-0.5">
                  <span className="text-slate-500 block">Oras ng Konsultasyon:</span>
                  <span className="font-bold text-slate-900 font-mono text-sm">
                    {confirmedBooking.selectedTimeSlot || selectedTimeSlot}
                  </span>
                </div>
              </div>

              {/* Instructions for Clinic Arrival */}
              {confirmedBooking.accountClaim?.required && (
                <div className="p-4 bg-cyan-50 border border-cyan-200 rounded text-sm space-y-2">
                  <span className="font-bold text-cyan-950 block">I-save ang Patient Account Claim Code</span>
                  <p className="text-cyan-900 text-xs leading-relaxed">Gamitin ito kasama ng Appointment ID sa mobile app para gumawa ng secure patient login at ma-manage ang booking. Isang beses lamang magagamit at valid nang 14 araw.</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div><span className="block text-[10px] font-bold uppercase text-cyan-800">Appointment ID</span><code className="break-all text-xs text-slate-950">{confirmedBooking.accountClaim.appointmentId}</code></div>
                    <div><span className="block text-[10px] font-bold uppercase text-cyan-800">Claim code</span><code className="break-all text-xs text-slate-950">{confirmedBooking.accountClaim.claimCode}</code></div>
                  </div>
                </div>
              )}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs space-y-1.5">
                <span className="font-bold text-slate-800 block">
                  Mga Hakbang at Tagubilin sa Pagdating sa Ospital:
                </span>
                
                {confirmedBooking.cardUid && confirmedBooking.cardUid !== 'NO_CARD' ? (
                  <div className="space-y-1">
                    <p className="text-slate-700 leading-relaxed">
                      &bull; <strong>May RFID Card Ka Na:</strong> Pagdating sa ospital sa araw ng inyong konsultasyon, i-tap agad ang inyong RFID Card (<span className="font-mono font-bold text-slate-900">{confirmedBooking.cardUid}</span>) sa scanner ng <strong>Triage / OPD Counter</strong> para sa agarang check-in sa pila.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1 text-slate-700">
                    <p className="leading-relaxed">
                      &bull; <strong className="text-amber-900">Hakbang 1 (Magpalista Muna):</strong> Dahil wala ka pang RFID Card, <u>huwag mag-tap sa scanner</u>. Magtungo muna sa <strong>OPD Reception / Registration Desk</strong> dala ang Appointment Code na ito upang magpalista sa database at tanggapin ang inyong opisyal na <strong>Arduino RFID Patient Card</strong>.
                    </p>
                    <p className="leading-relaxed">
                      &bull; <strong className="text-slate-900">Hakbang 2 (Check-in sa Pila):</strong> Matapos mai-isyu ang inyong RFID Card, i-tap ito sa counter upang makakuha ng opisyal na Queue Ticket para sa Vital Signs screening at konsultasyon kay <strong>{confirmedBooking.doctorName}</strong>.
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="w-full sm:w-auto min-h-[44px] px-4 text-xs font-semibold border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer flex items-center justify-center"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                <span>I-print ang Confirmation Slip</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmedBooking(null);
                  setStep(1);
                }}
                className="w-full sm:w-auto min-h-[44px] px-5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded shadow-xs transition-colors cursor-pointer flex items-center justify-center"
              >
                <span>Mag-book ng Panibagong Appointment</span>
              </button>
            </div>
          </section>
        )}
      </main>

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
                <p className="text-xs text-rose-100 mt-0.5">Online Appointment Validation</p>
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
                Huwag isara ang inyong browser
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
              <div className="w-12 h-12 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center mb-4">
                <CalendarCheck className="w-6 h-6 text-teal-700" />
              </div>
              <h3 className="font-bold text-lg text-slate-900 leading-snug">{confirmModal.title}</h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{confirmModal.message}</p>
              <div className="mt-6 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-sm transition-colors cursor-pointer"
                >
                  {confirmModal.cancelText || 'Bumalik'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const action = confirmModal.onConfirm;
                    action();
                  }}
                  className="px-5 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-semibold text-sm transition-colors cursor-pointer shadow-sm"
                >
                  {confirmModal.confirmText || 'Oo, Kumpirmahin'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
