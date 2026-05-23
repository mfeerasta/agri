import { db, fields, blocks, farms } from '@zameen/db';
import { eq } from 'drizzle-orm';
import { Masthead, SectionDivider } from '@zameen/ui';
import { UploadResultsForm } from '@/modules/soil-health/upload-results-form';

export const dynamic = 'force-dynamic';

export default async function UploadSoilLabResultsPage() {
  const rows = await db
    .select({ id: fields.id, code: fields.code, name: fields.name })
    .from(fields)
    .innerJoin(blocks, eq(blocks.id, fields.blockId))
    .innerJoin(farms, eq(farms.id, blocks.farmId))
    .limit(500);

  return (
    <div className="space-y-2">
      <Masthead section="LAND / SOIL SAMPLING / UPLOAD RESULTS" />
      <SectionDivider />
      <h1 className="text-2xl font-semibold">Upload lab results</h1>
      <p className="text-sm text-slate-600">
        Paste a URL for a scanned lab report. AI vision extracts the ~30 soil parameters into a draft card you can review and save.
      </p>
      <UploadResultsForm fieldOptions={rows} />
    </div>
  );
}
