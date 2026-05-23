import Link from 'next/link';
import { asc } from 'drizzle-orm';
import { db, cropVarieties } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function VarietyCataloguePage() {
  const rows = await db.select().from(cropVarieties).orderBy(asc(cropVarieties.cropProfileCode), asc(cropVarieties.name));

  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!grouped.has(r.cropProfileCode)) grouped.set(r.cropProfileCode, []);
    grouped.get(r.cropProfileCode)!.push(r);
  }

  return (
    <div>
      <Masthead section="CROPS / VARIETY CATALOGUE" />
      <SectionDivider label={`${rows.length} varieties across ${grouped.size} crops`} />
      <div className="p-4 space-y-6">
        {Array.from(grouped.entries()).map(([code, vs]) => (
          <section key={code}>
            <h2 className="text-sm uppercase tracking-wide text-slate-500 mb-2">{code}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {vs.map((v) => (
                <Link
                  key={v.id}
                  href={`/crops/varieties/${v.id}` as never}
                  className="border rounded p-3 hover:bg-slate-50 block"
                >
                  <div className="font-medium">{v.name}</div>
                  {v.nameUr ? <div className="text-sm" dir="rtl">{v.nameUr}</div> : null}
                  <div className="text-xs text-slate-500 mt-1">
                    {v.varietyKind ?? 'unknown kind'}
                    {v.sourceCompany ? ` · ${v.sourceCompany}` : ''}
                    {v.releaseYear ? ` · ${v.releaseYear}` : ''}
                  </div>
                  {v.resistanceTraits && v.resistanceTraits.length ? (
                    <div className="text-xs text-emerald-700 mt-1">
                      {v.resistanceTraits.join(', ')}
                    </div>
                  ) : null}
                </Link>
              ))}
            </div>
          </section>
        ))}
        {grouped.size === 0 ? <div className="text-slate-500">No varieties seeded yet.</div> : null}
      </div>
    </div>
  );
}
