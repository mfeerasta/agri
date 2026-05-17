import { getSessionContext } from '@/lib/session';
import { buildSeasonalReportData } from '@/lib/reports/seasonal-report';
import { SeasonalReportPdf } from '@/lib/reports/seasonal-pdf';
import { buildSeasonalXlsx } from '@/lib/reports/seasonal-xlsx';
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
    const seasonLabel = url.searchParams.get('seasonLabel');
    const entityIdParam = url.searchParams.get('entityId');
    const format = (url.searchParams.get('format') ?? 'pdf').toLowerCase();

    if (!seasonLabel) return badRequest('seasonLabel is required');
    if (format !== 'pdf' && format !== 'xlsx') return badRequest('format must be pdf or xlsx');

    const entityId = entityIdParam ?? session.entityId;
    if (!entityId) return badRequest('entityId is required');
    if (entityIdParam && entityIdParam !== session.entityId && session.role !== 'director') {
      return unauthorized();
    }

    const [data, entityName, generatedBy] = await Promise.all([
      buildSeasonalReportData(entityId, seasonLabel),
      getEntityName(entityId),
      getUserDisplayName(session.userId),
    ]);

    if (format === 'xlsx') {
      const buf = await buildSeasonalXlsx(data, {
        reportTitle: `Seasonal review, ${seasonLabel}`,
        entityName,
        period: seasonLabel,
        generatedAt: new Date(),
        generatedBy,
      });
      return xlsxResponse(buf, buildXlsxFilename('seasonal-review', seasonLabel));
    }

    return pdfResponse(
      SeasonalReportPdf({ data, entityName, generatedBy }),
      buildPdfFilename('seasonal-review', seasonLabel),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return serverError(msg);
  }
}
