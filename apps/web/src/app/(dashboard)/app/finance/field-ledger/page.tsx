import Link from 'next/link';
import { Masthead, SectionDivider, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { loadFieldLedger } from '@/modules/finance/field-ledger-actions';
import { FieldLedgerGrid } from '@/modules/finance/components/field-ledger-grid';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

function periodToRange(period: string, today: Date): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth();
  if (period === 'last-month') {
    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }
  if (period === 'fy') {
    // Pakistan FY: 1 July to 30 June
    const fyStartYear = m >= 6 ? y : y - 1;
    return {
      from: new Date(fyStartYear, 6, 1).toISOString().slice(0, 10),
      to: today.toISOString().slice(0, 10),
    };
  }
  // default: this month
  return {
    from: new Date(y, m, 1).toISOString().slice(0, 10),
    to: today.toISOString().slice(0, 10),
  };
}

const PERIOD_TILES = [
  { key: 'this-month', label: 'This month' },
  { key: 'last-month', label: 'Last month' },
  { key: 'fy', label: 'FY to date' },
  { key: 'custom', label: 'Custom' },
];

export default async function FieldLedgerPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const ctx = await getSessionContext();
  if (!ctx) {
    return <div className="p-6 text-sm">Sign in required.</div>;
  }

  const period = sp.period ?? 'this-month';
  const today = new Date();
  let range = periodToRange(period, today);
  if (period === 'custom' && sp.from && sp.to) {
    range = { from: sp.from, to: sp.to };
  }

  const data = await loadFieldLedger({
    entityId: ctx.entityId,
    fromDate: range.from,
    toDate: range.to,
  });

  const xlsxHref = `/api/finance/field-ledger/xlsx?from=${range.from}&to=${range.to}`;

  return (
    <div>
      <Masthead section="FIELD LEDGER" />
      <SectionDivider />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {PERIOD_TILES.map((p) => (
          <Link
            key={p.key}
            href={`/finance/field-ledger?period=${p.key}` as never}
            className={`smallcaps rounded border border-[var(--rule)] px-3 py-1 text-[0.7rem] ${
              period === p.key ? 'bg-[var(--ink)] text-[var(--paper)]' : 'hover:bg-[var(--paper-2)]'
            }`}
          >
            {p.label}
          </Link>
        ))}
        <span className="ml-auto smallcaps text-[0.7rem] text-[var(--ink)]/60">
          {range.from} → {range.to}
        </span>
        <a
          href={xlsxHref}
          className="smallcaps rounded border border-[var(--rule)] px-3 py-1 text-[0.7rem] hover:bg-[var(--paper-2)]"
        >
          Export XLSX
        </a>
      </div>

      {period === 'custom' && (
        <form className="mb-3 flex gap-2 text-sm" method="get">
          <input type="hidden" name="period" value="custom" />
          <input
            type="date"
            name="from"
            defaultValue={range.from}
            className="rounded border border-[var(--rule)] bg-[var(--paper)] px-2 py-1"
          />
          <input
            type="date"
            name="to"
            defaultValue={range.to}
            className="rounded border border-[var(--rule)] bg-[var(--paper)] px-2 py-1"
          />
          <button
            type="submit"
            className="smallcaps rounded border border-[var(--rule)] px-3 py-1 text-[0.7rem] hover:bg-[var(--paper-2)]"
          >
            Apply
          </button>
        </form>
      )}

      <div className="mb-3 flex justify-between smallcaps text-xs text-[var(--ink)]/70">
        <span>{data.rows.length} active days · {data.fields.length} fields</span>
        <span>
          Grand total <Pkr value={data.grandTotalPkr} mode="lac_crore" />
        </span>
      </div>

      <FieldLedgerGrid data={data} entityId={ctx.entityId} />
    </div>
  );
}
