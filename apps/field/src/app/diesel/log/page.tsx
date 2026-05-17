import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Masthead } from '@zameen/ui';
import { getFieldSession } from '../../../lib/session';
import { listAssets, listFields, listTanks } from '../../../lib/queries';
import { DieselLogForm } from './diesel-log-form';

export default async function DieselLogPage() {
  const session = await getFieldSession();
  if (!session) redirect('/login');
  const [assets, fieldsList, tanks] = await Promise.all([
    listAssets(session.entityId),
    listFields(session.entityId),
    listTanks(session.entityId),
  ]);
  return (
    <main className="mx-auto max-w-md p-4 space-y-4">
      <Link href="/diesel" className="text-sm text-[var(--ink)]/70 min-h-[44px] inline-flex items-center">← Diesel</Link>
      <Masthead section="Diesel log" />
      <DieselLogForm
        entityId={session.entityId}
        operatorName={session.workerName}
        operatorId={session.userId}
        assets={assets.map((a) => ({
          id: a.id,
          code: a.code,
          make: a.make,
          model: a.model,
          currentHourMeter: Number(a.currentHourMeter),
        }))}
        fields={fieldsList.map((f) => ({
          id: f.id,
          code: f.code,
          name: f.name,
          nameUr: f.nameUr,
          acres: Number(f.acres),
        }))}
        tanks={tanks.map((t) => ({ id: t.id, code: t.code }))}
      />
    </main>
  );
}
