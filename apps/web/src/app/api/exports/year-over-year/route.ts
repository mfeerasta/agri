import { getSessionContext } from '@/lib/session';
import { buildYoYReportData } from '@/lib/reports/yoy-report';
import { YoYReportPdf } from '@/lib/reports/yoy-pdf';
import { buildYoYXlsx } from '@/lib/reports/yoy-xlsx';
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
    const currentSeason = url.searchParams.get('currentSeason');
    const previousSeason = url.searchParams.get('previousSeason');
    const entityIdParam = url.searchParams.get('entityId');
    const format = (url.searchParams.get('format') ?? 'pdf').toLowerCase();

    if (!currentSeason || !previousSeason) return badRequest('currentSeason and previousSeason are required');
    if (format !== 'pdf' && format !== 'xlsx') return badRequest('format must be pdf or xlsx');

    const entityId = entityIdParam ?? session.entityId;
    if (!entityId) return badRequest('entityId is required');
    if (entityIdParam && entityIdParam !== session.entityId && session.role !== 'director') {
      return unauthorized();
    }

    const [data, entityName, generatedBy] = await Promise.all([
      buildYoYReportData(entityId, currentSeason, previousSeason),
      getEntityName(entityId),
      getUserDisplayName(session.userId),
    ]);

    const slug = `yoy-${currentSeason}-vs-${previousSeason}`;

    if (format === 'xlsx') {
      const buf = await buildYoYXlsx(data, {
        reportTitle: `Year-on-year, ${currentSeason} vs ${previousSeason}`,
        entityName,
        period: `${previousSeason} → ${currentSeason}`,
        generatedAt: new Date(),
        generatedBy,
      });
      return xlsxResponse(buf, buildXlsxFilename(slug, currentSeason));
    }

    return pdfResponse(
      YoYReportPdf({ data, entityName, generatedBy }),
      buildPdfFilename(slug, currentSeason),
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown error';
    return serverError(msg);
  }
}
