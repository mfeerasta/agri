import { describe, it, expect } from 'vitest';
import {
  toHijri,
  assertKebabCase,
  containsEmDash,
  stripEmDashes,
} from '../utilities.js';

describe('toHijri', () => {
  it('returns Hijri parts for a known date', () => {
    // 2024-04-09 falls in Shawwal 1445 in Umm al-Qura.
    const h = toHijri(new Date('2024-04-09T00:00:00Z'));
    expect(h.year).toBe(1445);
    expect(h.month).toBe(10);
    expect(h.monthNameEn).toBe('Shawwal');
    expect(h.monthNameUr).toMatch(/شوال/);
  });
});

describe('assertKebabCase', () => {
  it('throws on snake_case', () => {
    expect(() => assertKebabCase('my_file.ts')).toThrow(/kebab-case/);
  });
  it('accepts kebab-case', () => {
    expect(() => assertKebabCase('my-file.ts')).not.toThrow();
  });
});

describe('em-dash helpers', () => {
  it('containsEmDash detects em-dash', () => {
    expect(containsEmDash('foo — bar')).toBe(true);
  });
  it('containsEmDash false on plain text', () => {
    expect(containsEmDash('foo - bar')).toBe(false);
  });
  it('stripEmDashes replaces em-dash with comma+space', () => {
    expect(stripEmDashes('foo — bar')).toBe('foo, bar');
  });
  it('stripEmDashes replaces en-dash too', () => {
    expect(stripEmDashes('foo – bar')).toBe('foo, bar');
  });
});
