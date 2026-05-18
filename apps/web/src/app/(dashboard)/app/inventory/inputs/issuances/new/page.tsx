import { redirect } from 'next/navigation';
import { db, inputs, fields, cropPlans } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead, SectionDivider } from '@zameen/ui';
import { InputIssuanceForm } from '@/modules/inventory/components/input-issuance-form';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function NewIssuancePage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');
  const inputRows = await db.select({ id: inputs.id, name: inputs.name, unit: inputs.unit }).from(inputs);
  const fieldRows = await db
    .select({ id: fields.id, code: fields.code, name: fields.name, nameUr: fields.nameUr, acres: fields.acres })
    .from(fields)
    .orderBy(fields.code);
  const activePlans = await db
    .select({ id: cropPlans.id, fieldId: cropPlans.fieldId })
    .from(cropPlans);
  const planByField = new Map(activePlans.map((p) => [p.fieldId, p.id]));

  return (
    <div className="space-y-2">
      <Masthead section="INPUTS / ISSUE" />
      <SectionDivider />
      <InputIssuanceForm
        entityId={ctx.entityId}
        inputs={inputRows}
        fields={fieldRows.map((f) => ({ ...f, acres: Number(f.acres), activePlanId: planByField.get(f.id) ?? null }))}
        workers={[]}
      />
    </div>
  );
}
