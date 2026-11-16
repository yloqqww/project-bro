import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Platform, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import NetInfo from '@react-native-community/netinfo';
import * as Notifications from 'expo-notifications';

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');
const SESSION_KEY = 'lmc.patient.mobile.session.v1';
const CACHE_KEY = 'lmc.patient.mobile.cache.v1';

type AuthMode = 'login' | 'activation-request' | 'activate' | 'forgot' | 'reset' | 'claim';
type Tab = 'queue' | 'appointments' | 'records' | 'profile';
type Profile = { id: string; email: string; firstName: string; middleName?: string | null; lastName: string; dateOfBirth: string; gender: string; bloodType: string; phoneNumber: string; address: string; city: string; state: string; zipCode: string; emergencyContactName: string; emergencyContactPhone: string; emergencyContactRelation: string; cardUid: string | null };
type Queue = { id: string; ticketNumber: string; department: string; doctor: string; room: string; status: string; position: number; peopleAhead: number; estimatedWaitMinutes: number; averageConsultationMinutes: number; issuedAt: string; recallCount?: number; lastRecalledAt?: string | null };
type Appointment = { id: string; appointmentDate: string; duration: number; status: string; reasonForVisit: string; notes?: string | null; cancellationReason?: string | null; patientConfirmedAt?: string | null; changePolicy?: { allowed: boolean; noticeHours: number; code: string }; doctor: { id: string; name: string; specialization: string; roomNumber?: string | null } };
type Doctor = { id: string; name: string; specialization: string };
type Slot = { start: string; end: string; label: string };
type WaitlistEntry = { id: string; requestedDate: string; status: string; offeredSlot?: string | null; offerExpiresAt?: string | null; doctor: { firstName: string; lastName: string; specialization: string } };
type RecordAttachment = { id: string; fileName: string; mimeType: string; fileSize: number; createdAt: string };
type MedicalRecord = { id: string; visitDate: string; chiefComplaint: string; diagnosis: string; plan: string; doctorName: string; attachments?: RecordAttachment[] };
type Prescription = { id: string; medicationName: string; dosage: string; frequency: string; duration: string; instructions?: string | null; prescribedDate: string; doctorName: string };
type CachedData = { profile: Profile; queue: Queue | null; upcoming: Appointment[]; history: Appointment[]; records: MedicalRecord[]; prescriptions: Prescription[]; cachedAt: string };

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }) });

