import { and, eq, isNull, or } from 'drizzle-orm';
import { db, gradingStandards, produceLots, qualityLabTests } from '@zameen/db';

/**
 * Maps a quality_lab_tests.test_kind into the grading_standards.criteria key.
 * Criteria use *_max / *_min suffix convention.
 */
const TEST_KIND_CRITERIA_KEY: Record<string, string> = {
  moisture: 'moisture_max',
  foreign_matter: 'foreign_matter_max',
  broken_kernels: 'broken_kernels_max',
  discoloration: 'discoloration_max',
  protein: 'protein_min',
  gluten: 'gluten_min',
  aflatoxin: 'aflatoxin_max',
  heavy_metals: 'heavy_metals_max',
  pesticide_residue: 'pesticide_residue_max',
  germination: 'germination_min',
  vigor: 'vigor_min',
  seed_purity: 'seed_purity_min',
};

const GRADE_RANK: Record<string, number> = {
  premium: 100,
  'Mid+': 95,
  SLM: 90,
  A: 80,
  Mid: 70,
  medium: 60,
  B: 50,
  C: 30,
  reject: 0,
};

export interface AutoGradeResult {
  awardedGrade: string | null;
  downgradeReason: string | null;
  evaluated: Array<{ grade: string; passed: boolean; failedCriteria: string[] }>;
}

/**
 * Given a produce lot id, walk through quality_lab_tests and check against
 * grading_standards.criteria. Returns the highest-rank grade the lot qualifies for.
 * Side effect: when a grade is awarded, updates produce_lots.grade.
 */
export async function gradeFromTests({
  lotId,
  entityId,
  buyerSpecific,
}: {
  lotId: string;
  entityId?: string;
  buyerSpecific?: string;
}): Promise<AutoGradeResult> {
  const [lot] = await db.select().from(produceLots).where(eq(produceLots.id, lotId)).limit(1);
  if (!lot) return { awardedGrade: null, downgradeReason: 'lot-not-found', evaluated: [] };

  const tests = await db.select().from(qualityLabTests).where(eq(qualityLabTests.produceLotId, lotId));
  if (tests.length === 0) {
    return { awardedGrade: null, downgradeReason: 'no-tests', evaluated: [] };
  }

  const cropCode = lot.cropName.toLowerCase().replace(/\s+/g, '_');
  const standards = await db
    .select()
    .from(gradingStandards)
    .where(
      and(
        eq(gradingStandards.cropCode, cropCode),
        eq(gradingStandards.isActive, true),
        entityId
          ? or(eq(gradingStandards.entityId, entityId), isNull(gradingStandards.entityId))
          : isNull(gradingStandards.entityId),
        buyerSpecific ? eq(gradingStandards.buyerSpecific, buyerSpecific) : isNull(gradingStandards.buyerSpecific),
      ),
    );

  const evaluated: AutoGradeResult['evaluated'] = [];
  const sorted = [...standards].sort(
    (a, b) => (GRADE_RANK[b.grade] ?? 0) - (GRADE_RANK[a.grade] ?? 0),
  );

  let awardedGrade: string | null = null;
  let downgradeReason: string | null = null;

  for (const std of sorted) {
    const failedCriteria: string[] = [];
    for (const test of tests) {
      const key = TEST_KIND_CRITERIA_KEY[test.testKind];
      if (!key) continue;
      const limit = std.criteria[key];
      if (limit === undefined) continue;
      const val = test.resultValue ? Number(test.resultValue) : null;
      if (val === null) continue;
      if (key.endsWith('_max') && val > limit) failedCriteria.push(`${test.testKind}=${val}>${limit}`);
      if (key.endsWith('_min') && val < limit) failedCriteria.push(`${test.testKind}=${val}<${limit}`);
    }
    const passed = failedCriteria.length === 0;
    evaluated.push({ grade: std.grade, passed, failedCriteria });
    if (passed && awardedGrade === null) {
      awardedGrade = std.grade;
    } else if (!passed && awardedGrade === null) {
      downgradeReason = failedCriteria.join('; ');
    }
  }

  if (awardedGrade) {
    const normalized = normalizeToEnum(awardedGrade);
    if (normalized) {
      await db.update(produceLots).set({ grade: normalized }).where(eq(produceLots.id, lotId));
    }
  }

  return { awardedGrade, downgradeReason, evaluated };
}

function normalizeToEnum(grade: string): 'a' | 'b' | 'c' | 'reject' | null {
  const g = grade.toLowerCase();
  if (g === 'a' || g === 'premium' || g === 'mid+' || g === 'slm') return 'a';
  if (g === 'b' || g === 'medium' || g === 'mid') return 'b';
  if (g === 'c') return 'c';
  if (g === 'reject') return 'reject';
  return null;
}
