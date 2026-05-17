import { redirect } from 'next/navigation';
import { db, inputs } from '@zameen/db';
import { Masthead, SectionDivider } from '@zameen/ui';
import { InputPurchaseForm } from '@/modules/inventory/components/input-purchase-form';
import { getSessionContext } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function NewInputPurchasePage() {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');
  const inputRows = await db.select({ id: inputs.id, name: inputs.name, type: inputs.type, unit: inputs.unit }).from(inputs);
  return (
    <div className="space-y-2">
      <Masthead section="INPUTS / PURCHASE / NEW" />
      <SectionDivider />
      <InputPurchaseForm entityId={ctx.entityId} inputs={inputRows} vendors={[]} />
    </div>
  );
}
