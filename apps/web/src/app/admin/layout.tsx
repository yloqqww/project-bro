'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { auditedSignOut } from '@/lib/audited-sign-out';
import { readJsonResponse } from '@/lib/client-response';
import LogoutConfirmModal from '@/components/LogoutConfirmModal';
import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  Settings,
  FileText,
  ChevronRight,
  LogOut,
  Menu,
  X,
  Bell,
  Search,
  Check,
  CheckCheck,
  Trash2,
  Clock,
  AlertCircle,
  Info,
  User,
  CalendarCheck,
  FileHeart,
  Radio,
  Server,
  ShieldCheck,
  LogIn,
  MessageSquareText,
  BarChart3,
  ChevronLeft
} from 'lucide-react';

type Notification = {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  category?: string;
  title: string;
  message: string;
  staffName?: string | null;
  staffEmail?: string | null;
  staffRole?: string | null;
  staffSpecialty?: string | null;
  staffRoom?: string | null;
  createdAt: string;
  isRead: boolean;
};

const navGroups = [
  {
    label: 'Operations',
    items: [
      { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
      { name: 'Patient Registry', href: '/admin/patients', icon: User },
      { name: 'Patient Master Index', href: '/admin/patients/master-index', icon: ShieldCheck },
      { name: 'Appointments', href: '/admin/appointments', icon: CalendarCheck },
      { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
    ]
  },
  {
    label: 'Clinical & Schedules',
    items: [
      { name: 'Medical Records', href: '/admin/medical-records', icon: FileHeart },
      { name: 'Doctor Schedules', href: '/admin/schedules', icon: Calendar },
      { name: 'Staff Messages', href: '/admin/messages', icon: MessageSquareText },
    ]
  },
  {
    label: 'System & Security',
    items: [
      { name: 'Staff Accounts', href: '/admin/staff', icon: Users },
      { name: 'Activity Logs (Audit)', href: '/admin/audit-logs', icon: FileText },
      { name: 'Settings', href: '/admin/settings', icon: Settings },
    ]
  }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [toastNotification, setToastNotification] = useState<Notification | null>(null);
  const isInitialLoad = useRef(true);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=40');
      const data = await readJsonResponse<any>(res);
      if (!res.ok || !data.success) throw new Error(data.error || 'Failed to load notifications.');
      if (data.success && Array.isArray(data.notifications)) {
        setNotifications((prev) => {
          if (!isInitialLoad.current && prev.length > 0) {
            const prevIds = new Set(prev.map((p) => p.id));
            const newStaffLogins = data.notifications.filter(
              (n: Notification) => !prevIds.has(n.id) && !n.isRead && n.category === 'STAFF_LOGIN'
            );
            if (newStaffLogins.length > 0) {
              setToastNotification(newStaffLogins[0]);
            }
          }
          isInitialLoad.current = false;
          return data.notifications;
        });
        setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : 0);
      }
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
  };

  useEffect(() => {
    if (pathname === '/admin/login') return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [pathname]);

  useEffect(() => {
    if (toastNotification) {
      const timer = setTimeout(() => {
        setToastNotification(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [toastNotification]);

  const handleLogout = async () => {
    await auditedSignOut('/admin/login');
  };

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await fetch('/api/admin/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const deleteNotification = async (id: string) => {
    const target = notifications.find((n) => n.id === id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
    try {
      await fetch('/api/admin/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const clearAllNotifications = async () => {
    setNotifications([]);
    setUnreadCount(0);
    try {
      await fetch('/api/admin/notifications', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const diffMs = Date.now() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      if (diffSec < 60) return 'Just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHrs = Math.floor(diffMin / 60);
      if (diffHrs < 24) return `${diffHrs}h ago`;
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getRoleBadge = (role?: string | null) => {
    switch (role) {
      case 'DOCTOR':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            DOCTOR
          </span>
        );
      case 'NURSE':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200">
            TRIAGE
          </span>
        );
      case 'RECEPTIONIST':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            OPD
          </span>
        );
      case 'ADMIN':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
            ADMIN
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            STAFF
          </span>
        );
    }
  };


  const getBreadcrumb = () => {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length < 2) return 'Dashboard';
    
    const page = segments[segments.length - 1];
    return page
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (pathname === '/admin/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 text-sm antialiased">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 bg-white border-r border-slate-200 flex flex-col justify-between transition-all duration-200 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isSidebarCollapsed ? 'w-16' : 'w-60'}`}
      >
        <div>
          {/* App Brand Header */}
          <div className={`h-13 px-3 flex items-center border-b border-slate-200 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isSidebarCollapsed && (
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 bg-teal-800 text-white rounded flex items-center justify-center font-bold text-xs tracking-wider shrink-0">
                  LMC
                </div>
                <div className="leading-tight min-w-0">
                  <span className="font-bold text-slate-900 text-sm tracking-tight block truncate">Laguna Medical</span>
                  <span className="text-[11px] text-slate-500 block truncate">Admin Portal</span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setIsSidebarCollapsed((prev) => !prev)}
              className="hidden lg:flex w-7 h-7 rounded border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 text-slate-600 hover:text-teal-800 items-center justify-center transition-colors cursor-pointer shrink-0"
              title={isSidebarCollapsed ? 'Palawakin ang Sidebar' : 'I-collapse ang Sidebar'}
            >
              {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-1 text-slate-500 hover:text-slate-700"
              aria-label="Close sidebar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Navigation Groups */}
          <nav className="p-2.5 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)]">
            {(() => {
              const allHrefs = navGroups.flatMap((g) => g.items.map((i) => i.href));
              const activeHref = allHrefs
                .filter((href) => pathname === href || pathname.startsWith(href + '/'))
                .sort((a, b) => b.length - a.length)[0];

              return navGroups.map((group) => (
              <div key={group.label} className="space-y-1">
                {!isSidebarCollapsed && (
                  <p className="px-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    {group.label}
                  </p>
                )}
                {group.items.map((item) => {
                  const isActive = item.href === activeHref;
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      title={item.name}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center rounded-md text-sm transition-colors ${
                        isSidebarCollapsed ? 'justify-center p-2.5' : 'space-x-2.5 px-2.5 py-2'
                      } ${
                        isActive
                          ? 'bg-teal-800 text-white font-bold shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      {!isSidebarCollapsed && <span className="truncate">{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            ));
            })()}
          </nav>
        </div>

        {/* Sidebar Footer: User Profile */}
        <div className="border-t border-slate-200 bg-slate-50/50 p-2.5">
          <div className={`flex items-center ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isSidebarCollapsed && (
              <div className="flex items-center space-x-2 min-w-0">
                <div className="w-7 h-7 rounded bg-teal-100 text-teal-900 font-bold flex items-center justify-center text-xs shrink-0">
                  {session?.user?.email?.charAt(0).toUpperCase() || 'A'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-900 truncate">
                    {session?.user?.email?.split('@')[0] || 'Admin'}
                  </p>
                  <p className="text-[10px] text-slate-500 truncate uppercase font-semibold">ADMIN</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setIsLogoutModalOpen(true)}
              title="Sign Out"
              className="p-1.5 text-slate-500 hover:text-red-600 rounded hover:bg-slate-200/70 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Wrapper */}
      <div className={`transition-all duration-200 ${isSidebarCollapsed ? 'lg:pl-16' : 'lg:pl-60'}`}>
        {/* Top App Header */}
        <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
          <div className="h-13 px-4 sm:px-6 lg:px-8 flex items-center justify-between w-full">
            {/* Left: Breadcrumbs and mobile toggle */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-1.5 rounded hover:bg-slate-100 text-slate-600"
                aria-label="Open sidebar"
              >
                <Menu className="w-4 h-4" />
              </button>

              <div className="flex items-center space-x-1.5 text-[13px]">
                <span className="text-slate-400">Laguna Medical Center</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-medium text-slate-900">{getBreadcrumb()}</span>
              </div>
            </div>

            {/* Right: Notification & Menu */}
            <div className="flex items-center space-x-2.5">
              {/* Notification Button */}
              <div className="relative">
                <button 
                  onClick={() => setNotificationOpen(!notificationOpen)}
                  className="relative p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors"
                  aria-label="Staff & System Notifications"
                  title="Staff & System Notifications"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm animate-pulse">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Drawer */}
                {notificationOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setNotificationOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-88 sm:w-96 bg-white rounded-lg shadow-xl border border-slate-200 z-50 text-xs overflow-hidden">
                      <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-semibold text-slate-900">Notifications</span>
                          {unreadCount > 0 ? (
                            <span className="px-1.5 py-0.2 bg-blue-100 text-blue-700 font-medium rounded-full text-[10px]">
                              {unreadCount} new
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 font-medium rounded-full text-[10px]">
                              {notifications.length}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2">
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllAsRead}
                              className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
                              title="Mark all as read"
                            >
                              <CheckCheck className="w-3.5 h-3.5" />
                              <span>Read all</span>
                            </button>
                          )}
                          {notifications.length > 0 && (
                            <button
                              onClick={clearAllNotifications}
                              className="text-[11px] text-slate-400 hover:text-red-600 flex items-center space-x-1 transition-colors"
                              title="Clear all notifications"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Clear</span>
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="divide-y divide-slate-100 max-h-80 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="py-8 text-center px-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-2">
                              <Bell className="w-5 h-5 text-slate-300" />
                            </div>
                            <p className="text-xs font-medium text-slate-600">No staff login alerts yet</p>
                            <p className="text-[11px] text-slate-400 mt-1 max-w-[240px] mx-auto">
                              When doctors, nurses, or receptionists log in, notifications will appear here.
                            </p>
                          </div>
                        ) : (
                          notifications.map((n) => {
                            const isStaffLogin = n.category === 'STAFF_LOGIN' || n.title.toLowerCase().includes('logged in') || n.title.toLowerCase().includes('login');
                            return (
                              <div
                                key={n.id}
                                className={`p-3 transition-colors ${
                                  !n.isRead ? 'bg-blue-50/40 hover:bg-blue-50/60' : 'hover:bg-slate-50'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                                    {getRoleBadge(n.staffRole)}
                                    <span className="font-semibold text-slate-900 text-xs">
                                      {n.staffName || n.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1 flex-shrink-0">
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {formatTime(n.createdAt)}
                                    </span>
                                    {!n.isRead && (
                                      <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                                    )}
                                  </div>
                                </div>

                                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                                  {n.message}
                                </p>

                                <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-100/80">
                                  <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                                    {n.staffRoom && (
                                      <span className="bg-slate-100 text-slate-600 px-1 py-0.5 rounded">
                                        {n.staffRoom}
                                      </span>
                                    )}
                                    {n.staffEmail && (
                                      <span className="truncate max-w-[140px]">{n.staffEmail}</span>
                                    )}
                                  </div>

                                  <div className="flex items-center space-x-1.5">
                                    {!n.isRead && (
                                      <button
                                        onClick={() => markAsRead(n.id)}
                                        className="text-[10px] text-blue-600 hover:text-blue-800 font-medium px-1.5 py-0.5 rounded hover:bg-blue-50 transition-colors"
                                      >
                                        Mark read
                                      </button>
                                    )}
                                    <button
                                      onClick={() => deleteNotification(n.id)}
                                      className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-slate-100 transition-colors"
                                      title="Delete notification"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* User Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                  className="flex items-center space-x-2 pl-2 pr-1.5 py-1 rounded hover:bg-slate-100 text-[13px] text-slate-700"
                >
                  <span className="w-6 h-6 rounded bg-slate-900 text-white font-medium flex items-center justify-center text-xs">
                    {session?.user?.email?.charAt(0).toUpperCase() || 'A'}
                  </span>
                  <span className="hidden md:inline font-medium text-slate-900 text-[13px]">
                    {session?.user?.email || 'admin@clinic.local'}
                  </span>
                </button>

                {profileMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setProfileMenuOpen(false)}
                    />
                    <div className="absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-slate-200 py-1.5 z-50 text-xs">
                      <div className="px-3 py-2 border-b border-slate-100">
                        <p className="font-medium text-slate-900">{session?.user?.email || 'admin@clinic.local'}</p>
                        <p className="text-slate-400 text-[11px] mt-0.5">Role: System Administrator</p>
                      </div>
                      <Link
                        href="/admin/settings"
                        onClick={() => setProfileMenuOpen(false)}
                        className="block px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                      >
                        System Preferences
                      </Link>
                      <button
                        onClick={() => {
                          setProfileMenuOpen(false);
                          setIsLogoutModalOpen(true);
                        }}
                        className="w-full text-left px-3 py-1.5 text-red-600 hover:bg-red-50 flex items-center space-x-2"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Floating Real-time Staff Login Toast */}
        {toastNotification && (
          <div className="fixed top-16 right-6 z-50 max-w-sm w-full bg-white border border-blue-200 shadow-2xl rounded-xl p-4 transition-all duration-300 flex items-start space-x-3 ring-1 ring-black/5">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
              <LogIn className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">
                  {toastNotification.title}
                </span>
                <button
                  onClick={() => setToastNotification(null)}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                  aria-label="Dismiss toast"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-1 leading-snug">
                {toastNotification.message}
              </p>
              <div className="mt-2.5 flex items-center justify-between">
                <span className="text-[10px] text-slate-400 font-mono">Just now</span>
                <button
                  onClick={() => {
                    setNotificationOpen(true);
                    setToastNotification(null);
                  }}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-800"
                >
                  View alerts &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workspace Body */}
        <main className="p-4 sm:p-6 lg:p-8 w-full">
          {children}
        </main>
      </div>

      {/* Mobile Drawer Backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        userName={session?.user?.name || session?.user?.email || 'Administrator'}
        userRole="ADMINISTRATOR"
        description="Sigurado ka bang nais mong mag-sign out mula sa Admin Portal? Magtatapos ang inyong administrative session."
        onConfirmLogout={handleLogout}
      />
    </div>
  );
}

