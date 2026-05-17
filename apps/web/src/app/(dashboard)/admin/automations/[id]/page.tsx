import { notFound } from 'next/navigation';
import { eq, desc } from 'drizzle-orm';
import { db, automationRecipes, automationRuns } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent } from '@zameen/ui';
import { TRIGGER_KINDS, type ActionKind, type Condition, type TriggerKind } from '@zameen/automations';
import { RecipeBuilderEditor } from '@/modules/automations/recipe-builder-editor';

export const dynamic = 'force-dynamic';

export default async function AutomationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row] = await db.select().from(automationRecipes).where(eq(automationRecipes.id, id)).limit(1);
  if (!row) notFound();
  const runs = await db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.recipeId, id))
    .orderBy(desc(automationRuns.occurredAt))
    .limit(20);

  return (
    <div>
      <Masthead section="AUTOMATION" />
      <SectionDivider />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{row.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <RecipeBuilderEditor
            id={row.id}
            triggerKinds={[...TRIGGER_KINDS]}
            initial={{
              name: row.name,
              triggerKind: row.triggerKind as TriggerKind,
              conditions: row.conditions as Condition[],
              actions: row.actions as Array<{ kind: ActionKind; config: Record<string, unknown> }>,
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Run history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {runs.length === 0 ? (
            <div className="p-6 text-sm text-[var(--fg-muted)]">No runs yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">When</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Status</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Actions</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Error</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2 tabular text-xs">{new Date(r.occurredAt).toISOString()}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.status}</td>
                    <td className="px-3 py-2 text-xs">
                      {(r.actionsExecuted as Array<{ kind: string; ok: boolean }>).map(
                        (a, idx) => (
                          <span key={idx} className="mr-2">
                            {a.ok ? '✓' : '✕'} {a.kind}
                          </span>
                        ),
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-[var(--danger)]">{r.errorMessage ?? '—'}</td>
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
