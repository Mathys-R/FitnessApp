import { describe, it, expect } from 'vitest';
import {
  normalizeQuantityPerSingleServing,
  scaleQuantityByPortions,
  sumMacroValues,
  type MacroValues,
} from '@/lib/math/nutrition.math';

describe('nutrition.math - portions & meal prep', () => {
  describe('normalizeQuantityPerSingleServing', () => {
    it('should divide totalQuantity by servingsDivisor and round to 2 decimals', () => {
      expect(normalizeQuantityPerSingleServing(1000, 4)).toBe(250);
      expect(normalizeQuantityPerSingleServing(750, 3)).toBe(250);
      expect(normalizeQuantityPerSingleServing(1000, 3)).toBe(333.33);
      expect(normalizeQuantityPerSingleServing(500, 6)).toBe(83.33);
    });

    it('should default divisor to 1 when servingsDivisor <= 0', () => {
      expect(normalizeQuantityPerSingleServing(300, 0)).toBe(300);
      expect(normalizeQuantityPerSingleServing(300, -2)).toBe(300);
    });
  });

  describe('scaleQuantityByPortions', () => {
    it('should multiply base quantity by portionsMultiplier and round to 2 decimals', () => {
      expect(scaleQuantityByPortions(250, 1.5)).toBe(375);
      expect(scaleQuantityByPortions(200, 0.5)).toBe(100);
      expect(scaleQuantityByPortions(333.33, 0.75)).toBe(250);
    });

    it('should default to multiplier 1 when omitted or <= 0', () => {
      expect(scaleQuantityByPortions(250)).toBe(250);
      expect(scaleQuantityByPortions(250, 0)).toBe(250);
      expect(scaleQuantityByPortions(250, -1.5)).toBe(250);
    });
  });

  describe('sumMacroValues', () => {
    it('should aggregate an array of MacroValues and round each macro to 1 decimal', () => {
      const items: MacroValues[] = [
        { kcal: 350.4, p: 30.2, g: 40.5, l: 8.1 },
        { kcal: 200.2, p: 15.6, g: 10.3, l: 5.4 },
        { kcal: 150.1, p: 5.1, g: 25.1, l: 1.2 },
      ];

      const total = sumMacroValues(items);

      expect(total).toEqual({
        kcal: 700.7,
        p: 50.9,
        g: 75.9,
        l: 14.7,
      });
    });

    it('should return all zeros for an empty array', () => {
      expect(sumMacroValues([])).toEqual({
        kcal: 0,
        p: 0,
        g: 0,
        l: 0,
      });
    });

    it('should safely handle partial or missing fields', () => {
      const items: Partial<MacroValues>[] = [
        { kcal: 100, p: 10 },
        { g: 20, l: 5 },
      ];

      expect(sumMacroValues(items as MacroValues[])).toEqual({
        kcal: 100,
        p: 10,
        g: 20,
        l: 5,
      });
    });
  });
});

