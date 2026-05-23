/**
 * Crop rotation grid editor. Fields x years matrix, drag crops onto cells.
 * Validates rotation principles client-side via the simulator's validateRotation.
 */
import { notFound } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, fields as fieldsTable, blocks as blocksTable } from '@zameen/db';
import { loadStrategicPlan } from '@/modules/strategy/actions';
import { getSessionContext } from '@/lib/session';
import { RotationGridEditor } from '@/modules/strategy/components/rotation-grid-editor';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RotationEditorPage({ params }: PageProps) {
  const { id } = await params;
  const ctx = await getSessionContext();
  if (!ctx) return <div className="p-6">Sign in.</div>;
  const data = await loadStrategicPlan(id);
  if (!data) return notFound();

  const fieldRows = await db
    .select({ id: fieldsTable.id, name: fieldsTable.name, code: fieldsTable.code, acres: fieldsTable.acres })
    .from(fieldsTable)
    .innerJoin(blocksTable, eq(fieldsTable.blockId, blocksTable.id))
    .where(eq(blocksTable.entityId, ctx.entityId));

  const initial = data.rotations.map((r) => ({
    fieldId: r.fieldId,
    schedule: r.rotationSchedule,
    rotationKind: r.rotationKind ?? 'custom',
  }));

  return (
    <div className="space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Crop rotation editor</h1>
        <p className="text-sm text-slate-500">
          Plan years {data.plan.startYear}–{data.plan.startYear + data.plan.horizonYears - 1}. Engine flags violations of soil-health rotation principles.
        </p>
      </div>
      <RotationGridEditor
        planId={data.plan.id}
        startYear={data.plan.startYear}
        horizonYears={data.plan.horizonYears}
        fields={fieldRows.map((f) => ({ id: f.id, name: f.name ?? f.code ?? f.id.slice(0, 8), acres: Number(f.acres ?? 0) }))}
        initial={initial}
      />
    </div>
  );
}