class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function api<T>(path: string, options: RequestInit = {}, token?: string | null): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_BASE_URL}${path}`, { ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body.success === false) throw new ApiError(body.error || 'Request failed.', response.status);
    return body as T;
  } finally { clearTimeout(timer); }
}

export default function PatientApp() {
  const params = useLocalSearchParams<{ mode?: string; token?: string }>();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [online, setOnline] = useState(true);
  const [offlineCache, setOfflineCache] = useState(false);
  const [globalError, setGlobalError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [callBanner, setCallBanner] = useState<string | null>(null);
  const lastCalledKeyRef = useRef<string | null>(null);
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [tab, setTab] = useState<Tab>('queue');
  const [authMode, setAuthMode] = useState<AuthMode>(params.mode === 'activate' ? 'activate' : params.mode === 'reset' ? 'reset' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tokenInput, setTokenInput] = useState(params.token || '');
  const [birthDate, setBirthDate] = useState('');
  const [phoneLast4, setPhoneLast4] = useState('');
  const [claimAppointmentId, setClaimAppointmentId] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState<Profile | null>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [doctorId, setDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState('');
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [reason, setReason] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [cancellingAppointment, setCancellingAppointment] = useState<Appointment | null>(null);
  const [attachmentBusyId, setAttachmentBusyId] = useState<string | null>(null);
  const [previewAttachment, setPreviewAttachment] = useState<{ id: string; fileName: string; mimeType: string; fileSize: number; dataUrl: string } | null>(null);
  const [bookingBusy, setBookingBusy] = useState(false);

  const saveCache = useCallback(async (data: CachedData) => {
    const encryptedCache = { ...data, upcoming: data.upcoming.slice(0, 10), history: data.history.slice(0, 10), records: [], prescriptions: [] };
    await SecureStore.setItemAsync(CACHE_KEY, JSON.stringify(encryptedCache), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }).catch(() => undefined);
  }, []);
  const applyData = useCallback((data: CachedData) => { setProfile(data.profile); setProfileDraft(data.profile); setQueue(data.queue); setUpcoming(data.upcoming); setHistory(data.history); setRecords(data.records || []); setPrescriptions(data.prescriptions || []); }, []);

  const configureReminders = useCallback(async (items: Appointment[], token: string) => {
    try {
      const permission = await Notifications.requestPermissionsAsync();
      if (permission.status !== 'granted') return;
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const item of items) {
        const appointmentTime = new Date(item.appointmentDate).getTime();
        const dayBefore = appointmentTime - 24 * 60 * 60 * 1000;
        const hourBefore = appointmentTime - 60 * 60 * 1000;
        const reminder = new Date(dayBefore > Date.now() ? dayBefore : hourBefore);
        if (reminder > new Date()) await Notifications.scheduleNotificationAsync({ content: { title: 'Appointment reminder', body: `${item.doctor.name} on ${new Date(item.appointmentDate).toLocaleString()}`, data: { appointmentId: item.id } }, trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder } });
      }
      const push = await Notifications.getExpoPushTokenAsync().catch(() => null);
      if (push?.data) await api('/api/mobile/push-token', { method: 'POST', body: JSON.stringify({ expoPushToken: push.data, platform: Platform.OS, deviceName: `${Platform.OS} patient app` }) }, token).catch(() => undefined);
    } catch { /* Local reminders are optional when device services are unavailable. */ }
  }, []);

  const loadAll = useCallback(async (token: string, quiet = false) => {
    if (!quiet) setRefreshing(true);
    setGlobalError('');
    try {
      const [profileBody, queueBody, appointmentBody, recordBody, waitlistBody] = await Promise.all([
        api<{ profile: Profile }>('/api/mobile/profile', {}, token),
        api<{ queue: Queue | null }>('/api/mobile/queue', {}, token),
        api<{ upcoming: Appointment[]; history: Appointment[] }>('/api/mobile/appointments', {}, token),
        api<{ records: MedicalRecord[]; prescriptions: Prescription[] }>('/api/mobile/records', {}, token),
        api<{ entries: WaitlistEntry[] }>('/api/mobile/waitlist', {}, token),
      ]);
      setWaitlist(waitlistBody.entries || []);
      const data: CachedData = { profile: profileBody.profile, queue: queueBody.queue, upcoming: appointmentBody.upcoming, history: appointmentBody.history, records: recordBody.records, prescriptions: recordBody.prescriptions, cachedAt: new Date().toISOString() };
      applyData(data); setOfflineCache(false); await saveCache(data); void configureReminders(data.upcoming, token);

      const liveQ = queueBody.queue;
      if (liveQ && liveQ.status === 'CALLED') {
        const callKey = `${liveQ.id}:${liveQ.recallCount || 0}`;
        const isRecall = Number(liveQ.recallCount || 0) > 0;
        const msg = isRecall
          ? `TINATAWAG PO KAYO ULIT (${liveQ.ticketNumber})! Pumasok na sa ${liveQ.room} kay ${liveQ.doctor}.`
          : `TINAWAG NA PO KAYO (${liveQ.ticketNumber})! Pumasok na sa ${liveQ.room} kay ${liveQ.doctor}.`;
        setCallBanner(msg);
        if (lastCalledKeyRef.current !== callKey) {
          lastCalledKeyRef.current = callKey;
          void Notifications.getPermissionsAsync()
            .then((perm) => {
              if (perm.status === 'granted') {
                return Notifications.scheduleNotificationAsync({
                  content: {
                    title: isRecall ? 'Tinatawag po kayo ulit!' : 'Tinawag na po kayo!',
                    body: `Ticket ${liveQ.ticketNumber} • Pumasok na sa ${liveQ.room} kay ${liveQ.doctor}.`,
                    sound: 'default',
                    data: { queueTicketId: liveQ.id },
                  },
                  trigger: null,
                });
              }
            })
            .catch(() => undefined);
        }
      } else {
        setCallBanner(null);
        if (!liveQ || liveQ.status !== 'CALLED') {
          lastCalledKeyRef.current = null;
        }
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        await Promise.all([SecureStore.deleteItemAsync(SESSION_KEY), SecureStore.deleteItemAsync(CACHE_KEY)]);
        setSessionToken(null); setProfile(null); setGlobalError('Your session expired. Please sign in again.');
        return;
      }
      const cached = await SecureStore.getItemAsync(CACHE_KEY);
      if (cached) { applyData(JSON.parse(cached)); setOfflineCache(true); setGlobalError('Offline: showing the most recently saved information.'); }
      else throw error;
    } finally { setRefreshing(false); }
  }, [applyData, configureReminders, saveCache]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setOnline(Boolean(state.isConnected && state.isInternetReachable !== false)));
    void (async () => {
      const saved = await SecureStore.getItemAsync(SESSION_KEY);
      if (saved) {
        setSessionToken(saved);
        try { await loadAll(saved); } catch { await SecureStore.deleteItemAsync(SESSION_KEY); setSessionToken(null); }
      }
      setRestoring(false);
    })();
    return unsubscribe;
  }, [loadAll]);

  useEffect(() => {
    if (!sessionToken || !online || tab !== 'queue') return;
    const timer = setInterval(() => { void loadAll(sessionToken, true); }, 10000);
    return () => clearInterval(timer);
  }, [loadAll, online, sessionToken, tab]);

  const submitAuth = async () => {
    setAuthBusy(true); setAuthMessage('');
    try {
      if (authMode === 'login') {
        const body = await api<{ token: string }>('/api/mobile/auth/login', { method: 'POST', body: JSON.stringify({ email, password, expectedRole: 'PATIENT', deviceName: `${Platform.OS} patient app` }) });
        await SecureStore.setItemAsync(SESSION_KEY, body.token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
        setSessionToken(body.token); setPassword(''); await loadAll(body.token);
      } else if (authMode === 'activation-request') {
        const body = await api<{ message: string; developmentToken?: string }>('/api/mobile/auth/request-activation', { method: 'POST', body: JSON.stringify({ email, dateOfBirth: birthDate, phoneLast4 }) });
        if (body.developmentToken) setTokenInput(body.developmentToken);
        setAuthMessage(body.message); setAuthMode('activate');
      } else if (authMode === 'forgot') {
        const body = await api<{ message: string; developmentToken?: string }>('/api/mobile/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
        if (body.developmentToken) setTokenInput(body.developmentToken);
        setAuthMessage(body.message); setAuthMode('reset');
      } else if (authMode === 'claim') {
        const body = await api<{ message: string }>('/api/mobile/auth/claim-booking', { method: 'POST', body: JSON.stringify({ appointmentId: claimAppointmentId, claimCode: tokenInput, email, password, dateOfBirth: birthDate, phoneLast4 }) });
        setAuthMessage(body.message); setPassword(''); setTokenInput(''); setClaimAppointmentId(''); setAuthMode('login');
      } else {
        const path = authMode === 'activate' ? '/api/mobile/auth/activate' : '/api/mobile/auth/reset-password';
        const body = await api<{ message: string }>(path, { method: 'POST', body: JSON.stringify({ token: tokenInput, password }) });
        setAuthMessage(body.message); setPassword(''); setTokenInput(''); setAuthMode('login');
      }
    } catch (error) { setAuthMessage(error instanceof Error ? error.message : 'Request failed.'); }
    finally { setAuthBusy(false); }
  };

  const logout = async () => {
    if (sessionToken) await api('/api/mobile/auth/logout', { method: 'POST' }, sessionToken).catch(() => undefined);
    await Promise.all([SecureStore.deleteItemAsync(SESSION_KEY), SecureStore.deleteItemAsync(CACHE_KEY)]); setSessionToken(null); setProfile(null); setQueue(null); setUpcoming([]); setHistory([]); setWaitlist([]); setRecords([]); setPrescriptions([]); setAuthMode('login');
  };

  const loadDoctors = async (preferredDoctorId?: string) => {
    const body = await api<{ doctors: any[] }>('/api/doctors');
    const list = body.doctors.map((item) => ({ id: item.id, name: item.name || `Dr. ${item.firstName || ''} ${item.lastName || ''}`.trim(), specialization: item.specialization || 'General Medicine' }));
    setDoctors(list); setDoctorId(preferredDoctorId || doctorId || list[0]?.id || '');
  };

  const loadSlots = async () => {
    if (!doctorId || !bookingDate) return;
    setBookingBusy(true);
    try { const body = await api<{ slots: Slot[] }>(`/api/doctors/${doctorId}/availability?date=${encodeURIComponent(bookingDate)}`); setSlots(body.slots || []); setSelectedSlot(''); }
    catch (error) { setGlobalError(error instanceof Error ? error.message : 'Unable to load schedules.'); setSlots([]); }
    finally { setBookingBusy(false); }
  };

  const openBooking = async (appointment?: Appointment) => {
    setBookingOpen(true); setRescheduleId(appointment?.id || null); setDoctorId(appointment?.doctor.id || ''); setBookingDate(''); setSlots([]); setSelectedSlot(''); setReason(appointment?.reasonForVisit || ''); setChangeReason('');
    await loadDoctors(appointment?.doctor.id).catch((error) => setGlobalError(error instanceof Error ? error.message : 'Unable to load doctors.'));
  };

  const submitBooking = async () => {
    const submittedReason = rescheduleId ? changeReason.trim() : reason.trim();
    if (!sessionToken || !selectedSlot || submittedReason.length < 3) return;
    setBookingBusy(true);
    try {
      if (rescheduleId) await api('/api/mobile/appointments', { method: 'PATCH', body: JSON.stringify({ action: 'RESCHEDULE', appointmentId: rescheduleId, appointmentDate: selectedSlot, reason: submittedReason }) }, sessionToken);
      else await api('/api/mobile/appointments', { method: 'POST', body: JSON.stringify({ doctorId, appointmentDate: selectedSlot, reasonForVisit: reason }) }, sessionToken);
      setBookingOpen(false); await loadAll(sessionToken);
    } catch (error) { setGlobalError(error instanceof Error ? error.message : 'Appointment request failed.'); }
    finally { setBookingBusy(false); }
  };

  const cancelAppointment = (appointment: Appointment) => { setCancellingAppointment(appointment); setChangeReason(''); };

  const submitCancellation = async () => {
    if (!sessionToken || !cancellingAppointment || changeReason.trim().length < 3) return;
    setBookingBusy(true);
    try {
      await api('/api/mobile/appointments', { method: 'PATCH', body: JSON.stringify({ action: 'CANCEL', appointmentId: cancellingAppointment.id, reason: changeReason.trim() }) }, sessionToken);
      setCancellingAppointment(null); setChangeReason(''); await loadAll(sessionToken);
    } catch (error) { setGlobalError(error instanceof Error ? error.message : 'Cancellation failed.'); }
    finally { setBookingBusy(false); }
  };

  const confirmAppointment = async (appointment: Appointment) => { if (!sessionToken) return; try { await api('/api/mobile/appointments', { method: 'PATCH', body: JSON.stringify({ action: 'CONFIRM', appointmentId: appointment.id }) }, sessionToken); await loadAll(sessionToken); } catch (error) { setGlobalError(error instanceof Error ? error.message : 'Confirmation failed.'); } };

  const joinWaitlist = async () => { if (!sessionToken || !doctorId || !bookingDate || reason.trim().length < 3) return; try { await api('/api/mobile/waitlist', { method: 'POST', body: JSON.stringify({ doctorId, requestedDate: bookingDate, reasonForVisit: reason }) }, sessionToken); setBookingOpen(false); Alert.alert('Waitlist joined', 'The clinic will offer a released slot to you for a limited time.'); } catch (error) { setGlobalError(error instanceof Error ? error.message : 'Unable to join waitlist.'); } };

  const changeWaitlist = async (entry: WaitlistEntry, action: 'ACCEPT' | 'CANCEL') => { if (!sessionToken) return; try { await api('/api/mobile/waitlist', { method: 'PATCH', body: JSON.stringify({ action, waitlistId: entry.id }) }, sessionToken); await loadAll(sessionToken); } catch (error) { setGlobalError(error instanceof Error ? error.message : 'Waitlist update failed.'); } };

  const saveProfile = async () => {
    if (!sessionToken || !profileDraft) return;
    setRefreshing(true);
    try { await api('/api/mobile/profile', { method: 'PATCH', body: JSON.stringify(profileDraft) }, sessionToken); setEditingProfile(false); await loadAll(sessionToken); }
    catch (error) { setGlobalError(error instanceof Error ? error.message : 'Profile update failed.'); }
    finally { setRefreshing(false); }
  };

  const openAttachment = async (att: RecordAttachment, forceDownload = false) => {
    if (!sessionToken) return;
    if (!online) {
      Alert.alert('Offline Mode', 'Connect to the internet to view or download clinical attachments.');
      return;
    }
    setAttachmentBusyId(att.id);
    try {
      if (att.mimeType.startsWith('image/') && !forceDownload) {
        const res = await api<{ success: true; id: string; fileName: string; mimeType: string; fileSize: number; dataUrl: string }>(
          `/api/mobile/records/attachments/${encodeURIComponent(att.id)}?format=data-url`,
          {},
          sessionToken
        );
        setPreviewAttachment({
          id: res.id,
          fileName: res.fileName,
          mimeType: res.mimeType,
          fileSize: res.fileSize,
          dataUrl: res.dataUrl,
        });
        return;
      }

      const signed = await api<{ success: true; downloadPath: string }>(
        `/api/mobile/records/attachments/${encodeURIComponent(att.id)}`,
        { method: 'POST' },
        sessionToken
      );
      const url = `${API_BASE_URL}${signed.downloadPath}${forceDownload ? '&download=1' : ''}`;
      await Linking.openURL(url);
    } catch (error) {
      setGlobalError(error instanceof Error ? error.message : 'Failed to open attachment.');
    } finally {
      setAttachmentBusyId(null);
    }
  };

  const fullName = useMemo(() => profile ? `${profile.firstName} ${profile.lastName}` : '', [profile]);

  if (restoring) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#0f766e" /><Text style={styles.muted}>Restoring secure session...</Text></SafeAreaView>;

  if (!sessionToken || !profile) return <SafeAreaView style={styles.screen}><ScrollView contentContainerStyle={styles.authWrap} keyboardShouldPersistTaps="handled"><View style={styles.logo}><Text style={styles.logoText}>LMC</Text></View><Text style={styles.title}>Patient Mobile</Text><Text style={styles.subtitle}>{authMode === 'login' ? 'Secure access to appointments and live queue status' : authMode === 'claim' ? 'Claim the account created with your online booking' : authMode.includes('activation') || authMode === 'activate' ? 'Activate your patient account' : 'Reset your patient password'}</Text>{authMessage ? <View style={styles.notice}><Text style={styles.noticeText}>{authMessage}</Text></View> : null}<View style={styles.card}>{['login','activation-request','forgot','claim'].includes(authMode) && <Field label={authMode === 'claim' ? 'Your email' : 'Registered email'} value={email} onChangeText={setEmail} keyboardType="email-address" />}{['activation-request','claim'].includes(authMode) && <><Field label="Date of birth (YYYY-MM-DD)" value={birthDate} onChangeText={setBirthDate} /><Field label="Last 4 phone digits" value={phoneLast4} onChangeText={setPhoneLast4} keyboardType="number-pad" /></>}{authMode === 'claim' && <><Field label="Appointment ID" value={claimAppointmentId} onChangeText={setClaimAppointmentId} autoCapitalize="none" /><Field label="Booking claim code" value={tokenInput} onChangeText={setTokenInput} autoCapitalize="none" /></>}{['activate','reset'].includes(authMode) && <Field label="One-time token" value={tokenInput} onChangeText={setTokenInput} autoCapitalize="none" />}{['login','activate','reset','claim'].includes(authMode) && <Field label={authMode === 'login' ? 'Password' : 'New password'} value={password} onChangeText={setPassword} secureTextEntry />}
  <TouchableOpacity style={styles.primary} onPress={submitAuth} disabled={authBusy}>{authBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{authMode === 'login' ? 'Sign in' : authMode === 'activation-request' ? 'Send activation' : authMode === 'forgot' ? 'Send reset link' : authMode === 'activate' ? 'Activate account' : authMode === 'claim' ? 'Claim booking account' : 'Reset password'}</Text>}</TouchableOpacity>
  <View style={styles.authLinks}>{authMode === 'login' ? <><TouchableOpacity onPress={() => { setAuthMode('activation-request'); setAuthMessage(''); }}><Text style={styles.link}>Activate account</Text></TouchableOpacity><TouchableOpacity onPress={() => { setAuthMode('claim'); setAuthMessage(''); }}><Text style={styles.link}>Claim online booking</Text></TouchableOpacity><TouchableOpacity onPress={() => { setAuthMode('forgot'); setAuthMessage(''); }}><Text style={styles.link}>Forgot password?</Text></TouchableOpacity></> : <TouchableOpacity onPress={() => { setAuthMode('login'); setAuthMessage(''); }}><Text style={styles.link}>Back to sign in</Text></TouchableOpacity>}</View></View></ScrollView></SafeAreaView>;

  return <SafeAreaView style={styles.screen}><View style={styles.header}><View><Text style={styles.headerTitle}>{fullName}</Text><Text style={styles.headerSub}>{online ? offlineCache ? 'Cached data' : 'Connected' : 'Offline'} · {profile.cardUid || 'No RFID card'}</Text></View><TouchableOpacity onPress={logout} accessibilityLabel="Sign out"><Ionicons name="log-out-outline" size={24} color="#475569" /></TouchableOpacity></View>
    {!online || offlineCache ? <View style={styles.offline}><Ionicons name="cloud-offline-outline" size={16} color="#92400e" /><Text style={styles.offlineText}>{globalError || 'Offline mode. Changes require a connection.'}</Text></View> : globalError ? <View style={styles.error}><Text style={styles.errorText}>{globalError}</Text><TouchableOpacity onPress={() => setGlobalError('')}><Ionicons name="close" size={18} color="#991b1b" /></TouchableOpacity></View> : null}
    <View style={styles.tabs}>{(['queue','appointments','records','profile'] as Tab[]).map((item) => <TouchableOpacity key={item} style={[styles.tab, tab === item && styles.tabActive]} onPress={() => setTab(item)}><Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item === 'queue' ? 'Queue' : item === 'appointments' ? 'Visits' : item === 'records' ? 'Records' : 'Profile'}</Text></TouchableOpacity>)}</View>
    <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => sessionToken && loadAll(sessionToken)} enabled={online} />}>
      {tab === 'queue' && (queue ? <View style={styles.card}>{callBanner ? <View style={styles.notice}><Text style={styles.noticeText}>{callBanner}</Text></View> : null}<Text style={styles.eyebrow}>{queue.department}</Text><Text style={styles.ticket}>{queue.ticketNumber}</Text><StatusPill status={queue.status} /><View style={styles.metrics}><Metric label="Position" value={queue.position ? `#${queue.position}` : '—'} /><Metric label="Ahead" value={String(queue.peopleAhead)} /><Metric label="Est. wait" value={`${queue.estimatedWaitMinutes} min`} /></View><Text style={styles.body}>{queue.doctor} · {queue.room}</Text><Text style={styles.caption}>Estimate uses this doctor’s recent consultation average ({queue.averageConsultationMinutes} min). Refreshes every 10 seconds while online.</Text></View> : <Empty icon="time-outline" title="No active queue ticket" text="Your live position will appear after clinic check-in." />)}
      {tab === 'appointments' && <><TouchableOpacity style={styles.primary} onPress={() => openBooking()} disabled={!online}><Text style={styles.primaryText}>Book appointment</Text></TouchableOpacity>{bookingOpen && <View style={styles.card}><Text style={styles.sectionTitle}>{rescheduleId ? 'Choose a new schedule' : 'New appointment'}</Text><Text style={styles.label}>Doctor</Text><View style={styles.choiceWrap}>{doctors.map((doctor) => <TouchableOpacity key={doctor.id} style={[styles.choice, doctorId === doctor.id && styles.choiceActive]} onPress={() => { setDoctorId(doctor.id); setSlots([]); }}><Text style={styles.choiceText}>{doctor.name} · {doctor.specialization}</Text></TouchableOpacity>)}</View><Field label="Date (YYYY-MM-DD)" value={bookingDate} onChangeText={setBookingDate} />{rescheduleId ? <><Text style={styles.caption}>Original visit reason: {reason}</Text><Field label="Reason for rescheduling" value={changeReason} onChangeText={setChangeReason} /></> : <Field label="Reason for visit" value={reason} onChangeText={setReason} />}<TouchableOpacity style={styles.secondary} onPress={loadSlots} disabled={bookingBusy}><Text style={styles.secondaryText}>Load available times</Text></TouchableOpacity><View style={styles.choiceWrap}>{slots.map((slot) => <TouchableOpacity key={slot.start} style={[styles.choice, selectedSlot === slot.start && styles.choiceActive]} onPress={() => setSelectedSlot(slot.start)}><Text style={styles.choiceText}>{slot.label}</Text></TouchableOpacity>)}</View>{!rescheduleId && bookingDate && !slots.length ? <TouchableOpacity style={styles.secondary} onPress={joinWaitlist} disabled={reason.trim().length < 3}><Text style={styles.secondaryText}>Join waitlist for this date</Text></TouchableOpacity> : null}<View style={styles.row}><TouchableOpacity style={styles.secondary} onPress={() => setBookingOpen(false)}><Text style={styles.secondaryText}>Close</Text></TouchableOpacity><TouchableOpacity style={styles.primarySmall} onPress={submitBooking} disabled={!selectedSlot || bookingBusy || (rescheduleId ? changeReason : reason).trim().length < 3}><Text style={styles.primaryText}>Confirm</Text></TouchableOpacity></View></View>}
        {cancellingAppointment ? <View style={styles.card}><Text style={styles.sectionTitle}>Cancel appointment</Text><Text style={styles.body}>{cancellingAppointment.doctor.name} on {new Date(cancellingAppointment.appointmentDate).toLocaleString()}</Text><Text style={styles.caption}>This reason will be saved in your appointment history. The clinic cancellation policy still applies.</Text><Field label="Reason for cancellation" value={changeReason} onChangeText={setChangeReason} /><View style={styles.row}><TouchableOpacity style={styles.secondary} onPress={() => { setCancellingAppointment(null); setChangeReason(''); }} disabled={bookingBusy}><Text style={styles.secondaryText}>Keep appointment</Text></TouchableOpacity><TouchableOpacity style={styles.danger} onPress={submitCancellation} disabled={bookingBusy || changeReason.trim().length < 3}><Text style={styles.dangerText}>Confirm cancellation</Text></TouchableOpacity></View></View> : null}
        {waitlist.some((entry) => ['WAITING','OFFERED'].includes(entry.status)) ? <><Text style={styles.sectionTitle}>Waitlist</Text>{waitlist.filter((entry) => ['WAITING','OFFERED'].includes(entry.status)).map((entry) => <View key={entry.id} style={styles.card}><Text style={styles.sectionTitle}>Dr. {entry.doctor.firstName} {entry.doctor.lastName}</Text><Text style={styles.caption}>{entry.doctor.specialization} · requested {new Date(entry.requestedDate).toLocaleDateString()}</Text><StatusPill status={entry.status} />{entry.offeredSlot ? <Text style={styles.body}>Offered slot: {new Date(entry.offeredSlot).toLocaleString()}</Text> : null}<View style={styles.row}>{entry.status === 'OFFERED' ? <TouchableOpacity style={styles.primarySmall} onPress={() => changeWaitlist(entry, 'ACCEPT')}><Text style={styles.primaryText}>Accept offer</Text></TouchableOpacity> : null}<TouchableOpacity style={styles.danger} onPress={() => changeWaitlist(entry, 'CANCEL')}><Text style={styles.dangerText}>Leave waitlist</Text></TouchableOpacity></View></View>)}</> : null}
        <Text style={styles.sectionTitle}>Upcoming</Text>{upcoming.length ? upcoming.map((item) => <AppointmentCard key={item.id} item={item} actions={<><View style={styles.row}>{!item.patientConfirmedAt ? <TouchableOpacity style={styles.primarySmall} onPress={() => confirmAppointment(item)} disabled={!online}><Text style={styles.primaryText}>Confirm attendance</Text></TouchableOpacity> : null}</View><View style={styles.row}><TouchableOpacity style={styles.secondary} onPress={() => openBooking(item)} disabled={!online || item.changePolicy?.allowed === false}><Text style={styles.secondaryText}>Reschedule</Text></TouchableOpacity><TouchableOpacity style={styles.danger} onPress={() => cancelAppointment(item)} disabled={!online || item.changePolicy?.allowed === false}><Text style={styles.dangerText}>Cancel</Text></TouchableOpacity></View>{item.changePolicy?.allowed === false ? <Text style={styles.caption}>Online changes close {item.changePolicy.noticeHours} hours before the visit. Contact the clinic.</Text> : null}</>} />) : <Empty icon="calendar-outline" title="No upcoming appointments" text="Book an available clinic schedule above." />}
        <Text style={styles.sectionTitle}>History</Text>{history.length ? history.map((item) => <AppointmentCard key={item.id} item={item} />) : <Text style={styles.muted}>No appointment history yet.</Text>}</>}
      {tab === 'records' && <><Text style={styles.sectionTitle}>Active prescriptions</Text>{prescriptions.length ? prescriptions.map((item) => <View key={item.id} style={styles.card}><Text style={styles.sectionTitle}>{item.medicationName} · {item.dosage}</Text><Text style={styles.body}>{item.frequency} for {item.duration}</Text><Text style={styles.caption}>{item.doctorName} · {new Date(item.prescribedDate).toLocaleDateString()}</Text>{item.instructions ? <Text style={styles.muted}>{item.instructions}</Text> : null}</View>) : <Empty icon="medical-outline" title="No active prescriptions" text="Electronically signed prescriptions will appear here." />}<Text style={styles.sectionTitle}>Medical history</Text>{records.length ? records.map((item) => <View key={item.id} style={styles.card}><Text style={styles.sectionTitle}>{item.diagnosis}</Text><Text style={styles.caption}>{item.doctorName} · {new Date(item.visitDate).toLocaleDateString()}</Text><Text style={styles.body}>{item.chiefComplaint}</Text><Text style={styles.muted}>{item.plan}</Text>{item.attachments && item.attachments.length > 0 ? <View style={styles.attachmentSection}><Text style={styles.label}>Clinical Attachments ({item.attachments.length})</Text>{item.attachments.map((att) => <View key={att.id} style={styles.attachmentRow}><View style={styles.attachmentInfo}><Ionicons name={att.mimeType.startsWith('image/') ? 'image-outline' : 'document-text-outline'} size={18} color="#0f766e" /><View style={{ flex: 1 }}><Text style={styles.attachmentName} numberOfLines={1}>{att.fileName}</Text><Text style={styles.caption}>{att.mimeType === 'application/pdf' ? 'PDF' : att.mimeType.replace('image/', '').toUpperCase()} · {Math.max(1, Math.ceil(att.fileSize / 1024))} KB</Text></View></View><View style={styles.attachmentActions}><TouchableOpacity style={styles.attachmentBtn} onPress={() => openAttachment(att, false)} disabled={attachmentBusyId === att.id}><Text style={styles.attachmentBtnText}>{attachmentBusyId === att.id ? '...' : att.mimeType.startsWith('image/') ? 'View' : 'Open'}</Text></TouchableOpacity><TouchableOpacity style={styles.attachmentBtnSecondary} onPress={() => openAttachment(att, true)} disabled={attachmentBusyId === att.id}><Ionicons name="download-outline" size={14} color="#334155" /></TouchableOpacity></View></View>)}</View> : null}</View>) : <Text style={styles.muted}>No finalized medical history yet.</Text>}</>}
      {tab === 'profile' && profileDraft && <View style={styles.card}><View style={styles.between}><Text style={styles.sectionTitle}>Contact profile</Text><TouchableOpacity onPress={() => setEditingProfile((value) => !value)}><Text style={styles.link}>{editingProfile ? 'Cancel' : 'Edit'}</Text></TouchableOpacity></View><Text style={styles.body}>{profile.email}</Text><Text style={styles.caption}>Identity and medical fields can only be changed by clinic staff.</Text>{editingProfile ? <><Field label="Phone" value={profileDraft.phoneNumber} onChangeText={(value) => setProfileDraft({ ...profileDraft, phoneNumber: value })} keyboardType="phone-pad" /><Field label="Address" value={profileDraft.address} onChangeText={(value) => setProfileDraft({ ...profileDraft, address: value })} /><Field label="City" value={profileDraft.city} onChangeText={(value) => setProfileDraft({ ...profileDraft, city: value })} /><Field label="Province/State" value={profileDraft.state} onChangeText={(value) => setProfileDraft({ ...profileDraft, state: value })} /><Field label="ZIP code" value={profileDraft.zipCode} onChangeText={(value) => setProfileDraft({ ...profileDraft, zipCode: value })} /><Field label="Emergency contact" value={profileDraft.emergencyContactName} onChangeText={(value) => setProfileDraft({ ...profileDraft, emergencyContactName: value })} /><Field label="Emergency phone" value={profileDraft.emergencyContactPhone} onChangeText={(value) => setProfileDraft({ ...profileDraft, emergencyContactPhone: value })} keyboardType="phone-pad" /><Field label="Relationship" value={profileDraft.emergencyContactRelation} onChangeText={(value) => setProfileDraft({ ...profileDraft, emergencyContactRelation: value })} /><TouchableOpacity style={styles.primary} onPress={saveProfile} disabled={!online || refreshing}><Text style={styles.primaryText}>Save contact details</Text></TouchableOpacity></> : <View style={styles.details}><Detail label="Phone" value={profile.phoneNumber} /><Detail label="Address" value={`${profile.address}, ${profile.city}, ${profile.state} ${profile.zipCode}`} /><Detail label="Emergency contact" value={`${profile.emergencyContactName} (${profile.emergencyContactRelation}) · ${profile.emergencyContactPhone}`} /><Detail label="Date of birth" value={profile.dateOfBirth} /><Detail label="Blood type" value={profile.bloodType} /></View>}</View>}
    </ScrollView>
    <Modal visible={Boolean(previewAttachment)} animationType="fade" transparent onRequestClose={() => setPreviewAttachment(null)}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.between}>
            <Text style={[styles.sectionTitle, { flex: 1 }]} numberOfLines={1}>{previewAttachment?.fileName}</Text>
            <TouchableOpacity onPress={() => setPreviewAttachment(null)} accessibilityLabel="Close attachment preview">
              <Ionicons name="close" size={24} color="#334155" />
            </TouchableOpacity>
          </View>
          {previewAttachment ? (
            <>
              <Image source={{ uri: previewAttachment.dataUrl }} style={styles.previewImage} resizeMode="contain" />
              <View style={styles.row}>
                <TouchableOpacity style={styles.secondary} onPress={() => setPreviewAttachment(null)}>
                  <Text style={styles.secondaryText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primarySmall}
                  onPress={() => openAttachment({ id: previewAttachment.id, fileName: previewAttachment.fileName, mimeType: previewAttachment.mimeType, fileSize: previewAttachment.fileSize, createdAt: '' }, true)}
                >
                  <Text style={styles.primaryText}>Download</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
    </SafeAreaView>;
}

function Field(props: { label: string; value: string; onChangeText: (value: string) => void; keyboardType?: 'default' | 'email-address' | 'number-pad' | 'phone-pad'; secureTextEntry?: boolean; autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters' }) { const { label, ...inputProps } = props; return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput {...inputProps} style={styles.input} placeholderTextColor="#94a3b8" autoCapitalize={props.autoCapitalize || 'sentences'} /></View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function Detail({ label, value }: { label: string; value: string }) { return <View><Text style={styles.label}>{label}</Text><Text style={styles.body}>{value}</Text></View>; }
function StatusPill({ status }: { status: string }) { return <View style={styles.pill}><Text style={styles.pillText}>{status.replace(/_/g, ' ')}</Text></View>; }
function Empty({ icon, title, text }: { icon: any; title: string; text: string }) { return <View style={styles.empty}><Ionicons name={icon} size={32} color="#94a3b8" /><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.muted}>{text}</Text></View>; }
function AppointmentCard({ item, actions }: { item: Appointment; actions?: React.ReactNode }) { return <View style={styles.card}><View style={styles.between}><View style={{ flex: 1 }}><Text style={styles.sectionTitle}>{item.doctor.name}</Text><Text style={styles.caption}>{item.doctor.specialization} · {item.doctor.roomNumber || 'Clinic'}</Text></View><StatusPill status={item.status} /></View><Text style={styles.body}>{new Date(item.appointmentDate).toLocaleString()}</Text><Text style={styles.muted}>{item.reasonForVisit}</Text>{item.cancellationReason ? <Text style={styles.errorText}>{item.cancellationReason}</Text> : null}{actions}</View>; }

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: '#f8fafc' }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: '#f8fafc' }, authWrap: { flexGrow: 1, justifyContent: 'center', padding: 22 }, logo: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#0f172a', alignSelf: 'center', alignItems: 'center', justifyContent: 'center' }, logoText: { color: '#fff', fontWeight: '800' }, title: { marginTop: 14, textAlign: 'center', fontSize: 24, fontWeight: '800', color: '#0f172a' }, subtitle: { textAlign: 'center', color: '#64748b', marginTop: 4, marginBottom: 18 }, card: { backgroundColor: '#fff', borderColor: '#e2e8f0', borderWidth: 1, borderRadius: 12, padding: 16, gap: 12 }, field: { gap: 5 }, label: { color: '#64748b', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' }, input: { minHeight: 44, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, paddingHorizontal: 12, color: '#0f172a', backgroundColor: '#fff' }, primary: { minHeight: 44, borderRadius: 7, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 15 }, primarySmall: { flex: 1, minHeight: 40, borderRadius: 7, backgroundColor: '#0f766e', alignItems: 'center', justifyContent: 'center' }, primaryText: { color: '#fff', fontWeight: '700' }, secondary: { flex: 1, minHeight: 40, borderRadius: 7, borderWidth: 1, borderColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 }, secondaryText: { color: '#334155', fontWeight: '700', fontSize: 12 }, danger: { flex: 1, minHeight: 40, borderRadius: 7, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center' }, dangerText: { color: '#b91c1c', fontWeight: '700', fontSize: 12 }, authLinks: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }, link: { color: '#0f766e', fontWeight: '700', fontSize: 13 }, notice: { marginBottom: 12, padding: 12, borderRadius: 7, backgroundColor: '#ecfeff', borderWidth: 1, borderColor: '#a5f3fc' }, noticeText: { color: '#155e75' }, header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, headerTitle: { color: '#0f172a', fontSize: 17, fontWeight: '800' }, headerSub: { color: '#64748b', fontSize: 11, marginTop: 2 }, tabs: { flexDirection: 'row', backgroundColor: '#fff', padding: 6, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' }, tab: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 7 }, tabActive: { backgroundColor: '#e2e8f0' }, tabText: { color: '#64748b', fontSize: 12, fontWeight: '600' }, tabTextActive: { color: '#0f172a', fontWeight: '800' }, content: { padding: 14, gap: 13, paddingBottom: 40 }, offline: { flexDirection: 'row', gap: 8, padding: 10, backgroundColor: '#fffbeb', borderBottomColor: '#fde68a', borderBottomWidth: 1 }, offlineText: { color: '#92400e', fontSize: 12, flex: 1 }, error: { flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#fef2f2', borderBottomColor: '#fecaca', borderBottomWidth: 1 }, errorText: { color: '#991b1b', fontSize: 12 }, eyebrow: { color: '#64748b', fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }, ticket: { fontSize: 44, fontWeight: '900', color: '#0f172a', textAlign: 'center', letterSpacing: 2 }, pill: { alignSelf: 'flex-start', backgroundColor: '#ccfbf1', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }, pillText: { color: '#115e59', fontSize: 10, fontWeight: '800' }, metrics: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 }, metric: { flex: 1 }, metricLabel: { color: '#64748b', fontSize: 10 }, metricValue: { color: '#0f172a', fontSize: 17, fontWeight: '800' }, body: { color: '#334155', fontSize: 14, lineHeight: 20 }, caption: { color: '#64748b', fontSize: 11, lineHeight: 16 }, muted: { color: '#64748b', textAlign: 'center', lineHeight: 19 }, sectionTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' }, empty: { alignItems: 'center', padding: 28, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', gap: 7 }, choiceWrap: { gap: 7 }, choice: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 7, padding: 10 }, choiceActive: { borderColor: '#0f766e', backgroundColor: '#f0fdfa' }, choiceText: { color: '#334155', fontSize: 12 }, row: { flexDirection: 'row', gap: 9 }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, details: { gap: 14 }, attachmentSection: { borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10, gap: 8 }, attachmentRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10 }, attachmentInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }, attachmentName: { color: '#0f172a', fontSize: 12, fontWeight: '700' }, attachmentActions: { flexDirection: 'row', alignItems: 'center', gap: 6 }, attachmentBtn: { backgroundColor: '#0f766e', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }, attachmentBtnText: { color: '#fff', fontSize: 11, fontWeight: '700' }, attachmentBtnSecondary: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', padding: 6, borderRadius: 6 }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.75)', justifyContent: 'center', padding: 16 }, modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, gap: 12, maxHeight: '88%' }, previewImage: { width: '100%', height: 360, backgroundColor: '#f1f5f9', borderRadius: 8 } });
