import Link from 'next/link';
import { db, assets } from '@zameen/db';
import { ASSET_FUEL_BURN_ANOMALY_PCT } from '@zameen/shared';
import { Card, CardContent, EmptyState, Masthead, SectionDivider } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function AssetsPage() {
  const rows = await db.select().from(assets).orderBy(assets.category, assets.code);

  const groups = rows.reduce((acc, a) => {
    if (!acc.has(a.category)) acc.set(a.category, []);
    acc.get(a.category)!.push(a);
    return acc;
  }, new Map<string, typeof rows>());

  return (
    <div className="space-y-2">
      <Masthead section="ASSETS" />
      <SectionDivider />
      <div className="flex justify-end">
        <Link href={'/inventory/assets/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">
          New asset
        </Link>
      </div>
      {rows.length === 0 ? <EmptyState title="No assets" /> : null}
      {Array.from(groups.entries()).map(([cat, list]) => (
        <div key={cat}>
          <SectionDivider label={cat} />
          <Card>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                  <tr><th className="p-3">Code</th><th className="p-3">Make/model</th><th className="p-3">Year</th><th className="p-3">Hour meter</th><th className="p-3">Mfr L/hr</th><th className="p-3">Rolling 30d L/hr</th></tr>
                </thead>
                <tbody>
                  {list.map((a) => {
                    const spec = a.manufacturerFuelSpecLph ? Number(a.manufacturerFuelSpecLph) : null;
                    const rolling = a.rolling30dAvgLph ? Number(a.rolling30dAvgLph) : null;
                    const anomaly = spec && rolling && rolling > spec * (1 + ASSET_FUEL_BURN_ANOMALY_PCT / 100);
                    return (
                      <tr key={a.id} className="border-b border-[var(--rule)]">
                        <td className="p-3 font-semibold"><Link href={`/inventory/assets/${a.id}` as never}>{a.code}</Link></td>
                        <td className="p-3">{a.make ?? ''} {a.model ?? ''}</td>
                        <td className="p-3 tabular">{a.year ?? ''}</td>
                        <td className="p-3 tabular">{Number(a.currentHourMeter).toFixed(2)}</td>
                        <td className="p-3 tabular">{spec ?? ''}</td>
                        <td className={`p-3 tabular ${anomaly ? 'text-red-700' : ''}`}>
                          {rolling ?? '—'} {anomaly ? '⚠' : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}
