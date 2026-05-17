import { Geist, Geist_Mono, Noto_Nastaliq_Urdu } from 'next/font/google';

export const geist = Geist({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
});

export const geistMono = Geist_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
});

export const nastaliq = Noto_Nastaliq_Urdu({
  subsets: ['arabic'],
  display: 'swap',
  variable: '--font-urdu',
  weight: ['400', '500', '600', '700'],
});

export const fontVariables = [geist.variable, geistMono.variable, nastaliq.variable].join(' ');
