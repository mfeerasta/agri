import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Features · Zameen',
  description: 'Modules and capabilities shipped in Phase 1 of Zameen.',
};

const MODULES = [
  {
    name: 'Land and fields',
    body: 'Polygon-mapped fields with computed acreage, soil type, water source, crop rotation history.',
  },
  {
    name: 'Crops and seasons',
    body: 'Crop library, season plans, stage tracking, scouting logs, per-field timeline.',
  },
  {
    name: 'Diesel',
    body: 'Purchase capture with receipt photos, hour-meter logs, tank reconciliation, variance flags.',
  },
  {
    name: 'Repairs',
    body: 'Request, multi-quote comparison, approval routing, work orders, warranty windows.',
  },
  {
    name: 'Inventory',
    body: 'Inputs, fertilisers, pesticides, parts. FIFO issuance, low-stock alerts.',
  },
  {
    name: 'Livestock',
    body: 'Cattle register, vaccination, breeding, milk yield, feed cost allocation.',
  },
  {
    name: 'Labour',
    body: 'Worker register with CNIC vault, attendance with geofence, piece-rate and day-rate payroll.',
  },
  {
    name: 'Procurement',
    body: 'Vendor master, PO workflow, GRN, three-way match against invoices.',
  },
  {
    name: 'Sales',
    body: 'Buyer master, sales contracts, delivery notes, receivables aging.',
  },
  {
    name: 'Finance',
    body: 'Chart of accounts, balanced journals, per-field P&L, cost pool reporting.',
  },
  {
    name: 'Compliance',
    body: 'Document vault, expiry tracking, audit trail, 7-year retention.',
  },
  {
    name: 'Approvals',
    body: 'Threshold routing, delegation, full context for approvers, GPS-stamped decisions.',
  },
];

const APPS = [
  {
    name: 'Web (ops)',
    sub: 'agri.feerasta.ai',
    body: 'Full management surface for Farm Manager, Director, Auditor, and Super Admin roles.',
  },
  {
    name: 'Field PWA',
    sub: 'field.agri.feerasta.ai',
    body: 'Urdu-first, offline-capable, big-button UI for workers and field supervisors.',
  },
  {
    name: 'Approver PWA',
    sub: 'approve.agri.feerasta.ai',
    body: 'Passkey login, cash-position context, audit trail, GPS-captured decisions.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="max-w-[1100px] mx-auto px-5 py-16">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)] mb-4">
        Features
      </div>
      <h1 className="font-serif text-4xl tracking-tight">Twelve modules. One ledger.</h1>
      <p className="mt-4 text-[var(--fg-muted)] max-w-[60ch] leading-relaxed">
        Every operational action that moves money, inventory, or asset state flows through the
        same approval engine and the same balanced-journal posting.
      </p>

      <section className="mt-12">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-[var(--fg-muted)] mb-6">
          Modules
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-8">
          {MODULES.map((m) => (
            <div key={m.name} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span aria-hidden className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                <h3 className="text-sm font-semibold">{m.name}</h3>
              </div>
              <p className="text-sm text-[var(--fg-muted)] leading-relaxed">{m.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-[var(--fg-muted)] mb-6">
          Apps
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {APPS.map((a) => (
            <div key={a.name} className="border border-[var(--border)] rounded-md p-5 bg-[var(--surface)]">
              <div className="font-semibold">{a.name}</div>
              <div className="text-[11px] tracking-wide text-[var(--accent)] mt-0.5">{a.sub}</div>
              <p className="text-sm text-[var(--fg-muted)] mt-3 leading-relaxed">{a.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-[11px] uppercase tracking-[0.22em] text-[var(--fg-muted)] mb-6">
          Other capabilities
        </h2>
        <ul className="text-sm space-y-2 text-[var(--fg-muted)] leading-relaxed list-disc pl-5">
          <li>Receipt OCR for diesel and repair invoices</li>
          <li>Voice-to-text for field notes (browser SpeechRecognition)</li>
          <li>Reports and exports (XLSX, CSV, PDF) with seasonal roll-ups</li>
          <li>Push notifications and email digests</li>
          <li>Crop diagnostics and AI advisor with cached responses</li>
          <li>Automations: cron jobs for digest, NDVI refresh, anomaly scans</li>
          <li>Disaster recovery: nightly Postgres dumps, R2 object replication</li>
        </ul>
      </section>
    </div>
  );
}
