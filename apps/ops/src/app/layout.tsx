import type { Metadata } from 'next';
import '@zameen/ui/styles.css';
import './globals.css';
import { fontVariables } from '@zameen/ui/fonts';
import { OpsNavRail } from './nav-rail';

export const metadata: Metadata = { title: 'Zameen Ops · Rupafab Agri' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
        <div className="grid min-h-screen grid-cols-[88px_1fr]">
          <OpsNavRail />
          <main className="overflow-x-hidden p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
