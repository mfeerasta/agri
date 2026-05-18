import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, insuranceClaims, insurancePolicies } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, SectionDivider, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';
import { ClaimStatusActions } from '@/modules/insurance/components/claim-status-actions';

export const dynamic = 'force-dynamic';

export default async function ClaimDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [claim] = await db.select().from(insuranceClaims).where(eq(insuranceClaims.id, id)).limit(1);
  if (!claim) return notFound();
  const [policy] = await db.select().from(insurancePolicies).where(eq(insurancePolicies.id, claim.policyId)).limit(1);

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
        </CardContent>
      </Card>

      {claim.notes && (
        <Card><CardHeader><CardTitle>Notes</CardTitle></CardHeader><CardContent className="text-sm whitespace-pre-wrap">{claim.notes}</CardContent></Card>
      )}

      <Card>
        <CardHeader><CardTitle>Evidence</CardTitle></CardHeader>
        <CardContent className="flex gap-2 flex-wrap">
          {(claim.photoUrls ?? []).length === 0 ? (
            <div className="text-xs text-[var(--fg-muted)]">No photos uploaded.</div>
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
        <CardHeader><CardTitle>Workflow</CardTitle></CardHeader>
        <CardContent>
          <ClaimStatusActions claimId={claim.id} currentStatus={claim.status} />
        </CardContent>
      </Card>
    </div>
  );
}
