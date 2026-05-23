import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db, insuranceClaims, insurancePolicies, weatherIndexEvaluations, weatherIndexTriggers } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';
import { ClaimStatusActions } from '@/modules/insurance/components/claim-status-actions';
import { ClaimNarrative } from '@/modules/insurance/components/claim-narrative';

export const dynamic = 'force-dynamic';

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [claim] = await db.select().from(insuranceClaims).where(eq(insuranceClaims.id, id)).limit(1);
  if (!claim) return notFound();
  const [policy] = await db.select().from(insurancePolicies).where(eq(insurancePolicies.id, claim.policyId)).limit(1);

  // pull any weather-index evaluations that drafted this claim
  const evals = await db
    .select({
      id: weatherIndexEvaluations.id,
      evaluatedOn: weatherIndexEvaluations.evaluatedOn,
      measuredValue: weatherIndexEvaluations.measuredValue,
      thresholdValue: weatherIndexEvaluations.thresholdValue,
      isTriggered: weatherIndexEvaluations.isTriggered,
      computedPayoutPkr: weatherIndexEvaluations.computedPayoutPkr,
      triggerKind: weatherIndexTriggers.triggerKind,
      windowDays: weatherIndexTriggers.measurementWindowDays,
    })
    .from(weatherIndexEvaluations)
    .innerJoin(weatherIndexTriggers, eq(weatherIndexTriggers.id, weatherIndexEvaluations.triggerId))
    .where(eq(weatherIndexEvaluations.claimDraftId, claim.id))
    .orderBy(desc(weatherIndexEvaluations.evaluatedOn));

  const isAutoDrafted = claim.notes?.startsWith('Auto-drafted') ?? false;

  return (
    <div className="space-y-3">
      <Masthead section={`CLAIM ${claim.claimNumber ?? claim.id.slice(0, 8).toUpperCase()}`} />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Trail</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div><div className="smallcaps text-[0.65rem]">Policy</div><div className="font-semibold">{policy?.policyNumber}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Insurer</div><div>{policy?.insurerName}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Reported</div><div className="tabular text-xs">{fmtDate(claim.reportedDate)}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Incident</div><div className="tabular text-xs">{fmtDate(claim.incidentDate)}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Cause</div><div className="uppercase">{claim.cause}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Status</div><div className="smallcaps text-[0.7rem]">{claim.status}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Estimated loss</div><Pkr value={claim.estimatedLossPkr} /></div>
          <div><div className="smallcaps text-[0.65rem]">Claimed</div><Pkr value={claim.claimedPkr} /></div>
          <div><div className="smallcaps text-[0.65rem]">Settled</div>{claim.settledPkr ? <Pkr value={claim.settledPkr} /> : <span>—</span>}</div>
          <div><div className="smallcaps text-[0.65rem]">Source</div><div className="smallcaps text-[0.7rem]">{isAutoDrafted ? 'weather-index auto draft' : 'manual'}</div></div>
        </CardContent>
      </Card>

      {evals.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Weather-index evidence</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Date</th>
                  <th className="p-3">Trigger</th>
                  <th className="p-3 text-right">Measured</th>
                  <th className="p-3 text-right">Threshold</th>
                  <th className="p-3 text-right">Window</th>
                  <th className="p-3 text-right">Payout</th>
                </tr>
              </thead>
              <tbody>
                {evals.map((e) => (
                  <tr key={e.id} className="border-b border-[var(--rule)]">
                    <td className="p-3 tabular text-xs">{fmtDate(e.evaluatedOn)}</td>
                    <td className="p-3 smallcaps text-[0.7rem]">{e.triggerKind}</td>
                    <td className="p-3 text-right tabular">{e.measuredValue}</td>
                    <td className="p-3 text-right tabular">{e.thresholdValue}</td>
                    <td className="p-3 text-right tabular">{e.windowDays}d</td>
                    <td className="p-3 text-right">{e.computedPayoutPkr ? <Pkr value={e.computedPayoutPkr} /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Supporting photos</CardTitle></CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          {(claim.photoUrls ?? []).length === 0 ? (
            <div className="text-xs text-[var(--fg-muted)]">No photos attached. Field team should upload damage photos before submission.</div>
          ) : (
            (claim.photoUrls ?? []).map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="incident" className="w-24 h-24 object-cover rounded" />
              </a>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Narrative</CardTitle></CardHeader>
        <CardContent><ClaimNarrative claimId={claim.id} initialNotes={claim.notes} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
        <CardContent><ClaimStatusActions claimId={claim.id} currentStatus={claim.status} /></CardContent>
      </Card>
    </div>
  );
}
