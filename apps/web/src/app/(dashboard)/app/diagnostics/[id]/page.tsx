import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, cropDiagnostics, fields, cropPlans, cropProfiles } from '@zameen/db';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Masthead,
  SectionDivider,
} from '@zameen/ui';
import { fmtDate } from '@/lib/format';
import { DiagnosticReviewActions } from '@/modules/diagnostics/components/review-actions';

export const dynamic = 'force-dynamic';

interface DiagAlt {
  label: string;
  confidence: number;
  reason: string;
}

export default async function DiagnosticDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await db
    .select({
      id: cropDiagnostics.id,
      photoUrl: cropDiagnostics.photoUrl,
      observedOn: cropDiagnostics.observedOn,
      diagnosisLabel: cropDiagnostics.diagnosisLabel,
      confidence: cropDiagnostics.confidence,
      severity: cropDiagnostics.severity,
      treatmentSuggestion: cropDiagnostics.treatmentSuggestion,
      treatmentSuggestionUr: cropDiagnostics.treatmentSuggestionUr,
      alternativeDiagnoses: cropDiagnostics.alternativeDiagnoses,
      source: cropDiagnostics.source,
      status: cropDiagnostics.status,
      reviewedAt: cropDiagnostics.reviewedAt,
      fieldId: cropDiagnostics.fieldId,
      cropPlanId: cropDiagnostics.cropPlanId,
      fieldCode: fields.code,
      cropName: cropProfiles.name,
    })
    .from(cropDiagnostics)
    .leftJoin(fields, eq(fields.id, cropDiagnostics.fieldId))
    .leftJoin(cropPlans, eq(cropPlans.id, cropDiagnostics.cropPlanId))
    .leftJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .where(eq(cropDiagnostics.id, id))
    .limit(1);

  if (!row) notFound();

  const confidencePct = ((Number(row.confidence) || 0) * 100).toFixed(0);
  const alts = (row.alternativeDiagnoses ?? []) as DiagAlt[];

  return (
    <div className="space-y-2">
      <Masthead section={`DIAGNOSTIC / ${row.fieldCode ?? row.fieldId.slice(0, 6)}`} />
      <SectionDivider />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{row.diagnosisLabel ?? 'Unrecognized'}</h1>
          <p className="text-sm text-slate-500">
            {row.cropName ?? 'unknown crop'} · observed {fmtDate(row.observedOn)} · {row.source}
          </p>
        </div>
        {row.cropPlanId ? (
          <Link
            href={`/crops/plans/${row.cropPlanId}` as never}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            Open crop plan
          </Link>
        ) : null}
      </div>

      <Card>
        <CardContent className="p-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.photoUrl} alt="" className="max-h-[480px] w-full object-contain bg-slate-50" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Confidence</p><p className="text-lg tabular">{confidencePct}%</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Severity</p><p className="text-lg capitalize">{row.severity ?? 'unknown'}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Status</p><p className="text-lg">{row.status}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-slate-500">Reviewed</p><p className="text-lg">{row.reviewedAt ? fmtDate(row.reviewedAt) : 'No'}</p></CardContent></Card>
      </div>

      <SectionDivider label="Treatment suggestion" />
      <Card>
        <CardContent className="space-y-3 p-4">
          <div>
            <p className="text-xs uppercase text-slate-500">English</p>
            <p className="whitespace-pre-line text-sm">{row.treatmentSuggestion || '(none)'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Urdu</p>
            <p dir="rtl" className="urdu whitespace-pre-line text-right text-sm">
              {row.treatmentSuggestionUr || '(none)'}
            </p>
          </div>
        </CardContent>
      </Card>

      <SectionDivider label="Alternative diagnoses" />
      <Card>
        <CardContent className="p-0">
          {alts.length === 0 ? (
            <p className="p-4 text-sm text-slate-500">No alternatives suggested.</p>
          ) : (
            <ul>
              {alts.slice(0, 3).map((a, i) => (
                <li key={i} className="border-b border-[var(--rule)] px-4 py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="font-body">{a.label}</span>
                    <span className="tabular text-xs text-slate-500">
                      {(Number(a.confidence) * 100).toFixed(0)}%
                    </span>
                  </div>
                  {a.reason ? <p className="mt-1 text-sm text-slate-600">{a.reason}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SectionDivider label="Review" />
      <Card>
        <CardHeader><CardTitle>Decision</CardTitle></CardHeader>
        <CardContent>
          <DiagnosticReviewActions
            id={row.id}
            currentStatus={row.status as 'pending_review' | 'confirmed' | 'dismissed' | 'treated' | 'resolved'}
            treatmentSuggestion={row.treatmentSuggestion ?? ''}
            cropPlanId={row.cropPlanId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
