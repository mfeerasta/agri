import { and, desc, eq } from 'drizzle-orm';
import {
  db,
  fields,
  farms,
  blocks,
  cropPlans,
  cropProfiles,
  cropPhenology,
  fieldPhenologyLog,
  sprayWindows,
  nutrientRecommendations,
  soilHealthCards,
  harvestRecords,
  type NutrientAlternative,
  type SprayWindowFactors,
} from '@zameen/db';
import { fetchForecast, complete, HOUSE_STYLE } from '@zameen/shared';
import { CROP_BASELINES } from './fertilizer-recommendation.js';

// Agronomic decision-support engine. Combines forecast, soil, phenology,
// scouting, market, and finance signals to answer four core operator
// questions. Pure DB + open-meteo + Claude. No Sentinel, no Haazri.
// All currency PKR, all dates Asia/Karachi.

// ------------------------------------------------------------------------- //
// Shared helpers                                                            //
// ------------------------------------------------------------------------- //

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

interface FieldLocation {
  fieldId: string;
  lat: number;
  lng: number;
  acres: number;
  fieldName: string;
}

async function loadFieldLocation(fieldId: string): Promise<FieldLocation> {
  const row = await db
    .select({
      id: fields.id,
      acres: fields.acres,
      name: fields.name,
      code: fields.code,
      centroid: farms.centroid,
    })
    .from(fields)
    .innerJoin(blocks, eq(blocks.id, fields.blockId))
    .innerJoin(farms, eq(farms.id, blocks.farmId))
    .where(eq(fields.id, fieldId))
    .limit(1);
  const f = row[0];
  if (!f) throw new Error(`field not found: ${fieldId}`);
  const centroid = (f.centroid ?? {}) as { lat?: number; lng?: number };
  const lat = centroid.lat ?? 31.5204;
  const lng = centroid.lng ?? 74.3587;
  return {
    fieldId: f.id,
    lat,
    lng,
    acres: toNum(f.acres) ?? 1,
    fieldName: f.name ?? f.code,
  };
}

async function activeCropPlan(fieldId: string): Promise<{
  id: string;
  cropCode: string;
  sowingDate: Date | null;
  varietyName: string | null;
  plannedAcres: number;
} | null> {
  const row = await db
    .select({
      id: cropPlans.id,
      sowingDate: cropPlans.actualSowingDate,
      plannedSowingDate: cropPlans.plannedSowingDate,
      varietyName: cropPlans.varietyName,
      plannedAcres: cropPlans.plannedAcres,
      cropCode: cropProfiles.code,
    })
    .from(cropPlans)
    .innerJoin(cropProfiles, eq(cropProfiles.id, cropPlans.cropProfileId))
    .where(eq(cropPlans.fieldId, fieldId))
    .orderBy(desc(cropPlans.createdAt))
    .limit(1);
  const r = row[0];
  if (!r) return null;
  return {
    id: r.id,
    cropCode: r.cropCode,
    sowingDate: r.sowingDate ?? r.plannedSowingDate ?? null,
    varietyName: r.varietyName,
    plannedAcres: toNum(r.plannedAcres) ?? 1,
  };
}

async function latestPhenologyStage(fieldId: string): Promise<{
  stageCode: string | null;
  gdd: number | null;
  daysFromSowing: number | null;
}> {
  const row = await db
    .select()
    .from(fieldPhenologyLog)
    .where(eq(fieldPhenologyLog.fieldId, fieldId))
    .orderBy(desc(fieldPhenologyLog.observedOn))
    .limit(1);
  const r = row[0];
  if (!r) return { stageCode: null, gdd: null, daysFromSowing: null };
  return {
    stageCode: r.observedStageCode,
    gdd: toNum(r.gddAccumulated),
    daysFromSowing: r.daysFromSowing,
  };
}

