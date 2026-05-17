import { describe, it, expect, beforeEach } from 'vitest';
import { resetDb, getRows } from '@zameen/db';
import { proportionalSplit, allocateCost } from '../cost-allocation.js';

beforeEach(() => {
  resetDb();
});

describe('proportionalSplit', () => {
  it('sums to exact total (drift goes to first row)', () => {
    const out = proportionalSplit(100, [
      { fieldId: 'a', weight: 1 },
      { fieldId: 'b', weight: 1 },
      { fieldId: 'c', weight: 1 },
    ]);
    const sum = out.reduce((a, b) => a + b.amountPkr, 0);
    expect(Number(sum.toFixed(2))).toBe(100);
    expect(out).toHaveLength(3);
  });

  it('handles uneven weights with drift assigned to first row', () => {
    const out = proportionalSplit(1000, [
      { fieldId: 'a', weight: 1 },
      { fieldId: 'b', weight: 2 },
      { fieldId: 'c', weight: 3 },
    ]);
    const sum = Number(out.reduce((a, b) => a + b.amountPkr, 0).toFixed(2));
    expect(sum).toBe(1000);
    expect(out[1]!.amountPkr).toBeCloseTo(333.33, 2);
    expect(out[2]!.amountPkr).toBeCloseTo(500, 2);
  });

  it('zero-weight inputs return empty array', () => {
    expect(proportionalSplit(500, [])).toEqual([]);
    expect(
      proportionalSplit(500, [
        { fieldId: 'a', weight: 0 },
        { fieldId: 'b', weight: 0 },
      ]),
    ).toEqual([]);
  });

  it('single weight assigns full total to that field', () => {
    const out = proportionalSplit(750, [{ fieldId: 'only', weight: 5 }]);
    expect(out).toEqual([{ fieldId: 'only', amountPkr: 750 }]);
  });

  it('handles fractional totals without drift accumulation', () => {
    const out = proportionalSplit(33.33, [
      { fieldId: 'a', weight: 1 },
      { fieldId: 'b', weight: 1 },
      { fieldId: 'c', weight: 1 },
    ]);
    const sum = Number(out.reduce((a, b) => a + b.amountPkr, 0).toFixed(2));
    expect(sum).toBe(33.33);
  });
});

describe('allocateCost', () => {
  it('appends a row to costAllocations with the input values', async () => {
    await allocateCost({
      entityId: 'e-1',
      sourceModule: 'diesel',
      sourceRecordId: 'src-1',
      costPool: 'diesel',
      amountPkr: 1234.5,
      allocatedOn: '2026-05-17',
      fieldId: 'f-1',
    });
    const rows = getRows('costAllocations');
    expect(rows).toHaveLength(1);
    expect(rows[0]!.amountPkr).toBe('1234.5');
    expect(rows[0]!.fieldId).toBe('f-1');
    expect(rows[0]!.costPool).toBe('diesel');
  });
});
