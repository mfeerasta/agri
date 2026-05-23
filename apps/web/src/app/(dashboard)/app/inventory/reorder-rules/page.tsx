import { eq } from 'drizzle-orm';
import { db, inputs } from '@zameen/db';
import { Card, CardContent, EmptyState, Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { loadReorderRules } from '@/modules/inventory/forecast-actions';
import { AutoRfqToggle } from '@/modules/inventory/forecasts-controls';
import { ReorderRuleForm } from '@/modules/inventory/reorder-rule-form';

export const dynamic = 'force-dynamic';

export default async function ReorderRulesPage() {
  const ctx = await getSessionContext();
  if (!ctx?.entityId) return <EmptyState title="No entity context" />;
  const rules = await loadReorderRules(ctx.entityId);
  const ruleInputIds = new Set(rules.map((r) => r.inputId));
  const allInputs = await db
    .select({ id: inputs.id, name: inputs.name, unit: inputs.unit })
    .from(inputs)
    .where(eq(inputs.entityId, ctx.entityId));
  const unruled = allInputs.filter((i) => !ruleInputIds.has(i.id));

  return (
    <div className="space-y-2">
      <Masthead section="REORDER RULES" />
      <SectionDivider />
      <Card>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <EmptyState title="No reorder rules yet" />
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--rule)] text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="p-3">Input</th>
                  <th className="p-3">Kind</th>
                  <th className="p-3">Reorder point</th>
                  <th className="p-3">Reorder qty</th>
                  <th className="p-3">Safety days</th>
                  <th className="p-3">Active</th>
                  <th className="p-3">Auto-RFQ</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id} className="border-b border-[var(--rule)]">
                    <td className="p-3">
                      {r.inputName} <span className="text-xs text-slate-500">({r.unit})</span>
                    </td>
                    <td className="p-3">{r.ruleKind}</td>
                    <td className="p-3 tabular">{r.reorderPoint ?? ''}</td>
                    <td className="p-3 tabular">{r.reorderQuantity ?? 'EOQ'}</td>
                    <td className="p-3 tabular">{r.safetyStockDays}</td>
                    <td className="p-3">{r.isActive ? 'yes' : 'no'}</td>
                    <td className="p-3">
                      <AutoRfqToggle ruleId={r.id} initial={r.autoCreateRfq} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <SectionDivider />
      <Card>
        <CardContent className="p-4">
          <h2 className="mb-3 text-sm font-semibold">New reorder rule</h2>
          {unruled.length === 0 ? (
            <p className="text-xs text-slate-500">All inputs already have a rule.</p>
          ) : (
            <ReorderRuleForm inputs={unruled} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
