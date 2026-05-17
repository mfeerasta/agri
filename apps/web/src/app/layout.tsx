import type { Metadata } from 'next';
import '@zameen/ui/styles.css';
import './globals.css';
import { fontVariables } from '@zameen/ui/fonts';

export const metadata: Metadata = {
  title: 'Zameen · Rupafab Agri',
  description: 'Farm operations platform for Rupafab Agriculture',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased">
        <div className="relative isolate min-h-screen">{children}</div>
      </body>
    </html>
  );
}
