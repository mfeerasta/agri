import { describe, it, expect } from 'vitest';
import {
  dieselDailyLogSchema,
  dieselPurchaseSchema,
  dieselStockReconciliationSchema,
} from '../validators/diesel.js';

const UUID = '11111111-1111-1111-1111-111111111111';
const UUID_B = '22222222-2222-2222-2222-222222222222';

describe('dieselDailyLogSchema', () => {
  it('derives hoursRun and totalCostPkr', () => {
    const out = dieselDailyLogSchema.parse({
      entityId: UUID,
      assetId: UUID_B,
      logDate: '2026-05-17',
      operatorName: 'Aslam',
      hourMeterStart: 1000,
      hourMeterEnd: 1008,
      dieselFilledLiters: 25,
      rateLiterPkr: 280,
      receiptPhotoUrls: ['https://x/y.jpg'],
    });
    expect(out.hoursRun).toBe(8);
    expect(out.totalCostPkr).toBe(7000);
  });

  it('rejects hourMeterEnd < hourMeterStart', () => {
    expect(() =>
      dieselDailyLogSchema.parse({
        entityId: UUID,
        assetId: UUID_B,
        logDate: '2026-05-17',
        operatorName: 'Aslam',
        hourMeterStart: 1100,
        hourMeterEnd: 1000,
        dieselFilledLiters: 25,
        rateLiterPkr: 280,
        receiptPhotoUrls: ['https://x/y.jpg'],
      }),
    ).toThrow();
  });
});

describe('dieselPurchaseSchema', () => {
  const base = {
    entityId: UUID,
    purchasedAt: '2026-05-17T10:00:00Z',
    vendorName: 'PSO',
    quantityLiters: 1000,
    rateLiterPkr: 280,
    totalPkr: 280000,
    paymentMethod: 'cash' as const,
    receiptPhotoUrls: ['https://x/y.jpg'],
  };

  it('requires tank XOR direct-to-asset (neither = fail)', () => {
    expect(() => dieselPurchaseSchema.parse({ ...base })).toThrow();
  });

  it('requires tank XOR direct-to-asset (both = fail)', () => {
    expect(() =>
      dieselPurchaseSchema.parse({
        ...base,
        filledToTankId: UUID,
        filledDirectlyToAssetId: UUID_B,
      }),
    ).toThrow();
  });

  it('accepts tank only', () => {
    expect(() =>
      dieselPurchaseSchema.parse({ ...base, filledToTankId: UUID }),
    ).not.toThrow();
  });

  it('accepts direct-to-asset only', () => {
    expect(() =>
      dieselPurchaseSchema.parse({ ...base, filledDirectlyToAssetId: UUID_B }),
    ).not.toThrow();
  });

  it('requires at least one receipt photo', () => {
    expect(() =>
      dieselPurchaseSchema.parse({
        ...base,
        filledToTankId: UUID,
        receiptPhotoUrls: [],
      }),
    ).toThrow();
  });
});

describe('dieselStockReconciliationSchema', () => {
  it('computes expectedClosing, varianceLiters, variancePct', () => {
    const out = dieselStockReconciliationSchema.parse({
      tankId: UUID,
      reconciledOn: '2026-05-17',
      openingStockLiters: 1000,
      purchasesInLiters: 500,
      issuancesOutLiters: 800,
      actualClosingLiters: 695,
      physicalCheckPhotoUrls: ['https://x/y.jpg'],
    });
    expect(out.expectedClosingLiters).toBe(700);
    expect(out.varianceLiters).toBe(-5);
    expect(out.variancePct).toBeCloseTo(-0.714, 2);
  });

  it('variance computation handles zero expected', () => {
    const out = dieselStockReconciliationSchema.parse({
      tankId: UUID,
      reconciledOn: '2026-05-17',
      openingStockLiters: 0,
      purchasesInLiters: 0,
      issuancesOutLiters: 0,
      actualClosingLiters: 0,
      physicalCheckPhotoUrls: ['https://x/y.jpg'],
    });
    expect(out.expectedClosingLiters).toBe(0);
    expect(out.variancePct).toBe(0);
  });

  it('5L tolerance falls within typical alert threshold (1.5%)', () => {
    const out = dieselStockReconciliationSchema.parse({
      tankId: UUID,
      reconciledOn: '2026-05-17',
      openingStockLiters: 1000,
      purchasesInLiters: 0,
      issuancesOutLiters: 0,
      actualClosingLiters: 995,
      physicalCheckPhotoUrls: ['https://x/y.jpg'],
    });
    expect(Math.abs(out.variancePct)).toBeLessThan(1.5);
  });
});
