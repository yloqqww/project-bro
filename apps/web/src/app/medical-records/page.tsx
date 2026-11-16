'use client';

import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { MedicalRecordsWorkspace } from '@/components/MedicalRecordsWorkspace';
import { StaffWorkstationSidebar } from '@/components/StaffWorkstationSidebar';

export default function SharedMedicalRecordsPage() {
  const { data: session } = useSession();
  const role = session?.user?.role;
  const backHref = role === 'NURSE'
    ? '/triage'
    : role === 'RECEPTIONIST'
    ? '/reception/checkin'
    : role === 'DOCTOR'
    ? '/doctor/queue'
    : '/admin/dashboard';
  const backLabel = role === 'NURSE'
    ? 'Bumalik sa Triage'
    : role === 'RECEPTIONIST'
    ? 'Bumalik sa OPD'
    : role === 'DOCTOR'
    ? 'Bumalik sa Doctor Queue'
    : 'Bumalik sa Admin';

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-300 shadow-2xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded bg-teal-800 text-white flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-slate-900">Laguna Medical Center — Shared EHR</div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-700" />
                EHR &amp; Medical Records Archive Access for Triage and OPD staff
              </div>
            </div>
          </div>
          <Link
            href={backHref}
            className="h-9 px-3 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {backLabel}
          </Link>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-5">
        <div className="flex flex-col lg:flex-row items-start gap-4">
          <StaffWorkstationSidebar role={role} />
          <div className="flex-1 min-w-0 w-full">
            <MedicalRecordsWorkspace readOnly={role !== 'DOCTOR'} />
          </div>
        </div>
      </main>
    </div>
  );
}
