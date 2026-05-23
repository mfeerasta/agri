import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { db, cropVarieties, varietyTrials } from '@zameen/db';

// Variety performance engine. Reads variety_trials, builds a
// variety x season matrix, and emits a recommendation for the next
// season weighted toward recent-3-season performance and resistance.

export interface VarietyPerformanceInput {
  entityId: string;
  cropProfileCode: string;
  fromSeason?: string;
  toSeason?: string;
}

export interface VarietySeasonCell {
  season: string;
  trials: number;
  totalAcres: number;
  avgYieldPerAcreKg: number;
  yieldStdDev: number;
  avgNetRevenuePerAcrePkr: number;
  avgDiseaseSeverity: number | null;
  avgPestSeverity: number | null;
  qualityGrades: string[];
}

export interface VarietyRow {
  varietyId: string;
  varietyName: string;
  varietyKind: string | null;
  sourceCompany: string | null;
  resistanceTraits: string[];
  seasons: Record<string, VarietySeasonCell>;
  lifetimeTrials: number;
  lifetimeAvgYieldPerAcreKg: number;
  lifetimeAvgNetRevenuePerAcrePkr: number;
  weightedScore: number;
  sampleConfidence: 'low' | 'medium' | 'high';
}

export interface VarietyPerformanceMatrix {
  cropProfileCode: string;
  seasons: string[];
  rows: VarietyRow[];
  topPerformer: VarietyRow | null;
  recommendations: VarietyRecommendation[];
}

