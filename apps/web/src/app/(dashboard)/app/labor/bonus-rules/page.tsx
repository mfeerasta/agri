import { Masthead, SectionDivider, Card, CardContent, Pkr } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { listBonusRuleSets } from '@/modules/labor/bonus-actions';
import { BonusRuleSetForm } from '@/modules/labor/components/bonus-rule-set-form';
import { BonusRuleToggle } from '@/modules/labor/components/bonus-rule-toggle';

export const dynamic = 'force-dynamic';

export default async function BonusRulesPage() {
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Unauthorized</div>;
  const rows = await listBonusRuleSets(ctx.entityId);

  return (
    <div>
      <Masthead section="BONUS RULES" />
      <SectionDivider />
      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="text-lg font-semibold mb-3">قوانین / Rule sets</h2>
          {rows.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-[var(--ink)]/50">
                کوئی قوانین نہیں / No bonus rule sets defined yet.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {rows.map((r) => (
                <Card key={r.id}>
                  <CardContent className="p-4 text-sm space-y-2">
                    <div className="flex items-baseline justify-between">
                      <div className="font-semibold">{r.name}</div>
                      <BonusRuleToggle id={r.id} isActive={r.isActive} />
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {r.effectiveFrom}
                      {r.effectiveTo ? ` → ${r.effectiveTo}` : ' (open)'}
                    </div>
                    <ul className="text-xs space-y-1">
                      {r.rules.attendanceBonusPctOver90 ? (
                        <li>
                          Attendance &gt;90%: +{r.rules.attendanceBonusPctOver90}% of base
                        </li>
                      ) : null}
                      {r.rules.harvestBonusPerKg ? (
                        <li>
                          Harvest: <Pkr value={r.rules.harvestBonusPerKg} /> per kg credited
                        </li>
                      ) : null}
                      {r.rules.noBreakdownBonusPkr ? (
                        <li>
                          No breakdowns: <Pkr value={r.rules.noBreakdownBonusPkr} /> flat
                        </li>
                      ) : null}
                      {r.rules.taskCompletionBonusPctOnTime ? (
                        <li>
                          100% on-time tasks: +{r.rules.taskCompletionBonusPctOnTime}% of base
                        </li>
                      ) : null}
                    </ul>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
        <div>
          <h2 className="text-lg font-semibold mb-3">نیا قانون / New rule set</h2>
          <BonusRuleSetForm entityId={ctx.entityId} />
        </div>
      </div>
    </div>
  );
}
