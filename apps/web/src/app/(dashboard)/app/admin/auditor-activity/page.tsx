import { db, entityActivity, userEntityRoles, users } from '@zameen/db';
import { and, desc, eq, gte, inArray } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { getSessionContext } from '../../../../../lib/session';

export const dynamic = 'force-dynamic';

const AUDIT_ROLES = ['auditor', 'external_accountant', 'accountant'] as const;

export default async function AuditorActivityPage() {
  const session = await getSessionContext();
  if (!session) return null;

  // Surface every page-view + record-view performed by an audit-role user
  // within this entity over the last 180 days. Pair this with the entity
  // activity stream for traceability of who saw what.
  const auditRoleRows = await db
    .select({ userId: userEntityRoles.userId, role: userEntityRoles.role })
    .from(userEntityRoles)
    .where(
      and(
        eq(userEntityRoles.entityId, session.entityId),
        inArray(userEntityRoles.role, AUDIT_ROLES as unknown as string[]),
        eq(userEntityRoles.isActive, true),
      ),
    );
  const auditUserIds = auditRoleRows.map((r) => r.userId);
  const sinceDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 180);

  const rows = auditUserIds.length
    ? await db
        .select({
          id: entityActivity.id,
          actorId: entityActivity.actorId,
          actorName: users.fullName,
          verb: entityActivity.verb,
          payload: entityActivity.payload,
          occurredAt: entityActivity.occurredAt,
        })
        .from(entityActivity)
        .leftJoin(users, eq(users.id, entityActivity.actorId))
        .where(
          and(
            inArray(entityActivity.actorId, auditUserIds),
            gte(entityActivity.occurredAt, sinceDate),
          ),
        )
        .orderBy(desc(entityActivity.occurredAt))
        .limit(500)
    : [];

  return (
    <div>
      <Masthead section="AUDITOR ACTIVITY" />
      <SectionDivider />
      <Card>
        <CardHeader>
          <CardTitle>{rows.length} recent events (last 180 days)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
              <tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">When</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Actor</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Verb</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-[var(--rule)]">
                  <td className="px-3 py-2 tabular text-xs">
                    {new Date(r.occurredAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-xs">{r.actorName ?? r.actorId ?? '—'}</td>
                  <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.verb}</td>
                  <td className="px-3 py-2 text-xs font-mono opacity-80 truncate max-w-[420px]">
                    {JSON.stringify(r.payload)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-[var(--fg-muted)] text-sm">
                    No audit-role activity recorded for this entity.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
