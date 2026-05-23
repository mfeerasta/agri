import Link from 'next/link';
import { db, governmentSchemes, schemeApplications } from '@zameen/db';
import { desc, eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SchemesPage() {
  const schemes = await db
    .select()
    .from(governmentSchemes)
    .where(eq(governmentSchemes.isActive, true));
  const apps = await db
    .select()
    .from(schemeApplications)
    .orderBy(desc(schemeApplications.updatedAt))
    .limit(50);
  const schemeById = new Map(schemes.map((s) => [s.id, s]));

  return (
    <div>
      <Masthead section="GOVERNMENT SCHEMES" />
      <SectionDivider />

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Available schemes ({schemes.length})</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            {schemes.map((s) => (
              <div key={s.id} className="border-b border-[var(--rule)] py-2">
                <div className="flex justify-between items-baseline gap-2">
                  <div>
                    <div className="font-medium">{s.name}</div>
                    {s.nameUr ? <div className="text-xs text-[var(--ink)]/60" dir="rtl">{s.nameUr}</div> : null}
                    <div className="smallcaps text-[0.65rem] text-[var(--ink)]/60">
                      {s.authority} · {s.schemeType ?? '—'} · {s.region ?? 'Pakistan'}
                    </div>
                  </div>
                  <Link
                    href={`/compliance/schemes/${s.id}/apply` as never}
                    className="border border-[var(--ink)] px-2 py-1 smallcaps text-[0.65rem] hover:bg-[var(--ink)] hover:text-[var(--paper)]"
                  >
                    Apply
                  </Link>
                </div>
                {s.benefitSummary ? (
                  <div className="text-xs mt-1 text-[var(--ink)]/80">{s.benefitSummary}</div>
                ) : null}
                {s.applicationUrl ? (
                  <a
                    href={s.applicationUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline text-[var(--ink)]/70"
                  >
                    Official page
                  </a>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>My applications</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {apps.length === 0 ? (
              <div className="p-6 text-sm text-[var(--ink)]/50">No applications yet.</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                  <tr>
                    <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Scheme</th>
                    <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Applied</th>
                    <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                    <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Expected</th>
                  </tr>
                </thead>
                <tbody>
                  {apps.map((a) => {
                    const s = schemeById.get(a.schemeId);
                    return (
                      <tr key={a.id} className="border-t border-[var(--rule)]">
                        <td className="px-3 py-2">{s?.name ?? a.schemeId}</td>
                        <td className="px-3 py-2 tabular text-xs">{fmtDate(a.appliedOn)}</td>
                        <td className="px-3 py-2 smallcaps text-[0.7rem]">{a.status}</td>
                        <td className="px-3 py-2 text-right">
                          {a.expectedBenefitPkr ? <Pkr value={a.expectedBenefitPkr} /> : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
