import Link from 'next/link';
import { and, eq, inArray } from 'drizzle-orm';
import { db, cropPlans, fields, cropProfiles } from '@zameen/db';
import { Masthead, Card, CardContent, CardHeader, CardTitle, EmptyState } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function InspectIndex() {
  const rows = await db
    .select({
      id: cropPlans.id,
      stage: cropPlans.currentStage,
      acres: cropPlans.plannedAcres,
      seasonLabel: cropPlans.seasonLabel,
      varietyName: cropPlans.varietyName,
      fieldCode: fields.code,
      fieldName: fields.name,
      cropName: cropProfiles.name,
    })
    .from(cropPlans)
    .leftJoin(fields, eq(fields.id, cropPlans.fieldId))
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .where(inArray(cropPlans.currentStage, ['land_prep', 'sowing', 'germination', 'vegetative', 'flowering', 'fruiting', 'maturity'] as never))
    .limit(50);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Masthead section="Field Inspection" />
      {rows.length === 0 ? (
        <EmptyState title="No active crop plans" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <Link key={r.id} href={`/inspect/${r.id}` as never}>
              <Card className="transition hover:bg-[var(--paper-2)]">
                <CardHeader>
                  <CardTitle className="text-base">
                    {r.fieldCode} · {r.cropName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--ink)]/70">Stage</span>
                    <span className="smallcaps">{r.stage}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--ink)]/70">Variety</span>
                    <span>{r.varietyName ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--ink)]/70">Acres</span>
                    <span className="tabular-nums">{Number(r.acres).toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
