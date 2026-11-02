// tests/unit/format-utils.test.ts
import { describe, it, expect } from 'vitest';
import { formatKcal, formatKg, formatSignedKg } from '@/lib/format.utils';

const norm = (s: string) => s.replace(/[  ]/g, ' ');

describe('formatKg', () => {
  it('virgule décimale fr-FR, maxDigits respecté', () => {
    expect(formatKg(82.46, 1)).toBe('82,5');
    expect(formatKg(82.456, 2)).toBe('82,46');
    expect(formatKg(80, 1)).toBe('80');
  });
  it('minDigits force les décimales', () => {
    expect(formatKg(80, 1, 1)).toBe('80,0');
  });
  it('séparateur de milliers fr-FR', () => {
    expect(norm(formatKg(12500, 1))).toBe('12 500');
  });
});

describe('formatSignedKg', () => {
  it('« + » explicite si > 0', () => {
    expect(formatSignedKg(0.5, 1)).toBe('+0,5');
    expect(formatSignedKg(1.234, 2)).toBe('+1,23');
  });
  it('signe moins ASCII si < 0', () => {
    expect(formatSignedKg(-0.45, 2)).toBe('-0,45');
    expect(formatSignedKg(-1.2, 1, 1)).toBe('-1,2');
    expect(formatSignedKg(-1.2, 1)).not.toContain('−');
  });
  it('zéro (y compris arrondi et -0) sans signe', () => {
    expect(formatSignedKg(0, 2)).toBe('0');
    expect(formatSignedKg(-0, 2)).toBe('0');
    expect(formatSignedKg(-0.004, 2)).toBe('0');
    expect(formatSignedKg(0.04, 1, 1)).toBe('0,0');
  });
  it('valeur non finie → zéro neutre', () => {
    expect(formatSignedKg(Number.NaN, 1)).toBe('0');
  });
});

describe('formatKcal', () => {
  it('arrondi à l’unité avec milliers fr-FR', () => {
    expect(norm(formatKcal(2499.6))).toBe('2 500');
    expect(formatKcal(0)).toBe('0');
  });
});
