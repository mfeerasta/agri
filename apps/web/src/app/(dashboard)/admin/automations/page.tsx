import Link from 'next/link';
import { desc, eq } from 'drizzle-orm';
import { db, automationRecipes } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { ToggleRecipeButton } from '@/modules/automations/toggle-recipe-button';

export const dynamic = 'force-dynamic';

export default async function AutomationsListPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Not authenticated.</div>;
  const rows = await db
    .select()
    .from(automationRecipes)
    .where(eq(automationRecipes.entityId, ctx.entityId))
    .orderBy(desc(automationRecipes.createdAt));

  return (
    <div>
      <Masthead section="AUTOMATIONS" />
      <SectionDivider />
      <div className="flex justify-end mb-4">
        <Link
          href="/admin/automations/new"
          className="px-4 py-2 rounded-md bg-[var(--accent)] text-[var(--accent-fg)] text-sm font-medium"
        >
          New recipe
        </Link>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{rows.length} recipes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="p-6 text-sm text-[var(--fg-muted)]">
              No recipes yet. Start from a template on the new-recipe page.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Name</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Trigger</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Actions</th>
                  <th className="smallcaps text-center px-3 py-2 text-[0.7rem]">Fires</th>
                  <th className="smallcaps text-center px-3 py-2 text-[0.7rem]">Enabled</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">
                      <Link href={`/admin/automations/${r.id}`} className="hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.triggerKind}</td>
                    <td className="px-3 py-2 smallcaps text-[0.65rem]">
                      {(r.actions as Array<{ kind: string }>).map((a) => a.kind).join(', ')}
                    </td>
                    <td className="px-3 py-2 text-center tabular">{r.fireCount}</td>
                    <td className="px-3 py-2 text-center">
                      <ToggleRecipeButton id={r.id} enabled={r.enabled} />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Link href={`/admin/automations/${r.id}`} className="text-xs text-[var(--accent)]">
                        Edit
                      </Link>
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
