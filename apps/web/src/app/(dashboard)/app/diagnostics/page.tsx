import Link from 'next/link';
import Image from 'next/image';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { db, cropDiagnostics, fields, cropPlans, cropProfiles } from '@zameen/db';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  Masthead,
  SectionDivider,
  StatBlock,
} from '@zameen/ui';
import { fmtDate } from '@/lib/format';
import { BackfillButton } from '@/modules/diagnostics/components/backfill-button';

export const dynamic = 'force-dynamic';

interface SearchParams {
  fieldId?: string;
  cropPlanId?: string;
  severity?: string;
  status?: string;
  from?: string;
  to?: string;
}

export default async function DiagnosticsListPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const conditions = [] as ReturnType<typeof eq>[];
  if (sp.fieldId) conditions.push(eq(cropDiagnostics.fieldId, sp.fieldId));
  if (sp.cropPlanId) conditions.push(eq(cropDiagnostics.cropPlanId, sp.cropPlanId));
  if (sp.severity) conditions.push(eq(cropDiagnostics.severity, sp.severity));
  if (sp.status) conditions.push(eq(cropDiagnostics.status, sp.status));
  if (sp.from) conditions.push(gte(cropDiagnostics.observedOn, sp.from));
  if (sp.to) conditions.push(lte(cropDiagnostics.observedOn, sp.to));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = await db
    .select({
      id: cropDiagnostics.id,
      photoUrl: cropDiagnostics.photoUrl,
      observedOn: cropDiagnostics.observedOn,
      diagnosisLabel: cropDiagnostics.diagnosisLabel,
      confidence: cropDiagnostics.confidence,
      severity: cropDiagnostics.severity,
      status: cropDiagnostics.status,
      fieldCode: fields.code,
      cropName: cropProfiles.name,
    })
    .from(cropDiagnostics)
    .leftJoin(fields, eq(fields.id, cropDiagnostics.fieldId))
    .leftJoin(cropPlans, eq(cropPlans.id, cropDiagnostics.cropPlanId))
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .where(where)
    .orderBy(desc(cropDiagnostics.observedOn))
    .limit(200);

  const [totals] = await db
    .select({
      total: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${cropDiagnostics.status} = 'pending_review')::int`,
      severe: sql<number>`count(*) filter (where ${cropDiagnostics.severity} = 'severe')::int`,
      cropsAffected: sql<number>`count(distinct ${cropDiagnostics.cropPlanId})::int`,
    })
    .from(cropDiagnostics);

  return (
    <div className="space-y-2">
      <Masthead section="DIAGNOSTICS" />
      <SectionDivider />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Crop diagnostics</h1>
        <BackfillButton />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--rule)]">
        <StatBlock label="Total" value={String(totals?.total ?? 0)} />
        <StatBlock label="Pending review" value={String(totals?.pending ?? 0)} />
        <StatBlock label="Severe" value={String(totals?.severe ?? 0)} />
        <StatBlock label="Crops affected" value={String(totals?.cropsAffected ?? 0)} />
      </div>

      <SectionDivider label="Filters" />
      <Card>
        <CardContent className="p-3">
          <form className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm">
            <input name="fieldId" defaultValue={sp.fieldId} placeholder="field id" className="h-9 rounded border px-2" />
            <input name="cropPlanId" defaultValue={sp.cropPlanId} placeholder="crop plan id" className="h-9 rounded border px-2" />
            <select name="severity" defaultValue={sp.severity ?? ''} className="h-9 rounded border px-2">
              <option value="">severity (any)</option>
              <option value="mild">mild</option>
              <option value="moderate">moderate</option>
              <option value="severe">severe</option>
              <option value="unknown">unknown</option>
            </select>
            <select name="status" defaultValue={sp.status ?? ''} className="h-9 rounded border px-2">
              <option value="">status (any)</option>
              <option value="pending_review">pending_review</option>
              <option value="confirmed">confirmed</option>
              <option value="dismissed">dismissed</option>
              <option value="treated">treated</option>
              <option value="resolved">resolved</option>
            </select>
            <input name="from" type="date" defaultValue={sp.from} className="h-9 rounded border px-2" />
            <input name="to" type="date" defaultValue={sp.to} className="h-9 rounded border px-2" />
            <button type="submit" className="col-span-2 md:col-span-6 rounded-md bg-emerald-700 px-3 py-2 text-white">Apply</button>
          </form>
        </CardContent>
      </Card>

      <SectionDivider label="Results" />
      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <EmptyState title="No diagnostics match these filters" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Photo</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Field</th>
                  <th className="p-3">Crop</th>
                  <th className="p-3">Diagnosis</th>
                  <th className="p-3">Sev.</th>
                  <th className="p-3">Conf.</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--rule)]">
                    <td className="p-3">
                      <Link href={`/diagnostics/${r.id}` as never}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <Image src={r.photoUrl} alt="" width={40} height={40} className="h-10 w-10 rounded object-cover" />
                      </Link>
                    </td>
                    <td className="p-3 tabular">{fmtDate(r.observedOn)}</td>
                    <td className="p-3">{r.fieldCode ?? ''}</td>
                    <td className="p-3">{r.cropName ?? ''}</td>
                    <td className="p-3">
                      <Link href={`/diagnostics/${r.id}` as never} className="text-emerald-700 underline">
                        {r.diagnosisLabel ?? 'Unrecognized'}
                      </Link>
                    </td>
                    <td className="p-3">{r.severity ?? ''}</td>
                    <td className="p-3 tabular">{((Number(r.confidence) || 0) * 100).toFixed(0)}%</td>
                    <td className="p-3">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
