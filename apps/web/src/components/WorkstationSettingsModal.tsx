'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  X,
  User,
  Shield,
  Volume2,
  VolumeX,
  Bell,
  Clock,
  Key,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Settings,
  Sliders,
  Check,
} from 'lucide-react';
import { getApiErrorMessage } from '@/lib/client-response';

export interface WorkstationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stationName: string;
  stationRole: string;
  currentRoom?: string;
  soundEnabled?: boolean;
  onToggleSound?: (enabled: boolean) => void;
  onTestSound?: () => void;
  refreshInterval?: number;
  onChangeRefreshInterval?: (interval: number) => void;
  onProfileUpdated?: () => void;
}

export default function WorkstationSettingsModal({
  isOpen,
  onClose,
  stationName,
  stationRole,
  currentRoom,
  soundEnabled = true,
  onToggleSound,
  onTestSound,
  refreshInterval = 7,
  onChangeRefreshInterval,
  onProfileUpdated,
}: WorkstationSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences'>('profile');

  // Profile data states
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [room, setRoom] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [contact, setContact] = useState('');
  const [prcLicense, setPrcLicense] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Browser notification permission state
  const [desktopPermStatus, setDesktopPermStatus] = useState<string>('default');

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setDesktopPermStatus(Notification.permission);
    } else {
      setDesktopPermStatus('unsupported');
    }
  }, []);

  // Fetch current staff profile on modal open
  useEffect(() => {
    if (!isOpen) return;

    setSuccessMessage('');
    setErrorMessage('');
    setNewPassword('');

    const fetchProfile = async () => {
      try {
        setLoadingProfile(true);
        const res = await fetch('/api/user/profile');
        const data = await res.json();
        if (data.success && data.profile) {
          setName(data.profile.name || '');
          setEmail(data.profile.email || '');
          setRole(data.profile.role || stationRole);
          setRoom(data.profile.room || currentRoom || '');
          setSpecialty(data.profile.specialty || '');
          setContact(data.profile.contact || '');
          setPrcLicense(data.profile.prcLicense || '');
        }
      } catch (err) {
        console.error('Error fetching profile in settings modal:', err);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, [isOpen, stationRole, currentRoom]);

  if (!isOpen) return null;

  // Handle saving profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');

    if (newPassword && (newPassword.trim().length < 12 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword))) {
      setErrorMessage('Ang bagong password ay dapat 12+ characters at may uppercase, lowercase, at numero.');
      return;
    }

    try {
      setSavingProfile(true);
      const payload: any = {
        name: name.trim(),
        contact: contact.trim(),
      };

      if (prcLicense && prcLicense.trim()) {
        payload.prcLicense = prcLicense.trim();
      }

      if (newPassword && newPassword.trim().length >= 12) {
        payload.password = newPassword.trim();
      }

      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMessage(getApiErrorMessage(data.error, 'Hindi na-save ang profile. Subukan muli.'));
        return;
      }

      setSuccessMessage('Matagumpay na na-update ang iyong profile!');
      setNewPassword('');
      if (onProfileUpdated) {
        onProfileUpdated();
      }

      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (err) {
      console.error('Error saving profile:', err);
      setErrorMessage('Nagkaroon ng network error sa pag-save.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleRequestDesktopPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        const perm = await Notification.requestPermission();
        setDesktopPermStatus(perm);
      } catch (e) {
        console.warn('Desktop notification permission error:', e);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white border border-slate-300 rounded-xl max-w-xl w-full shadow-2xl overflow-hidden my-6">
        
        {/* Modal Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-teal-800 text-white flex items-center justify-center font-bold shadow-xs">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-900">
                Workstation & Profile Settings
              </div>
              <div className="text-xs text-slate-500">
                {stationName} &bull; {stationRole}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer"
            aria-label="Isara"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-5 pt-2 gap-4 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
              activeTab === 'profile'
                ? 'border-teal-800 text-teal-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Profile & Seguridad</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('preferences')}
            className={`pb-2.5 border-b-2 flex items-center space-x-1.5 transition cursor-pointer ${
              activeTab === 'preferences'
                ? 'border-teal-800 text-teal-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Mga Setting ng Counter & Alerto</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 max-h-[72vh] overflow-y-auto">
          
          {/* TAB 1: PROFILE & SECURITY */}
          {activeTab === 'profile' && (
            <div>
              {loadingProfile ? (
                <div className="py-12 text-center text-xs text-slate-500 flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-teal-800" />
                  <span>Kinukuha ang impormasyon ng account...</span>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
                  {successMessage && (
                    <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-md font-semibold flex items-center space-x-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>{successMessage}</span>
                    </div>
                  )}

                  {errorMessage && (
                    <div className="p-3 bg-rose-50 border border-rose-300 text-rose-900 rounded-md font-semibold flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Read-Only Hospital Credential Card */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                    <div className="text-[11px] font-bold uppercase text-slate-500 tracking-wider">
                      Opisyal na Pagkakakilanlan sa Ospital
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-slate-500 block text-[10px]">Email ng Account</span>
                        <span className="font-mono font-bold text-slate-800">{email || 'N/A'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Gampanin (Role)</span>
                        <span className="font-bold text-teal-800 uppercase bg-teal-50 px-2 py-0.5 rounded border border-teal-200 inline-block text-[11px]">
                          {(role || stationRole) === 'RECEPTIONIST'
                            ? 'OPD'
                            : (role || stationRole) === 'NURSE'
                            ? 'TRIAGE'
                            : role || stationRole}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Itinalagang Silid / Counter</span>
                        <span className="font-mono font-bold text-slate-800">{room || currentRoom || 'OPD Counter'}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[10px]">Department / Specialty</span>
                        <span className="font-semibold text-slate-800">{specialty || 'General Outpatient'}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 italic pt-1 border-t border-slate-200/80">
                      Tandaan: Ang opisyal na counter at departamento ay itinalaga ng Hospital Administrator.
                    </div>
                  </div>

                  {/* Editable: Full Name */}
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">
                      Buong Pangalan ng Kawani *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Hal. Juan Dela Cruz"
                      className="w-full h-9 px-3 rounded-md border border-slate-300 text-xs font-medium text-slate-900 focus:outline-teal-800"
                    />
                  </div>

                  {/* Editable: Contact Number */}
                  <div>
                    <label className="font-bold text-slate-800 block mb-1">
                      Numero ng Telepono / Mobile
                    </label>
                    <div className="relative">
                      <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={11}
                        value={contact}
                        onChange={(e) => setContact(e.target.value.replace(/\D/g, '').slice(0, 11))}
                        placeholder="09170000000"
                        className="w-full h-9 pl-9 pr-3 rounded-md border border-slate-300 text-xs font-mono text-slate-900 focus:outline-teal-800"
                      />
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Ginagamit para sa direktang komunikasyon at koordinasyon sa pagitan ng mga estasyon.
                    </span>
                  </div>

                  {/* PRC License for Doctors (if applicable) */}
                  {stationRole.toLowerCase().includes('doctor') && (
                    <div>
                      <label className="font-bold text-slate-800 block mb-1">
                        PRC Medical License Number
                      </label>
                      <input
                        type="text"
                        value={prcLicense}
                        onChange={(e) => setPrcLicense(e.target.value)}
                        placeholder="Hal. 0123456"
                        className="w-full h-9 px-3 rounded-md border border-slate-300 text-xs font-mono text-slate-900 focus:outline-teal-800"
                      />
                    </div>
                  )}

                  {/* Change Password */}
                  <div className="pt-3 border-t border-slate-200">
                    <label className="font-bold text-slate-800 block mb-1">
                      Palitan ang Password ng Account (Opsyonal)
                    </label>
                    <div className="relative">
                      <Key className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Iwanang blangko kung ayaw palitan ang password"
                        className="w-full h-9 pl-9 pr-16 rounded-md border border-slate-300 text-xs font-mono text-slate-900 focus:outline-teal-800"
                      />
                      {newPassword && (
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-2.5 top-2 text-[11px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                        >
                          {showPassword ? 'Itago' : 'Ipakita'}
                        </button>
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">
                      Dapat 12+ characters at may uppercase, lowercase, at numero.
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-900">Authenticator at sessions</div>
                        <div className="mt-0.5 text-[10px] text-slate-500">I-manage ang MFA at mag-sign out sa lahat ng devices.</div>
                      </div>
                      <Link href="/security" onClick={onClose} className="shrink-0 rounded border border-teal-700 bg-white px-3 py-1.5 font-bold text-teal-800 hover:bg-teal-50">
                        Security
                      </Link>
                    </div>
                  </div>

                  {/* Action Save Button */}
                  <div className="flex justify-end space-x-2 pt-3 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={savingProfile}
                      className="h-9 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition cursor-pointer"
                    >
                      Kanselahin
                    </button>
                    <button
                      type="submit"
                      disabled={savingProfile}
                      className="h-9 px-4 rounded-md bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {savingProfile ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Sine-save...</span>
                        </>
                      ) : (
                        <span>I-save ang Profile</span>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* TAB 2: WORKSTATION PREFERENCES & HARDWARE */}
          {activeTab === 'preferences' && (
            <div className="space-y-4 text-xs">
              
              {/* Feature 1: Sound Alert Chime */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-md bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                      {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        Tunog ng Alerto (Audio Chime)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Tumutunog kapag may bagong pasyente o pagbabago sa pila
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {onTestSound && (
                      <button
                        type="button"
                        onClick={onTestSound}
                        className="px-2.5 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold transition cursor-pointer"
                        title="Subukan ang tunog ng chime"
                      >
                        Subukan ang Tunog
                      </button>
                    )}

                    {onToggleSound && (
                      <button
                        type="button"
                        onClick={() => onToggleSound(!soundEnabled)}
                        className={`px-3 py-1 rounded text-xs font-bold transition cursor-pointer ${
                          soundEnabled
                            ? 'bg-teal-800 text-white'
                            : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                        }`}
                      >
                        {soundEnabled ? 'Bukas' : 'Naka-mute'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Feature 2: Desktop Push Notifications */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-md bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">
                        Desktop Browser Notifications
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Nagpapadala ng pop-up notification kahit naka-minimize ang browser
                      </div>
                    </div>
                  </div>

                  <div>
                    {desktopPermStatus === 'granted' ? (
                      <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded bg-emerald-100 text-emerald-800 font-bold text-[11px] border border-emerald-300">
                        <Check className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Aktibo</span>
                      </span>
                    ) : desktopPermStatus === 'denied' ? (
                      <span className="px-2.5 py-1 rounded bg-rose-100 text-rose-800 font-bold text-[11px] border border-rose-300">
                        Naka-block sa Browser
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleRequestDesktopPermission}
                        className="px-3 py-1 rounded bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs transition cursor-pointer"
                      >
                        I-enable
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Feature 3: Auto-Refresh Polling Interval */}
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-md bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">
                      Bilis ng Pag-update ng Queue Data
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Pumili ng agwat ng awtomatikong pagsusuri ng bagong datos
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                  {[
                    { sec: 5, label: '5 segundo', desc: 'Pinakamabilis' },
                    { sec: 7, label: '7 segundo', desc: 'Standard' },
                    { sec: 10, label: '10 segundo', desc: 'Katamtaman' },
                    { sec: 15, label: '15 segundo', desc: 'Matipid' },
                  ].map((item) => (
                    <button
                      key={item.sec}
                      type="button"
                      onClick={() => onChangeRefreshInterval && onChangeRefreshInterval(item.sec)}
                      className={`p-2 rounded-md border text-left transition cursor-pointer ${
                        refreshInterval === item.sec
                          ? 'bg-teal-800 text-white border-teal-900 ring-1 ring-teal-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-bold text-xs leading-tight">{item.label}</div>
                      <div className={`text-[10px] mt-0.5 ${refreshInterval === item.sec ? 'text-teal-200' : 'text-slate-400'}`}>
                        {item.desc}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Feature 4: Workstation Info Note */}
              <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-teal-900 text-[11px] leading-relaxed">
                <strong>Laguna Medical Center Workstation Security:</strong> Ang lahat ng mga klinikal na transaksyon, tawag sa pasyente, at reseta ay naka-log alinsunod sa DOH Health Information Data Privacy Act.
              </div>

              {/* Close Button */}
              <div className="flex justify-end pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-5 rounded-md bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs transition cursor-pointer shadow-xs"
                >
                  I-close ang Settings
                </button>
              </div>

            </div>
          )}

        </div>

      </div>
    </div>
  );
}
