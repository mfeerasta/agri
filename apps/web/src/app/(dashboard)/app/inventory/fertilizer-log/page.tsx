import { redirect } from 'next/navigation';
import { Masthead, SectionDivider } from '@zameen/ui';
import { and, eq, inArray } from 'drizzle-orm';
import { db, cropPlans, fields, blocks, farms } from '@zameen/db';
import { getSessionContext } from '@/lib/session';
import { loadFertilizerLog } from '@/modules/inventory/fertilizer-log-actions';
import { FertilizerGrid } from '@/modules/inventory/components/fertilizer-grid';

interface SearchParams {
  from?: string;
  to?: string;
}

export default async function FertilizerLogPage({
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

  const data = await loadFertilizerLog({ entityId: ctx.entityId, fromDate, toDate });

  const farmRows = await db.select({ id: farms.id }).from(farms).where(eq(farms.entityId, ctx.entityId));
  const blockRows = farmRows.length
    ? await db.select({ id: blocks.id }).from(blocks).where(inArray(blocks.farmId, farmRows.map((f) => f.id)))
    : [];
  const fieldRows = blockRows.length
    ? await db.select({ id: fields.id }).from(fields).where(inArray(fields.blockId, blockRows.map((b) => b.id)))
    : [];
  const plansRaw = fieldRows.length
    ? await db
        .select({ id: cropPlans.id, fieldId: cropPlans.fieldId, cropName: cropPlans.cropName, status: cropPlans.status })
        .from(cropPlans)
        .where(inArray(cropPlans.fieldId, fieldRows.map((f) => f.id)))
    : [];
  const plans = plansRaw.filter((p) => p.status === 'active' || p.status === 'planned');

  return (
    <div className="space-y-4">
      <Masthead section="کھاد لاگ / Fertilizer Log" />
      <SectionDivider />
      <FertilizerGrid entityId={ctx.entityId} data={data} cropPlans={plans} />
    </div>
  );
}
