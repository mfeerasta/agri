import { db, cspViolations } from '@zameen/db';
import { safeStringify } from '@zameen/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CspReportBody {
  'csp-report'?: Record<string, unknown>;
  [k: string]: unknown;
}

export async function POST(req: Request) {
  try {
    const report = (await req.json()) as CspReportBody;
    const r = (report['csp-report'] ?? report) as Record<string, unknown>;
    await db.insert(cspViolations).values({
      app: 'field',
      documentUri: (r['document-uri'] as string | undefined) ?? null,
      violatedDirective: (r['violated-directive'] as string | undefined) ?? null,
      blockedUri: (r['blocked-uri'] as string | undefined) ?? null,
      sourceFile: (r['source-file'] as string | undefined) ?? null,
      lineNumber: (r['line-number'] as number | undefined) ?? null,
      columnNumber: (r['column-number'] as number | undefined) ?? null,
      userAgent: req.headers.get('user-agent'),
    });
  } catch (e) {
    console.error(safeStringify({ scope: 'csp-report/field', err: String(e) }));
  }
  return new Response(null, { status: 204 });
}
