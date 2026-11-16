'use client';

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Flame,
  Inbox,
  Loader2,
  LockKeyhole,
  Megaphone,
  MessageSquareText,
  RefreshCw,
  Send,
  UserRound,
} from 'lucide-react';
import { StaffWorkstationSidebar } from '@/components/StaffWorkstationSidebar';

type Role = 'ADMIN' | 'DOCTOR' | 'NURSE' | 'RECEPTIONIST';
type Priority = 'ROUTINE' | 'IMPORTANT' | 'URGENT';
type MessageItem = {
  id: string;
  senderId: string | null;
  recipientId: string | null;
  senderName: string;
  senderRole: string;
  recipientRole: string;
  body: string;
  priority: Priority;
  readAt: string | null;
  acknowledgedAt: string | null;
  createdAt: string;
};
type Conversation = {
  id: string;
  queueTicketId: string;
  status: 'OPEN' | 'RESOLVED';
  resolvedAt: string | null;
  updatedAt: string;
  patientId: string;
  patientName: string;
  queueNumber: number;
  queueStatus: string;
  queuePriority: number;
  doctorName: string;
  doctorRoom: string | null;
  messages: MessageItem[];
};
type Announcement = {
  id: string;
  creatorName: string;
  targetRole: string;
  title: string;
  body: string;
  priority: Priority;
  createdAt: string;
  isRead: boolean;
};
type QueueTicket = {
  id: string;
  ticketNumber: string;
  patientName: string;
  doctor: string;
  room: string;
  priority: string;
  status: string;
};

type ChatThreadTarget = {
  key: string;
  conversationId: string | null;
  queueTicketId: string;
  patientName: string;
  queueLabel: string;
  doctorName: string;
  doctorRoom: string | null;
  status: 'OPEN' | 'RESOLVED' | 'NEW';
  unreadCount: number;
  lastMessage: string;
  isUrgent: boolean;
  messages: MessageItem[];
};

const roleLabels: Record<Role, string> = {
  ADMIN: 'Admin',
  DOCTOR: 'Doctor',
  NURSE: 'Triage',
  RECEPTIONIST: 'OPD',
};

const backLinks: Record<Role, string> = {
  ADMIN: '/admin/dashboard',
  DOCTOR: '/doctor/queue',
  NURSE: '/triage',
  RECEPTIONIST: '/reception/checkin',
};