async function latestSoilCard(fieldId: string) {
  const row = await db
    .select()
    .from(soilHealthCards)
    .where(eq(soilHealthCards.fieldId, fieldId))
    .orderBy(desc(soilHealthCards.issuedOn))
    .limit(1);
  return row[0] ?? null;
}

// ------------------------------------------------------------------------- //
// 1. Best spray window                                                      //
// ------------------------------------------------------------------------- //

export interface BestSprayWindowInput {
  fieldId: string;
  productKind: string;
  horizonHours?: number;
}

export interface SprayWindowOption {
  startAt: Date;
  endAt: Date;
  score: number;
  factors: SprayWindowFactors;
  rationale: string;
}

const WIND_HARD_LIMIT_KPH = 12;
const RAIN_HARD_LIMIT_MM = 1;
const TEMP_DEGRADATION_C = 35;

function scoreHour(h: {
  tempC: number;
  windKph: number;
  rainfallMm: number;
  humidityPct: number;
}): { score: number; factors: SprayWindowFactors } {
  let s = 100;
  const warn: string[] = [];

  // wind
  let windScore = 100;
  if (h.windKph > WIND_HARD_LIMIT_KPH) {
    windScore = 0;
    s = 0;
    warn.push(`wind ${h.windKph.toFixed(0)} kph exceeds drift limit`);
  } else if (h.windKph > WIND_HARD_LIMIT_KPH * 0.7) {
    windScore = 60;
    s *= 0.7;
  }

  // rain
  let rainScore = 100;
  if (h.rainfallMm > RAIN_HARD_LIMIT_MM) {
    rainScore = 0;
    s = 0;
    warn.push(`rain ${h.rainfallMm.toFixed(1)} mm risks wash-off`);
  } else if (h.rainfallMm > 0) {
    rainScore = 70;
    s *= 0.85;
  }

  // temp
  let tempScore = 100;
  if (h.tempC > TEMP_DEGRADATION_C) {
    tempScore = 20;
    s = Math.min(s, 30);
    warn.push(`temp ${h.tempC.toFixed(0)}C degrades chemistry`);
  } else if (h.tempC > 30) {
    tempScore = 70;
    s *= 0.85;
  } else if (h.tempC < 10) {
    tempScore = 60;
    s *= 0.8;
  }

  // humidity
  let humScore = 100;
  if (h.humidityPct >= 50 && h.humidityPct <= 80) {
    humScore = 100;
    s = Math.min(100, s * 1.05);
  } else if (h.humidityPct < 30) {
    humScore = 60;
    s *= 0.85;
  } else if (h.humidityPct > 90) {
    humScore = 70;
    s *= 0.9;
  }

  const factors: SprayWindowFactors = {
    temp: { value: h.tempC, score: tempScore },
    wind: { value: h.windKph, score: windScore },
    rain: { value: h.rainfallMm, score: rainScore },
    humidity: { value: h.humidityPct, score: humScore },
    phenologyOk: true,
    rationaleEn: warn.length
      ? warn.join('; ')
      : `calm ${h.windKph.toFixed(0)} kph, ${h.tempC.toFixed(0)}C, RH ${h.humidityPct.toFixed(0)}%`,
  };
  return { score: clamp(s, 0, 100), factors };
}

