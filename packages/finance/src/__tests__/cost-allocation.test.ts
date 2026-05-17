import { describe, it, expect, vi } from 'vitest';

// Mock @zameen/db so importing cost-allocation does not require a live DB.
vi.mock('@zameen/db', () => ({
  db: { insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })) },
  costAllocations: {},
}));

import { proportionalSplit } from '../cost-allocation.js';

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
    // b ~= 333.33, c = 500, a absorbs the rest
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
