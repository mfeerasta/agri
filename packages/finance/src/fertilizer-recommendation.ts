import { db, soilHealthCards, fertilizerRecommendations } from '@zameen/db';
import { eq } from 'drizzle-orm';

// Fertilizer recommendation engine. Baseline NPK by crop is anchored to Punjab
// Agriculture Dept extension bulletins and FAO crop nutrient removal data
// (kg per acre at the cited target yield). Adjustments overlay soil-test
// values per common Pakistan agronomy practice.
//
// References:
// - Punjab Agri Dept "Recommended Doses of Fertilizer" bulletins (wheat, rice, cotton, maize, sugarcane).
// - FAO Plant Nutrition for Food Security: a Guide for Integrated Nutrient Management.

export interface CropBaseline {
  cropCode: string;
  cropName: string;
  baselineTargetYieldKgPerAcre: number;
  nKgPerAcre: number;
  p2o5KgPerAcre: number;
  k2oKgPerAcre: number;
  zincKgPerAcre?: number;
  sulphurKgPerAcre?: number;
}

export const CROP_BASELINES: Record<string, CropBaseline> = {
  wheat: {
    cropCode: 'wheat',
    cropName: 'Wheat',
    baselineTargetYieldKgPerAcre: 1600,
    nKgPerAcre: 55,
    p2o5KgPerAcre: 46,
    k2oKgPerAcre: 25,
    zincKgPerAcre: 2.5,
  },
  rice_basmati: {
    cropCode: 'rice_basmati',
    cropName: 'Rice (Basmati)',
    baselineTargetYieldKgPerAcre: 1400,
    nKgPerAcre: 50,
    p2o5KgPerAcre: 34,
    k2oKgPerAcre: 25,
    zincKgPerAcre: 5,
  },
  cotton: {
    cropCode: 'cotton',
    cropName: 'Cotton',
    baselineTargetYieldKgPerAcre: 1000,
    nKgPerAcre: 60,
    p2o5KgPerAcre: 30,
    k2oKgPerAcre: 30,
    sulphurKgPerAcre: 10,
  },
  maize: {
    cropCode: 'maize',
    cropName: 'Maize',
    baselineTargetYieldKgPerAcre: 3200,
    nKgPerAcre: 100,
    p2o5KgPerAcre: 60,
    k2oKgPerAcre: 50,
    zincKgPerAcre: 2.5,
  },
  sugarcane: {
    cropCode: 'sugarcane',
    cropName: 'Sugarcane',
    baselineTargetYieldKgPerAcre: 28000,
    nKgPerAcre: 110,
    p2o5KgPerAcre: 50,
    k2oKgPerAcre: 50,
    sulphurKgPerAcre: 10,
  },
};

export interface RecommendationInput {
  cardId: string;
  cropCode: string;
  targetYieldKgPerAcre: number;
  persist?: boolean;
}

export interface RecommendationOutput {
  cropCode: string;
  targetYieldKgPerAcre: number;
  nKgPerAcre: number;
  p2o5KgPerAcre: number;
  k2oKgPerAcre: number;
  zincKgPerAcre: number | null;
  sulphurKgPerAcre: number | null;
  micros: Record<string, number>;
  organicRecommendations: string | null;
  aiRationaleEn: string;
  aiRationaleUr: string;
}

function n(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : null;
}

