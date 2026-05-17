import type { Metadata, Viewport } from 'next';
import '@zameen/ui/styles.css';
import './globals.css';
import { fontVariables } from '@zameen/ui/fonts';
import { ApproverNavRail } from './nav-rail';

export const metadata: Metadata = {
  title: 'Zameen Approver · Rupafab Agri',
  description: 'Approval queue PWA',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  themeColor: '#1B4332',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased pb-16">
        {children}
        <ApproverNavRail />
      </body>
    </html>
  );
}
