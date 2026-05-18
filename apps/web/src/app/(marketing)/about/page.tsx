import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About · Zameen',
  description: 'Why Zameen exists, who built it, and where it is heading.',
};

export default function AboutPage() {
  return (
    <div className="max-w-[760px] mx-auto px-5 py-16">
      <div className="text-[11px] uppercase tracking-[0.22em] text-[var(--accent)] mb-4">About</div>
      <h1 className="font-serif text-4xl tracking-tight">Why Zameen.</h1>

      <div className="prose-zameen mt-8 space-y-6 text-[15px] leading-relaxed text-[var(--fg)]">
        <p>
          Rupafab runs a 100 acre farm at Raiwind. Like most Pakistani farms, the bookkeeping
          ran on stacks of paper receipts, a few shared spreadsheets, and the patience of a
          farm manager who knew every drum of diesel by feel. When something went missing,
          it was almost impossible to tell whether the loss was leakage, theft, or just a
          number written down wrong.
        </p>
        <p>
          Zameen is the consolidation of that operation into one ledger. Built mobile-first
          because the people doing the work are in the field, not at a desk. Built Urdu-first
          because that is the language the operation actually runs in.
        </p>

        <h2 className="font-serif text-2xl tracking-tight mt-10">The pain points</h2>
        <ul className="list-disc pl-6 space-y-2 text-[var(--fg-muted)]">
          <li>Fragmented record-keeping across paper, WhatsApp, and Excel.</li>
          <li>Fuel and repair losses with no audit trail or per-asset attribution.</li>
          <li>No way to compute a per-field profit and loss at season close.</li>
          <li>Approvals lived in voice notes and were forgotten within a week.</li>
          <li>Workers had no way to log attendance or work without a literate intermediary.</li>
        </ul>

        <h2 className="font-serif text-2xl tracking-tight mt-10">Pilot</h2>
        <p>
          Phase 1 is live for the Rupafab Agri operation at Raiwind, Lahore, for the
          Rabi 2025-26 season. 100 acres across 16 fields, three role-specific apps, and
          a finance ledger that posts a balanced journal for every cost-bearing action.
        </p>

        <h2 className="font-serif text-2xl tracking-tight mt-10">Team</h2>
        <p>
          Zameen is built by M (Meer Feerasta) with Claude Code as the implementation
          partner. It is intentionally a small operation: one decision-maker, one engineer,
          one farm, one season. We are not selling this. We are running it.
        </p>

        <h2 className="font-serif text-2xl tracking-tight mt-10">Roadmap</h2>
        <ul className="list-disc pl-6 space-y-2 text-[var(--fg-muted)]">
          <li>Phase 2: Edge cron jobs, WhatsApp Business notifications, NDVI satellite overlays.</li>
          <li>Phase 3: Pest identification vision model, Urdu and Punjabi speech-to-text.</li>
          <li>Phase 4: Feasibility study UI, Mapbox field-polygon editor.</li>
        </ul>
      </div>
    </div>
  );
}
