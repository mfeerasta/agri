import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Masthead } from '@zameen/ui';
import { getFieldSession } from '../../../lib/session';
import { listAssets, listTanks } from '../../../lib/queries';
import { DieselPurchaseForm } from './diesel-purchase-form';

export default async function DieselPurchasePage() {
  const session = await getFieldSession();
  if (!session) redirect('/login');
  const [assets, tanks] = await Promise.all([
    listAssets(session.entityId),
    listTanks(session.entityId),
  ]);
  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <Link href="/diesel" className="text-sm text-[var(--ink)]/70 min-h-[44px] inline-flex items-center">← Diesel</Link>
      <Masthead section="Diesel purchase" />
      <DieselPurchaseForm
        entityId={session.entityId}
        assets={assets.map((a) => ({ id: a.id, code: a.code, make: a.make, model: a.model }))}
        tanks={tanks.map((t) => ({ id: t.id, code: t.code }))}
      />
    </main>
  );
}
