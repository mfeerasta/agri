import Link from 'next/link';
import { db, complianceDocuments } from '@zameen/db';
import { desc } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

function daysBetween(target: string | null): number | null {
  if (!target) return null;
  const t = new Date(target).getTime();
  const now = Date.now();
  return Math.round((t - now) / 86_400_000);
}

export default async function ComplianceDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const rows = await db
    .select()
    .from(complianceDocuments)
    .orderBy(desc(complianceDocuments.updatedAt))
    .limit(500);

  const filtered = rows.filter((r) => {
    if (sp.kind && r.docKind !== sp.kind) return false;
    if (sp.status && r.status !== sp.status) return false;
    return true;
  });

  const buckets = {
    expired: filtered.filter((r) => {
      const d = daysBetween(r.expiresOn);
      return d !== null && d < 0;
    }),
    in30: filtered.filter((r) => {
      const d = daysBetween(r.expiresOn);
      return d !== null && d >= 0 && d <= 30;
    }),
    in60: filtered.filter((r) => {
      const d = daysBetween(r.expiresOn);
      return d !== null && d > 30 && d <= 60;
    }),
    in90: filtered.filter((r) => {
      const d = daysBetween(r.expiresOn);
      return d !== null && d > 60 && d <= 90;
    }),
  };

  const docKinds = Array.from(new Set(rows.map((r) => r.docKind))).sort();

  return (
    <div>
      <Masthead section="COMPLIANCE DOCUMENTS" />
      <SectionDivider />

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-4 mb-4">
        <AlertCard tone="danger" label="Expired" count={buckets.expired.length} />
        <AlertCard tone="warn" label="Expiring ≤30d" count={buckets.in30.length} />
        <AlertCard tone="muted" label="Expiring ≤60d" count={buckets.in60.length} />
        <AlertCard tone="muted" label="Expiring ≤90d" count={buckets.in90.length} />
      </div>

      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <div className="flex gap-2 flex-wrap">
          <form className="flex gap-2 items-center">
            <select
              name="kind"
              defaultValue={sp.kind ?? ''}
              className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-xs smallcaps"
            >
              <option value="">All kinds</option>
              {docKinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <select
              name="status"
              defaultValue={sp.status ?? ''}
              className="border border-[var(--ink)] bg-[var(--paper)] px-2 py-1 text-xs smallcaps"
            >
              <option value="">All status</option>
              <option value="active">active</option>
              <option value="expired">expired</option>
              <option value="renewing">renewing</option>
              <option value="superseded">superseded</option>
              <option value="lost">lost</option>
            </select>
            <button
              type="submit"
              className="border border-[var(--ink)] px-3 py-1 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]"
            >
              Filter
            </button>
          </form>
        </div>
        <Link
          href={'/compliance/documents/new' as never}
          className="border border-[var(--ink)] px-4 py-2 smallcaps text-xs hover:bg-[var(--ink)] hover:text-[var(--paper)]"
        >
          Upload document
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{filtered.length} documents</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No documents.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Title</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Kind</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Reference</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Issued</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Expires</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((d) => {
                  const days = daysBetween(d.expiresOn);
                  const expiryClass =
                    days === null
                      ? ''
                      : days < 0
                        ? 'text-red-700 font-medium'
                        : days <= 30
                          ? 'text-amber-700 font-medium'
                          : days <= 90
                            ? 'text-amber-600'
                            : '';
                  return (
                    <tr key={d.id} className="border-t border-[var(--rule)]">
                      <td className="px-3 py-2">
                        <Link
                          href={`/compliance/documents/${d.id}` as never}
                          className="hover:underline"
                        >
                          {d.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2 smallcaps text-[0.7rem]">{d.docKind}</td>
                      <td className="px-3 py-2 tabular text-xs">{d.referenceNumber ?? '—'}</td>
                      <td className="px-3 py-2 tabular text-xs">{fmtDate(d.issuedOn)}</td>
                      <td className={`px-3 py-2 tabular text-xs ${expiryClass}`}>
                        {fmtDate(d.expiresOn)}
                        {days !== null && days < 0 ? ' (lapsed)' : days !== null && days <= 90 ? ` (T-${days}d)` : ''}
                      </td>
                      <td className="px-3 py-2 smallcaps text-[0.7rem]">{d.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AlertCard({
  tone,
  label,
  count,
}: {
  tone: 'danger' | 'warn' | 'muted';
  label: string;
  count: number;
}) {
  const bg =
    tone === 'danger'
      ? 'border-red-700 bg-red-50'
      : tone === 'warn'
        ? 'border-amber-700 bg-amber-50'
        : 'border-[var(--rule)]';
  return (
    <div className={`border ${bg} p-3`}>
      <div className="smallcaps text-[0.7rem] text-[var(--ink)]/70">{label}</div>
      <div className="text-2xl tabular mt-1">{count}</div>
    </div>
  );
}