export async function computeRecommendation(input: RecommendationInput): Promise<RecommendationOutput> {
  const [card] = await db
    .select()
    .from(soilHealthCards)
    .where(eq(soilHealthCards.id, input.cardId))
    .limit(1);
  if (!card) throw new Error(`soil-health-card not found: ${input.cardId}`);

  const baseline = CROP_BASELINES[input.cropCode];
  if (!baseline) throw new Error(`unsupported crop-code: ${input.cropCode}`);

  // Scale baseline NPK linearly by target yield ratio (capped to 0.5x..1.8x).
  const yieldRatio = Math.min(
    1.8,
    Math.max(0.5, input.targetYieldKgPerAcre / baseline.baselineTargetYieldKgPerAcre),
  );

  let nKg = baseline.nKgPerAcre * yieldRatio;
  let pKg = baseline.p2o5KgPerAcre * yieldRatio;
  let kKg = baseline.k2oKgPerAcre * yieldRatio;
  let zincKg = baseline.zincKgPerAcre ?? null;
  let sulphurKg = baseline.sulphurKgPerAcre ?? null;
  const micros: Record<string, number> = {};

  const rationaleParts: string[] = [];
  const rationaleUrParts: string[] = [];
  rationaleParts.push(
    `Baseline for ${baseline.cropName} at ${input.targetYieldKgPerAcre} kg/acre target: N ${nKg.toFixed(0)}, P2O5 ${pKg.toFixed(0)}, K2O ${kKg.toFixed(0)} kg/acre.`,
  );
  rationaleUrParts.push(
    `${baseline.cropName} کی بنیادی سفارش ${input.targetYieldKgPerAcre} کلو/ایکڑ پیداوار کے لیے: N ${nKg.toFixed(0)}, P2O5 ${pKg.toFixed(0)}, K2O ${kKg.toFixed(0)} کلو/ایکڑ.`,
  );

  const pAvail = n(card.phosphorusAvailPpm);
  const kAvail = n(card.potassiumAvailPpm);
  const zincVal = n(card.zincPpm);
  const om = n(card.organicMatterPct);
  const ph = n(card.ph);
  const ec = n(card.electricalConductivityDsPerM);
  const sulphur = n(card.sulphurPpm);
  const boron = n(card.boronPpm);
  const iron = n(card.ironPpm);

  if (pAvail !== null && pAvail < 7) {
    pKg *= 1.25;
    rationaleParts.push(`Phosphorus low (${pAvail} ppm < 7); P2O5 increased 25%.`);
    rationaleUrParts.push(`فاسفورس کم ہے (${pAvail} ppm)؛ P2O5 میں 25% اضافہ.`);
  }
  if (kAvail !== null && kAvail < 80) {
    kKg *= 1.3;
    rationaleParts.push(`Potassium low (${kAvail} ppm < 80); K2O increased 30%.`);
    rationaleUrParts.push(`پوٹاش کم ہے (${kAvail} ppm)؛ K2O میں 30% اضافہ.`);
  }
  if (zincVal !== null && zincVal < 0.5) {
    zincKg = Math.max(zincKg ?? 0, 5);
    rationaleParts.push(`Zinc deficient (${zincVal} ppm < 0.5); add 5 kg Zn/acre.`);
    rationaleUrParts.push(`زنک کی کمی ہے (${zincVal} ppm)؛ 5 کلو زنک فی ایکڑ شامل کریں.`);
  }
  if (sulphur !== null && sulphur < 10) {
    sulphurKg = Math.max(sulphurKg ?? 0, 10);
    rationaleParts.push(`Sulphur low (${sulphur} ppm); add 10 kg S/acre.`);
    rationaleUrParts.push(`گندھک کم ہے (${sulphur} ppm)؛ 10 کلو فی ایکڑ شامل کریں.`);
  }
  if (boron !== null && boron < 0.5) {
    micros.boron = 1;
    rationaleParts.push(`Boron deficient (${boron} ppm); add 1 kg B/acre.`);
    rationaleUrParts.push(`بوران کی کمی ہے (${boron} ppm)؛ 1 کلو فی ایکڑ.`);
  }
  if (iron !== null && iron < 4.5) {
    micros.iron = 5;
    rationaleParts.push(`Iron deficient (${iron} ppm); foliar Fe at 5 kg/acre equivalent.`);
    rationaleUrParts.push(`فولاد کی کمی ہے (${iron} ppm)؛ 5 کلو فی ایکڑ.`);
  }

  let organicRecommendations: string | null = null;
  if (om !== null && om < 0.8) {
    organicRecommendations =
      'Apply 5 to 10 tons per acre of well-rotted FYM or compost 3 to 4 weeks before sowing. سڑی ہوئی گوبر کی کھاد 5 تا 10 ٹن فی ایکڑ بوائی سے 3 سے 4 ہفتے پہلے ڈالیں.';
    rationaleParts.push(`Organic matter low (${om}% < 0.8%); FYM/compost recommended.`);
    rationaleUrParts.push(`نامیاتی مادہ کم ہے (${om}%)؛ گوبر کی کھاد کی سفارش ہے.`);
  }
  if (ph !== null && ph > 8) {
    const gypsum = 'Apply gypsum at 1 to 2 tons per acre to reduce alkalinity. ایک تا دو ٹن جپسم فی ایکڑ ڈالیں.';
    organicRecommendations = organicRecommendations ? `${organicRecommendations}\n${gypsum}` : gypsum;
    rationaleParts.push(`pH high (${ph} > 8); gypsum recommended.`);
    rationaleUrParts.push(`پی ایچ زیادہ ہے (${ph})؛ جپسم کی سفارش.`);
  }
  if (ec !== null && ec > 4) {
    rationaleParts.push(`Salinity elevated (EC ${ec} dS/m); consider leaching irrigation.`);
    rationaleUrParts.push(`نمکیات زیادہ ہیں (EC ${ec})؛ پانی سے دھلائی کریں.`);
  }

  const output: RecommendationOutput = {
    cropCode: input.cropCode,
    targetYieldKgPerAcre: input.targetYieldKgPerAcre,
    nKgPerAcre: Math.round(nKg * 10) / 10,
    p2o5KgPerAcre: Math.round(pKg * 10) / 10,
    k2oKgPerAcre: Math.round(kKg * 10) / 10,
    zincKgPerAcre: zincKg,
    sulphurKgPerAcre: sulphurKg,
    micros,
    organicRecommendations,
    aiRationaleEn: rationaleParts.join(' '),
    aiRationaleUr: rationaleUrParts.join(' '),
  };

  if (input.persist) {
    await db.insert(fertilizerRecommendations).values({
      cardId: input.cardId,
      cropCode: input.cropCode,
      targetYieldKgPerAcre: String(input.targetYieldKgPerAcre),
      nKgPerAcre: String(output.nKgPerAcre),
      p2o5KgPerAcre: String(output.p2o5KgPerAcre),
      k2oKgPerAcre: String(output.k2oKgPerAcre),
      zincKgPerAcre: zincKg !== null ? String(zincKg) : null,
      sulphurKgPerAcre: sulphurKg !== null ? String(sulphurKg) : null,
      microsJsonb: Object.keys(micros).length ? micros : null,
      organicRecommendations,
      aiRationale: `${output.aiRationaleEn}\n\n${output.aiRationaleUr}`,
    });
  }

  return output;
}
