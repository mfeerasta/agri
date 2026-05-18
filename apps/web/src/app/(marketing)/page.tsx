import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Zameen · Run a Pakistani farm like a finance team',
  description:
    'Zameen consolidates land, crops, diesel, repairs, labour, and finance into one mobile-first platform. Approval-first. Urdu-first.',
};

const PILLARS = [
  {
    title: 'Diesel and repair tracking',
    body: 'Receipt photos, hour-meter logs, multi-quote repair workflows. Variance flagged automatically.',
  },
  {
    title: 'Per-field P&L',
    body: 'Every Rupee flows to a field and a cost pool. Compute true gross margin per acre, per crop, per season.',
  },
  {
    title: 'Approval workflow',
    body: 'Threshold-based routing with delegation, audit, and full context shown in the Approver PWA.',
  },
  {
    title: 'Field PWA in Urdu',
    body: 'Offline-first, big-button interface for farm staff. Voice input, photo capture, geofenced clock-ins.',
  },
];

const STATS = [
  { value: '100', label: 'acre pilot' },
  { value: '16', label: 'fields' },
  { value: '23', label: 'worker classes' },
  { value: '14', label: 'cron jobs' },
];

export default function MarketingHome() {
  return (
    <div>
      <section className="border-b border-[var(--border)]">
        <div className="max-w-[1100px] mx-auto px-5 pt-20 pb-16">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)] mb-5">
            Rupafab Agri · Phase 1 live
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight max-w-[18ch]">
            Run a Pakistani farm like a finance team.
          </h1>
          <p className="mt-6 text-lg text-[var(--fg-muted)] max-w-[60ch] leading-relaxed">
            Zameen consolidates land, crops, diesel, repairs, labour, and finance into one
            mobile-first platform. Approval-first. Urdu-first.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="inline-flex items-center px-5 py-2.5 rounded-md bg-[var(--accent)] text-[var(--bg)] font-medium hover:opacity-90 transition"
            >
              Sign in
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center px-5 py-2.5 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition"
            >
              Request a demo
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--border)]">
        <div className="max-w-[1100px] mx-auto px-5 py-14">
          <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--fg-muted)] mb-8">
            What it does
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-10">
            {PILLARS.map((p) => (
              <div key={p.title} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                  <h3 className="text-base font-semibold">{p.title}</h3>
                </div>
                <p className="text-sm text-[var(--fg-muted)] leading-relaxed max-w-[50ch]">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-b border-[var(--border)]">
        <div className="max-w-[1100px] mx-auto px-5 py-10">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="font-serif text-3xl tabular text-[var(--fg)]">{s.value}</div>
                <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--fg-muted)] mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="max-w-[1100px] mx-auto px-5 py-14 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <h2 className="font-serif text-2xl sm:text-3xl tracking-tight">
              Built for the way Pakistani farms actually run.
            </h2>
            <p className="mt-3 text-[var(--fg-muted)] leading-relaxed max-w-[60ch] text-sm">
              Cash, not card. Worker classes, not job titles. Diesel by the drum, not the pump.
              Every workflow assumes intermittent connectivity and Urdu as a first language.
            </p>
          </div>
          <div className="space-y-3 text-sm">
            <Link
              href="/features"
              className="block px-4 py-3 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition"
            >
              Browse features
            </Link>
            <Link
              href="/about"
              className="block px-4 py-3 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition"
            >
              About the project
            </Link>
            <Link
              href="/api/docs"
              className="block px-4 py-3 rounded-md border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-2)] transition"
            >
              API documentation
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
