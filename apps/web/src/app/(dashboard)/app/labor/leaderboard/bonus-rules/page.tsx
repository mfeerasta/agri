import { eq } from 'drizzle-orm';
import { db, bonusRules, entities } from '@zameen/db';
import { Masthead, SectionDivider, Card, CardHeader, CardTitle, CardContent, Pkr } from '@zameen/ui';
import { NewRuleForm } from './new-rule-form';

export const dynamic = 'force-dynamic';

export default async function BonusRulesPage() {
  const [ent] = await db.select().from(entities).limit(1);
  const entityId = ent?.id as string | undefined;
  const rules = entityId
    ? await db.select().from(bonusRules).where(eq(bonusRules.entityId, entityId))
    : [];

  return (
    <div>
      <Masthead section="BONUS RULES" />
      <SectionDivider />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Active rules</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <div className="p-6 text-sm text-[var(--ink)]/50">No rules yet. Define one below.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-[var(--paper-2)] border-b border-[var(--rule)]">
                <tr>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Name</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Cadence</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Min score</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Amount</th>
                  <th className="smallcaps text-left px-3 py-2 text-[0.7rem]">Active</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id as string} className="border-t border-[var(--rule)]">
                    <td className="px-3 py-2">{r.name as string}</td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.periodKind as string}</td>
                    <td className="px-3 py-2 tabular">{Number(r.minScore).toFixed(1)}</td>
                    <td className="px-3 py-2">
                      {(r.amountKind as string) === 'flat' || (r.amountKind as string) === 'top_n' ? (
                        <Pkr value={r.amountValue as string} />
                      ) : (
                        <>{Number(r.amountValue).toFixed(2)}% ({r.amountKind as string})</>
                      )}
                      {r.topN ? <span className="opacity-60"> · top {r.topN as number}</span> : null}
                    </td>
                    <td className="px-3 py-2 smallcaps text-[0.7rem]">{r.active ? 'yes' : 'no'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <SectionDivider label="New rule" />
      <NewRuleForm entityId={entityId ?? ''} />
    </div>
  );
}
