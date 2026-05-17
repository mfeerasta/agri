import Link from 'next/link';
import { and, desc, eq, gte, lte, ilike } from 'drizzle-orm';
import { db, auditLog, users } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { fmtDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface SearchParams {
  action?: string;
  resource?: string;
  actor?: string;
  from?: string;
  to?: string;
}

export default async function AuditIndex({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const session = await getSessionContext();
  if (!session) {
    return (
      <div>
        <Masthead section="AUDIT" />
        <SectionDivider />
        <p className="text-sm text-[var(--ink)]/60">Sign in to view audit history.</p>
      </div>
    );
  }

  const where = [eq(auditLog.entityId, session.entityId)];
  if (params.action) where.push(eq(auditLog.action, params.action));
  if (params.resource) where.push(eq(auditLog.resource, params.resource));
  if (params.actor) where.push(ilike(users.fullName, `%${params.actor}%`));
  if (params.from) where.push(gte(auditLog.occurredAt, new Date(params.from)));
  if (params.to) where.push(lte(auditLog.occurredAt, new Date(params.to)));

  const rows = await db
    .select({
      id: auditLog.id,
      action: auditLog.action,
      resource: auditLog.resource,
      resourceId: auditLog.resourceId,
      occurredAt: auditLog.occurredAt,
      actorRole: auditLog.actorRole,
      actorName: users.fullName,
    })
    .from(auditLog)
    .leftJoin(users, eq(auditLog.actorId, users.id))
    .where(and(...where))
    .orderBy(desc(auditLog.occurredAt))
    .limit(300);

  return (
    <div>
      <Masthead section="AUDIT" />
      <SectionDivider />

      <form className="mb-4 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm" method="get">
        <input
          name="resource"
          defaultValue={params.resource ?? ''}
          placeholder="resource"
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
        />
        <input
          name="action"
          defaultValue={params.action ?? ''}
          placeholder="action"
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
        />
        <input
          name="actor"
          defaultValue={params.actor ?? ''}
          placeholder="actor name"
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
        />
        <input
          name="from"
          type="date"
          defaultValue={params.from ?? ''}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
        />
        <input
          name="to"
          type="date"
          defaultValue={params.to ?? ''}
          className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1"
        />
        <button
          type="submit"
          className="md:col-span-5 rounded bg-[var(--zameen-500,var(--ochre))] px-3 py-1 text-xs uppercase tracking-wider text-white"
        >
          Filter
        </button>
      </form>

      <Card>
        <CardHeader><CardTitle>Recent audit events</CardTitle></CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No events match these filters.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">When</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Action</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Resource</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Actor</th>
                  <th className="smallcaps text-right px-3 py-2 text-[0.7rem]">Walk</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{fmtDateTime(r.occurredAt)}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.action}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.resource}{r.resourceId ? ` / ${r.resourceId.slice(0, 8)}` : ''}
                    </td>
                    <td className="px-3 py-2">{r.actorName ?? r.actorRole ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      {r.resourceId ? (
                        <Link
                          href={`/audit/${r.resource}/${r.resourceId}` as never}
                          className="smallcaps text-[0.7rem] text-[var(--ochre)] hover:underline"
                        >
                          walk →
                        </Link>
                      ) : null}
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
