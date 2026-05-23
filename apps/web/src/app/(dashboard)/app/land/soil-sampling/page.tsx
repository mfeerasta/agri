import Link from 'next/link';
import { db, soilSamplingEvents, fields } from '@zameen/db';
import { desc, eq } from 'drizzle-orm';
import { EmptyState, Masthead, SectionDivider } from '@zameen/ui';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function SoilSamplingListPage() {
  const rows = await db
    .select({
      id: soilSamplingEvents.id,
      sampledOn: soilSamplingEvents.sampledOn,
      sampleCount: soilSamplingEvents.sampleCount,
      depthCm: soilSamplingEvents.depthCm,
      samplingMethod: soilSamplingEvents.samplingMethod,
      status: soilSamplingEvents.status,
      labReferenceNumber: soilSamplingEvents.labReferenceNumber,
      sentToLab: soilSamplingEvents.sentToLab,
      expectedResultDate: soilSamplingEvents.expectedResultDate,
      fieldCode: fields.code,
      fieldId: fields.id,
    })
    .from(soilSamplingEvents)
    .leftJoin(fields, eq(fields.id, soilSamplingEvents.fieldId))
    .orderBy(desc(soilSamplingEvents.sampledOn))
    .limit(200);

  return (
    <div className="space-y-2">
      <Masthead section="LAND / SOIL SAMPLING" />
      <SectionDivider />

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Soil sampling events</h1>
        <div className="flex gap-2">
          <Link
            href={'/land/soil-sampling/upload-results' as never}
            className="rounded-md bg-slate-700 px-4 py-2 text-sm text-white"
          >
            Upload lab results
          </Link>
          <Link
            href={'/land/soil-sampling/new' as never}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm text-white"
          >
            Plan sampling
          </Link>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No sampling events yet" description="Plan a sampling event to begin." />
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th>Date</th>
              <th>Field</th>
              <th>Method</th>
              <th>Samples</th>
              <th>Depth</th>
              <th>Lab</th>
              <th>Lab ref</th>
              <th>Status</th>
              <th>Expected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td>{fmtDate(r.sampledOn)}</td>
                <td>{r.fieldCode ?? '-'}</td>
                <td>{r.samplingMethod ?? '-'}</td>
                <td>{r.sampleCount}</td>
                <td>{r.depthCm} cm</td>
                <td>{r.sentToLab ?? '-'}</td>
                <td>{r.labReferenceNumber ?? '-'}</td>
                <td>{r.status}</td>
                <td>{r.expectedResultDate ? fmtDate(r.expectedResultDate) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