function getError(data: unknown, fallback: string) {
  if (data && typeof data === 'object' && 'error' in data) {
    const error = (data as { error?: string | { message?: string } }).error;
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
  }
  return fallback;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export default function StaffMessagesPage() {
  const { data: session, status: sessionStatus } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const role = session?.user?.role as Role | undefined;
  const embeddedInAdmin = pathname.startsWith('/admin/');
  const currentUserId = session?.user?.id;

  const [activeView, setActiveView] = useState<'handoffs' | 'announcements'>('handoffs');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tickets, setTickets] = useState<QueueTicket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [messageBody, setMessageBody] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [targetRole, setTargetRole] = useState('ALL_STAFF');

  useEffect(() => {
    if (sessionStatus === 'authenticated' && role === 'ADMIN' && pathname === '/messages') {
      router.replace('/admin/messages');
    }
  }, [pathname, role, router, sessionStatus]);

  const loadMessages = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await fetch('/api/staff-messages', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(getError(data, 'Hindi ma-load ang messages.'));
      setConversations(Array.isArray(data.conversations) ? data.conversations : []);
      setAnnouncements(Array.isArray(data.announcements) ? data.announcements : []);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Hindi ma-load ang messages.' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    if (!role || role === 'ADMIN') return;
    try {
      const response = await fetch('/api/queue', { cache: 'no-store' });
      const data = await response.json();
      if (response.ok && Array.isArray(data.tickets)) {
        setTickets(
          data.tickets.filter((ticket: QueueTicket) => !['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(ticket.status))
        );
      }
    } catch {
      // Keep chat usable if queue refresh fails
    }
  }, [role]);

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !role) return;
    void loadMessages();
    void loadTickets();
    const interval = window.setInterval(() => {
      void loadMessages(true);
      void loadTickets();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [sessionStatus, role, loadMessages, loadTickets]);

  useEffect(() => {
    if (role === 'ADMIN') setActiveView('announcements');
  }, [role]);

  // Combine existing conversations + active queue tickets into a single 1-click sidebar list
  const chatTargets = useMemo<ChatThreadTarget[]>(() => {
    const map = new Map<string, ChatThreadTarget>();

    for (const conv of conversations) {
      const last = conv.messages.at(-1);
      const unreadCount = conv.messages.filter((m) => m.recipientId === currentUserId && !m.readAt).length;
      map.set(conv.queueTicketId, {
        key: conv.queueTicketId,
        conversationId: conv.id,
        queueTicketId: conv.queueTicketId,
        patientName: conv.patientName,
        queueLabel: `#${conv.queueNumber}`,
        doctorName: conv.doctorName,
        doctorRoom: conv.doctorRoom,
        status: conv.status,
        unreadCount,
        lastMessage: last?.body || 'Walang mensahe',
        isUrgent: last?.priority === 'URGENT',
        messages: conv.messages,
      });
    }

    for (const ticket of tickets) {
      if (!map.has(ticket.id)) {
        map.set(ticket.id, {
          key: ticket.id,
          conversationId: null,
          queueTicketId: ticket.id,
          patientName: ticket.patientName,
          queueLabel: ticket.ticketNumber,
          doctorName: ticket.doctor,
          doctorRoom: ticket.room || null,
          status: 'NEW',
          unreadCount: 0,
          lastMessage: 'Pindutin para mag-message...',
          isUrgent: ticket.priority === 'URGENT',
          messages: [],
        });
      }
    }

    return Array.from(map.values());
  }, [conversations, tickets, currentUserId]);

  // Auto-select the first patient/thread so the user doesn't have to click to open
  useEffect(() => {
    if (!selectedTicketId && chatTargets.length > 0) {
      setSelectedTicketId(chatTargets[0].queueTicketId);
    }
  }, [chatTargets, selectedTicketId]);

  const selectedTarget = useMemo(
    () => chatTargets.find((item) => item.queueTicketId === selectedTicketId) || null,
    [chatTargets, selectedTicketId]
  );

  const clinicalUnread = useMemo(
    () =>
      conversations.reduce(
        (count, conversation) =>
          count + conversation.messages.filter((message) => message.recipientId === currentUserId && !message.readAt).length,
        0
      ),
    [conversations, currentUserId]
  );
  const announcementUnread = announcements.filter((announcement) => !announcement.isRead).length;

  const updateMessage = useCallback(async (payload: Record<string, string>) => {
    const response = await fetch('/api/staff-messages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(getError(data, 'Hindi na-update ang message.'));
  }, []);

  // Automatically mark messages as read when viewing the selected conversation
  useEffect(() => {
    if (!selectedTarget?.conversationId || selectedTarget.unreadCount === 0) return;
    void (async () => {
      try {
        await updateMessage({ action: 'markRead', conversationId: selectedTarget.conversationId! });
        await loadMessages(true);
      } catch {
        // Ignore read receipt error
      }
    })();
  }, [selectedTarget, updateMessage, loadMessages]);

  // Automatically mark unread announcements as read when opening Announcements tab
  useEffect(() => {
    if (activeView !== 'announcements') return;
    const unreadList = announcements.filter((a) => !a.isRead);
    if (unreadList.length === 0) return;
    void (async () => {
      try {
        await Promise.all(unreadList.map((a) => updateMessage({ action: 'readAnnouncement', announcementId: a.id })));
        await loadMessages(true);
      } catch {
        // Ignore read receipt error
      }
    })();
  }, [activeView, announcements, updateMessage, loadMessages]);

  const sendClinicalMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selectedTarget || !messageBody.trim() || saving) return;
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch('/api/staff-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'message',
          queueTicketId: selectedTarget.queueTicketId,
          body: messageBody.trim(),
          priority: isUrgent ? 'URGENT' : 'ROUTINE',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(getError(data, 'Hindi naipadala ang message.'));
      setMessageBody('');
      setIsUrgent(false);
      await loadMessages(true);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Hindi naipadala ang message.' });
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void sendClinicalMessage();
    }
  };

  const sendAnnouncement = async (event: FormEvent) => {
    event.preventDefault();
    if (!messageBody.trim() || saving) return;
    setSaving(true);
    setNotice(null);
    const computedTitle =
      announcementTitle.trim().length >= 3
        ? announcementTitle.trim()
        : messageBody.trim().slice(0, 60) + (messageBody.trim().length > 60 ? '...' : '');
    try {
      const response = await fetch('/api/staff-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'announce',
          title: computedTitle,
          body: messageBody.trim(),
          targetRole,
          priority: isUrgent ? 'URGENT' : 'ROUTINE',
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(getError(data, 'Hindi naipadala ang announcement.'));
      setAnnouncementTitle('');
      setMessageBody('');
      setIsUrgent(false);
      setNotice({ type: 'success', text: 'Na-post na ang abiso sa staff.' });
      await loadMessages(true);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Hindi naipadala ang announcement.' });
    } finally {
      setSaving(false);
    }
  };

  const resolveConversation = async () => {
    if (!selectedTarget?.conversationId) return;
    try {
      await updateMessage({ action: 'resolve', conversationId: selectedTarget.conversationId });
      await loadMessages(true);
    } catch (error) {
      setNotice({ type: 'error', text: error instanceof Error ? error.message : 'Hindi na-resolve ang usapan.' });
    }
  };

  if (sessionStatus === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-100 text-sm font-medium text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-teal-700" /> Loading messages...
      </div>
    );
  }

  if (!role || !backLinks[role]) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md rounded-lg border border-rose-200 bg-white p-6 text-center">
          <LockKeyhole className="mx-auto h-7 w-7 text-rose-700" />
          <h1 className="mt-3 font-bold">Staff access required</h1>
          <p className="mt-1 text-sm text-slate-600">Hindi available ang internal messages para sa account na ito.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${embeddedInAdmin ? 'min-h-full' : 'min-h-screen'} bg-slate-100 text-slate-900`}>
      <div className="w-full px-4 py-4 sm:px-6 lg:px-8">
        {/* Compact Top Bar */}
        <header className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-800 text-white">
              <MessageSquareText className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900">Clinic Messenger</h1>
                <span className="rounded bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800">
                  {roleLabels[role]}
                </span>
              </div>
              <p className="text-xs text-slate-500">Mabilis na usapan para sa pila ng pasyente at abiso ng clinic</p>
            </div>
          </div>

          {/* Simple 2-Tab Switch + Back Button */}
          <div className="flex items-center gap-2">
            {role !== 'ADMIN' && (
              <div className="flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveView('handoffs')}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-bold transition ${
                    activeView === 'handoffs' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Inbox className="h-3.5 w-3.5" />
                  Patient Chat
                  {clinicalUnread > 0 && (
                    <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] text-white">{clinicalUnread}</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveView('announcements')}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-bold transition ${
                    activeView === 'announcements' ? 'bg-white text-teal-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Megaphone className="h-3.5 w-3.5" />
                  Abiso
                  {announcementUnread > 0 && (
                    <span className="rounded-full bg-rose-600 px-1.5 py-0.2 text-[10px] text-white">{announcementUnread}</span>
                  )}
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                void loadMessages(true);
                void loadTickets();
              }}
              disabled={refreshing}
              title="I-refresh"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            {!embeddedInAdmin && (
              <Link
                href={backLinks[role]}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-bold text-white hover:bg-slate-800"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Balik
              </Link>
            )}
          </div>
        </header>

        {notice && (
          <div
            role="status"
            className={`mb-3 flex items-center justify-between gap-2 rounded-lg border px-3.5 py-2.5 text-xs font-medium ${
              notice.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {notice.type === 'success' ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              <span>{notice.text}</span>
            </div>
            <button type="button" onClick={() => setNotice(null)} className="text-[11px] font-bold underline">
              Isara
            </button>
          </div>
        )}

        {/* VIEW 1: SIMPLE PATIENT CHAT (Triage / OPD / Doctor) */}
        <div className="flex flex-col lg:flex-row items-start gap-4">
          {!embeddedInAdmin && <StaffWorkstationSidebar role={role} />}
          <div className="flex-1 min-w-0 w-full">
        {activeView === 'handoffs' && role !== 'ADMIN' ? (
          <div className="grid h-[calc(100vh-140px)] min-h-[500px] max-h-[680px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:grid-cols-[280px_minmax(0,1fr)]">
            {/* Left Sidebar: Active Patients + Chats */}
            <aside className="flex flex-col border-b border-slate-200 bg-slate-50/60 md:border-b-0 md:border-r">
              <div className="border-b border-slate-200 bg-white px-3.5 py-3">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Pumili ng Pasyente ({chatTargets.length})
                </h2>
              </div>

              <div className="flex-1 divide-y divide-slate-200/70 overflow-y-auto">
                {chatTargets.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                    <Inbox className="h-6 w-6 text-slate-400" />
                    <p className="mt-2 text-xs font-bold text-slate-700">Walang pasyente sa pila</p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Kapag may Queue Ticket na ang pasyente sa OPD, lilitaw agad siya rito.
                    </p>
                  </div>
                ) : (
                  chatTargets.map((item) => {
                    const isSelected = selectedTarget?.queueTicketId === item.queueTicketId;
                    return (
                      <button
                        type="button"
                        key={item.key}
                        onClick={() => setSelectedTicketId(item.queueTicketId)}
                        className={`flex w-full items-start gap-2.5 px-3.5 py-3 text-left transition ${
                          isSelected ? 'bg-teal-50/90 border-l-4 border-l-teal-700' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                          <UserRound className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-xs font-bold text-slate-900">{item.patientName}</p>
                            {item.unreadCount > 0 && (
                              <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                {item.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="truncate text-[11px] font-medium text-teal-800">
                            {item.queueLabel} · {item.doctorName}
                          </p>
                          <div className="mt-1 flex items-center justify-between gap-1">
                            <p className="truncate text-[11px] text-slate-500">{item.lastMessage}</p>
                            {item.isUrgent && (
                              <span className="shrink-0 rounded bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-rose-700">
                                Urgent
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </aside>

            {/* Right Panel: Direct Chat Box */}
            <section className="flex flex-col bg-white">
              {!selectedTarget ? (
                <div className="flex flex-1 flex-col items-center justify-center p-6 text-center text-slate-500">
                  <MessageSquareText className="h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-bold text-slate-700">Pumili ng pasyente sa kaliwa</p>
                  <p className="mt-0.5 text-xs">Isang click lang para mag-message sa Doktor o Triage/OPD.</p>
                </div>
              ) : (
                <>
                  {/* Chat Header */}
                  <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-sm font-bold text-slate-900">{selectedTarget.patientName}</h2>
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                          {selectedTarget.queueLabel}
                        </span>
                        {selectedTarget.status === 'RESOLVED' && (
                          <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                            TAPOS NA
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">
                        {selectedTarget.doctorName}
                        {selectedTarget.doctorRoom ? ` · ${selectedTarget.doctorRoom}` : ''}
                      </p>
                    </div>

                    {selectedTarget.conversationId && selectedTarget.status !== 'RESOLVED' && (
                      <button
                        type="button"
                        onClick={() => void resolveConversation()}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> Tapos Na
                      </button>
                    )}
                  </div>

                  {/* Chat Messages Area */}
                  <div className="flex-1 space-y-2.5 overflow-y-auto bg-slate-50 p-4">
                    {selectedTarget.messages.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center text-center">
                        <p className="text-xs font-semibold text-slate-600">
                          Wala pang usapan para kay {selectedTarget.patientName}.
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          Mag-type lang sa baba at pindutin ang Enter o Send.
                        </p>
                      </div>
                    ) : (
                      selectedTarget.messages.map((message) => {
                        const mine = message.senderId === currentUserId;
                        return (
                          <div key={message.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                            <div
                              className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm ${
                                mine
                                  ? 'rounded-br-sm bg-teal-800 text-white'
                                  : 'rounded-bl-sm border border-slate-200 bg-white text-slate-800'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <span className={`font-bold ${mine ? 'text-teal-100' : 'text-slate-900'}`}>
                                  {mine ? 'Ikaw' : `${message.senderName} (${message.senderRole})`}
                                </span>
                                {message.priority === 'URGENT' && (
                                  <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white">
                                    Urgent
                                  </span>
                                )}
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{message.body}</p>
                              <p className={`mt-1 text-[10px] ${mine ? 'text-teal-200' : 'text-slate-400'}`}>
                                {formatTime(message.createdAt)}
                                {mine && (message.readAt ? ' · Seen' : ' · Sent')}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* 1-Line Quick Chat Input */}
                  <form onSubmit={sendClinicalMessage} className="border-t border-slate-200 bg-white p-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsUrgent((prev) => !prev)}
                        title="Markahan kung Urgent"
                        className={`inline-flex h-9 shrink-0 items-center gap-1 rounded-lg border px-2.5 text-xs font-bold transition ${
                          isUrgent
                            ? 'border-rose-300 bg-rose-600 text-white'
                            : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <Flame className="h-3.5 w-3.5" />
                        Urgent
                      </button>

                      <input
                        type="text"
                        required
                        minLength={2}
                        maxLength={1000}
                        value={messageBody}
                        onChange={(event) => setMessageBody(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Mag-message tungkol kay ${selectedTarget.patientName}...`}
                        className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-teal-700"
                      />

                      <button
                        type="submit"
                        disabled={saving || !messageBody.trim()}
                        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-teal-800 px-4 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50"
                      >
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                        Send
                      </button>
                    </div>
                  </form>
                </>
              )}
            </section>
          </div>
        ) : (
          /* VIEW 2: SIMPLE ANNOUNCEMENTS (Admin & Staff) */
          <div className="space-y-3">
            {role === 'ADMIN' && (
              <form onSubmit={sendAnnouncement} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-bold text-slate-900">Mag-post ng Abiso sa Staff</h2>
                  <div className="flex items-center gap-2">
                    <select
                      value={targetRole}
                      onChange={(event) => setTargetRole(event.target.value)}
                      className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs font-semibold text-slate-700"
                    >
                      <option value="ALL_STAFF">Para sa: Lahat ng Staff</option>
                      <option value="DOCTOR">Para sa: Mga Doktor</option>
                      <option value="NURSE">Para sa: Triage</option>
                      <option value="RECEPTIONIST">Para sa: OPD</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => setIsUrgent((prev) => !prev)}
                      className={`inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-xs font-bold ${
                        isUrgent
                          ? 'border-rose-300 bg-rose-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <Flame className="h-3.5 w-3.5" /> Urgent
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    maxLength={120}
                    value={announcementTitle}
                    onChange={(event) => setAnnouncementTitle(event.target.value)}
                    placeholder="Paksa (hal. Schedule Update)"
                    className="h-9 rounded-lg border border-slate-300 px-3 text-sm sm:w-56"
                  />
                  <input
                    type="text"
                    required
                    minLength={3}
                    maxLength={1000}
                    value={messageBody}
                    onChange={(event) => setMessageBody(event.target.value)}
                    placeholder="Isulat ang buong abiso para sa clinic staff..."
                    className="h-9 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                  />
                  <button
                    type="submit"
                    disabled={saving || !messageBody.trim()}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-teal-800 px-4 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50"
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Megaphone className="h-3.5 w-3.5" />}
                    I-post
                  </button>
                </div>
              </form>
            )}

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">Mga Abiso mula sa Admin</h2>
              </div>
              <div className="divide-y divide-slate-200">
                {announcements.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500">Wala pang naka-post na abiso.</div>
                ) : (
                  announcements.map((announcement) => (
                    <div key={announcement.id} className="p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-slate-900">{announcement.title}</h3>
                          {announcement.priority === 'URGENT' && (
                            <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
                              Urgent
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">{formatTime(announcement.createdAt)}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{announcement.body}</p>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        Mula kay {announcement.creatorName} · Para sa {announcement.targetRole.replaceAll('_', ' ')}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
