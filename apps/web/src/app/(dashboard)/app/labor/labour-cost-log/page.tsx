import { redirect } from 'next/navigation';
import { Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { loadLabourCostLog } from '@/modules/labor/labour-cost-log-actions';
import { LabourCostGrid } from '@/modules/labor/components/labour-cost-grid';

export const dynamic = 'force-dynamic';

interface SearchParams {
  from?: string;
  to?: string;
}

export default async function LabourCostLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');

  const sp = await searchParams;
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 3600 * 1000);
  const toDate = sp.to ?? today.toISOString().slice(0, 10);
  const fromDate = sp.from ?? monthAgo.toISOString().slice(0, 10);

  const data = await loadLabourCostLog({ entityId: ctx.entityId, fromDate, toDate });

  return (
    <div className="space-y-4">
      <Masthead section="مزدوری لاگت لاگ / Labour cost log" />
      <SectionDivider />
      <LabourCostGrid entityId={ctx.entityId} data={data} />
    </div>
  );
}