export async function bestSprayWindow(input: BestSprayWindowInput): Promise<SprayWindowOption[]> {
  const horizon = input.horizonHours ?? 168;
  const loc = await loadFieldLocation(input.fieldId);
  const days = Math.min(16, Math.ceil(horizon / 24) + 1);
  const wx = await fetchForecast({ lat: loc.lat, lng: loc.lng, days });

  // Group hourly into 2-hour windows, score, then pick top 3 non-overlapping.
  const candidates: SprayWindowOption[] = [];
  const now = Date.now();
  for (let i = 0; i < wx.hourly.length - 1; i += 1) {
    const h0 = wx.hourly[i];
    const h1 = wx.hourly[i + 1];
    if (!h0 || !h1) continue;
    const start = new Date(h0.timeIso);
    const end = new Date(h1.timeIso);
    end.setHours(end.getHours() + 1);
    if (start.getTime() < now) continue;
    if (start.getTime() - now > horizon * 3600 * 1000) break;
    const localHour = start.getHours();
    // Restrict to working daylight + cool hours: 5-9 and 16-19 typical.
    if (!((localHour >= 5 && localHour <= 9) || (localHour >= 16 && localHour <= 19))) continue;
    const avg = {
      tempC: (h0.tempC + h1.tempC) / 2,
      windKph: Math.max(h0.windKph, h1.windKph),
      rainfallMm: h0.rainfallMm + h1.rainfallMm,
      humidityPct: (h0.humidityPct + h1.humidityPct) / 2,
    };
    const { score, factors } = scoreHour(avg);
    if (score <= 0) continue;
    candidates.push({
      startAt: start,
      endAt: end,
      score,
      factors,
      rationale: factors.rationaleEn,
    });
  }
  candidates.sort((a, b) => b.score - a.score || a.startAt.getTime() - b.startAt.getTime());

  // Pick top 3 with at least 8-hour separation.
  const picked: SprayWindowOption[] = [];
  for (const c of candidates) {
    if (picked.every((p) => Math.abs(p.startAt.getTime() - c.startAt.getTime()) > 8 * 3600 * 1000)) {
      picked.push(c);
      if (picked.length === 3) break;
    }
  }

  // Persist into spray_windows cache.
  const expiresAt = new Date(now + 6 * 3600 * 1000);
  if (picked.length) {
    await db.insert(sprayWindows).values(
      picked.map((p) => ({
        fieldId: input.fieldId,
        recommendedForTarget: input.productKind,
        startAt: p.startAt,
        endAt: p.endAt,
        score: String(p.score.toFixed(2)),
        factors: p.factors,
        expiresAt,
      })),
    );
  }
  return picked;
}

// ------------------------------------------------------------------------- //
// 2. Nutrient recommendation                                                //
// ------------------------------------------------------------------------- //

export interface NutrientRecommendationInput {
  fieldId: string;
  stage?: string;
  targetYieldKgPerAcre?: number;
  budgetPkrPerAcre?: number;
}

export interface NutrientRecommendationOutput {
  fieldId: string;
  cropCode: string;
  phenologyStage: string | null;
  nKgPerAcre: number;
  p2o5KgPerAcre: number;
  k2oKgPerAcre: number;
  micros: Record<string, number>;
  organicAdvice: string | null;
  estimatedCostPkrPerAcre: number;
  estimatedCostPkrTotal: number;
  alternatives: NutrientAlternative[];
  aiRationaleEn: string;
  aiRationaleUr: string;
}

// Fertilizer product cost reference (PKR per bag, 50 kg). Updated 2026-Q2.
const FERT_PRICES_PKR_PER_BAG_50KG = {
  urea: 4500, // 46% N
  dap: 12500, // 18% N, 46% P2O5
  sop: 14000, // 50% K2O
  mop: 11000, // 60% K2O
  zinc: 6500, // ZnSO4 33%
} as const;

function bagsCost(kg: number, pricePerBag50kg: number): { bags: number; pkr: number } {
  const bags = Math.ceil(kg / 50);
  return { bags, pkr: bags * pricePerBag50kg };
}

function stageMultiplier(stage: string | null | undefined): number {
  // Split application: starter is small, mid-season is biggest.
  if (!stage) return 1;
  if (/tillering|squaring|v6|panicle_init/.test(stage)) return 1;
  if (/seedling|germination|v2_v4/.test(stage)) return 0.3;
  if (/stem_extension|flowering|v10|peak_flower/.test(stage)) return 0.6;
  return 1;
}

