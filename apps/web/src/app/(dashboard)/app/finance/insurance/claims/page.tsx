import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, insuranceClaims, insurancePolicies } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

const STATUS_FLOW = ['draft', 'reported', 'assessor_pending', 'assessor_done', 'approved', 'paid', 'closed'];

export default async function ClaimsListPage() {
  const claims = await db
    .select({
      id: insuranceClaims.id,
      claimNumber: insuranceClaims.claimNumber,
      reportedDate: insuranceClaims.reportedDate,
      incidentDate: insuranceClaims.incidentDate,
      cause: insuranceClaims.cause,
      claimedPkr: insuranceClaims.claimedPkr,
      settledPkr: insuranceClaims.settledPkr,
      status: insuranceClaims.status,
      notes: insuranceClaims.notes,
      policyId: insuranceClaims.policyId,
      policyNumber: insurancePolicies.policyNumber,
      insurerName: insurancePolicies.insurerName,
    })
    .from(insuranceClaims)
    .leftJoin(insurancePolicies, eq(insurancePolicies.id, insuranceClaims.policyId))
    .orderBy(desc(insuranceClaims.reportedDate));

  const autoDrafted = claims.filter((c) => c.status === 'draft');
  const inFlight = claims.filter((c) => !['draft', 'closed', 'rejected'].includes(c.status));
  const closed = claims.filter((c) => c.status === 'closed' || c.status === 'rejected');

  return (
    <div className="space-y-3">
      <Masthead section="INSURANCE CLAIMS" />
      <SectionDivider />

      <Card>
        <CardHeader><CardTitle>Auto-drafted (weather-index)</CardTitle></CardHeader>
        <CardContent className="p-0">
          {autoDrafted.length === 0 ? <EmptyState title="No auto-drafted claims" /> : <ClaimTable claims={autoDrafted} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>In flight</CardTitle></CardHeader>
        <CardContent className="p-0">
          {inFlight.length === 0 ? <EmptyState title="No claims in flight" /> : <ClaimTable claims={inFlight} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Closed / rejected</CardTitle></CardHeader>
        <CardContent className="p-0">
          {closed.length === 0 ? <EmptyState title="Nothing closed yet" /> : <ClaimTable claims={closed} />}
        </CardContent>
      </Card>

      <div className="text-xs text-[var(--fg-muted)]">
        Status flow: {STATUS_FLOW.join(' → ')}
      </div>
    </div>
  );
}

type ClaimRow = {
  id: string;
  claimNumber: string | null;
  reportedDate: string;
  incidentDate: string;
  cause: string;
  claimedPkr: string;
  settledPkr: string | null;
  status: string;
  notes: string | null;
  policyNumber: string | null;
  insurerName: string | null;
};

function ClaimTable({ claims }: { claims: ClaimRow[] }): React.JSX.Element {
  return (
    <table className="w-full text-sm">
      <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
        <tr>
          <th className="p-3">Reported</th>
          <th className="p-3">Policy</th>
          <th className="p-3">Cause</th>
          <th className="p-3 text-right">Claimed</th>
          <th className="p-3 text-right">Settled</th>
          <th className="p-3">Status</th>
          <th className="p-3">Source</th>
        </tr>
      </thead>
      <tbody>
        {claims.map((c) => (
          <tr key={c.id} className="border-b border-[var(--rule)]">
            <td className="p-3 tabular text-xs">{fmtDate(c.reportedDate)}</td>
            <td className="p-3">
              <Link href={`/finance/insurance/claims/${c.id}` as never} className="font-semibold">
                {c.policyNumber ?? c.id.slice(0, 8)}
              </Link>
              <div className="text-[0.65rem] text-[var(--fg-muted)]">{c.insurerName}</div>
            </td>
            <td className="p-3 smallcaps text-[0.7rem]">{c.cause}</td>
            <td className="p-3 text-right"><Pkr value={c.claimedPkr} /></td>
            <td className="p-3 text-right">{c.settledPkr ? <Pkr value={c.settledPkr} /> : '—'}</td>
            <td className="p-3 smallcaps text-[0.7rem]">{c.status}</td>
            <td className="p-3 text-[0.65rem] text-[var(--fg-muted)]">
              {c.notes?.startsWith('Auto-drafted') ? 'weather index' : 'manual'}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
