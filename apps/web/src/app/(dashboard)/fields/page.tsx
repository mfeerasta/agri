import Link from 'next/link';
import { db, fields, blocks, farms, cropPlans, cropProfiles, soilTests } from '@zameen/db';
import { eq, desc } from 'drizzle-orm';
import { Card, CardContent, EmptyState, FieldMap, Masthead, SectionDivider } from '@zameen/ui';

export const dynamic = 'force-dynamic';

export default async function FieldsListPage() {
  const rows = await db
    .select({
      id: fields.id,
      code: fields.code,
      name: fields.name,
      nameUr: fields.nameUr,
      acres: fields.acres,
      geometry: fields.geometry,
      blockId: fields.blockId,
      blockCode: blocks.code,
      farmName: farms.name,
    })
    .from(fields)
    .leftJoin(blocks, eq(blocks.id, fields.blockId))
    .leftJoin(farms, eq(farms.id, blocks.farmId))
    .orderBy(fields.code);

  const activePlans = await db
    .select({ fieldId: cropPlans.fieldId, stage: cropPlans.currentStage, cropName: cropProfiles.name })
    .from(cropPlans)
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId));

  const planByField = new Map(activePlans.map((p) => [p.fieldId, p]));

  const latestSoil = await db
    .select({ fieldId: soilTests.fieldId, ph: soilTests.ph })
    .from(soilTests)
    .orderBy(desc(soilTests.testedOn));
  const phByField = new Map<string, string | null>();
  for (const r of latestSoil) if (!phByField.has(r.fieldId)) phByField.set(r.fieldId, r.ph);

  const polygons = rows
    .filter((r) => r.geometry)
    .map((r) => ({ id: r.id, code: r.code, geometry: r.geometry as never }));

  return (
    <div className="space-y-2">
      <Masthead section="FIELDS" />
      <SectionDivider />

      <div className="flex justify-end">
        <Link href={'/fields/new' as never} className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">
          New field
        </Link>
      </div>

      <SectionDivider label="Map" />
      {polygons.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <FieldMap fields={polygons} />
          </CardContent>
        </Card>
      ) : null}

      <SectionDivider label="All fields" />
      {rows.length === 0 ? (
        <EmptyState title="No fields yet" caption="Create your first field to get going." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Code</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Acres</th>
                  <th className="p-3">Crop</th>
                  <th className="p-3">Stage</th>
                  <th className="p-3">Soil pH</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const p = planByField.get(r.id);
                  return (
                    <tr key={r.id} className="cursor-pointer border-b border-[var(--rule)] hover:bg-slate-50">
                      <td className="p-3 font-semibold">
                        <Link href={`/fields/${r.id}` as never}>{r.code}</Link>
                      </td>
                      <td className="p-3">
                        <div>{r.name ?? ''}</div>
                        {r.nameUr ? <div dir="rtl" className="text-xs text-slate-500">{r.nameUr}</div> : null}
                      </td>
                      <td className="p-3 tabular">{Number(r.acres).toFixed(2)}</td>
                      <td className="p-3">{p?.cropName ?? ''}</td>
                      <td className="p-3">{p?.stage ?? ''}</td>
                      <td className="p-3 tabular">{phByField.get(r.id) ?? ''}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
