import { getSessionContext } from '@/lib/session';
import { buildFieldMatrix } from '@/lib/reports/field-matrix';
import { FieldMatrixPdf } from '@/lib/reports/field-matrix-pdf';
import { buildFieldMatrixXlsx } from '@/lib/reports/field-matrix-xlsx';
import { pdfResponse, xlsxResponse, badRequest, unauthorized, serverError } from '@/lib/reports/response';
import { buildPdfFilename, buildXlsxFilename } from '@/lib/reports/excel-template';
import { getEntityName, getUserDisplayName } from '@/lib/reports/entity';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request): Promise<Response> {
  try {
    const session = await getSessionContext();
    if (!session) return unauthorized();

    const url = new URL(req.url);
    const years = Math.min(10, Math.max(2, Number(url.searchParams.get('years') ?? '5') || 5));
    const entityIdParam = url.searchParams.get('entityId');
    const format = (url.searchParams.get('format') ?? 'pdf').toLowerCase();

    if (format !== 'pdf' && format !== 'xlsx') return badRequest('format must be pdf or xlsx');

    const entityId = entityIdParam ?? session.entityId;
    if (!entityId) return badRequest('entityId is required');
    if (entityIdParam && entityIdParam !== session.entityId && session.role !== 'director') {
      return unauthorized();
    }

    const [matrix, entityName, generatedBy] = await Promise.all([
      buildFieldMatrix(entityId, years),
      getEntityName(entityId),
      getUserDisplayName(session.userId),
    ]);

    const slug = `field-matrix-${years}yr`;
    const period = matrix.seasons.length
      ? `${matrix.seasons[0]!} → ${matrix.seasons[matrix.seasons.length - 1]!}`
      : `${years}-season`;

    if (format === 'xlsx') {
      const buf = await buildFieldMatrixXlsx(matrix, {
        reportTitle: `Field margin/acre matrix, ${years} seasons`,
        entityName,
        period,
        generatedAt: new Date(),
        generatedBy,
      });
      return xlsxResponse(buf, buildXlsxFilename(slug, period));
    }

    return pdfResponse(
      FieldMatrixPdf({ matrix, entityName, generatedBy }),
      buildPdfFilename(slug, period),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return serverError(msg);
  }
}