export async function nutrientRecommendation(
  input: NutrientRecommendationInput,
): Promise<NutrientRecommendationOutput> {
  const plan = await activeCropPlan(input.fieldId);
  if (!plan) throw new Error(`no active crop plan for field ${input.fieldId}`);

  const baseline = CROP_BASELINES[plan.cropCode];
  if (!baseline) throw new Error(`unsupported crop-code: ${plan.cropCode}`);

  const card = await latestSoilCard(input.fieldId);
  const pheno = await latestPhenologyStage(input.fieldId);
  const stage = input.stage ?? pheno.stageCode ?? null;
  const target = input.targetYieldKgPerAcre ?? baseline.baselineTargetYieldKgPerAcre;
  const yieldRatio = clamp(target / baseline.baselineTargetYieldKgPerAcre, 0.5, 1.8);

  let nKg = baseline.nKgPerAcre * yieldRatio;
  let pKg = baseline.p2o5KgPerAcre * yieldRatio;
  let kKg = baseline.k2oKgPerAcre * yieldRatio;
  const micros: Record<string, number> = {};
  let organicAdvice: string | null = null;

  if (card) {
    const pAvail = toNum(card.phosphorusAvailPpm);
    const kAvail = toNum(card.potassiumAvailPpm);
    const zinc = toNum(card.zincPpm);
    const boron = toNum(card.boronPpm);
    const om = toNum(card.organicMatterPct);
    const ph = toNum(card.ph);
    if (pAvail !== null && pAvail < 7) pKg *= 1.25;
    if (kAvail !== null && kAvail < 80) kKg *= 1.3;
    if (zinc !== null && zinc < 0.5) micros.zinc = 5;
    if (boron !== null && boron < 0.5) micros.boron = 1;
    if (om !== null && om < 0.8)
      organicAdvice = 'Apply 5 to 10 tons per acre of well-rotted FYM or compost before sowing.';
    if (ph !== null && ph > 8)
      organicAdvice =
        (organicAdvice ? organicAdvice + '\n' : '') + 'Apply gypsum at 1 to 2 tons per acre.';
  }

  // Stage-aware split. If a mid-season stage, scale down to the portion due now.
  const mult = stageMultiplier(stage);
  nKg = Math.round(nKg * mult * 10) / 10;
  pKg = Math.round(pKg * mult * 10) / 10;
  kKg = Math.round(kKg * mult * 10) / 10;

  // Translate kg of N P2O5 K2O into bags of urea + DAP + SOP.
  const dap = bagsCost(pKg / 0.46, FERT_PRICES_PKR_PER_BAG_50KG.dap);
  const dapNContribution = dap.bags * 50 * 0.18;
  const remainingN = Math.max(0, nKg - dapNContribution);
  const urea = bagsCost(remainingN / 0.46, FERT_PRICES_PKR_PER_BAG_50KG.urea);
  const sop = bagsCost(kKg / 0.5, FERT_PRICES_PKR_PER_BAG_50KG.sop);
  const zincKg = micros.zinc ?? 0;
  const zincCost = zincKg > 0 ? bagsCost(zincKg, FERT_PRICES_PKR_PER_BAG_50KG.zinc) : { bags: 0, pkr: 0 };

  const perAcre = dap.pkr + urea.pkr + sop.pkr + zincCost.pkr;
  const total = Math.round(perAcre * (plan.plannedAcres || 1));

  // Budget alternative: if budget given and primary plan exceeds it,
  // propose MOP-substituted plan (cheaper than SOP) + 80% N.
  const alternatives: NutrientAlternative[] = [];
  alternatives.push({
    label: 'Primary plan (DAP + Urea + SOP)',
    productKind: 'dap_urea_sop',
    bagsPerAcre: dap.bags + urea.bags + sop.bags + zincCost.bags,
    pkrPerAcre: perAcre,
    notes: `${dap.bags} DAP, ${urea.bags} Urea, ${sop.bags} SOP per acre`,
  });
  const mop = bagsCost(kKg / 0.6, FERT_PRICES_PKR_PER_BAG_50KG.mop);
  const altCost = dap.pkr + urea.pkr + mop.pkr;
  alternatives.push({
    label: 'Budget plan (MOP instead of SOP)',
    productKind: 'dap_urea_mop',
    bagsPerAcre: dap.bags + urea.bags + mop.bags,
    pkrPerAcre: altCost,
    notes: 'Use MOP only if soil chloride is not already elevated',
  });
  if (input.budgetPkrPerAcre && perAcre > input.budgetPkrPerAcre) {
    alternatives.push({
      label: 'Tight-budget split: defer 30% N to next stage',
      productKind: 'split_deferred',
      bagsPerAcre: Math.ceil((dap.bags + urea.bags) * 0.7),
      pkrPerAcre: Math.round(perAcre * 0.7),
      notes: 'Apply remainder at next phenology stage when cash improves',
    });
  }

  // AI rationale via Claude (cached system + reference).
  const cropRef = JSON.stringify({
    crop: baseline.cropName,
    baseline,
    stage,
    soil: card
      ? {
          ph: card.ph,
          om: card.organicMatterPct,
          p_ppm: card.phosphorusAvailPpm,
          k_ppm: card.potassiumAvailPpm,
        }
      : null,
    target,
  });
  const ai = await complete({
    cacheSystem: true,
    cachedReferences: [`Crop phenology library (Punjab, BBCH). ${cropRef}`],
    temperature: 0.3,
    maxTokens: 400,
    system: [
      'You are an agronomy advisor specialized in Punjab Pakistan smallholder and commercial farms.',
      'Output JSON only with keys "en" and "ur". "en" is a 2 to 3 sentence rationale in English, "ur" is the same in Urdu script.',
      'Mention any soil-test adjustments and the stage-aware split. Never use em-dashes.',
      HOUSE_STYLE,
    ].join('\n'),
    messages: [
      {
        role: 'user',
        content: `Field has ${plan.cropCode} at stage ${stage ?? 'unknown'}. Recommendation: N ${nKg} P2O5 ${pKg} K2O ${kKg} kg/acre. Cost PKR ${perAcre}/acre.`,
      },
    ],
  });
  let aiRationaleEn = `Stage ${stage ?? 'unknown'}: apply ${nKg} N, ${pKg} P2O5, ${kKg} K2O kg/acre based on baseline and soil test adjustments.`;
  let aiRationaleUr = `مرحلہ ${stage ?? ''}: فی ایکڑ ${nKg} N, ${pKg} P2O5, ${kKg} K2O کلو ڈالیں.`;
  try {
    const parsed = JSON.parse(ai.text) as { en?: string; ur?: string };
    if (parsed.en) aiRationaleEn = parsed.en;
    if (parsed.ur) aiRationaleUr = parsed.ur;
  } catch {
    // keep fallback
  }

  const today = new Date().toISOString().slice(0, 10);
  await db.insert(nutrientRecommendations).values({
    fieldId: input.fieldId,
    cropPlanId: plan.id,
    phenologyStage: stage,
    computedOn: today,
    nKgPerAcre: String(nKg),
    p2o5KgPerAcre: String(pKg),
    k2oKgPerAcre: String(kKg),
    microsJsonb: Object.keys(micros).length ? micros : null,
    organicAdvice,
    aiRationale: aiRationaleEn,
    aiRationaleUr,
    estimatedCostPkr: String(total),
    alternativesJsonb: alternatives,
  });

  return {
    fieldId: input.fieldId,
    cropCode: plan.cropCode,
    phenologyStage: stage,
    nKgPerAcre: nKg,
    p2o5KgPerAcre: pKg,
    k2oKgPerAcre: kKg,
    micros,
    organicAdvice,
    estimatedCostPkrPerAcre: perAcre,
    estimatedCostPkrTotal: total,
    alternatives,
    aiRationaleEn,
    aiRationaleUr,
  };
}

