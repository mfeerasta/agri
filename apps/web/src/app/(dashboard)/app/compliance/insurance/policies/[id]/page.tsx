import Link from 'next/link';
import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db, insurancePolicies, insuranceClaims, documents } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, EmptyState, Masthead, SectionDivider, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [policy] = await db.select().from(insurancePolicies).where(eq(insurancePolicies.id, id)).limit(1);
  if (!policy) return notFound();
  const claims = await db.select().from(insuranceClaims).where(eq(insuranceClaims.policyId, id)).orderBy(desc(insuranceClaims.reportedDate));
  const [doc] = policy.attachedDocId
    ? await db.select().from(documents).where(eq(documents.id, policy.attachedDocId)).limit(1)
    : [];

  return (
    <div className="space-y-3">
      <Masthead section={`POLICY ${policy.policyNumber}`} />
      <SectionDivider />
      <Card>
        <CardHeader><CardTitle>Coverage</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><div className="smallcaps text-[0.65rem]">Insurer</div><div className="font-semibold">{policy.insurerName}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Kind</div><div className="uppercase">{policy.policyKind}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Coverage</div><Pkr value={policy.coveragePkr} /></div>
          <div><div className="smallcaps text-[0.65rem]">Premium</div><Pkr value={policy.premiumPkr} /></div>
          <div><div className="smallcaps text-[0.65rem]">Effective</div><div className="tabular text-xs">{fmtDate(policy.effectiveFrom)} to {fmtDate(policy.effectiveTo)}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Status</div><div className="smallcaps text-[0.7rem]">{policy.status}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Fields covered</div><div>{(policy.fieldsCovered ?? []).length}</div></div>
          <div><div className="smallcaps text-[0.65rem]">Animals covered</div><div>{(policy.animalsCovered ?? []).length}</div></div>
        </CardContent>
      </Card>

      {doc && (
        <Card>
          <CardHeader><CardTitle>Policy document</CardTitle></CardHeader>
          <CardContent>
            <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-emerald-700 underline">{doc.title}</a>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Link
          href={`/compliance/insurance/claims/new?policyId=${policy.id}` as never}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white"
        >
          File claim
        </Link>
      </div>

      <Card>
        <CardHeader><CardTitle>Claims</CardTitle></CardHeader>
        <CardContent className="p-0">
          {claims.length === 0 ? (
            <EmptyState title="No claims filed against this policy" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Reported</th>
                  <th className="p-3">Incident</th>
                  <th className="p-3">Cause</th>
                  <th className="p-3 text-right">Claimed</th>
                  <th className="p-3 text-right">Settled</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {claims.map((c) => (
                  <tr key={c.id} className="border-b border-[var(--rule)]">
                    <td className="p-3 tabular text-xs">{fmtDate(c.reportedDate)}</td>
                    <td className="p-3 tabular text-xs">{fmtDate(c.incidentDate)}</td>
                    <td className="p-3 smallcaps text-[0.7rem]">{c.cause}</td>
                    <td className="p-3 text-right"><Pkr value={c.claimedPkr} /></td>
                    <td className="p-3 text-right">{c.settledPkr ? <Pkr value={c.settledPkr} /> : ''}</td>
                    <td className="p-3 smallcaps text-[0.7rem]">
                      <Link href={`/compliance/insurance/claims/${c.id}` as never}>{c.status}</Link>
                    </td>
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
