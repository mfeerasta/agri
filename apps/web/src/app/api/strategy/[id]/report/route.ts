/**
 * GET /api/strategy/:id/report
 *
 * Streams a board-ready PDF of the 5-year strategic plan: executive summary,
 * initiative Gantt, crop rotation map, financial projections, sensitivity.
 */
import { NextResponse } from 'next/server';
import { renderToStream } from '@react-pdf/renderer';
import { and, eq, desc } from 'drizzle-orm';
import React from 'react';
import {
  db,
  strategicPlans,
  strategicInitiatives,
  cropRotationPlans,
  scenarioSimulations,
  fields as fieldsTable,
  entities,
  blocks as blocksTable,
} from '@zameen/db';
import { StrategicPlanPdf, runScenario, type ScenarioInputs } from '@zameen/finance';
import { getSessionContext } from '@/lib/session';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteContext) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await params;

  const [plan] = await db
    .select()
    .from(strategicPlans)
    .where(and(eq(strategicPlans.id, id), eq(strategicPlans.entityId, ctx.entityId)))
    .limit(1);
  if (!plan) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [entity] = await db.select().from(entities).where(eq(entities.id, plan.entityId)).limit(1);
  const initiatives = await db.select().from(strategicInitiatives).where(eq(strategicInitiatives.planId, plan.id));
  const rotations = await db.select().from(cropRotationPlans).where(eq(cropRotationPlans.planId, plan.id));

  const fieldRows = await db
    .select({ id: fieldsTable.id, name: fieldsTable.name, code: fieldsTable.code })
    .from(fieldsTable)
    .innerJoin(blocksTable, eq(fieldsTable.blockId, blocksTable.id))
    .where(eq(blocksTable.entityId, ctx.entityId));
  const fieldLabel = new Map(fieldRows.map((f) => [f.id, f.name ?? f.code ?? f.id.slice(0, 8)]));

  const [topSim] = await db
    .select()
    .from(scenarioSimulations)
    .where(eq(scenarioSimulations.planId, plan.id))
    .orderBy(desc(scenarioSimulations.createdAt))
    .limit(1);

  let topSimulation: Parameters<typeof StrategicPlanPdf>[0]['topSimulation'] = null;
  if (topSim) {
    const yearly = (topSim.outputsJsonb ?? []) as { year: number; netCashFlowPkr: number; cumulativeCashPkr: number }[];
    let sensitivity: { label: string; npvPkr: number }[] | undefined;
    try {
      const baseInputs = topSim.inputsJsonb as ScenarioInputs;
      const variants = [
        { label: 'Yield -10%, Price -5%', yieldMult: 0.9, priceMult: 0.95 },
        { label: 'Baseline', yieldMult: 1, priceMult: 1 },
        { label: 'Yield +10%, Price +5%', yieldMult: 1.1, priceMult: 1.05 },
      ];
      sensitivity = variants.map((v) => {
        const tweaked: ScenarioInputs = {
          ...baseInputs,
          fieldYearAssumptions: baseInputs.fieldYearAssumptions.map((a) => ({
            ...a,
            yieldPerAcreKg: a.yieldPerAcreKg * v.yieldMult,
            pricePerKgPkr: a.pricePerKgPkr * v.priceMult,
          })),
          monteCarloIterations: 0,
        };
        const out = runScenario(tweaked);
        return { label: v.label, npvPkr: out.npvPkr };
      });
    } catch {
      // tolerate older inputs shapes
    }
    topSimulation = {
      scenarioName: topSim.scenarioName,
      npvPkr: Number(topSim.netPresentValuePkr ?? 0),
      irrPct: topSim.internalRateOfReturnPct != null ? Number(topSim.internalRateOfReturnPct) : null,
      paybackYears: topSim.paybackYears != null ? Number(topSim.paybackYears) : null,
      yearly,
      sensitivity,
    };
  }

  const pdfStream = await renderToStream(
    React.createElement(StrategicPlanPdf, {
      entityName: entity?.name ?? 'AGRI',
      planName: plan.name,
      startYear: plan.startYear,
      horizonYears: plan.horizonYears,
      visionStatement: plan.visionStatement ?? null,
      initiatives: initiatives.map((i) => ({
        name: i.name,
        category: i.category,
        startYear: i.startYear,
        endYear: i.endYear,
        estimatedInvestmentPkr: Number(i.estimatedInvestmentPkr ?? 0),
        expectedReturnPkr: Number(i.expectedReturnPkr ?? 0),
        expectedIrrPct: i.expectedIrrPct != null ? Number(i.expectedIrrPct) : null,
        paybackYears: i.paybackYears != null ? Number(i.paybackYears) : null,
        priority: i.priority,
        status: i.status,
      })),
      rotations: rotations.map((r) => {
        const byYear: Record<number, string> = {};
        for (const e of r.rotationSchedule) byYear[e.year] = e.cropCode;
        return { fieldLabel: fieldLabel.get(r.fieldId) ?? r.fieldId.slice(0, 8), byYear };
      }),
      topSimulation,
    }),
  );

  return new NextResponse(pdfStream as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="strategic-plan-${plan.id}.pdf"`,
    },
  });
}
