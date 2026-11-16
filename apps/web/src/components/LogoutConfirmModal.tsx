'use client';

import React, { useState } from 'react';
import { LogOut, AlertTriangle, Loader2, X } from 'lucide-react';
import { auditedSignOut } from '@/lib/audited-sign-out';

export interface LogoutConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  userName?: string;
  userRole?: string;
  onConfirmLogout?: () => Promise<void> | void;
}

export default function LogoutConfirmModal({
  isOpen,
  onClose,
  title = 'Kumpirmahin ang Pag-logout',
  description = 'Sigurado ka bang nais mong mag-sign out mula sa workstation na ito? Kakailanganin mong mag-log in muli upang maipagpatuloy ang iyong mga sesyon o transaksyon.',
  userName,
  userRole,
  onConfirmLogout,
}: LogoutConfirmModalProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  if (!isOpen) return null;

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      if (onConfirmLogout) {
        await onConfirmLogout();
      } else {
        await auditedSignOut('/');
      }
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
      <div 
        className="bg-white border border-slate-300 rounded-xl max-w-md w-full shadow-2xl overflow-hidden my-6 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-modal-title"
      >
        {/* Header */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-red-100 border border-red-200 text-red-700 flex items-center justify-center font-bold shadow-xs shrink-0">
              <LogOut className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <h3 id="logout-modal-title" className="text-sm font-bold text-slate-900 leading-tight">
                {title}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Laguna Medical Center &bull; Portal Security
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoggingOut}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition cursor-pointer disabled:opacity-50"
            aria-label="Isara"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {/* User & Role Badge (if provided) */}
          {(userName || userRole) && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 flex items-center justify-between text-xs">
              <div className="min-w-0 pr-2">
                <span className="text-slate-500 block text-[11px]">Kasalukuyang Naka-login</span>
                <span className="font-bold text-slate-800 truncate block">
                  {userName || 'Staff Member'}
                </span>
              </div>
              {userRole && (
                <span className="px-2.5 py-1 rounded bg-teal-50 border border-teal-200 text-teal-800 font-bold text-[11px] uppercase tracking-wider shrink-0">
                  {userRole}
                </span>
              )}
            </div>
          )}

          {/* Warning Note */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-800 leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-slate-50 border-t border-slate-200 px-5 py-3.5 flex items-center justify-end space-x-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoggingOut}
            className="h-9 px-4 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-50"
          >
            Kanselahin
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="h-9 px-4 rounded-md bg-red-600 hover:bg-red-700 text-white font-bold text-xs sm:text-sm flex items-center space-x-1.5 transition-colors cursor-pointer shadow-xs disabled:opacity-50"
          >
            {isLoggingOut ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Nagla-log out...</span>
              </>
            ) : (
              <>
                <LogOut className="w-4 h-4" />
                <span>Oo, Mag-log out</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
