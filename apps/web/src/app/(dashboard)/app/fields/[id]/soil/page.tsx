import Link from 'next/link';
import { notFound } from 'next/navigation';
import { db, fields, soilHealthCards } from '@zameen/db';
import { desc, eq } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider, StatBlock } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface Params {
  params: Promise<{ id: string }>;
}

function val(v: string | number | null | undefined, unit = ''): string {
  if (v === null || v === undefined || v === '') return '-';
  const s = typeof v === 'number' ? String(v) : v;
  return unit ? `${s} ${unit}` : s;
}

export default async function FieldSoilPage({ params }: Params) {
  const { id } = await params;
  const [field] = await db.select().from(fields).where(eq(fields.id, id)).limit(1);
  if (!field) notFound();

  const cards = await db
    .select()
    .from(soilHealthCards)
    .where(eq(soilHealthCards.fieldId, id))
    .orderBy(desc(soilHealthCards.issuedOn));

  const latest = cards[0] ?? null;
  const expiringSoon =
    latest && new Date(latest.validUntil).getTime() - Date.now() < 6 * 30 * 24 * 3600 * 1000;

  return (
    <div className="space-y-2">
      <Masthead section={`FIELD / ${field.code} / SOIL HEALTH`} />
      <SectionDivider />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Soil health cards</h1>
        <div className="flex gap-2">
          <Link
            href={`/land/soil-sampling/new?fieldId=${id}` as never}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white"
          >
            Plan sampling
          </Link>
          {latest ? (
            <Link
              href={`/fields/${id}/soil/recommendations` as never}
              className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white"
            >
              Fertilizer plan
            </Link>
          ) : null}
        </div>
      </div>

      {!latest ? (
        <EmptyState
          title="No soil health card on file"
          description="Plan a sampling event to begin."
        />
      ) : (
        <>
          {expiringSoon ? (
            <div className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
              Card valid until {fmtDate(latest.validUntil)}. Consider re-sampling within 6 months.
            </div>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rule)]">
            <StatBlock label="Card #" value={latest.cardNumber} />
            <StatBlock label="Issued" value={fmtDate(latest.issuedOn)} />
            <StatBlock label="Valid until" value={fmtDate(latest.validUntil)} />
            <StatBlock label="Lab" value={latest.laboratory ?? '-'} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Macro nutrients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Row label="pH" value={val(latest.ph)} />
                <Row label="EC" value={val(latest.electricalConductivityDsPerM, 'dS/m')} />
                <Row label="Organic matter" value={val(latest.organicMatterPct, '%')} />
                <Row label="Organic carbon" value={val(latest.organicCarbonPct, '%')} />
                <Row label="CEC" value={val(latest.cecCmolPerKg, 'cmol/kg')} />
                <Row label="N (total)" value={val(latest.nitrogenTotalPct, '%')} />
                <Row label="P (avail)" value={val(latest.phosphorusAvailPpm, 'ppm')} />
                <Row label="K (avail)" value={val(latest.potassiumAvailPpm, 'ppm')} />
                <Row label="Sulphur" value={val(latest.sulphurPpm, 'ppm')} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Micro nutrients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                <Row label="Zinc" value={val(latest.zincPpm, 'ppm')} />
                <Row label="Iron" value={val(latest.ironPpm, 'ppm')} />
                <Row label="Manganese" value={val(latest.manganesePpm, 'ppm')} />
                <Row label="Copper" value={val(latest.copperPpm, 'ppm')} />
                <Row label="Boron" value={val(latest.boronPpm, 'ppm')} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Physical + classifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <Row label="Texture" value={val(latest.textureClass)} />
                <Row label="Clay" value={val(latest.clayPct, '%')} />
                <Row label="Sand" value={val(latest.sandPct, '%')} />
                <Row label="Silt" value={val(latest.siltPct, '%')} />
                <Row label="Bulk density" value={val(latest.bulkDensityGPerCm3, 'g/cm3')} />
                <Row label="Infiltration" value={val(latest.infiltrationRateCmPerHr, 'cm/hr')} />
                <Row label="Carbonate" value={val(latest.carbonatePct, '%')} />
                <Row label="Salinity" value={val(latest.salinityClass)} />
                <Row label="Sodicity" value={val(latest.sodicityClass)} />
              </div>
            </CardContent>
          </Card>

          {latest.aiSummary || latest.aiSummaryUr ? (
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                {latest.aiSummary ? <p className="text-sm">{latest.aiSummary}</p> : null}
                {latest.aiSummaryUr ? (
                  <p dir="rtl" className="mt-2 text-sm text-slate-700">
                    {latest.aiSummaryUr}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {latest.fullReportUrl ? (
            <a
              href={latest.fullReportUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-emerald-700 underline"
            >
              View full lab report
            </a>
          ) : null}

          {cards.length > 1 ? (
            <Card>
              <CardHeader>
                <CardTitle>History</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th>Card #</th>
                      <th>Issued</th>
                      <th>pH</th>
                      <th>OM%</th>
                      <th>P ppm</th>
                      <th>K ppm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cards.slice(1).map((c) => (
                      <tr key={c.id} className="border-t">
                        <td>{c.cardNumber}</td>
                        <td>{fmtDate(c.issuedOn)}</td>
                        <td>{val(c.ph)}</td>
                        <td>{val(c.organicMatterPct)}</td>
                        <td>{val(c.phosphorusAvailPpm)}</td>
                        <td>{val(c.potassiumAvailPpm)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
