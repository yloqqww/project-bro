'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReceptionAnalyticsPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/reception/checkin?tab=analytics');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 font-sans p-4">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-teal-800 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium">Binubuksan ang OPD Analytics sa Reception Workstation...</p>
      </div>
    </div>
  );
}