export interface VarietyRecommendation {
  varietyId: string;
  varietyName: string;
  rationale: string;
  weightedScore: number;
  recentSeasons: string[];
  sampleConfidence: 'low' | 'medium' | 'high';
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function confidenceFor(trials: number): 'low' | 'medium' | 'high' {
  if (trials >= 6) return 'high';
  if (trials >= 3) return 'medium';
  return 'low';
}

// Recent-3-season weighting: most recent season gets 0.5, next 0.3, next 0.2.
const RECENT_WEIGHTS = [0.5, 0.3, 0.2];

export async function computeVarietyPerformance(
  input: VarietyPerformanceInput,
): Promise<VarietyPerformanceMatrix> {
  const conds = [eq(varietyTrials.entityId, input.entityId)];
  if (input.fromSeason) conds.push(gte(varietyTrials.season, input.fromSeason));
  if (input.toSeason) conds.push(lte(varietyTrials.season, input.toSeason));

  const trials = await db
    .select({
      varietyId: varietyTrials.varietyId,
      season: varietyTrials.season,
      areaAcres: varietyTrials.areaAcres,
      yieldKg: varietyTrials.yieldKg,
      yieldPerAcreKg: varietyTrials.yieldPerAcreKg,
      qualityGrade: varietyTrials.qualityGrade,
      disease: varietyTrials.diseasePressureSeverity,
      pest: varietyTrials.pestPressureSeverity,
      netRevenuePkr: varietyTrials.netRevenuePkr,
      varietyName: cropVarieties.name,
      varietyKind: cropVarieties.varietyKind,
      sourceCompany: cropVarieties.sourceCompany,
      resistanceTraits: cropVarieties.resistanceTraits,
      cropProfileCode: cropVarieties.cropProfileCode,
    })
    .from(varietyTrials)
    .innerJoin(cropVarieties, eq(cropVarieties.id, varietyTrials.varietyId))
    .where(and(...conds, eq(cropVarieties.cropProfileCode, input.cropProfileCode)));

  const seasonSet = new Set<string>();
  const byVariety = new Map<
    string,
    {
      meta: { name: string; kind: string | null; source: string | null; traits: string[] };
      bySeason: Map<string, typeof trials>;
    }
  >();

  for (const t of trials) {
    seasonSet.add(t.season);
    if (!byVariety.has(t.varietyId)) {
      byVariety.set(t.varietyId, {
        meta: {
          name: t.varietyName,
          kind: t.varietyKind,
          source: t.sourceCompany,
          traits: t.resistanceTraits ?? [],
        },
        bySeason: new Map(),
      });
    }
    const v = byVariety.get(t.varietyId)!;
    if (!v.bySeason.has(t.season)) v.bySeason.set(t.season, []);
    v.bySeason.get(t.season)!.push(t);
  }

  const seasons = Array.from(seasonSet).sort();
  const rows: VarietyRow[] = [];

  for (const [varietyId, data] of byVariety) {
    const seasonCells: Record<string, VarietySeasonCell> = {};
    let lifetimeYieldSum = 0;
    let lifetimeRevenueSum = 0;
    let lifetimeAcresSum = 0;
    let lifetimeTrials = 0;

    for (const [season, rs] of data.bySeason) {
      const yields = rs
        .map((r) => Number(r.yieldPerAcreKg ?? 0))
        .filter((v) => v > 0);
      const acresTotal = rs.reduce((s, r) => s + Number(r.areaAcres), 0);
      const revPerAcre = rs
        .map((r) => {
          const acres = Number(r.areaAcres);
          const rev = Number(r.netRevenuePkr ?? 0);
          return acres > 0 ? rev / acres : 0;
        })
        .filter((v) => v > 0);
      const diseases = rs.map((r) => r.disease).filter((v): v is number => v != null);
      const pests = rs.map((r) => r.pest).filter((v): v is number => v != null);
      const grades = Array.from(new Set(rs.map((r) => r.qualityGrade).filter((v): v is string => !!v)));

      const avgYield = yields.length ? yields.reduce((s, v) => s + v, 0) / yields.length : 0;
      const avgRev = revPerAcre.length ? revPerAcre.reduce((s, v) => s + v, 0) / revPerAcre.length : 0;

      seasonCells[season] = {
        season,
        trials: rs.length,
        totalAcres: Number(acresTotal.toFixed(3)),
        avgYieldPerAcreKg: Number(avgYield.toFixed(2)),
        yieldStdDev: Number(stdDev(yields).toFixed(2)),
        avgNetRevenuePerAcrePkr: Number(avgRev.toFixed(2)),
        avgDiseaseSeverity: diseases.length
          ? Number((diseases.reduce((s, v) => s + v, 0) / diseases.length).toFixed(2))
          : null,
        avgPestSeverity: pests.length
          ? Number((pests.reduce((s, v) => s + v, 0) / pests.length).toFixed(2))
          : null,
        qualityGrades: grades,
      };

      lifetimeYieldSum += yields.reduce((s, v) => s + v, 0);
      lifetimeRevenueSum += revPerAcre.reduce((s, v) => s + v, 0);
      lifetimeAcresSum += acresTotal;
      lifetimeTrials += rs.length;
    }

    // Weighted score: recent-3 seasons by yield/acre, penalized by disease+pest pressure.
    const sortedSeasonsDesc = Object.keys(seasonCells).sort().reverse();
    let weightedScore = 0;
    let usedWeight = 0;
    for (let i = 0; i < Math.min(3, sortedSeasonsDesc.length); i++) {
      const w = RECENT_WEIGHTS[i] ?? 0;
      const cell = seasonCells[sortedSeasonsDesc[i]];
      const penalty = ((cell.avgDiseaseSeverity ?? 0) + (cell.avgPestSeverity ?? 0)) * 0.05;
      weightedScore += w * cell.avgYieldPerAcreKg * (1 - Math.min(penalty, 0.4));
      usedWeight += w;
    }
    if (usedWeight > 0) weightedScore = Number((weightedScore / usedWeight).toFixed(2));

    rows.push({
      varietyId,
      varietyName: data.meta.name,
      varietyKind: data.meta.kind,
      sourceCompany: data.meta.source,
      resistanceTraits: data.meta.traits,
      seasons: seasonCells,
      lifetimeTrials,
      lifetimeAvgYieldPerAcreKg: lifetimeTrials
        ? Number((lifetimeYieldSum / lifetimeTrials).toFixed(2))
        : 0,
      lifetimeAvgNetRevenuePerAcrePkr: lifetimeTrials
        ? Number((lifetimeRevenueSum / lifetimeTrials).toFixed(2))
        : 0,
      weightedScore,
      sampleConfidence: confidenceFor(lifetimeTrials),
    });
  }

  rows.sort((a, b) => b.weightedScore - a.weightedScore);

  const top = rows.find((r) => r.sampleConfidence !== 'low') ?? rows[0] ?? null;
  const recommendations: VarietyRecommendation[] = rows.slice(0, 2).map((r) => ({
    varietyId: r.varietyId,
    varietyName: r.varietyName,
    weightedScore: r.weightedScore,
    sampleConfidence: r.sampleConfidence,
    recentSeasons: Object.keys(r.seasons).sort().reverse().slice(0, 3),
    rationale: buildRationale(r),
  }));

  return {
    cropProfileCode: input.cropProfileCode,
    seasons,
    rows,
    topPerformer: top,
    recommendations,
  };
}

function buildRationale(r: VarietyRow): string {
  const parts: string[] = [];
  parts.push(`Avg ${r.lifetimeAvgYieldPerAcreKg} kg/acre across ${r.lifetimeTrials} trial(s)`);
  if (r.lifetimeAvgNetRevenuePerAcrePkr > 0) {
    parts.push(`PKR ${Math.round(r.lifetimeAvgNetRevenuePerAcrePkr).toLocaleString()}/acre net`);
  }
  if (r.resistanceTraits.length) {
    parts.push(`resistant: ${r.resistanceTraits.join(', ')}`);
  }
  parts.push(`confidence: ${r.sampleConfidence}`);
  return parts.join(' · ');
}

// Per-season loss summary for the harvest losses dashboard.
export interface LossSummaryRow {
  lossKind: string;
  totalKg: number;
  totalValuePkr: number;
  preventableKg: number;
  records: number;
}

export async function computeLossSummary(input: {
  fieldId?: string;
  fromDate?: Date;
  toDate?: Date;
}): Promise<LossSummaryRow[]> {
  const { harvestLossRecords } = await import('@zameen/db');
  const conds = [];
  if (input.fieldId) conds.push(eq(harvestLossRecords.fieldId, input.fieldId));
  if (input.fromDate) conds.push(gte(harvestLossRecords.createdAt, input.fromDate));
  if (input.toDate) conds.push(lte(harvestLossRecords.createdAt, input.toDate));

  const rows = await db
    .select({
      lossKind: harvestLossRecords.lossKind,
      totalKg: sql<string>`coalesce(sum(${harvestLossRecords.estimatedKg}), 0)`,
      totalValue: sql<string>`coalesce(sum(${harvestLossRecords.estimatedValuePkr}), 0)`,
      preventableKg: sql<string>`coalesce(sum(case when ${harvestLossRecords.preventable} then ${harvestLossRecords.estimatedKg} else 0 end), 0)`,
      records: sql<number>`count(*)::int`,
    })
    .from(harvestLossRecords)
    .where(conds.length ? and(...conds) : undefined)
    .groupBy(harvestLossRecords.lossKind);

  return rows.map((r) => ({
    lossKind: r.lossKind ?? 'other',
    totalKg: Number(r.totalKg),
    totalValuePkr: Number(r.totalValue),
    preventableKg: Number(r.preventableKg),
    records: Number(r.records),
  }));
}
