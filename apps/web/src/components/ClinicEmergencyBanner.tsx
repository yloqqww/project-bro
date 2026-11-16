'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, Phone } from 'lucide-react';

export function ClinicEmergencyBanner() {
  const [settings, setSettings] = useState<{ emergencyNotice: string; hotline: string } | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((response) => response.json())
      .then((data) => {
        if (data.success && data.settings) setSettings(data.settings);
      })
      .catch(() => {});
  }, []);

  if (!settings?.emergencyNotice) return null;
  return (
    <div className="bg-rose-50 border-b border-rose-200 text-rose-950 px-4 py-2.5">
      <div className="max-w-4xl mx-auto flex items-start sm:items-center gap-2 text-xs sm:text-sm">
        <AlertTriangle className="w-4 h-4 mt-0.5 sm:mt-0 shrink-0 text-rose-700" />
        <span className="flex-1 font-medium">{settings.emergencyNotice}</span>
        {settings.hotline && (
          <span className="inline-flex items-center gap-1 font-mono font-semibold whitespace-nowrap">
            <Phone className="w-3.5 h-3.5" /> {settings.hotline}
          </span>
        )}
      </div>
    </div>
  );
}
