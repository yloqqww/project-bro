'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Radio,
  Stethoscope,
  Tv,
  UserPlus,
} from 'lucide-react';

type Role = 'ADMIN' | 'DOCTOR' | 'NURSE' | 'RECEPTIONIST';

type NavItem = {
  label: string;
  subLabel: string;
  href: string;
  icon: typeof FileText;
  newTab?: boolean;
};

const ROLE_CONFIG: Record<Role, { badge: string; title: string; items: NavItem[] }> = {
  DOCTOR: {
    badge: 'Doctor Desk',
    title: 'Navigasyon & Talaan',
    items: [
      { label: 'Pila ng Konsultasyon', subLabel: 'Live Queue Desk', href: '/doctor/queue', icon: Stethoscope },
      { label: 'Medical Records', subLabel: 'Live EHR Database', href: '/medical-records', icon: FileText },
      { label: 'Patient Registry', subLabel: 'Master Patient Index', href: '/patient-registry', icon: UserPlus },
      { label: 'Aking Schedule', subLabel: 'Clinic Duty & Hours', href: '/doctor/schedule', icon: Calendar },
      { label: 'Messages', subLabel: 'Patient Handoffs & Chat', href: '/messages', icon: MessageSquareText },
    ],
  },
  NURSE: {
    badge: 'Triage Booth',
    title: 'Navigasyon & Talaan',
    items: [
      { label: 'Triage Assessment', subLabel: 'Vitals & Screening', href: '/triage', icon: Activity },
      { label: 'Patient Registry', subLabel: 'Lahat ng Pasyente', href: '/patient-registry', icon: UserPlus },
      { label: 'Medical Records', subLabel: 'Live EHR Database', href: '/medical-records', icon: FileText },
      { label: 'Messages', subLabel: 'Patient Handoffs & Chat', href: '/messages', icon: MessageSquareText },
    ],
  },
  RECEPTIONIST: {
    badge: 'OPD Counter',
    title: 'Mga Pangunahing Gawain',
    items: [
      { label: 'I-tap ang RFID Card', subLabel: 'Check-in sa Pila', href: '/reception/checkin?tab=checkin', icon: Radio },
      { label: 'Magpalista ng Pasyente', subLabel: 'Bagong Pasyente & I-link ang RFID Card', href: '/reception/checkin?tab=register', icon: UserPlus },
      { label: 'Talaan ng Pila Ngayon', subLabel: 'Live Queue Monitoring', href: '/reception/checkin?tab=roster', icon: Clock },
      { label: 'Medical Records', subLabel: 'Live EHR Database • Lahat ng Pasyente', href: '/medical-records', icon: FileText },
      { label: 'Patient Registry', subLabel: 'Lahat ng Pasyente & RFID Cards', href: '/patient-registry', icon: UserPlus },
      { label: 'Messages', subLabel: 'Patient Handoffs & Chat', href: '/messages', icon: MessageSquareText },
      { label: 'Queue TV Display', subLabel: 'Buksan sa TV / Bagong Tab', href: '/queue-tv', icon: Tv, newTab: true },
    ],
  },
  ADMIN: {
    badge: 'Admin Portal',
    title: 'Clinic Navigation',
    items: [
      { label: 'Admin Dashboard', subLabel: 'Lagay ng Clinic', href: '/admin/dashboard', icon: LayoutDashboard },
      { label: 'Patient Registry', subLabel: 'Lahat ng Pasyente', href: '/admin/patients', icon: UserPlus },
      { label: 'Medical Records', subLabel: 'Live EHR Database', href: '/admin/medical-records', icon: FileText },
      { label: 'Staff Messages', subLabel: 'Announcements', href: '/admin/messages', icon: MessageSquareText },
    ],
  },
};

export function StaffWorkstationSidebar({ role }: { role?: string }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const normalizedRole: Role =
    role === 'DOCTOR' || role === 'NURSE' || role === 'RECEPTIONIST' || role === 'ADMIN'
      ? role
      : 'RECEPTIONIST';

  const config = ROLE_CONFIG[normalizedRole];

  return (
    <aside
      className={`transition-all duration-200 shrink-0 w-full ${
        isCollapsed ? 'lg:w-16' : 'lg:w-72'
      }`}
    >
      <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden sticky top-20">
        {/* Sidebar Header & Collapse Toggle */}
        <div
          className={`p-3 bg-slate-50 border-b border-slate-200 flex items-center ${
            isCollapsed ? 'justify-center' : 'justify-between'
          }`}
        >
          {!isCollapsed && (
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                {normalizedRole === 'RECEPTIONIST' && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Reception Menu
                  </span>
                )}
                <span className="text-[10px] px-2 py-0.5 rounded bg-teal-100 text-teal-800 font-bold border border-teal-200 uppercase tracking-wider">
                  {config.badge}
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900 mt-1 truncate">{config.title}</div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="w-8 h-8 rounded-md border border-slate-300 bg-white hover:bg-teal-50 hover:border-teal-300 text-slate-600 hover:text-teal-800 flex items-center justify-center transition-colors cursor-pointer shrink-0 shadow-2xs"
            title={isCollapsed ? 'Palawakin ang Sidebar (Expand)' : 'I-collapse ang Sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="p-2 space-y-1.5" aria-label="Workstation Navigation">
          {config.items.map((item) => {
            const Icon = item.icon;
            const itemPath = item.href.split('?')[0];
            const isActive = !item.href.includes('?') && (pathname === itemPath || pathname.startsWith(`${itemPath}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                target={item.newTab ? '_blank' : undefined}
                title={`${item.label} • ${item.subLabel}`}
                className={`w-full text-left rounded-lg transition-all flex items-center cursor-pointer border p-2.5 ${
                  isCollapsed ? 'justify-center' : 'space-x-3'
                } ${
                  isActive
                    ? 'bg-teal-800 text-white border-teal-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-teal-900 text-white' : 'bg-teal-50 text-teal-800'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold leading-tight truncate">{item.label}</div>
                    <div className={`text-xs mt-0.5 truncate ${isActive ? 'text-teal-100' : 'text-slate-500'}`}>
                      {item.subLabel}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