// ------------------------------------------------------------------------- //
// 3. Harvest readiness                                                      //
// ------------------------------------------------------------------------- //

export interface HarvestReadinessInput {
  fieldId: string;
  cropPlanId?: string;
  pricePkrPerKgTodayOpt?: number;
  pricePkrPerKgWeekAgoOpt?: number;
}

export interface HarvestReadinessOutput {
  recommendation: 'harvest_now' | 'wait' | 'monitor';
  daysSuggested: number;
  gddAccumulated: number | null;
  gddReference: number | null;
  weatherRisk: { stormProbability: number; rainNext72hMm: number };
  priceTrendPct: number | null;
  rationaleEn: string;
  rationaleUr: string;
}

const HARVEST_GDD_REFERENCE: Record<string, number> = {
  wheat: 1900,
  maize: 2150,
  rice_basmati: 2300,
  cotton: 2300,
  sugarcane: 4000,
};

export async function harvestReadiness(
  input: HarvestReadinessInput,
): Promise<HarvestReadinessOutput> {
  const loc = await loadFieldLocation(input.fieldId);
  const plan = await activeCropPlan(input.fieldId);
  if (!plan) throw new Error(`no active crop plan for field ${input.fieldId}`);
  const pheno = await latestPhenologyStage(input.fieldId);
  const gddRef = HARVEST_GDD_REFERENCE[plan.cropCode] ?? null;

  // Pull next 7 days weather for storm risk.
  const wx = await fetchForecast({ lat: loc.lat, lng: loc.lng, days: 7 });
  const next72 = wx.daily.slice(0, 3);
  const rain72 = next72.reduce((a, b) => a + b.rainfallMm, 0);
  const stormProb = clamp(rain72 / 30, 0, 1); // 30 mm in 72h ~ heavy storm risk

  const priceTrendPct =
    input.pricePkrPerKgTodayOpt !== undefined && input.pricePkrPerKgWeekAgoOpt
      ? ((input.pricePkrPerKgTodayOpt - input.pricePkrPerKgWeekAgoOpt) /
          input.pricePkrPerKgWeekAgoOpt) *
        100
      : null;

  let rec: HarvestReadinessOutput['recommendation'] = 'monitor';
  let days = 14;
  const parts: string[] = [];
  const partsUr: string[] = [];

  const gddRatio = pheno.gdd && gddRef ? pheno.gdd / gddRef : null;
  if (gddRatio !== null && gddRatio >= 0.98) {
    if (stormProb > 0.6) {
      rec = 'harvest_now';
      days = 0;
      parts.push(`Crop is mature (GDD ${pheno.gdd}/${gddRef}) and ${rain72.toFixed(0)} mm rain expected in 72h.`);
      partsUr.push(`فصل پک گئی ہے اور 72 گھنٹے میں ${rain72.toFixed(0)} ملی میٹر بارش متوقع ہے.`);
    } else if (priceTrendPct !== null && priceTrendPct > 5) {
      rec = 'wait';
      days = 5;
      parts.push(`Mature but prices rising ${priceTrendPct.toFixed(1)}% week-on-week; consider holding 5 days.`);
      partsUr.push(`فصل تیار، قیمتیں بڑھ رہی ہیں ${priceTrendPct.toFixed(1)}% فی ہفتہ؛ 5 دن انتظار کریں.`);
    } else {
      rec = 'harvest_now';
      days = 0;
      parts.push(`Mature (GDD ${pheno.gdd}/${gddRef}); weather and prices stable.`);
      partsUr.push(`فصل تیار ہے (GDD ${pheno.gdd}/${gddRef})؛ موسم اور قیمتیں مستحکم.`);
    }
  } else if (gddRatio !== null && gddRatio >= 0.85) {
    rec = 'wait';
    days = Math.round((1 - gddRatio) * 30);
    parts.push(`Close to maturity (GDD ${pheno.gdd}/${gddRef}); estimated ${days} days remaining.`);
    partsUr.push(`فصل قریب پکنے کے (GDD ${pheno.gdd}/${gddRef})؛ تقریباً ${days} دن باقی.`);
  } else {
    rec = 'monitor';
    days = 21;
    parts.push(`Not yet mature; continue monitoring.`);
    partsUr.push(`ابھی پکنے میں وقت ہے؛ نگرانی جاری رکھیں.`);
  }

  if (stormProb > 0.4 && rec !== 'harvest_now') {
    parts.push(`Rain risk: ${rain72.toFixed(0)} mm in next 72h.`);
    partsUr.push(`بارش کا خطرہ: 72 گھنٹے میں ${rain72.toFixed(0)} ملی میٹر.`);
  }

  return {
    recommendation: rec,
    daysSuggested: days,
    gddAccumulated: pheno.gdd,
    gddReference: gddRef,
    weatherRisk: { stormProbability: stormProb, rainNext72hMm: rain72 },
    priceTrendPct,
    rationaleEn: parts.join(' '),
    rationaleUr: partsUr.join(' '),
  };
}

