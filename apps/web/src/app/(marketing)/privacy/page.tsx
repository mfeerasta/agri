import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Privacy · Zameen',
  description: 'How Zameen handles data.',
};

export default function PrivacyPage() {
  return (
    <div className="max-w-[760px] mx-auto px-5 py-16">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)] mb-4">
        Privacy
      </div>
      <h1 className="font-serif text-4xl tracking-tight">Privacy policy.</h1>
      <p className="text-xs text-[var(--fg-muted)] mt-2">Last updated 2026-05-18.</p>

      <div className="mt-8 space-y-6 text-[15px] leading-relaxed">
        <p>
          Zameen is a private operations platform for Rupafab Agri. This policy explains what we
          store, where we store it, and what rights you have over your data.
        </p>

        <h2 className="font-serif text-2xl tracking-tight">What we store</h2>
        <ul className="list-disc pl-6 space-y-2 text-[var(--fg-muted)]">
          <li>Account data: name, email, role, phone number.</li>
          <li>Operational records: fields, crops, diesel logs, repairs, labour, finance entries.</li>
          <li>Photos uploaded as evidence for diesel purchases, repairs, and field activity.</li>
          <li>
            CNIC numbers for worker payroll. Stored encrypted at rest. Visible only to Director,
            Super Admin, and Auditor roles.
          </li>
          <li>Audit logs of every approval action and decision.</li>
        </ul>

        <h2 className="font-serif text-2xl tracking-tight">Where we store it</h2>
        <ul className="list-disc pl-6 space-y-2 text-[var(--fg-muted)]">
          <li>
            Database: Postgres on Hetzner, Falkenstein, Germany. Encrypted at rest, daily
            snapshots.
          </li>
          <li>
            Photos and documents: Cloudflare R2, private buckets, nearest-region routing for
            Pakistan.
          </li>
          <li>Email: Resend, used for transactional notifications only.</li>
        </ul>

        <h2 className="font-serif text-2xl tracking-tight">How long we keep it</h2>
        <p className="text-[var(--fg-muted)]">
          Audit logs are retained for 7 years. Operational records are retained as long as the
          account is active. On account closure, data is exported and then deleted within 30 days.
        </p>

        <h2 className="font-serif text-2xl tracking-tight">Your rights</h2>
        <ul className="list-disc pl-6 space-y-2 text-[var(--fg-muted)]">
          <li>Export your data on request, in CSV and PDF.</li>
          <li>Delete your data on request, subject to the 7-year audit retention requirement.</li>
          <li>Correct any record that you believe is inaccurate.</li>
          <li>Ask who has accessed your data and when.</li>
        </ul>

        <h2 className="font-serif text-2xl tracking-tight">What we do not do</h2>
        <ul className="list-disc pl-6 space-y-2 text-[var(--fg-muted)]">
          <li>No third-party advertising trackers. None.</li>
          <li>No sale of data to anyone, for any reason.</li>
          <li>No location tracking outside of approval-action GPS capture and geofenced clock-ins.</li>
          <li>No marketing emails. Notifications are operational only.</li>
        </ul>

        <h2 className="font-serif text-2xl tracking-tight">Contact</h2>
        <p className="text-[var(--fg-muted)]">
          For privacy questions or to exercise any of the rights above, email{' '}
          <a className="text-[var(--accent)] hover:underline" href="mailto:meerfeerasta@gmail.com">
            meerfeerasta@gmail.com
          </a>
          .
        </p>
      </div>
    </div>
  );
}
