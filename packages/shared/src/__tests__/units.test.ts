import { describe, it, expect } from 'vitest';
import {
  kgToMann,
  mannToKg,
  acreToKanal,
  kanalToAcre,
  marlaToAcre,
  KG_PER_MANN,
} from '../units.js';

describe('mann <-> kg', () => {
  it('1 mann = 40 kg', () => {
    expect(mannToKg(1)).toBe(40);
    expect(KG_PER_MANN).toBe(40);
  });
  it('80 kg = 2 mann', () => {
    expect(kgToMann(80)).toBe(2);
  });
  it('round-trip preserves value', () => {
    expect(kgToMann(mannToKg(3.5))).toBe(3.5);
  });
});

describe('kanal <-> acre', () => {
  it('8 kanal = 1 acre', () => {
    expect(kanalToAcre(8)).toBeCloseTo(1, 10);
  });
  it('1 acre = 8 kanal', () => {
    expect(acreToKanal(1)).toBe(8);
  });
  it('round-trip', () => {
    expect(acreToKanal(kanalToAcre(16))).toBeCloseTo(16, 10);
  });
});

describe('marla -> acre', () => {
  it('160 marla = 1 acre (20 marla = 1 kanal, 8 kanal = 1 acre)', () => {
    expect(marlaToAcre(160)).toBeCloseTo(1, 10);
  });
  it('20 marla = 1 kanal = 0.125 acre', () => {
    expect(marlaToAcre(20)).toBeCloseTo(0.125, 10);
  });
});