// ------------------------------------------------------------------------- //
// 4. Replant decision support                                               //
// ------------------------------------------------------------------------- //

export interface ReplantDecisionInput {
  fieldId: string;
  gappedPct: number;
  daysFromSowing: number;
  seedCostPkrPerAcre?: number;
  expectedYieldPkrPerAcre?: number;
}

export interface ReplantDecisionOutput {
  recommendation: 'gap_fill' | 'full_replant' | 'write_off' | 'keep_as_is';
  rationaleEn: string;
  rationaleUr: string;
  estimatedCostPkr: number;
  estimatedNetReturnPkr: number;
  windowStillOpen: boolean;
}

// Season replant windows (days from typical sowing window start).
// Outside these windows, replanting late will not catch GDD requirement.
const REPLANT_WINDOW_DAYS: Record<string, number> = {
  wheat: 25,
  maize: 20,
  rice_basmati: 20,
  cotton: 30,
  sugarcane: 45,
};

export async function replantDecisionSupport(
  input: ReplantDecisionInput,
): Promise<ReplantDecisionOutput> {
  const plan = await activeCropPlan(input.fieldId);
  const loc = await loadFieldLocation(input.fieldId);
  const cropCode = plan?.cropCode ?? 'wheat';
  const windowDays = REPLANT_WINDOW_DAYS[cropCode] ?? 25;
  const windowOpen = input.daysFromSowing <= windowDays;
  const seedCost = input.seedCostPkrPerAcre ?? 5000;
  const expectedYield = input.expectedYieldPkrPerAcre ?? 80000;
  const acres = loc.acres;

  let rec: ReplantDecisionOutput['recommendation'];
  let cost = 0;
  let netReturn = 0;
  const parts: string[] = [];
  const partsUr: string[] = [];

  if (input.gappedPct < 15) {
    rec = 'keep_as_is';
    parts.push(`Gap ${input.gappedPct}% is below 15% threshold; in-field compensation expected.`);
    partsUr.push(`${input.gappedPct}% خلا 15% سے کم ہے؛ فصل خود پوری ہو جائے گی.`);
  } else if (input.gappedPct < 30 && windowOpen) {
    rec = 'gap_fill';
    cost = Math.round(seedCost * 0.4 * acres);
    netReturn = Math.round(expectedYield * (1 - input.gappedPct / 100) * acres - cost);
    parts.push(
      `Gap ${input.gappedPct}% with ${windowDays - input.daysFromSowing} replant days remaining; gap-fill cost-effective.`,
    );
    partsUr.push(`${input.gappedPct}% خلا، ${windowDays - input.daysFromSowing} دن باقی؛ خلا بھریں.`);
  } else if (input.gappedPct >= 30 && input.gappedPct < 60 && windowOpen) {
    rec = 'full_replant';
    cost = Math.round(seedCost * acres);
    netReturn = Math.round(expectedYield * 0.9 * acres - cost);
    parts.push(`Gap ${input.gappedPct}% is severe but window open; full replant beats partial yield.`);
    partsUr.push(`${input.gappedPct}% خلا شدید ہے مگر وقت باقی؛ پوری دوبارہ کاشت کریں.`);
  } else if (!windowOpen && input.gappedPct >= 30) {
    rec = 'write_off';
    cost = 0;
    netReturn = Math.round(expectedYield * (1 - input.gappedPct / 100) * 0.6 * acres);
    parts.push(
      `Gap ${input.gappedPct}% and ${input.daysFromSowing} days from sowing exceeds ${windowDays}-day replant window. Switch field to alternative crop or fallow.`,
    );
    partsUr.push(`${input.gappedPct}% خلا اور وقت ختم؛ متبادل فصل یا کھیت چھوڑ دیں.`);
  } else {
    rec = 'gap_fill';
    cost = Math.round(seedCost * 0.4 * acres);
    netReturn = Math.round(expectedYield * (1 - input.gappedPct / 100) * acres - cost);
    parts.push(`Gap ${input.gappedPct}%; gap-fill recommended.`);
    partsUr.push(`${input.gappedPct}% خلا؛ خلا بھریں.`);
  }

  return {
    recommendation: rec,
    rationaleEn: parts.join(' '),
    rationaleUr: partsUr.join(' '),
    estimatedCostPkr: cost,
    estimatedNetReturnPkr: netReturn,
    windowStillOpen: windowOpen,
  };
}

