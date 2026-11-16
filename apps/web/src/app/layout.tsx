import type { Metadata } from 'next';
// import { Inter } from 'next/font/google';
import { SessionProvider } from '@/components/providers/session-provider';
import './globals.css';
import { SystemStatusBanner } from '@/components/SystemStatusBanner';

const inter = { className: '' };

export const metadata: Metadata = {
  title: 'Laguna Medical Center - EHR & RFID Hub',
  description: 'Hospital Management & Electronic Health Records System powered by RFID Patient Identification',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <meta name="darkreader-lock" />
      </head>
      <body className={inter.className}>
        <a href="#main-content" className="skip-link">Skip to main content</a>
        <SessionProvider><SystemStatusBanner /><div id="main-content" tabIndex={-1}>{children}</div></SessionProvider>
      </body>
    </html>
  );
}
