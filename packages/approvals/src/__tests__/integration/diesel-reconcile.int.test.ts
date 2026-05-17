import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, stopPg, type PgFixture } from './setup.js';
import { dieselStockReconciliationSchema } from '@zameen/shared';
import { DIESEL_VARIANCE_TOLERANCE_PCT } from '@zameen/shared';

const SHOULD_RUN = process.env.RUN_INT_TESTS === '1';
const d = SHOULD_RUN ? describe : describe.skip;

let pg: PgFixture;
const TANK = '00000000-0000-0000-0000-000000000001';

d('integration: diesel reconcile (purchase 1000L, issue 800L)', () => {
  beforeAll(async () => {
    pg = await startPg();
    process.env.DATABASE_URL = pg.url;
  }, 120_000);

  afterAll(async () => {
    if (pg) await stopPg(pg);
  });

  it('expected closing = 200L, +/-5L tolerance kept within alert threshold', () => {
    const out = dieselStockReconciliationSchema.parse({
      tankId: TANK,
      reconciledOn: '2026-05-17',
      openingStockLiters: 0,
      purchasesInLiters: 1000,
      issuancesOutLiters: 800,
      actualClosingLiters: 197,
      physicalCheckPhotoUrls: ['https://x/y.jpg'],
    });
    expect(out.expectedClosingLiters).toBe(200);
    expect(out.varianceLiters).toBe(-3);
    expect(Math.abs(out.variancePct)).toBeLessThan(DIESEL_VARIANCE_TOLERANCE_PCT);
  });
});
