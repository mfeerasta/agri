import type { Metadata } from 'next';
import { DemoRequestForm } from './demo-request-form';

export const metadata: Metadata = {
  title: 'Contact · Zameen',
  description: 'Get in touch or request a demo of Zameen.',
};

export default function ContactPage() {
  return (
    <div className="max-w-[860px] mx-auto px-5 py-16 grid grid-cols-1 md:grid-cols-2 gap-12">
      <div>
        <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)] mb-4">
          Contact
        </div>
        <h1 className="font-serif text-4xl tracking-tight">Talk to us.</h1>
        <p className="mt-4 text-[var(--fg-muted)] leading-relaxed">
          Zameen is a private project for Rupafab Agri. We are not selling licenses, but we are
          happy to demo what we built and share what we learned.
        </p>

        <div className="mt-8 space-y-4 text-sm">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Email</div>
            <a className="text-[var(--accent)] hover:underline" href="mailto:meerfeerasta@gmail.com">
              meerfeerasta@gmail.com
            </a>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Operation</div>
            <div>Rupafab Agri, Raiwind, Lahore</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--fg-muted)]">Domain</div>
            <div>agri.feerasta.ai</div>
          </div>
        </div>
      </div>

      <DemoRequestForm />
    </div>
  );
}
