import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { cookies } from 'next/headers';
import '@zameen/ui/styles.css';
import './globals.css';
import { fontVariables } from '@zameen/ui/fonts';
import { localeDirection, localeHtmlLang, type Locale } from '@zameen/locale';
import { ServiceWorkerRegister } from '../components/service-worker-register';
import { SyncDaemon } from '../components/sync-daemon';
import { SyncStatusHost } from '../components/sync-status-host';
import { TrainingBanner } from '../components/training-banner';

const CAPACITOR_DETECT = `(function(){try{var c=window.Capacitor;if(c&&typeof c.isNativePlatform==='function'&&c.isNativePlatform()){document.documentElement.classList.add('capacitor-native','capacitor-'+(c.getPlatform&&c.getPlatform()||'unknown'));}}catch(e){}})();`;

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

const SUPPORTED_LOCALES: ReadonlySet<Locale> = new Set(['ur', 'roman_ur', 'pa', 'hi', 'en']);

async function getInitialLocale(): Promise<Locale> {
  const c = await cookies();
  const v = c.get('zameenLocale')?.value as Locale | undefined;
  if (v && SUPPORTED_LOCALES.has(v)) return v;
  return 'ur';
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getInitialLocale();
  const dir = localeDirection(locale);
  const lang = localeHtmlLang(locale);
  const bodyLocaleClass = locale === 'ur' || locale === 'pa' ? 'urdu' : '';
  return (
    <html lang={lang} dir={dir} className={fontVariables}>
      <body className={`${bodyLocaleClass} min-h-screen bg-[var(--paper)] text-[var(--ink)] antialiased`}>
        <Script id="zameen-capacitor-detect" strategy="beforeInteractive">
          {CAPACITOR_DETECT}
        </Script>
        <ServiceWorkerRegister />
        <SyncDaemon />
        <TrainingBanner />
        <header className="sticky top-0 z-30 flex items-center justify-end bg-[var(--paper)]/80 px-3 py-2 backdrop-blur">
          <SyncStatusHost />
        </header>
        {children}
      </body>
    </html>
  );
}