// ------------------------------------------------------------------------- //
// Hub helper: top recommendation per active field                           //
// ------------------------------------------------------------------------- //

export interface FieldTopRecommendation {
  fieldId: string;
  fieldName: string;
  cropCode: string | null;
  stage: string | null;
  topAction: 'spray' | 'fertilize' | 'harvest' | 'replant' | 'observe';
  headline: string;
}

export async function topRecommendationPerField(): Promise<FieldTopRecommendation[]> {
  const rows = await db
    .select({
      fieldId: fields.id,
      fieldName: fields.name,
      fieldCode: fields.code,
    })
    .from(fields);

  const out: FieldTopRecommendation[] = [];
  for (const r of rows) {
    const plan = await activeCropPlan(r.fieldId);
    const pheno = await latestPhenologyStage(r.fieldId);
    let topAction: FieldTopRecommendation['topAction'] = 'observe';
    let headline = 'No active crop plan';
    if (plan) {
      if (pheno.stageCode && /maturity|dough|dent|boll_open|first_pick/.test(pheno.stageCode)) {
        topAction = 'harvest';
        headline = `Approaching harvest (${pheno.stageCode})`;
      } else if (pheno.stageCode && /tillering|squaring|v6|panicle_init/.test(pheno.stageCode)) {
        topAction = 'fertilize';
        headline = `Apply mid-season N + P + K at ${pheno.stageCode}`;
      } else if (pheno.stageCode && /flowering|booting|heading/.test(pheno.stageCode)) {
        topAction = 'spray';
        headline = `Sensitive stage (${pheno.stageCode}); plan protective spray`;
      } else {
        topAction = 'observe';
        headline = `Stage ${pheno.stageCode ?? plan.cropCode}; routine scouting`;
      }
    }
    out.push({
      fieldId: r.fieldId,
      fieldName: r.fieldName ?? r.fieldCode,
      cropCode: plan?.cropCode ?? null,
      stage: pheno.stageCode,
      topAction,
      headline,
    });
  }
  return out;
}

// Re-export for ergonomic imports.
export { CROP_BASELINES };
// Touch unused import to keep tree-shaker honest about exports.
void harvestRecords;
