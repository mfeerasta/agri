import { db, users, userEntityRoles } from '@zameen/db';
import { asc, eq } from 'drizzle-orm';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { getSessionContext } from '../../../../../lib/session';
import { AssignRoleControl, InviteAuditorForm } from './role-controls';

export const dynamic = 'force-dynamic';

export default async function UsersAdminPage() {
  const session = await getSessionContext();
  const rows = await db.select().from(users).orderBy(asc(users.fullName));
  const roles = session
    ? await db.select().from(userEntityRoles).where(eq(userEntityRoles.entityId, session.entityId))
    : [];
  const rolesByUser = roles.reduce<Record<string, string[]>>((acc, r) => {
    if (!r.isActive) return acc;
    (acc[r.userId] ??= []).push(r.role);
    return acc;
  }, {});
  return (
    <div>
      <Masthead section="USERS" />
      <SectionDivider />
      <div className="space-y-4">
        <Card>
          <CardHeader><CardTitle>Invite external auditor</CardTitle></CardHeader>
          <CardContent><InviteAuditorForm /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{rows.length} users</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]"><tr>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Name</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Phone</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Primary role</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Entity roles</th>
                <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Role admin</th>
                <th className="smallcaps text-center px-3 py-2 text-[0.7rem]">Active</th>
              </tr></thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">{u.fullName}</td>
                    <td className="px-3 py-2 tabular text-xs">{u.phone ?? '—'}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{u.primaryRole}</td>
                    <td className="px-3 py-2 smallcaps text-[0.65rem]">{rolesByUser[u.id]?.join(' · ') ?? '—'}</td>
                    <td className="px-3 py-2">
                      <AssignRoleControl userId={u.id} currentRoles={rolesByUser[u.id] ?? []} />
                    </td>
                    <td className="px-3 py-2 text-center">{u.isActive ? '✓' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
