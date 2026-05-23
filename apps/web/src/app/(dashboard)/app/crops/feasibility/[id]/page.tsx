import Link from 'next/link';
import { notFound } from 'next/navigation';
import { inArray } from 'drizzle-orm';
import { db, fields as fieldsTable, blocks as blocksTable } from '@zameen/db';
import { loadStudy, listCropPrefills } from '@/modules/feasibility/actions';
import { getSessionContext } from '@/lib/session';
import { StudyWorkbench } from '@/modules/feasibility/components/study-workbench';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function FeasibilityStudyPage({ params }: PageProps) {
  const session = await getSessionContext();
  if (!session) return <div className="p-6">Sign in to view feasibility studies.</div>;
  const { id } = await params;
  const data = await loadStudy(id);
  if (!data) notFound();

  const blocks = await db.select().from(blocksTable).where(inArray(blocksTable.entityId, [session.entityId]));
  const fieldRows = blocks.length
    ? await db
        .select()
        .from(fieldsTable)
        .where(inArray(fieldsTable.blockId, blocks.map((b) => b.id)))
    : [];
  const fieldOptions = fieldRows.map((f) => ({ id: f.id, code: f.code, acres: Number(f.acres ?? 0) }));
  const crops = await listCropPrefills();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">
            <Link href={'/app/crops/feasibility' as never} className="hover:underline">
              Feasibility planner
            </Link>
            {' / '}
            {data.study.name}
          </div>
          <h1 className="text-2xl font-semibold mt-1">{data.study.name}</h1>
          <div className="text-sm text-slate-500">{data.study.season ?? 'Season not set'}</div>
        </div>
        <a
          href={`/api/feasibility/${data.study.id}/xlsx`}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Export XLSX
        </a>
      </div>

      <StudyWorkbench
        studyId={data.study.id}
        scenarios={data.scenarios.map((s) => ({
          id: s.id,
          name: s.name,
          cropCode: s.cropCode,
          fieldIds: s.fieldIds,
          totalAcres: Number(s.totalAcres),
          yieldPerAcreKg: Number(s.yieldPerAcreKg),
          pricePerKgPkr: Number(s.pricePerKgPkr),
          costBreakdown: (s.costBreakdown ?? {}) as Record<string, number>,
          revenuePkr: Number(s.revenuePkr),
          totalCostPkr: Number(s.totalCostPkr),
          netPkr: Number(s.netPkr),
          netPerAcrePkr: Number(s.netPerAcrePkr),
          irrPct: s.irrPct != null ? Number(s.irrPct) : null,
          paybackMonths: s.paybackMonths != null ? Number(s.paybackMonths) : null,
          notes: s.notes,
        }))}
        crops={crops}
        fields={fieldOptions}
      />
    </div>
  );
}
