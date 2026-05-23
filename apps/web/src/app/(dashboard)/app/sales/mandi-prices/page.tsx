import { Masthead, SectionDivider, Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';
import { getDb } from '@zameen/db';
import { marketPrices } from '@zameen/db/schema';
import { desc, gte, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const NEARBY_MARKETS = ['lahore', 'sahiwal', 'okara', 'faisalabad'];
const TRACKED_COMMODITIES = ['wheat', 'rice', 'cotton', 'maize', 'sugarcane', 'potato'];

interface PriceCell {
  modePkr: number;
  deltaPct: number | null;
  recordedOn: string;
}

export default async function MandiPricesPage(): Promise<JSX.Element> {
  const db = getDb();
  const fourteenAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(marketPrices)
    .where(gte(marketPrices.recordedOn, fourteenAgo))
    .orderBy(desc(marketPrices.recordedOn))
    .limit(2000);

  const grid = new Map<string, Map<string, PriceCell>>();
  for (const r of rows) {
    const commodity = r.commodity.toLowerCase();
    const market = r.market.toLowerCase();
    if (!TRACKED_COMMODITIES.includes(commodity) || !NEARBY_MARKETS.includes(market)) continue;
    const mode = Number(r.modePkr ?? 0);
    if (mode <= 0) continue;

    if (!grid.has(commodity)) grid.set(commodity, new Map());
    const row = grid.get(commodity);
    if (!row) continue;
    const existing = row.get(market);
    if (!existing) {
      row.set(market, { modePkr: mode, deltaPct: null, recordedOn: r.recordedOn });
    } else if (existing.recordedOn > r.recordedOn && existing.deltaPct === null) {
      existing.deltaPct = ((existing.modePkr - mode) / mode) * 100;
    }
  }

  return (
    <div>
      <Masthead section="Mandi prices" />
      <SectionDivider />
      <Card>
        <CardHeader>
          <CardTitle>Wholesale prices (PKR per kg, mode)</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left smallcaps text-[0.7rem] text-[var(--ink)]/60">
                <th className="py-1 pr-2">Commodity</th>
                {NEARBY_MARKETS.map((m) => (
                  <th key={m} className="py-1 pr-2 capitalize">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TRACKED_COMMODITIES.map((commodity) => {
                const row = grid.get(commodity);
                return (
                  <tr key={commodity} className="border-t border-[var(--rule)]">
                    <td className="py-1 pr-2 capitalize">{commodity}</td>
                    {NEARBY_MARKETS.map((market) => {
                      const cell = row?.get(market);
                      if (!cell) {
                        return (
                          <td key={market} className="py-1 pr-2 text-[var(--ink)]/40">-</td>
                        );
                      }
                      return (
                        <td key={market} className="py-1 pr-2 font-mono">
                          {cell.modePkr.toFixed(0)}
                          {cell.deltaPct !== null ? (
                            <span className={`ml-1 text-[0.65rem] ${cell.deltaPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {cell.deltaPct >= 0 ? '+' : ''}
                              {cell.deltaPct.toFixed(1)}%
                            </span>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="text-[0.65rem] text-[var(--ink)]/50 mt-2">Source: pricecheck.gov.pk / PBS weekly bulletin. Refreshed Mondays 08:00 PKT.</p>
        </CardContent>
      </Card>
    </div>
  );
}

void sql;
