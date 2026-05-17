import type { Config } from 'tailwindcss';
import plugin from 'tailwindcss/plugin';

const preset: Partial<Config> = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: { DEFAULT: 'var(--bg)', 2: 'var(--bg-2)' },
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)' },
        fg: { DEFAULT: 'var(--fg)', muted: 'var(--fg-muted)', subtle: 'var(--fg-subtle)' },
        accent: { DEFAULT: 'var(--accent)', strong: 'var(--accent-strong)' },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        border: 'var(--border)',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
        urdu: ['var(--font-urdu)'],
      },
      borderColor: { DEFAULT: 'var(--border)' },
      borderRadius: { sm: '6px', DEFAULT: '10px', lg: '14px', xl: '20px' },
      boxShadow: {
        soft: '0 1px 0 rgba(255,255,255,0.05) inset, 0 8px 32px rgba(0,0,0,0.35)',
        glow: '0 0 0 1px rgba(255,255,255,0.1), 0 0 40px var(--accent-glow)',
      },
      letterSpacing: { tight: '-0.02em', smallcaps: '0.14em' },
    },
  },
  plugins: [
    plugin(({ addUtilities }) => {
      addUtilities({
        '.tabular': {
          'font-family': 'var(--font-mono)',
          'font-variant-numeric': 'tabular-nums',
          'font-feature-settings': "'tnum'",
        },
        '.smallcaps': {
          'text-transform': 'uppercase',
          'letter-spacing': '0.14em',
          'font-weight': '500',
          'font-size': '0.72rem',
          color: 'var(--fg-muted)',
        },
        '.urdu': {
          'font-family': 'var(--font-urdu)',
          'line-height': '2.0',
        },
      });
    }),
  ],
};

export default preset;
