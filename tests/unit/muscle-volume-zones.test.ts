// tests/unit/muscle-volume-zones.test.ts
import { describe, it, expect } from 'vitest';
import {
  OPTIMAL_WEEKLY_SETS_MIN,
  OPTIMAL_WEEKLY_SETS_MAX,
  MIN_VOLUME_SCALE_MAX,
  classifyWeeklyVolume,
  computeVolumeScaleMax,
  toBarPercent,
} from '@/lib/math/muscle-volume-zones.math';

describe('muscle-volume-zones.math (Couche 1)', () => {
  it('expose les bornes de la zone optimale 10–20 et une échelle min de 24', () => {
    expect(OPTIMAL_WEEKLY_SETS_MIN).toBe(10);
    expect(OPTIMAL_WEEKLY_SETS_MAX).toBe(20);
    expect(MIN_VOLUME_SCALE_MAX).toBe(24);
  });

  describe('classifyWeeklyVolume', () => {
    it.each([
      [0, 'below'],
      [9.5, 'below'],
      [9.999, 'below'],
      [10, 'optimal'],
      [15, 'optimal'],
      [20, 'optimal'],
      [20.5, 'above'],
      [20.0001, 'above'],
      [100, 'above'],
    ] as const)('%s séries → %s', (sets, zone) => {
      expect(classifyWeeklyVolume(sets)).toBe(zone);
    });

    it('valeurs négatives → below', () => {
      expect(classifyWeeklyVolume(-1)).toBe('below');
      expect(classifyWeeklyVolume(-Infinity)).toBe('below');
    });

    it('Infinity → above', () => {
      expect(classifyWeeklyVolume(Infinity)).toBe('above');
    });

    it('NaN est classé below', () => {
      expect(classifyWeeklyVolume(Number.NaN)).toBe('below');
    });
  });

  describe('computeVolumeScaleMax', () => {
    it('[] → 24', () => {
      expect(computeVolumeScaleMax([])).toBe(24);
    });

    it('toutes valeurs <= 24 → 24', () => {
      expect(computeVolumeScaleMax([0, 4, 6, 2, 24])).toBe(24);
    });

    it('max > 24 → ceil(max)', () => {
      expect(computeVolumeScaleMax([3, 24.5, 10])).toBe(25);
      expect(computeVolumeScaleMax([30])).toBe(30);
      expect(computeVolumeScaleMax([30.1])).toBe(31);
    });

    it('ignore NaN / Infinity / -Infinity', () => {
      expect(computeVolumeScaleMax([Number.NaN, Infinity, -Infinity])).toBe(24);
      expect(computeVolumeScaleMax([Number.NaN, 27.2, Infinity])).toBe(28);
    });

    it('valeurs négatives → 24', () => {
      expect(computeVolumeScaleMax([-5, -100])).toBe(24);
    });
  });

  describe('toBarPercent', () => {
    it('proportion simple', () => {
      expect(toBarPercent(12, 24)).toBe(50);
      expect(toBarPercent(0, 24)).toBe(0);
      expect(toBarPercent(24, 24)).toBe(100);
    });

    it('borne à 100 au-delà de l’échelle', () => {
      expect(toBarPercent(48, 24)).toBe(100);
    });

    it('borne à 0 pour une valeur négative', () => {
      expect(toBarPercent(-3, 24)).toBe(0);
    });

    it('scaleMax <= 0 → 0', () => {
      expect(toBarPercent(10, 0)).toBe(0);
      expect(toBarPercent(10, -24)).toBe(0);
    });

    it('valeurs non finies → 0', () => {
      expect(toBarPercent(Number.NaN, 24)).toBe(0);
      expect(toBarPercent(Infinity, 24)).toBe(0);
      expect(toBarPercent(10, Number.NaN)).toBe(0);
      expect(toBarPercent(10, Infinity)).toBe(0);
    });

    it('positionne la bande optimale 10–20 sur une échelle de 24', () => {
      const left = toBarPercent(10, 24);
      const right = toBarPercent(20, 24);
      expect(left).toBeCloseTo(41.667, 2);
      expect(right - left).toBeCloseTo(41.667, 2);
    });
  });
});
