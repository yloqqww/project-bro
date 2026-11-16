'use client';

import React from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, Users, ShieldCheck } from 'lucide-react';
import PatientsPage from '@/app/admin/patients/page';
import { StaffWorkstationSidebar } from '@/components/StaffWorkstationSidebar';

export default function SharedPatientsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;

  const backHref =
    role === 'NURSE'
      ? '/triage'
      : role === 'RECEPTIONIST'
      ? '/reception/checkin'
      : role === 'DOCTOR'
      ? '/doctor/queue'
      : '/admin/dashboard';

  const backLabel =
    role === 'NURSE'
      ? 'Bumalik sa Triage'
      : role === 'RECEPTIONIST'
      ? 'Bumalik sa OPD'
      : role === 'DOCTOR'
      ? 'Bumalik sa Doctor Queue'
      : 'Bumalik sa Admin';

  const roleTitle =
    role === 'NURSE'
      ? 'Triage Counter — Master Patient Registry'
      : role === 'RECEPTIONIST'
      ? 'OPD Reception Desk — Master Patient Registry'
      : 'Clinic Master Patient Registry';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-300 shadow-2xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 min-h-16 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-teal-800 text-white flex items-center justify-center shrink-0 shadow-sm">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900 text-base leading-tight">
                {roleTitle}
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                <span>Paghahanap ng Pasyente, RFID Cards, at Rekord ng Pagpapatala</span>
              </div>
            </div>
          </div>

          <Link
            href={backHref}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs self-start sm:self-auto shrink-0"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{backLabel}</span>
          </Link>
        </div>
      </header>

      {/* Main Registry Content */}
      <main className="w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col lg:flex-row items-start gap-4">
          <StaffWorkstationSidebar role={role} />
          <div className="flex-1 min-w-0 w-full bg-white rounded-xl border border-slate-200 p-4 sm:p-6 shadow-sm">
            <PatientsPage />
          </div>
        </div>
      </main>
    </div>
  );
}

