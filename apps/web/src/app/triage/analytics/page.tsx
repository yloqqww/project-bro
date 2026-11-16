'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  HeartPulse,
  Users,
  Clock,
  RefreshCw,
  FileText,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Thermometer,
  ShieldAlert,
  Building2,
  CheckCircle2,
} from 'lucide-react';

export default function TriageAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/analytics');
      const json = await res.json();
      if (json.success && json.triage) {
        setData(json.triage);
        setLastRefreshed(
          new Date().toLocaleTimeString('fil-PH', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        );
      }
    } catch (err) {
      console.error('Error fetching triage analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 15000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const triage = data || {
    totalTriagedToday: 0,
    totalTriagedAllTime: 0,
    pendingOpdCount: 0,
    opdProcessedCount: 0,
    departmentBreakdown: {},
    priorityBreakdown: {},
    clinicalAlerts: {
      hypertensionCount: 0,
      feverCount: 0,
      tachycardiaCount: 0,
      severePainCount: 0,
    },
    recentAssessments: [],
  };

  const departmentLabels: Record<string, string> = {
    OB_GYN: 'Obstetrics & Gynecology (OB-GYN)',
    PEDIATRICS: 'Pediatrics Clinic',
    INTERNAL_MEDICINE: 'Internal Medicine',
    SURGERY: 'General Surgery & Minor OR',
    EENT: 'Eye, Ear, Nose & Throat (EENT)',
  };

  const priorityBadgeStyle = (p: string) => {
    switch (p) {
      case 'RESUSCITATION':
        return 'bg-purple-100 text-purple-800 border-purple-300 font-bold';
      case 'URGENT':
        return 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
      case 'PRIORITY':
        return 'bg-amber-100 text-amber-800 border-amber-300 font-semibold';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300 font-medium';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col">
      {/* ── 1. HEADER (STATION 1 SPECIFIC) ──────────────────────────── */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-30 shadow-2xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-teal-800 text-white font-bold flex items-center justify-center text-sm tracking-wider shadow-sm shrink-0">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">
                  Laguna Medical Center
                </span>
                <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 font-bold text-xs rounded border border-teal-200 uppercase tracking-wider">
                  Station 1: Triage Analytics
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-tight mt-0.5">
                Vital Signs Telemetry, Priority Stratification & Clinical Routing Analytics
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
              href="/triage"
              className="h-9 px-4 bg-teal-800 hover:bg-teal-900 text-white text-xs sm:text-sm font-bold rounded-md flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Triage Counter</span>
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
                Triaged Patients Today
              </span>
              <div className="w-8 h-8 rounded-md bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono">
                {triage.totalTriagedToday}
              </span>
              <span className="text-xs text-slate-500 font-medium">pasyente</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Kabuuang na-triage all-time: {triage.totalTriagedAllTime}
            </p>
          </div>

          <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">
                Pending for OPD Counter
              </span>
              <div className="w-8 h-8 rounded-md bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-amber-700 font-mono">
                {triage.pendingOpdCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">waiting at Station 2</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Na-process na sa OPD: {triage.opdProcessedCount}
            </p>
          </div>

          <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">
                Urgent & Priority Cases
              </span>
              <div className="w-8 h-8 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-rose-700 font-mono">
                {(triage.priorityBreakdown?.URGENT || 0) +
                  (triage.priorityBreakdown?.RESUSCITATION || 0) +
                  (triage.priorityBreakdown?.PRIORITY || 0)}
              </span>
              <span className="text-xs text-slate-500 font-medium">high acuity cases</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Standard / Non-urgent: {triage.priorityBreakdown?.STANDARD || 0}
            </p>
          </div>

          <div className="bg-white border border-slate-300 rounded-lg p-5 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm font-bold text-slate-500 uppercase tracking-wider">
                Clinical Vitals Alerts
              </span>
              <div className="w-8 h-8 rounded-md bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-700">
                <HeartPulse className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline space-x-2">
              <span className="text-2xl sm:text-3xl font-extrabold text-rose-600 font-mono">
                {(triage.clinicalAlerts?.hypertensionCount || 0) +
                  (triage.clinicalAlerts?.feverCount || 0) +
                  (triage.clinicalAlerts?.tachycardiaCount || 0) +
                  (triage.clinicalAlerts?.severePainCount || 0)}
              </span>
              <span className="text-xs text-slate-500 font-medium">flagged vital signs</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Kritikal na presyon, lagnat o heart rate
            </p>
          </div>
        </div>

        {/* Clinical Health Screening Alerts Grid */}
        <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Clinical Health Screening Alerts
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Awtomatikong binabantayan ang abnormal na presyon ng dugo, lagnat, at mataas na pulso mula sa Station 1 Vital Signs
              </p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-700 font-mono text-xs font-semibold rounded border border-slate-300">
              Screening Criteria: Philippine DOH Standards
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
            <div className="p-4 rounded-md border border-rose-200 bg-rose-50/70">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900 uppercase">Hypertension Alert</span>
                <HeartPulse className="w-4 h-4 text-rose-700" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-rose-800 font-mono">
                {triage.clinicalAlerts?.hypertensionCount || 0}
              </div>
              <p className="mt-1 text-xs text-rose-700">BP &gt;= 140/90 mmHg</p>
            </div>

            <div className="p-4 rounded-md border border-amber-200 bg-amber-50/70">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900 uppercase">Fever / Pyrexia</span>
                <Thermometer className="w-4 h-4 text-amber-700" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-amber-800 font-mono">
                {triage.clinicalAlerts?.feverCount || 0}
              </div>
              <p className="mt-1 text-xs text-amber-700">Temp &gt;= 37.8 &deg;C</p>
            </div>

            <div className="p-4 rounded-md border border-indigo-200 bg-indigo-50/70">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-900 uppercase">Tachycardia</span>
                <Activity className="w-4 h-4 text-indigo-700" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-indigo-800 font-mono">
                {triage.clinicalAlerts?.tachycardiaCount || 0}
              </div>
              <p className="mt-1 text-xs text-indigo-700">Pulse &gt; 100 bpm</p>
            </div>

            <div className="p-4 rounded-md border border-purple-200 bg-purple-50/70">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 uppercase">Severe Pain</span>
                <AlertTriangle className="w-4 h-4 text-purple-700" />
              </div>
              <div className="mt-2 text-2xl font-extrabold text-purple-800 font-mono">
                {triage.clinicalAlerts?.severePainCount || 0}
              </div>
              <p className="mt-1 text-xs text-purple-700">Pain Scale &gt;= 7 / 10</p>
            </div>
          </div>
        </div>

        {/* Breakdown Sections: Departments & Acuity Priority */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Department Breakdown */}
          <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Department Clinical Routing Volume
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Bilang ng pasyenteng itinalaga ng Triage sa bawat klinika
            </p>

            <div className="mt-5 space-y-3">
              {['OB_GYN', 'PEDIATRICS', 'INTERNAL_MEDICINE', 'SURGERY', 'EENT'].map((dept) => {
                const count = triage.departmentBreakdown?.[dept] || 0;
                const total = triage.totalTriagedToday || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={dept} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-semibold text-slate-800">
                        {departmentLabels[dept] || dept}
                      </span>
                      <span className="font-mono text-slate-600 font-bold">
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
                      <div
                        className="bg-teal-700 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Acuity Level Breakdown */}
          <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-2xs">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Triage Priority Acuity Distribution
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Klasipikasyon ng mga pasyente ayon sa antas ng pangangailangang medikal
            </p>

            <div className="mt-5 grid grid-cols-2 gap-3.5">
              <div className="p-4 rounded-md border border-slate-300 bg-slate-50">
                <span className="text-xs font-bold text-slate-600 uppercase">Standard (Green)</span>
                <div className="mt-1 text-2xl font-extrabold text-slate-900 font-mono">
                  {triage.priorityBreakdown?.STANDARD || 0}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">Non-urgent outpatients</p>
              </div>

              <div className="p-4 rounded-md border border-amber-300 bg-amber-50">
                <span className="text-xs font-bold text-amber-800 uppercase">Priority (Yellow)</span>
                <div className="mt-1 text-2xl font-extrabold text-amber-800 font-mono">
                  {triage.priorityBreakdown?.PRIORITY || 0}
                </div>
                <p className="text-xs text-amber-700 mt-0.5">Senior, PWD, Pregnant</p>
              </div>

              <div className="p-4 rounded-md border border-rose-300 bg-rose-50">
                <span className="text-xs font-bold text-rose-800 uppercase">Urgent (Orange)</span>
                <div className="mt-1 text-2xl font-extrabold text-rose-800 font-mono">
                  {triage.priorityBreakdown?.URGENT || 0}
                </div>
                <p className="text-xs text-rose-700 mt-0.5">Severe symptoms, fast-track</p>
              </div>

              <div className="p-4 rounded-md border border-purple-300 bg-purple-50">
                <span className="text-xs font-bold text-purple-800 uppercase">Resuscitation (Red)</span>
                <div className="mt-1 text-2xl font-extrabold text-purple-800 font-mono">
                  {triage.priorityBreakdown?.RESUSCITATION || 0}
                </div>
                <p className="text-xs text-purple-700 mt-0.5">Emergency direct transfer</p>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Triage Assessments Table */}
        <div className="bg-white border border-slate-300 rounded-lg p-6 shadow-2xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Recent Triage Patient Assessments
              </h2>
              <p className="text-xs sm:text-sm text-slate-500">
                Huling mga pasyenteng sinuri sa Station 1 Triage Counter
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500">
              Showing {triage.recentAssessments?.length || 0} entries
            </span>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-300">
                <tr>
                  <th className="py-2.5 px-3">Triage Number</th>
                  <th className="py-2.5 px-3">Patient Name</th>
                  <th className="py-2.5 px-3">Assigned Dept</th>
                  <th className="py-2.5 px-3">Priority Level</th>
                  <th className="py-2.5 px-3">Vital Signs (BP / Temp / HR)</th>
                  <th className="py-2.5 px-3">Station Status</th>
                  <th className="py-2.5 px-3 text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {triage.recentAssessments?.length > 0 ? (
                  triage.recentAssessments.map((a: any) => (
                    <tr key={a.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-teal-800">
                        {a.triageNumber}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">{a.patientName}</td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {departmentLabels[a.department] || a.department}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] border ${priorityBadgeStyle(
                            a.priorityLevel
                          )}`}
                        >
                          {a.priorityLevel}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {a.bloodPressure} &bull; {a.temperature}&deg;C &bull; {a.heartRate} bpm
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                          {a.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-slate-500">
                        {new Date(a.createdAt).toLocaleTimeString('fil-PH', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      Walang naitalang triage assessment sa kasalukuyan.
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
