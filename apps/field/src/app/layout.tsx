import type { Metadata, Viewport } from 'next';
import '@zameen/ui/styles.css';
import './globals.css';
import { fontVariables } from '@zameen/ui/fonts';
import { ServiceWorkerRegister } from '../components/service-worker-register';
import { SyncDaemon } from '../components/sync-daemon';

export const metadata: Metadata = {
  title: 'Zameen Field',
  description: 'Worker PWA',
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
    <html lang="ur" dir="rtl" className={fontVariables}>
      <body className="urdu min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
        <ServiceWorkerRegister />
        <SyncDaemon />
        {children}
      </body>
    </html>
  );
}
