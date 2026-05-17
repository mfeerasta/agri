import { describe, it, expect } from 'vitest';
import { fromRupees, toRupeesString, mul, formatPkr } from '../money.js';

describe('fromRupees', () => {
  it('parses "1,234.56" to 123456n', () => {
    expect(fromRupees('1,234.56')).toBe(123456n);
  });
  it('handles whole rupees without fraction', () => {
    expect(fromRupees('100')).toBe(10000n);
  });
  it('handles negative amounts', () => {
    expect(fromRupees('-50.25')).toBe(-5025n);
  });
  it('handles numbers', () => {
    expect(fromRupees(12.34)).toBe(1234n);
  });
  it('empty string returns 0n', () => {
    expect(fromRupees('')).toBe(0n);
  });
});

describe('toRupeesString', () => {
  it('converts 123456n to "1234.56"', () => {
    expect(toRupeesString(123456n)).toBe('1234.56');
  });
  it('pads fractional zeros', () => {
    expect(toRupeesString(10000n)).toBe('100.00');
  });
  it('negative values keep sign', () => {
    expect(toRupeesString(-5025n)).toBe('-50.25');
  });
});

describe('mul', () => {
  it('multiplies bigint paisa by fractional factor', () => {
    expect(mul(10000n, 0.5)).toBe(5000n);
    expect(mul(10000n, 1.25)).toBe(12500n);
  });
  it('handles small factors without losing accuracy', () => {
    expect(mul(1_000_000n, 0.075)).toBe(75_000n);
  });
});

describe('formatPkr', () => {
  it('plain mode formats with rupees and paisa', () => {
    expect(formatPkr(123456n)).toMatch(/Rs\.\s*1,234\.56/);
  });
  it('lac_crore: 1 lac breakpoint', () => {
    // 100_000 rupees = 10_000_000n paisa
    expect(formatPkr(10_000_000n, 'lac_crore')).toMatch(/lac/);
  });
  it('lac_crore: 1 crore breakpoint', () => {
    // 10_000_000 rupees = 1_000_000_000n paisa
    expect(formatPkr(1_000_000_000n, 'lac_crore')).toMatch(/crore/);
  });
  it('lac_crore: below 1 lac falls back to plain', () => {
    expect(formatPkr(9_999_900n, 'lac_crore')).not.toMatch(/lac|crore/);
  });
});
