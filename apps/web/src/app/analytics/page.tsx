'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  HeartPulse,
  Users,
  Clock,
  Stethoscope,
  RefreshCw,
  FileText,
  CreditCard,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  BarChart3,
  Calendar,
  Building2,
  CheckCircle2,
  ShieldAlert,
  Pill,
  PieChart
} from 'lucide-react';

export default function HospitalAnalyticsPage() {
  const [activeTab, setActiveTab] = useState<'all' | 'triage' | 'opd' | 'doctor'>('all');
  const [loading, setLoading] = useState(true);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/analytics');
      const data = await res.json();
      if (data.success) {
        setAnalyticsData(data);
        setLastRefreshed(new Date().toLocaleTimeString('fil-PH', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      }
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 15000); // 15s live refresh
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  const triage = analyticsData?.triage || {};
  const opd = analyticsData?.opd || {};
  const doctor = analyticsData?.doctor || {};

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col">
      {/* ── 1. HEADER (FULL SCREEN) ─────────────────────────────────── */}
      <header className="bg-white border-b border-slate-300 sticky top-0 z-30 shadow-2xs">
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-lg bg-teal-800 text-white font-bold flex items-center justify-center text-sm tracking-wider shadow-sm shrink-0">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <span className="font-bold text-slate-900 text-base sm:text-lg tracking-tight">Laguna Medical Center</span>
                <span className="px-2.5 py-0.5 bg-teal-100 text-teal-800 font-bold text-xs rounded border border-teal-200 uppercase tracking-wider">
                  Hospital Operational Analytics
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 leading-tight mt-0.5">
                Real-Time Clinical Performance, Patient Flow & Workstation Metrics
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
              href="/admin/dashboard"
              className="h-9 px-3.5 bg-teal-800 hover:bg-teal-900 text-white text-xs sm:text-sm font-bold rounded-md flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <span>Admin Portal</span>
            </Link>
          </div>
        </div>

        {/* ── NAVIGATION TABS ────────────────────────────────────────── */}
        <div className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 bg-slate-50 border-t border-slate-200 flex items-center space-x-1 overflow-x-auto py-1.5">
          {[
            { id: 'all', label: 'All Stations Overview', icon: Building2 },
            { id: 'triage', label: 'Station 1: Triage Analytics', icon: HeartPulse },
            { id: 'opd', label: 'Station 2: OPD Records Analytics', icon: Users },
            { id: 'doctor', label: 'Station 3: Doctor Consultation Analytics', icon: Stethoscope },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`h-9 px-3.5 rounded-md text-xs sm:text-sm font-bold flex items-center space-x-2 transition-all cursor-pointer whitespace-nowrap ${
                  isSelected
                    ? 'bg-teal-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* ── 2. MAIN CONTENT (FULL SCREEN) ───────────────────────────── */}
      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-10 py-6 flex-1 space-y-6">

        {/* ── SECTION A: TOP HIGH-LEVEL KPI METRICS ─────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Triage Volume */}
          <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Total Triaged (Station 1)</span>
              <HeartPulse className="w-4 h-4 text-teal-700" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black text-slate-900">{triage.totalTriagedToday ?? 0}</span>
              <span className="text-xs text-slate-500 font-medium">Ngayong Araw</span>
            </div>
            <div className="text-xs text-slate-600 border-t border-slate-100 pt-2 flex items-center justify-between">
              <span>All-time Triaged:</span>
              <strong className="text-slate-800 font-mono">{triage.totalTriagedAllTime ?? 0}</strong>
            </div>
          </div>

          {/* KPI 2: OPD Tickets */}
          <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>OPD Queue Tickets (Station 2)</span>
              <Users className="w-4 h-4 text-blue-700" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black text-slate-900">{opd.totalTicketsToday ?? 0}</span>
              <span className="text-xs text-slate-500 font-medium">Iniisyu Ngayong Araw</span>
            </div>
            <div className="text-xs text-slate-600 border-t border-slate-100 pt-2 flex items-center justify-between">
              <span>Nasa Pila (Waiting):</span>
              <strong className="text-amber-700 font-bold font-mono">{opd.statusBreakdown?.WAITING ?? 0}</strong>
            </div>
          </div>

          {/* KPI 3: Doctor Consultations */}
          <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>Consultations (Station 3)</span>
              <Stethoscope className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black text-slate-900">{doctor.totalConsultationsToday ?? 0}</span>
              <span className="text-xs text-slate-500 font-medium">Tapos na Ngayon</span>
            </div>
            <div className="text-xs text-slate-600 border-t border-slate-100 pt-2 flex items-center justify-between">
              <span>Kasalukuyang Kinokonsulta:</span>
              <strong className="text-teal-800 font-bold font-mono">{doctor.activeConsultationsCount ?? 0}</strong>
            </div>
          </div>

          {/* KPI 4: Registration & RFID */}
          <div className="bg-white border border-slate-300 rounded-xl p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
              <span>RFID & Patient Records</span>
              <CreditCard className="w-4 h-4 text-purple-700" />
            </div>
            <div className="flex items-baseline space-x-2">
              <span className="text-3xl font-black text-slate-900">{opd.totalPatientsCount ?? 0}</span>
              <span className="text-xs text-slate-500 font-medium">Kabuuang Pasyente</span>
            </div>
            <div className="text-xs text-slate-600 border-t border-slate-100 pt-2 flex items-center justify-between">
              <span>Aktibong RFID Cards:</span>
              <strong className="text-emerald-700 font-bold font-mono">{opd.activeRfidCardsCount ?? 0}</strong>
            </div>
          </div>
        </div>

        {/* ── SECTION B: TAB CONTENT ─────────────────────────────────── */}

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'all' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Triage Overview Card */}
              <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-7 h-7 rounded bg-teal-800 text-white font-bold text-xs flex items-center justify-center">1</span>
                    <h3 className="text-base font-bold text-slate-900">Station 1: Triage Flow</h3>
                  </div>
                  <Link href="/triage" className="text-xs font-bold text-teal-800 hover:underline">
                    Buksan Station &rarr;
                  </Link>
                </div>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600">Pending sa OPD Records:</span>
                    <strong className="text-amber-800 font-bold font-mono text-sm">{triage.pendingOpdCount ?? 0} pasyente</strong>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600">Naproseso na sa OPD:</span>
                    <strong className="text-emerald-800 font-bold font-mono text-sm">{triage.opdProcessedCount ?? 0} pasyente</strong>
                  </div>
                  
                  <div className="pt-2">
                    <span className="font-bold text-slate-800 block mb-2">Department Clinical Routing:</span>
                    <div className="space-y-1.5">
                      {Object.entries(triage.departmentBreakdown || {}).map(([dept, count]: any) => (
                        <div key={dept} className="flex items-center justify-between text-xs">
                          <span className="text-slate-600 font-medium">{dept.replace('_', ' ')}</span>
                          <span className="font-mono font-bold text-slate-900 px-2 py-0.5 rounded bg-slate-100">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* OPD Overview Card */}
              <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-7 h-7 rounded bg-blue-800 text-white font-bold text-xs flex items-center justify-center">2</span>
                    <h3 className="text-base font-bold text-slate-900">Station 2: OPD Records</h3>
                  </div>
                  <Link href="/reception/checkin" className="text-xs font-bold text-blue-800 hover:underline">
                    Buksan Station &rarr;
                  </Link>
                </div>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600">Estimated Average Wait Time:</span>
                    <strong className="text-blue-900 font-bold font-mono text-sm">{opd.averageWaitMinutes ?? 12} mins</strong>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600">Bagong Rehistro Ngayon:</span>
                    <strong className="text-slate-900 font-bold font-mono text-sm">{opd.newPatientsRegisteredToday ?? 0} pasyente</strong>
                  </div>

                  <div className="pt-2">
                    <span className="font-bold text-slate-800 block mb-2">Queue Priority Breakdown:</span>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Regular Pila:</span>
                        <span className="font-mono font-bold text-slate-900 px-2 py-0.5 rounded bg-slate-100">{opd.priorityBreakdown?.Regular ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Senior / PWD Priority:</span>
                        <span className="font-mono font-bold text-blue-900 px-2 py-0.5 rounded bg-blue-50 border border-blue-200">{opd.priorityBreakdown?.['Senior/PWD'] ?? 0}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 font-medium">Urgent Fast-Track:</span>
                        <span className="font-mono font-bold text-red-900 px-2 py-0.5 rounded bg-red-50 border border-red-200">{opd.priorityBreakdown?.Urgent ?? 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Doctor Overview Card */}
              <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-7 h-7 rounded bg-emerald-800 text-white font-bold text-xs flex items-center justify-center">3</span>
                    <h3 className="text-base font-bold text-slate-900">Station 3: Doctor Clinic</h3>
                  </div>
                  <Link href="/doctor/queue" className="text-xs font-bold text-emerald-800 hover:underline">
                    Buksan Station &rarr;
                  </Link>
                </div>

                <div className="space-y-3 text-xs sm:text-sm">
                  <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600">Average Consultation Duration:</span>
                    <strong className="text-emerald-900 font-bold font-mono text-sm">{doctor.averageConsultationMinutes ?? 15} mins</strong>
                  </div>
                  <div className="flex justify-between p-2.5 bg-slate-50 rounded border border-slate-200">
                    <span className="text-slate-600">Kabuuang Reseta Naitala:</span>
                    <strong className="text-slate-900 font-bold font-mono text-sm">{doctor.totalPrescriptionsIssued ?? 0} reseta</strong>
                  </div>

                  <div className="pt-2">
                    <span className="font-bold text-slate-800 block mb-2">Pangunahing Gamot na Inireseta:</span>
                    <div className="space-y-1.5">
                      {(doctor.topMedications || []).slice(0, 3).map((med: any) => (
                        <div key={med.name} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700 font-medium">{med.name}</span>
                          <span className="font-mono font-bold text-slate-900 px-2 py-0.5 rounded bg-slate-100">{med.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* 2. TRIAGE ANALYTICS TAB */}
        {activeTab === 'triage' && (
          <div className="space-y-6">
            {/* Clinical Screening Health Alerts Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1">
                <span className="text-xs font-bold text-red-800 uppercase tracking-wider block">Hypertension Alert</span>
                <span className="text-2xl font-black text-red-900">{triage.clinicalAlerts?.hypertensionCount ?? 0}</span>
                <span className="text-[11px] text-red-700 block">Pasyenteng may BP &ge; 140/90 mmHg</span>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1">
                <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">Fever Screening Alert</span>
                <span className="text-2xl font-black text-amber-900">{triage.clinicalAlerts?.feverCount ?? 0}</span>
                <span className="text-[11px] text-amber-700 block">Pasyenteng may Temp &ge; 37.8°C</span>
              </div>
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 space-y-1">
                <span className="text-xs font-bold text-rose-800 uppercase tracking-wider block">Tachycardia Alert</span>
                <span className="text-2xl font-black text-rose-900">{triage.clinicalAlerts?.tachycardiaCount ?? 0}</span>
                <span className="text-[11px] text-rose-700 block">Pasyenteng may Heart Rate &gt; 100 bpm</span>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 space-y-1">
                <span className="text-xs font-bold text-purple-800 uppercase tracking-wider block">Severe Pain Scale</span>
                <span className="text-2xl font-black text-purple-900">{triage.clinicalAlerts?.severePainCount ?? 0}</span>
                <span className="text-[11px] text-purple-700 block">Pasyenteng may Pain Score &ge; 7 / 10</span>
              </div>
            </div>

            {/* Department Routing Table */}
            <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Department Clinical Routing Volume (Saan Pinapunta ang Pasyente)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
                {Object.entries(triage.departmentBreakdown || {}).map(([dept, count]: any) => (
                  <div key={dept} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1">
                    <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">{dept.replace('_', ' ')}</span>
                    <span className="text-2xl font-black text-teal-900 font-mono">{count}</span>
                    <span className="text-[11px] text-slate-500 block">Pasyenteng na-triage</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent Triaged Roster */}
            <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-slate-900">
                Pinakahuling Pasyenteng Na-triage sa Station 1
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 text-slate-700 border-b border-slate-300 font-semibold uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Triage Slip</th>
                      <th className="py-2.5 px-3">Pangalan</th>
                      <th className="py-2.5 px-3">Kagawaran</th>
                      <th className="py-2.5 px-3">Priority</th>
                      <th className="py-2.5 px-3">Presyon (BP)</th>
                      <th className="py-2.5 px-3">Temperatura</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {(triage.recentAssessments || []).map((r: any) => (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-3 font-mono font-bold text-teal-800">{r.triageNumber}</td>
                        <td className="py-2.5 px-3 font-bold text-slate-900">{r.patientName}</td>
                        <td className="py-2.5 px-3">{r.department?.replace('_', ' ')}</td>
                        <td className="py-2.5 px-3">
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100">{r.priorityLevel}</span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">{r.bloodPressure || 'N/A'}</td>
                        <td className="py-2.5 px-3 font-mono">{r.temperature ? `${r.temperature}°C` : 'N/A'}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            r.status === 'PENDING_OPD' ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          }`}>
                            {r.status === 'PENDING_OPD' ? 'Waiting at OPD' : 'Processed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* 3. OPD RECORDS ANALYTICS TAB */}
        {activeTab === 'opd' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-1 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Average Wait Time sa Pila</span>
                <span className="text-3xl font-black text-blue-900 font-mono">{opd.averageWaitMinutes ?? 12} mins</span>
                <span className="text-xs text-slate-500 block">Mula check-in hanggang tawagin ng doktor</span>
              </div>
              <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-1 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Aktibong RFID Health Cards</span>
                <span className="text-3xl font-black text-emerald-900 font-mono">{opd.activeRfidCardsCount ?? 0}</span>
                <span className="text-xs text-slate-500 block">Naka-pares sa pasyente para sa 1-tap check-in</span>
              </div>
              <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-1 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Kabuuang Pasyente sa Database</span>
                <span className="text-3xl font-black text-slate-900 font-mono">{opd.totalPatientsCount ?? 0}</span>
                <span className="text-xs text-slate-500 block">May electronic health profile</span>
              </div>
            </div>

            {/* Queue Status Grid */}
            <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Katayuan ng Pila sa OPD (Queue Status Breakdown)
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-lg bg-amber-50 border border-amber-200">
                  <span className="text-xs font-bold text-amber-800 uppercase block">Waiting (Naghihintay)</span>
                  <span className="text-2xl font-black text-amber-950 font-mono">{opd.statusBreakdown?.WAITING ?? 0}</span>
                </div>
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <span className="text-xs font-bold text-blue-800 uppercase block">Called / Tinawag</span>
                  <span className="text-2xl font-black text-blue-950 font-mono">{opd.statusBreakdown?.CALLED ?? 0}</span>
                </div>
                <div className="p-4 rounded-lg bg-teal-50 border border-teal-200">
                  <span className="text-xs font-bold text-teal-800 uppercase block">In Consultation</span>
                  <span className="text-2xl font-black text-teal-950 font-mono">{opd.statusBreakdown?.IN_CONSULTATION ?? 0}</span>
                </div>
                <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-200">
                  <span className="text-xs font-bold text-emerald-800 uppercase block">Completed (Natapos)</span>
                  <span className="text-2xl font-black text-emerald-950 font-mono">{opd.statusBreakdown?.COMPLETED ?? 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4. DOCTOR CONSULTATION ANALYTICS TAB */}
        {activeTab === 'doctor' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-1 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Average Consultation Time</span>
                <span className="text-3xl font-black text-emerald-900 font-mono">{doctor.averageConsultationMinutes ?? 15} mins</span>
                <span className="text-xs text-slate-500 block">Kada pasyente sa loob ng klinika</span>
              </div>
              <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-1 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Kabuuang Reseta Naitala</span>
                <span className="text-3xl font-black text-teal-900 font-mono">{doctor.totalPrescriptionsIssued ?? 0}</span>
                <span className="text-xs text-slate-500 block">Electronic prescription slips</span>
              </div>
              <div className="bg-white border border-slate-300 rounded-xl p-4 space-y-1 shadow-sm">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">Natapos Ngayong Araw</span>
                <span className="text-3xl font-black text-slate-900 font-mono">{doctor.totalConsultationsToday ?? 0}</span>
                <span className="text-xs text-slate-500 block">Nalapatan ng SOAP notes</span>
              </div>
            </div>

            {/* Top Diagnoses & Prescriptions Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Diagnoses */}
              <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-base font-bold text-slate-900">
                  Pangunahing Diagnosis / Clinical Impressions (ICD-10)
                </h3>
                <div className="space-y-2">
                  {(doctor.topDiagnoses || []).map((diag: any, idx: number) => (
                    <div key={diag.name} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs sm:text-sm">
                      <div className="flex items-center space-x-2">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center font-mono">
                          {idx + 1}
                        </span>
                        <span className="font-semibold text-slate-800">{diag.name}</span>
                      </div>
                      <span className="font-mono font-bold text-teal-900 px-2.5 py-0.5 rounded bg-teal-50 border border-teal-200">
                        {diag.count} kaso
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Medications */}
              <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-base font-bold text-slate-900">
                  Pangunahing Gamot na Inireseta (Prescription Trends)
                </h3>
                <div className="space-y-2">
                  {(doctor.topMedications || []).map((med: any, idx: number) => (
                    <div key={med.name} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs sm:text-sm">
                      <div className="flex items-center space-x-2">
                        <Pill className="w-4 h-4 text-teal-700" />
                        <span className="font-semibold text-slate-800">{med.name}</span>
                      </div>
                      <span className="font-mono font-bold text-slate-900 px-2.5 py-0.5 rounded bg-slate-200">
                        {med.count} pasyente
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Doctor Duty Roster Performance */}
            {doctor.doctorPerformance && doctor.doctorPerformance.length > 0 && (
              <div className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm space-y-3">
                <h3 className="text-base font-bold text-slate-900">
                  Performance ng mga Doktor sa Duty (Workstation Performance)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs sm:text-sm border-collapse">
                    <thead className="bg-slate-100 text-slate-700 border-b border-slate-300 font-semibold uppercase text-xs">
                      <tr>
                        <th className="py-2.5 px-3">Doktor</th>
                        <th className="py-2.5 px-3">Kagawaran</th>
                        <th className="py-2.5 px-3">Silid / Room</th>
                        <th className="py-2.5 px-3">Natapos Ngayon</th>
                        <th className="py-2.5 px-3">Kasalukuyang Kinokonsulta</th>
                        <th className="py-2.5 px-3">Naghihintay sa Pila</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium">
                      {doctor.doctorPerformance.map((doc: any) => (
                        <tr key={doc.id} className="hover:bg-slate-50">
                          <td className="py-3 px-3 font-bold text-slate-900">{doc.name}</td>
                          <td className="py-3 px-3">{doc.specialty}</td>
                          <td className="py-3 px-3 font-mono">{doc.room}</td>
                          <td className="py-3 px-3 font-bold text-emerald-800 font-mono">{doc.completedToday}</td>
                          <td className="py-3 px-3 font-bold text-teal-800 font-mono">{doc.inSessionNow}</td>
                          <td className="py-3 px-3 font-bold text-amber-800 font-mono">{doc.waitingNow}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ── 3. FOOTER ──────────────────────────────────────────────── */}
      <footer className="bg-white border-t border-slate-300 py-3 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 text-center">
        Laguna Medical Center &bull; Operational Health Information & Analytics &bull; Provincial Capitol Compound, Santa Cruz, Laguna
      </footer>
    </div>
  );
}
