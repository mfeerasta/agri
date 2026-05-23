import Link from 'next/link';
import { notFound } from 'next/navigation';
import { and, desc, eq } from 'drizzle-orm';
import { db, stakeholders, stakeholderReports } from '@zameen/db';
import { Card, CardContent, CardHeader, CardTitle, Masthead, StatBlock, EmptyState, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function StakeholderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await getSessionContext();
  const entityId = ctx?.entityId ?? '';
  if (!entityId) return <EmptyState title="No entity in session" description="Sign in." />;

  const [st] = await db
    .select()
    .from(stakeholders)
    .where(and(eq(stakeholders.id, id), eq(stakeholders.entityId, entityId)));
  if (!st) notFound();

  const reports = await db
    .select()
    .from(stakeholderReports)
    .where(eq(stakeholderReports.stakeholderId, st.id))
    .orderBy(desc(stakeholderReports.dueDate))
    .limit(50);

  return (
    <div className="p-6 space-y-6">
      <Masthead title={st.name} subtitle={`${st.stakeholderKind} · ${st.reportingFrequency}`} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBlock label="Exposure" value={st.exposurePkr ? <Pkr value={Math.round(Number(st.exposurePkr) * 100)} /> : '—'} />
        <StatBlock label="Next due" value={st.nextReportDue ?? '—'} />
        <StatBlock label="Contact" value={st.contactPerson ?? '—'} />
        <StatBlock label="Reports filed" value={String(reports.filter((r) => r.submittedOn).length)} />
      </div>

      <div className="flex gap-3">
        <Link
          href={`/stakeholders/reports/new?stakeholderId=${st.id}`}
          className="px-3 py-2 rounded bg-emerald-700 text-white text-sm"
        >
          Generate new report
        </Link>
        {st.signedAgreementUrl ? (
          <a href={st.signedAgreementUrl} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded border text-sm">
            View signed agreement
          </a>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>Email: {st.email ?? '—'}</div>
          <div>Phone: {st.phone ?? '—'}</div>
          <div>Address: {st.address ?? '—'}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reporting history</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <EmptyState title="No reports yet" description="Generate your first report." />
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-zinc-500">
                <tr>
                  <th className="py-1">Period</th>
                  <th>Due</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>PDF</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2">{r.reportPeriodStart} → {r.reportPeriodEnd}</td>
                    <td>{r.dueDate}</td>
                    <td>{r.submittedOn ?? '—'}</td>
                    <td>{r.status}</td>
                    <td>{r.pdfUrl ? <a href={r.pdfUrl} className="underline">open</a> : '—'}</td>
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
