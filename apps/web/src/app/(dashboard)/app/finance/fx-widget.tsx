import { Card, CardContent, CardHeader, CardTitle } from '@zameen/ui';
import { getDb } from '@zameen/db';
import { fxRates } from '@zameen/db/schema';
import { and, desc, eq, gte, sql } from 'drizzle-orm';

const DISPLAYED = ['USD', 'EUR', 'SAR', 'AED'];

export async function FxWidget(): Promise<JSX.Element> {
  const db = getDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const recent = await db
    .select()
    .from(fxRates)
    .where(and(eq(fxRates.baseCurrency, 'PKR'), gte(fxRates.date, sevenDaysAgo)))
    .orderBy(desc(fxRates.date));

  const latestByQuote = new Map<string, { date: string; rate: number }>();
  const weekAgoByQuote = new Map<string, number>();
  for (const r of recent) {
    if (!DISPLAYED.includes(r.quoteCurrency)) continue;
    const rate = Number(r.rate);
    if (!latestByQuote.has(r.quoteCurrency)) {
      latestByQuote.set(r.quoteCurrency, { date: r.date, rate });
    } else {
      weekAgoByQuote.set(r.quoteCurrency, rate);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>FX (PKR per unit)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {DISPLAYED.map((q) => {
            const latest = latestByQuote.get(q);
            const ago = weekAgoByQuote.get(q);
            if (!latest) {
              return (
                <div key={q}>
                  <div className="smallcaps text-[0.65rem] text-[var(--ink)]/60">{q}</div>
                  <div className="text-sm text-[var(--ink)]/50">no data</div>
                </div>
              );
            }
            const pkrPerUnit = latest.rate > 0 ? 1 / latest.rate : 0;
            const agoPkrPerUnit = ago && ago > 0 ? 1 / ago : null;
            const delta =
              agoPkrPerUnit !== null && agoPkrPerUnit > 0
                ? ((pkrPerUnit - agoPkrPerUnit) / agoPkrPerUnit) * 100
                : null;
            return (
              <div key={q}>
                <div className="smallcaps text-[0.65rem] text-[var(--ink)]/60">{q}</div>
                <div className="text-base font-mono">{pkrPerUnit.toFixed(2)}</div>
                {delta !== null ? (
                  <div className={`text-[0.7rem] ${delta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)}% vs 7d
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <p className="text-[0.65rem] text-[var(--ink)]/50 mt-2">Source: exchangerate.host. Refreshed daily 09:00 PKT.</p>
      </CardContent>
    </Card>
  );
}

void sql;
