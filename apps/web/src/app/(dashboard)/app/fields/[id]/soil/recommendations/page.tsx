import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, fields, soilHealthCards, cropPlans, cropProfiles } from '@zameen/db';
import { and, desc, eq, ne } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider } from '@zameen/ui';
import { computeRecommendation, CROP_BASELINES } from '@zameen/finance';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ crop?: string; yield?: string }>;
}

export default async function FertilizerRecommendationPage({ params, searchParams }: Params) {
  const { id } = await params;
  const sp = await searchParams;

  const [field] = await db.select().from(fields).where(eq(fields.id, id)).limit(1);
  if (!field) notFound();

  const [card] = await db
    .select()
    .from(soilHealthCards)
    .where(eq(soilHealthCards.fieldId, id))
    .orderBy(desc(soilHealthCards.issuedOn))
    .limit(1);

  if (!card) {
    return (
      <div className="space-y-2">
        <Masthead section={`FIELD / ${field.code} / RECOMMENDATIONS`} />
        <SectionDivider />
        <EmptyState
          title="No soil health card"
          description="Upload or create a soil health card first."
        />
      </div>
    );
  }

  const activePlan = await db
    .select({
      id: cropPlans.id,
      cropCode: cropProfiles.code,
      cropName: cropProfiles.name,
      expectedYield: cropPlans.expectedYieldPerAcre,
      seasonLabel: cropPlans.seasonLabel,
    })
    .from(cropPlans)
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .where(and(eq(cropPlans.fieldId, id), ne(cropPlans.currentStage, 'harvested')))
    .orderBy(desc(cropPlans.plannedSowingDate))
    .limit(1);

  const planRow = activePlan[0];
  const cropCode = sp.crop ?? planRow?.cropCode ?? 'wheat';
  const baseline = CROP_BASELINES[cropCode] ?? CROP_BASELINES.wheat;
  const targetYield = Number(sp.yield ?? planRow?.expectedYield ?? baseline.baselineTargetYieldKgPerAcre);

  const rec = await computeRecommendation({
    cardId: card.id,
    cropCode,
    targetYieldKgPerAcre: targetYield,
  });

  return (
    <div className="space-y-2">
      <Masthead section={`FIELD / ${field.code} / FERTILIZER PLAN`} />
      <SectionDivider />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Fertilizer recommendation</h1>
          <div className="text-sm text-slate-500">
            Card {card.cardNumber}, issued {fmtDate(card.issuedOn)}.
          </div>
        </div>
        <Link
          href={`/api/soil-health/recommendations/${card.id}/pdf?crop=${cropCode}&yield=${targetYield}` as never}
          className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white"
        >
          Download PDF
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3 rounded-md border border-[var(--rule)] p-3" method="get">
        <label className="text-sm">
          <div className="text-xs uppercase text-slate-500">Crop</div>
          <select name="crop" defaultValue={cropCode} className="mt-1 rounded border px-2 py-1">
            {Object.values(CROP_BASELINES).map((b) => (
              <option key={b.cropCode} value={b.cropCode}>
                {b.cropName}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <div className="text-xs uppercase text-slate-500">Target yield (kg/acre)</div>
          <input
            type="number"
            name="yield"
            defaultValue={targetYield}
            min={100}
            className="mt-1 w-32 rounded border px-2 py-1"
          />
        </label>
        <button type="submit" className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white">
          Recompute
        </button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>NPK + sulphur + zinc</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <Cell label="Nitrogen (N)" value={`${rec.nKgPerAcre} kg/acre`} />
            <Cell label="Phosphate (P2O5)" value={`${rec.p2o5KgPerAcre} kg/acre`} />
            <Cell label="Potash (K2O)" value={`${rec.k2oKgPerAcre} kg/acre`} />
            <Cell label="Zinc" value={rec.zincKgPerAcre ? `${rec.zincKgPerAcre} kg/acre` : 'not required'} />
            <Cell
              label="Sulphur"
              value={rec.sulphurKgPerAcre ? `${rec.sulphurKgPerAcre} kg/acre` : 'not required'}
            />
          </div>
        </CardContent>
      </Card>

      {Object.keys(rec.micros).length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Micronutrients</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm">
              {Object.entries(rec.micros).map(([k, v]) => (
                <li key={k}>
                  {k}: {v} kg/acre
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {rec.organicRecommendations ? (
        <Card>
          <CardHeader>
            <CardTitle>Organic amendments</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm">{rec.organicRecommendations}</p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Rationale</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{rec.aiRationaleEn}</p>
          <p dir="rtl" className="mt-3 text-sm text-slate-700">
            {rec.aiRationaleUr}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}
