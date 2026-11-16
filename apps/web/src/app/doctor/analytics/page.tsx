'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Stethoscope,
  Clock,
  RefreshCw,
  FileText,
  Pill,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Users,
  Building2,
  Activity,
} from 'lucide-react';

export default function DoctorAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/analytics');
      const json = await res.json();
      if (json.success && json.doctor) {
        setData(json.doctor);
        setLastRefreshed(
          new Date().toLocaleTimeString('fil-PH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      }
    } catch (err) {
      console.error('Error fetching doctor analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 15000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const doctor = data || {
    totalConsultationsToday: 0,
    totalConsultationsAllTime: 0,
    activeConsultationsCount: 0,
    averageConsultationMinutes: 0,
    totalPrescriptionsIssued: 0,
    topDiagnoses: [],
    topMedications: [],
    doctorPerformance: [],
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col">
      {/* ── 1. HEADER (STATION 3 SPECIFIC) ──────────────────────────── */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-30 shadow-2xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-teal-800 text-white font-bold flex items-center justify-center text-sm tracking-wider shadow-sm shrink-0">
              <Stethoscope className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                  Laguna Medical Center
                </span>
                <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 font-bold text-xs rounded border border-teal-200 uppercase tracking-wider">
                  Station 3: Doctor Consultation Analytics
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-tight mt-0.5">
                Clinical Consultations, ICD-10 Diagnoses, E-Prescriptions & Turnaround Telemetry
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-sm">
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs sm:text-sm text-slate-700 font-mono">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse" />
              <span>LIVE DATA &bull; Refreshed: {lastRefreshed || 'Just now'}</span>
            </div>

            <button
              type="button"
              onClick={fetchAnalytics}
              disabled={loading}
              className="h-9 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs sm:text-sm font-semibold rounded-md flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <Link
              href="/doctor/queue"
              className="h-9 px-4 bg-teal-800 hover:bg-teal-900 text-white text-xs sm:text-sm font-bold rounded-md flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Consultation Desk</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── 2. MAIN CONTENT (FULL SCREEN) ───────────────────────────── */}
      <main className="w-full flex-1 px-4 sm:px-6 lg:px-8 xl:px-10 py-6 space-y-6">
        {/* KPI Overview Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">
                Completed Consultations Today
              </span>
              <div className="w-8 h-8 rounded-md bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                {doctor.totalConsultationsToday}
              </span>
              <span className="text-xs text-slate-500 font-medium">consultations</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Kabuuang completed all-time: {doctor.totalConsultationsAllTime}
            </p>
          </div>

          <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">
                Active In Consultation
              </span>
              <div className="w-8 h-8 rounded-md bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700 font-mono">
                {doctor.activeConsultationsCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">currently in session</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Kasalukuyang sinusuri sa mga klinika
            </p>
          </div>

          <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">
                Average Consultation Duration
              </span>
              <div className="w-8 h-8 rounded-md bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-indigo-700 font-mono">
                {doctor.averageConsultationMinutes}
              </span>
              <span className="text-xs text-slate-500 font-medium">minuto kada pasyente</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Mula pagpasok hanggang completion
            </p>
          </div>

          <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">
                Total Prescriptions Issued
              </span>
              <div className="w-8 h-8 rounded-md bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
                <Pill className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-teal-800 font-mono">
                {doctor.totalPrescriptionsIssued}
              </span>
              <span className="text-xs text-slate-500 font-medium">e-prescriptions</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Mula sa SOAP treatment plans
            </p>
          </div>
        </div>

        {/* Section 1: Top Diagnoses & Top Prescriptions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Clinical Diagnoses */}
          <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Top Clinical Diagnoses & ICD-10 Impressions
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Pinakamadalas na clinical impressions na naitala sa SOAP assessments
            </p>

            <div className="mt-5 space-y-3">
              {doctor.topDiagnoses?.length > 0 ? (
                doctor.topDiagnoses.map((d: any, idx: number) => (
                  <div
                    key={d.name}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-200"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 rounded-full bg-teal-100 text-teal-800 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                        {d.name}
                      </span>
                    </div>
                    <span className="font-mono text-slate-600 font-bold text-xs sm:text-sm">
                      {d.count} kaso
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500 text-xs">
                  Walang naitalang diagnosis record.
                </div>
              )}
            </div>
          </div>

          {/* Top Prescribed Medications */}
          <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Top Prescribed Medications
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Pinakamadalas na gamot na ibinigay sa outpatient pharmacy orders
            </p>

            <div className="mt-5 space-y-3">
              {doctor.topMedications?.length > 0 ? (
                doctor.topMedications.map((m: any, idx: number) => (
                  <div
                    key={m.name}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-md border border-slate-200"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="w-6 h-6 rounded-full bg-sky-100 text-sky-800 font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-800 text-xs sm:text-sm">
                        {m.name}
                      </span>
                    </div>
                    <span className="font-mono text-slate-600 font-bold text-xs sm:text-sm">
                      {m.count} reseta
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-slate-500 text-xs">
                  Walang naitalang reseta.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 2: Doctor Duty Roster Performance Table */}
        <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Doctor Duty Roster & Consultation Load
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Kasalukuyang estado ng bawat attending physician sa Laguna Medical Center
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              {doctor.doctorPerformance?.length || 0} active doctors
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300">
                <tr>
                  <th className="py-2.5 px-3">Physician Name</th>
                  <th className="py-2.5 px-3">Specialty</th>
                  <th className="py-2.5 px-3">Assigned Room</th>
                  <th className="py-2.5 px-3 text-center">Completed Today</th>
                  <th className="py-2.5 px-3 text-center">Waiting Now</th>
                  <th className="py-2.5 px-3 text-center">In Session</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {doctor.doctorPerformance?.length > 0 ? (
                  doctor.doctorPerformance.map((doc: any) => (
                    <tr key={doc.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-medium text-slate-900">{doc.name}</td>
                      <td className="py-2.5 px-3 text-slate-600">{doc.specialty}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{doc.room}</td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-teal-800">
                        {doc.completedToday}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-amber-700">
                        {doc.waitingNow}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-emerald-700">
                        {doc.inSessionNow}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          ON DUTY
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Walang aktibong doktor na nakarehistro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
