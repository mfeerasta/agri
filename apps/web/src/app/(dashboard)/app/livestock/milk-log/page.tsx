import { redirect } from 'next/navigation';
import { Masthead, SectionDivider } from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { loadMilkMatrix } from '@/modules/livestock/milk-actions';
import { MilkGrid } from '@/modules/livestock/components/milk-grid';

interface SearchParams {
  from?: string;
  to?: string;
}

export default async function MilkLogPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ctx = await getSessionContext();
  if (!ctx) redirect('/login');
  const sp = await searchParams;
  const today = new Date();
  const monthAgo = new Date(today.getTime() - 30 * 24 * 3600 * 1000);
  const toDate = sp.to ?? today.toISOString().slice(0, 10);
  const fromDate = sp.from ?? monthAgo.toISOString().slice(0, 10);

  const data = await loadMilkMatrix({ entityId: ctx.entityId, fromDate, toDate });

  return (
    <div className="space-y-4">
      <Masthead section="دودھ لاگ / Milk Log" />
      <SectionDivider />
      <MilkGrid data={data} />
    </div>
  );
}
