import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { db, consolidationRuns, entities } from '@zameen/db';
import { ConsolidationPdf, buildConsolidationXlsx } from '@zameen/finance';
import type { ConsolidatedReport } from '@zameen/finance';

export const dynamic = 'force-dynamic';

function snapshotToReport(run: typeof consolidationRuns.$inferSelect): ConsolidatedReport {
  return {
    parentEntityId: run.parentEntityId,
    periodStart: run.periodStart,
    periodEnd: run.periodEnd,
    childEntities: Array.isArray(run.childEntities) ? (run.childEntities as string[]) : [],
    perEntity: [],
    beforeEliminations: {
      balanceSheet: run.balanceSheetSnapshot as never,
      incomeStatement: run.incomeStatementSnapshot as never,
      cashFlow: run.cashFlowSnapshot as never,
    },
    consolidated: {
      balanceSheet: run.balanceSheetSnapshot as never,
      incomeStatement: run.incomeStatementSnapshot as never,
      cashFlow: run.cashFlowSnapshot as never,
    },
    eliminationsApplied: Array.isArray(run.eliminationsApplied) ? (run.eliminationsApplied as never) : [],
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'pdf';

  const [run] = await db.select().from(consolidationRuns).where(eq(consolidationRuns.id, id)).limit(1);
  if (!run) return new NextResponse('Not found', { status: 404 });
  const [parent] = await db.select().from(entities).where(eq(entities.id, run.parentEntityId)).limit(1);
  const parentName = parent?.name ?? 'Consolidated';

  const report = snapshotToReport(run);

  if (format === 'xlsx') {
    const buf = await buildConsolidationXlsx(parentName, report);
    return new NextResponse(buf as unknown as BodyInit, {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'content-disposition': `attachment; filename="consolidation-${run.periodEnd}.xlsx"`,
      },
    });
  }

  const pdfBuf = await renderToBuffer(React.createElement(ConsolidationPdf, { parentEntityName: parentName, report }));
  return new NextResponse(pdfBuf as unknown as BodyInit, {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="consolidation-${run.periodEnd}.pdf"`,
    },
  });
}
