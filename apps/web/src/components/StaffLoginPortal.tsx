'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import {
  Shield,
  Lock,
  Building2,
  PhoneCall,
  HelpCircle,
  AlertCircle,
  ArrowRight,
  KeyRound,
  X,
  Eye,
  EyeOff,
} from 'lucide-react';
import { getRoleBasedRedirect } from '@/lib/role-navigation';

type PortalMode = 'medical' | 'admin';
type MedicalRole = 'DOCTOR' | 'NURSE' | 'RECEPTIONIST';

/**
 * Shared authentication portal parameterized for either Medical Staff ('/')
 * or dedicated Administration ('/admin/login').
 */
export function StaffLoginPortal({ mode }: { mode: PortalMode }) {
  const router = useRouter();
  const isAdminPortal = mode === 'admin';

  const [selectedRole, setSelectedRole] = useState<MedicalRole>('DOCTOR');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);

  const handleRoleChange = (role: MedicalRole) => {
    setSelectedRole(role);
    setErrorMessage('');
    setIdentifier('');
    setPassword('');
    setMfaCode('');
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setErrorMessage('Please enter both your Staff ID / Email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const expectedRole = isAdminPortal ? 'ADMIN' : selectedRole;
      const res = await signIn('credentials', {
        email: identifier.trim(),
        password,
        expectedRole,
        mfaCode: mfaCode.trim(),
        redirect: false,
      });

      if (res?.error) {
        const roleLabel =
          expectedRole === 'NURSE'
            ? 'Triage'
            : expectedRole === 'RECEPTIONIST'
            ? 'OPD'
            : expectedRole.toLowerCase();
        setErrorMessage(
          `Authentication failed. Please use an authorized ${roleLabel} account for this portal.`
        );
        setIsLoading(false);
        return;
      }

      const sessionRes = await fetch('/api/auth/session');
      const sessionData = await sessionRes.json();

      if (sessionData?.user?.role === 'PATIENT') {
        setErrorMessage(
          'Patient accounts are restricted from the Staff Portal. Please access the Patient Mobile App.'
        );
        setIsLoading(false);
        return;
      }

      const redirectUri = getRoleBasedRedirect(sessionData?.user?.role || '');
      router.push(redirectUri);
      router.refresh();
    } catch {
      setErrorMessage(
        'A network or server error occurred during authorization. Please try again.'
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between text-slate-800 font-sans antialiased">
      {/* ── TOP HEADER ────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded bg-slate-900 flex items-center justify-center text-white font-bold text-base shadow-xs">
              <Building2 className="w-5 h-5 text-slate-100" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-slate-900 text-sm tracking-tight">
                  Laguna Medical Center
                </span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-300">
                  HIS v2.4
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">
                Hospital Management System •{' '}
                {isAdminPortal ? 'Administrator Portal' : 'Medical Staff Access Portal'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
              <span>Core Services: Operational</span>
            </div>

            <button
              type="button"
              onClick={() => setIsSupportModalOpen(true)}
              className="inline-flex items-center space-x-1.5 text-slate-600 hover:text-slate-900 font-medium px-2.5 py-1.5 rounded hover:bg-slate-100 transition-colors"
            >
              <PhoneCall className="w-3.5 h-3.5 text-slate-500" />
              <span>IT Support (Ext. 4040)</span>
            </button>

            <button
              type="button"
              onClick={() => setIsSupportModalOpen(true)}
              className="inline-flex items-center space-x-1 text-slate-600 hover:text-slate-900 px-2 py-1.5 rounded hover:bg-slate-100 transition-colors"
              title="Portal Guidelines"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Help</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT AREA ─────────────────────────────────────────── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 md:py-12 flex items-center">
        <div className="w-full grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* ── LEFT COLUMN: System Identity & Notice ── */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-3">
              <div className="inline-flex items-center space-x-2 px-2.5 py-1 rounded bg-slate-200 text-slate-800 text-xs font-semibold tracking-wide uppercase">
                <Shield className="w-3.5 h-3.5 text-slate-700" />
                <span>{isAdminPortal ? 'Hospital Administration Portal' : 'Hospital Staff Portal'}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight leading-tight">
                {isAdminPortal
                  ? 'Secure Access for Clinic Administration'
                  : 'Secure Access for Medical Staff'}
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                {isAdminPortal
                  ? 'Manage clinic operations, staff accounts, doctor schedules, audit logs, and system settings through your authorized administrator account.'
                  : 'Access patient triage, OPD reception check-in, doctor consultation queues, and clinical records through your authorized medical staff account.'}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded p-4 text-xs space-y-3 shadow-xs">
              <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                System Status &amp; Operations
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-slate-500 block">Hospital Network</span>
                  <span className="font-semibold text-slate-800">VLAN-MED-04 (Secure)</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-slate-500 block">Audit Logging</span>
                  <span className="font-semibold text-slate-800">Active &amp; Audited</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-slate-500 block">IT Helpdesk Desk</span>
                  <span className="font-semibold text-slate-800">Extension 4040 / 4041</span>
                </div>
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-slate-500 block">Maintenance Window</span>
                  <span className="font-semibold text-slate-800">Sunday 02:00 – 04:00 PHT</span>
                </div>
              </div>
            </div>

            <div className="border-l-2 border-slate-400 bg-white p-3.5 rounded-r border-y border-r border-slate-200 text-xs text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center space-x-1.5">
                <Lock className="w-3.5 h-3.5 text-slate-600" />
                <span>Authorized Personnel Only</span>
              </div>
              <p className="text-slate-600 leading-normal">
                Access to this system is restricted to authorized hospital personnel. All session
                activity is logged and audited in accordance with hospital information security
                guidelines. If you are having trouble accessing your account, contact IT support.
              </p>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Sign In Form ── */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end">
            <div className="w-full max-w-md bg-white border border-slate-300 rounded shadow-sm p-6 sm:p-8 space-y-5">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <span className="text-xs font-semibold text-slate-700">
                  {isAdminPortal ? 'Administration Access' : 'Clinical Workstation Access'}
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {isAdminPortal ? 'AUTH / ADMIN' : 'AUTH / CLINICAL'}
                </span>
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {isAdminPortal ? 'Administrator Sign In' : 'Medical Staff Sign In'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {isAdminPortal
                    ? 'Sign in with your authorized administrator account.'
                    : 'Piliin ang iyong departamento at mag-sign in gamit ang staff account.'}
                </p>
              </div>

              {!isAdminPortal && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Select your role
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded border border-slate-200">
                    {([
                      ['DOCTOR', 'Doctor'],
                      ['NURSE', 'Triage'],
                      ['RECEPTIONIST', 'OPD'],
                    ] as const).map(([role, label]) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => handleRoleChange(role)}
                        className={`py-1.5 text-xs font-semibold rounded text-center transition-colors cursor-pointer ${
                          selectedRole === role
                            ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 rounded text-xs flex items-start space-x-2">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSignIn} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1" htmlFor="login-id">
                    {isAdminPortal ? 'Email / Admin ID' : 'Staff ID / Email'}
                  </label>
                  <input
                    id="login-id"
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={isAdminPortal ? 'admin@clinic.local' : 'e.g. cardio.doc@clinic.local'}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded text-slate-900 focus:outline-hidden focus:border-slate-600 text-xs bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-slate-700 font-semibold" htmlFor="login-pass">
                      Password
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsForgotModalOpen(true)}
                      className="text-slate-600 hover:text-slate-900 font-medium text-[11px]"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-pass"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        isAdminPortal
                          ? 'Enter your administrative password'
                          : 'Enter your staff password'
                      }
                      required
                      className="w-full px-3 py-2 pr-9 border border-slate-300 rounded text-slate-900 focus:outline-hidden focus:border-slate-600 text-xs bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded text-xs transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <span>{isLoading ? 'Authenticating...' : 'Sign In'}</span>
                  {!isLoading && <ArrowRight className="w-3.5 h-3.5" />}
                </button>
              </form>

              {isAdminPortal && (
                <div className="pt-3 border-t border-slate-200 text-center text-[11px] text-slate-500">
                  Clinical or OPD staff?{' '}
                  <Link href="/" className="font-semibold text-slate-800 hover:underline">
                    Go to Medical Staff Login
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── FOOTER ────────────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-200 text-xs text-slate-500 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-3">
            <span>© {new Date().getFullYear()} Laguna Medical Center. All rights reserved.</span>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="hidden sm:inline">Authorized clinical use only</span>
          </div>

          <div className="flex items-center space-x-4">
            <button
              type="button"
              onClick={() => setIsSupportModalOpen(true)}
              className="hover:text-slate-800 transition-colors"
            >
              Contact IT Support
            </button>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400 font-mono">Station: MNL-TERMINAL-01</span>
          </div>
        </div>
      </footer>

      {/* ── IT SUPPORT MODAL ──────────────────────────────────────────── */}
      {isSupportModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border border-slate-300 shadow-md max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <PhoneCall className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Hospital IT Support Helpdesk</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                For immediate assistance regarding staff account provisioning, two-factor
                authentication, or workstation network access:
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">Internal Extension:</span>
                  <span className="font-semibold text-slate-900">Ext. 4040 / 4041</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Direct Landline:</span>
                  <span className="font-semibold text-slate-900">(02) 8888-4040</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">IT Helpdesk Email:</span>
                  <span className="font-semibold text-slate-900">itsupport@lagunamedical.ph</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Operating Hours:</span>
                  <span className="font-semibold text-slate-900">24/7 On-Call Support</span>
                </div>
              </div>

              <div className="p-2.5 bg-slate-100 rounded text-slate-600">
                <span className="font-semibold text-slate-800 block mb-1">Patient Inquiries</span>
                Patients requiring queue numbers or lab results must use the Patient Mobile App or
                proceed to Central Registration on the Ground Floor.
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsSupportModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── FORGOT PASSWORD MODAL ─────────────────────────────────────── */}
      {isForgotModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded border border-slate-300 shadow-md max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-slate-700" />
                <h3 className="text-sm font-bold text-slate-900">Password Reset Policy</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-600 space-y-3">
              <p>
                In accordance with hospital data security policies, self-service automated password
                resets for clinical and administrative accounts are disabled to protect patient
                records.
              </p>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-1.5">
                <div className="font-semibold text-slate-800">To reset your credentials:</div>
                <ol className="list-decimal list-inside space-y-1 text-slate-600">
                  <li>
                    Call IT Helpdesk at <span className="font-semibold text-slate-800">Extension 4040</span>{' '}
                    from any hospital desk phone.
                  </li>
                  <li>Present your physical Hospital Staff ID Badge for identity verification.</li>
                  <li>A temporary one-time passcode (OTP) will be issued for initial logon.</li>
                </ol>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-semibold transition-colors"
              >
                Acknowledge &amp; Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

