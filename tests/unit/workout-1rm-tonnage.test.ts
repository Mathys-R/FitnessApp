import { describe, it, expect } from 'vitest';
import {
  computeEpley1Rm,
  isSetPersonalRecord,
  computeEffectiveTonnage,
  type SetCalcInput,
} from '@/lib/math/workout-kpis.math';

describe('workout-kpis.math - 1RM Epley, Records & Tonnage', () => {
  describe('computeEpley1Rm', () => {
    it('should calculate 1RM using the Epley formula: Weight * (1 + Reps / 30)', () => {
      expect(computeEpley1Rm(100, 10)).toBe(133.33);
      expect(computeEpley1Rm(100, 1)).toBe(103.33);
      expect(computeEpley1Rm(80, 6)).toBe(96);
      expect(computeEpley1Rm(120, 30)).toBe(240);
    });

    it('should return 0 when isWarmup is true', () => {
      expect(computeEpley1Rm(100, 10, true)).toBe(0);
      expect(computeEpley1Rm(140, 5, true)).toBe(0);
    });

    it('should return 0 when reps <= 0 or weightKg <= 0', () => {
      expect(computeEpley1Rm(100, 0)).toBe(0);
      expect(computeEpley1Rm(100, -3)).toBe(0);
      expect(computeEpley1Rm(0, 10)).toBe(0);
      expect(computeEpley1Rm(-50, 10)).toBe(0);
    });
  });

  describe('isSetPersonalRecord', () => {
    const historicalMaxWeight = 100;
    const historicalMax1Rm = 120;

    it('should be a PR when weight exceeds referenceMaxWeightKg', () => {
      const set: SetCalcInput = {
        weight_kg: 105,
        reps: 1,
        is_warmup: false,
        is_completed: true,
      };
      expect(isSetPersonalRecord(set, historicalMaxWeight, historicalMax1Rm)).toBe(true);
    });

    it('should be a PR when 1RM exceeds referenceMax1RmKg even if weight is lower', () => {
      const set: SetCalcInput = {
        weight_kg: 95,
        reps: 10, // 1RM = 95 * (1 + 10/30) = 126.67 > 120
        is_warmup: false,
        is_completed: true,
      };
      expect(isSetPersonalRecord(set, historicalMaxWeight, historicalMax1Rm)).toBe(true);
    });

    it('should not be a PR when neither weight nor 1RM exceed references', () => {
      const set: SetCalcInput = {
        weight_kg: 90,
        reps: 5,
        is_warmup: false,
        is_completed: true,
      };
      expect(isSetPersonalRecord(set, historicalMaxWeight, historicalMax1Rm)).toBe(false);
    });

    it('should not be a PR when values exactly match the references', () => {
      const setExactWeight: SetCalcInput = {
        weight_kg: 100,
        reps: 1,
        is_warmup: false,
        is_completed: true,
      };
      expect(isSetPersonalRecord(setExactWeight, historicalMaxWeight, historicalMax1Rm)).toBe(false);
    });

    it('should return false if set is a warmup or not completed', () => {
      expect(
        isSetPersonalRecord(
          { weight_kg: 150, reps: 15, is_warmup: true, is_completed: true },
          historicalMaxWeight,
          historicalMax1Rm
        )
      ).toBe(false);

      expect(
        isSetPersonalRecord(
          { weight_kg: 150, reps: 15, is_warmup: false, is_completed: false },
          historicalMaxWeight,
          historicalMax1Rm
        )
      ).toBe(false);
    });
  });

  describe('computeEffectiveTonnage', () => {
    it('should compute the sum of weight * reps for effective sets only', () => {
      const sets: SetCalcInput[] = [
        { weight_kg: 100, reps: 10, is_warmup: false, is_completed: true }, // 1000
        { weight_kg: 100, reps: 8, is_warmup: false, is_completed: true },  // 800
        { weight_kg: 90, reps: 10, is_warmup: false, is_completed: true },  // 900
      ];
      expect(computeEffectiveTonnage(sets)).toBe(2700);
    });

    it('should exclude warmup sets and uncompleted sets', () => {
      const sets: SetCalcInput[] = [
        { weight_kg: 60, reps: 10, is_warmup: true, is_completed: true },
        { weight_kg: 100, reps: 5, is_warmup: false, is_completed: false },
        { weight_kg: 100, reps: 5, is_warmup: false, is_completed: true },
      ];
      expect(computeEffectiveTonnage(sets)).toBe(500);
    });

    it('should exclude sets with zero or negative weight/reps', () => {
      const sets: SetCalcInput[] = [
        { weight_kg: 0, reps: 10, is_warmup: false, is_completed: true },
        { weight_kg: 80, reps: 0, is_warmup: false, is_completed: true },
        { weight_kg: -50, reps: 10, is_warmup: false, is_completed: true },
        { weight_kg: 50, reps: 6, is_warmup: false, is_completed: true },
      ];
      expect(computeEffectiveTonnage(sets)).toBe(300);
    });

    it('should return 0 when array is empty and round tonnage to 1 decimal place', () => {
      expect(computeEffectiveTonnage([])).toBe(0);
      const sets: SetCalcInput[] = [
        { weight_kg: 22.5, reps: 7, is_warmup: false, is_completed: true },
      ];
      expect(computeEffectiveTonnage(sets)).toBe(157.5);
    });
  });
});

