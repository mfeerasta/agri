import {
  Masthead,
  SectionDivider,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  EmptyState,
} from '@zameen/ui';
import { getSessionContext } from '@/lib/session';
import { buildFieldMatrix } from '@/lib/reports/field-matrix';
import { FieldMatrixTable } from '../field-trends/field-matrix-table';
import { ExportButtons } from '@/components/export-buttons';

export const dynamic = 'force-dynamic';

interface SearchParams {
  years?: string;
}

export default async function FieldMatrixPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const session = await getSessionContext();
  if (!session) {
    return (
      <div>
        <Masthead section="FIELD MATRIX" />
        <SectionDivider />
        <EmptyState title="Sign in required" body="Sign in to view the field matrix." />
      </div>
    );
  }

  const years = Math.min(10, Math.max(2, Number(params.years ?? '5') || 5));
  const matrix = await buildFieldMatrix(session.entityId, years);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <Masthead section="FIELD MATRIX" />
        <ExportButtons
          endpoint="/api/exports/field-matrix"
          query={{ years: String(years), entityId: session.entityId }}
          label="Download"
        />
      </div>
      <SectionDivider />
      <Card>
        <CardHeader>
          <CardTitle>{years}-year × {matrix.rows.length}-field margin/acre heatmap</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <FieldMatrixTable matrix={matrix} />
        </CardContent>
      </Card>
    </div>
  );
}
