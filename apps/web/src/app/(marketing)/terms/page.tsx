import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Terms · Zameen',
  description: 'Terms of use for Zameen.',
};

export default function TermsPage() {
  return (
    <div className="max-w-[760px] mx-auto px-5 py-16">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)] mb-4">Terms</div>
      <h1 className="font-serif text-4xl tracking-tight">Terms of use.</h1>
      <p className="text-xs text-[var(--fg-muted)] mt-2">Last updated 2026-05-18.</p>

      <div className="mt-8 space-y-6 text-[15px] leading-relaxed">
        <p>
          Zameen is a private platform operated for Rupafab Agri. Access is by invitation and is
          governed by these terms together with the privacy policy.
        </p>

        <h2 className="font-serif text-2xl tracking-tight">Accounts</h2>
        <p className="text-[var(--fg-muted)]">
          You are responsible for keeping your sign-in credentials safe. Where passkeys are
          available, we recommend them over passwords. You must not share your account.
        </p>

        <h2 className="font-serif text-2xl tracking-tight">Acceptable use</h2>
        <ul className="list-disc pl-6 space-y-2 text-[var(--fg-muted)]">
          <li>Use the platform only for legitimate Rupafab Agri operations.</li>
          <li>Do not attempt to bypass approval routing or audit logging.</li>
          <li>Do not upload content that does not belong to the operation.</li>
          <li>Do not reverse-engineer the platform or its APIs without written permission.</li>
        </ul>

        <h2 className="font-serif text-2xl tracking-tight">Approvals are binding</h2>
        <p className="text-[var(--fg-muted)]">
          Decisions recorded in the Approver PWA are treated as authoritative for downstream
          actions. GPS, IP, and timestamp are captured at decision time and stored in the audit
          log. Disputes are resolved with reference to that record.
        </p>

        <h2 className="font-serif text-2xl tracking-tight">Currency and units</h2>
        <p className="text-[var(--fg-muted)]">
          All monetary values are in Pakistani Rupees (PKR). No foreign exchange conversion is
          performed or implied.
        </p>

        <h2 className="font-serif text-2xl tracking-tight">Availability</h2>
        <p className="text-[var(--fg-muted)]">
          We aim for high availability but do not offer a contractual SLA. The platform is
          operated on a best-effort basis with daily backups and disaster recovery procedures.
        </p>

        <h2 className="font-serif text-2xl tracking-tight">Liability</h2>
        <p className="text-[var(--fg-muted)]">
          The platform is provided as-is to its invited users. Operational decisions are made by
          the humans using the platform. Zameen does not assume liability for those decisions.
        </p>

        <h2 className="font-serif text-2xl tracking-tight">Changes</h2>
        <p className="text-[var(--fg-muted)]">
          We may update these terms. Material changes are announced in-app. Continued use after a
          change indicates acceptance.
        </p>

        <h2 className="font-serif text-2xl tracking-tight">Contact</h2>
        <p className="text-[var(--fg-muted)]">
          Questions:{' '}
          <a className="text-[var(--accent)] hover:underline" href="mailto:meerfeerasta@gmail.com">
            meerfeerasta@gmail.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
