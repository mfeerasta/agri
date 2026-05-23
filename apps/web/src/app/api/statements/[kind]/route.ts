/**
 * Statements export route.
 *
 *   GET /api/statements/balance-sheet?format=pdf|xlsx&from=YYYY-MM-DD&to=YYYY-MM-DD&entity=:uuid
 *   GET /api/statements/income-statement?...
 *   GET /api/statements/cash-flow?...
 *   GET /api/statements/field-pnl?cropPlanId=:uuid&format=pdf|xlsx
 *
 * Streams a print-ready PDF or an .xlsx workbook. Auth via Supabase server
 * client; the entity query param is ignored unless it matches the caller's
 * own entity scope.
 */

import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { eq } from 'drizzle-orm';
import {
  buildBalanceSheet,
  buildIncomeStatement,
  buildCashFlow,
  BalanceSheetPdf,
  IncomeStatementPdf,
  CashFlowPdf,
  FieldPnLPdf,
  buildBalanceSheetXlsx,
  buildIncomeStatementXlsx,
  buildCashFlowXlsx,
  buildFieldPnLXlsx,
  computeFieldPnL,
} from '@zameen/finance';
import { db, entities, fields } from '@zameen/db';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type StatementKind = 'balance-sheet' | 'income-statement' | 'cash-flow' | 'field-pnl';
const ALLOWED: ReadonlySet<StatementKind> = new Set(['balance-sheet', 'income-statement', 'cash-flow', 'field-pnl']);

interface RouteContext {
  params: Promise<{ kind: string }>;
}

async function authedEntityId(): Promise<string | null> {
  const sb = await createSupabaseServerClient();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const eid = (data.user.user_metadata as Record<string, unknown> | null)?.['entityId'];
  return typeof eid === 'string' ? eid : null;
}

async function loadEntity(entityId: string): Promise<{ name: string; nameUr: string | null } | null> {
  const [row] = await db
    .select({ name: entities.name })
    .from(entities)
    .where(eq(entities.id, entityId))
    .limit(1);
  return row ? { name: row.name, nameUr: null } : null;
}

async function streamPdf(node: React.JSX.Element, filename: string): Promise<NextResponse> {
  const stream = await renderToStream(node);
  const chunks: Buffer[] = [];
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return new NextResponse(Buffer.concat(chunks), {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}

function streamXlsx(buf: Buffer, filename: string): NextResponse {
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}

export async function GET(req: Request, ctx: RouteContext): Promise<NextResponse> {
  const { kind } = await ctx.params;
  if (!ALLOWED.has(kind as StatementKind)) {
    return NextResponse.json({ error: 'unknown_statement_kind' }, { status: 400 });
  }

  const entityId = await authedEntityId();
  if (!entityId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const ent = await loadEntity(entityId);
  if (!ent) return NextResponse.json({ error: 'entity_not_found' }, { status: 404 });

  const url = new URL(req.url);
  const format = (url.searchParams.get('format') ?? 'pdf').toLowerCase();
  if (format !== 'pdf' && format !== 'xlsx') {
    return NextResponse.json({ error: 'invalid_format' }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  const from = url.searchParams.get('from') ?? `${today.slice(0, 7)}-01`;
  const to = url.searchParams.get('to') ?? today;

  if (kind === 'balance-sheet') {
    const data = await buildBalanceSheet(entityId, to);
    const filename = `balance-sheet-${to}`;
    if (format === 'pdf') {
      return streamPdf(
        BalanceSheetPdf({ entityName: ent.name, entityNameUr: ent.nameUr ?? undefined, data }),
        `${filename}.pdf`,
      );
    }
    const buf = await buildBalanceSheetXlsx({ entityName: ent.name, data });
    return streamXlsx(buf, `${filename}.xlsx`);
  }

  if (kind === 'income-statement') {
    const data = await buildIncomeStatement(entityId, from, to);
    const filename = `income-statement-${from}-to-${to}`;
    if (format === 'pdf') {
      return streamPdf(
        IncomeStatementPdf({ entityName: ent.name, entityNameUr: ent.nameUr ?? undefined, data }),
        `${filename}.pdf`,
      );
    }
    const buf = await buildIncomeStatementXlsx({ entityName: ent.name, data });
    return streamXlsx(buf, `${filename}.xlsx`);
  }

  if (kind === 'cash-flow') {
    const data = await buildCashFlow(entityId, from, to);
    const filename = `cash-flow-${from}-to-${to}`;
    if (format === 'pdf') {
      return streamPdf(
        CashFlowPdf({ entityName: ent.name, entityNameUr: ent.nameUr ?? undefined, data }),
        `${filename}.pdf`,
      );
    }
    const buf = await buildCashFlowXlsx({ entityName: ent.name, data });
    return streamXlsx(buf, `${filename}.xlsx`);
  }

  if (kind === 'field-pnl') {
    const cropPlanId = url.searchParams.get('cropPlanId');
    if (!cropPlanId) return NextResponse.json({ error: 'missing_crop_plan_id' }, { status: 400 });
    const data = await computeFieldPnL(cropPlanId);
    if (!data) return NextResponse.json({ error: 'crop_plan_not_found' }, { status: 404 });
    const [field] = await db.select({ name: fields.name }).from(fields).where(eq(fields.id, data.fieldId)).limit(1);
    const filename = `field-pnl-${cropPlanId.slice(0, 8)}`;
    if (format === 'pdf') {
      return streamPdf(
        FieldPnLPdf({ entityName: ent.name, entityNameUr: ent.nameUr ?? undefined, fieldName: field?.name, data }),
        `${filename}.pdf`,
      );
    }
    const buf = await buildFieldPnLXlsx({ entityName: ent.name, fieldName: field?.name, data });
    return streamXlsx(buf, `${filename}.xlsx`);
  }

  return NextResponse.json({ error: 'unhandled' }, { status: 500 });
}
