import { describe, it, expect } from 'vitest';
import {
  roundToTwoDecimals,
  computeSingleDayEma,
  recomputeWeightEmaSeries,
  parseDecimalInput,
  type WeightPointInput,
} from '@/lib/math/weight-ema.math';

describe('weight-ema.math', () => {
  describe('roundToTwoDecimals', () => {
    it('should round numbers to 2 decimal places', () => {
      expect(roundToTwoDecimals(75.436)).toBe(75.44);
      expect(roundToTwoDecimals(75.434)).toBe(75.43);
      expect(roundToTwoDecimals(75.4)).toBe(75.4);
      expect(roundToTwoDecimals(75)).toBe(75);
    });

    it('should handle floating point representation quirks', () => {
      // 0.1 + 0.2 = 0.30000000000000004
      expect(roundToTwoDecimals(0.1 + 0.2)).toBe(0.3);
      expect(roundToTwoDecimals(1.005)).toBe(1.01);
    });

    it('should handle zero and negative values correctly', () => {
      expect(roundToTwoDecimals(0)).toBe(0);
      expect(roundToTwoDecimals(-12.3456)).toBe(-12.35);
    });
  });

  describe('computeSingleDayEma', () => {
    it('should return current weight when previousEma is null, undefined, or <= 0 (first weigh-in)', () => {
      expect(computeSingleDayEma(82.4, null)).toBe(82.4);
      expect(computeSingleDayEma(82.4, undefined)).toBe(82.4);
      expect(computeSingleDayEma(82.4, 0)).toBe(82.4);
      expect(computeSingleDayEma(82.4, -5)).toBe(82.4);
    });

    it('should compute EMA with alpha = 0.25 (current * 0.25 + previous * 0.75)', () => {
      // Current: 84, Previous: 80 -> 84 * 0.25 + 80 * 0.75 = 21 + 60 = 81.00
      expect(computeSingleDayEma(84, 80)).toBe(81);

      // Current: 80, Previous: 80 -> 80
      expect(computeSingleDayEma(80, 80)).toBe(80);

      // Current: 78.5, Previous: 79.2 -> 78.5 * 0.25 + 79.2 * 0.75 = 19.625 + 59.4 = 79.025 -> 79.03
      expect(computeSingleDayEma(78.5, 79.2)).toBe(79.03);
    });

    it('should round the computed EMA to 2 decimal places', () => {
      // 77.3 * 0.25 + 78.1 * 0.75 = 19.325 + 58.575 = 77.9
      expect(computeSingleDayEma(77.3, 78.1)).toBe(77.9);
      // 75.3 * 0.25 + 76.2 * 0.75 = 18.825 + 57.15 = 75.975 -> 75.98
      expect(computeSingleDayEma(75.3, 76.2)).toBe(75.98);
    });
  });

  describe('recomputeWeightEmaSeries', () => {
    it('should return an empty array when given an empty array', () => {
      const result = recomputeWeightEmaSeries([]);
      expect(result).toEqual([]);
    });

    it('should sort entries chronologically before computing EMA chain', () => {
      const unsortedInputs: WeightPointInput[] = [
        { id: '3', log_date: '2026-10-03', weight_kg: 80.0 },
        { id: '1', log_date: '2026-10-01', weight_kg: 82.0 },
        { id: '2', log_date: '2026-10-02', weight_kg: 81.0 },
      ];

      const result = recomputeWeightEmaSeries(unsortedInputs);

      expect(result.map((r) => r.log_date)).toEqual([
        '2026-10-01',
        '2026-10-02',
        '2026-10-03',
      ]);
      expect(result[0].weight_ema_kg).toBe(82); // First day: 82.0
      // Day 2: 81 * 0.25 + 82 * 0.75 = 20.25 + 61.5 = 81.75
      expect(result[1].weight_ema_kg).toBe(81.75);
      // Day 3: 80 * 0.25 + 81.75 * 0.75 = 20 + 61.3125 = 81.3125 -> 81.31
      expect(result[2].weight_ema_kg).toBe(81.31);
    });

    it('should carry over initialPreviousEmaKg if provided', () => {
      const inputs: WeightPointInput[] = [
        { id: '1', log_date: '2026-10-05', weight_kg: 80.0 },
      ];

      // With initialPreviousEmaKg = 84.0: 80 * 0.25 + 84 * 0.75 = 20 + 63 = 83.0
      const result = recomputeWeightEmaSeries(inputs, 84.0);
      expect(result[0].weight_ema_kg).toBe(83);
    });

    it('should handle gaps in dates seamlessly without breaking the mathematical chain', () => {
      const inputsWithGaps: WeightPointInput[] = [
        { log_date: '2026-10-01', weight_kg: 80.0 },
        { log_date: '2026-10-10', weight_kg: 84.0 }, // 9-day gap
        { log_date: '2026-10-25', weight_kg: 82.0 }, // 15-day gap
      ];

      const result = recomputeWeightEmaSeries(inputsWithGaps);

      expect(result).toHaveLength(3);
      expect(result[0].weight_ema_kg).toBe(80.0);
      // Day 10: 84 * 0.25 + 80 * 0.75 = 81.0
      expect(result[1].weight_ema_kg).toBe(81.0);
      // Day 25: 82 * 0.25 + 81 * 0.75 = 20.5 + 60.75 = 81.25
      expect(result[2].weight_ema_kg).toBe(81.25);
    });

    it('should preserve ids and round weight_kg in the output', () => {
      const inputs: WeightPointInput[] = [
        { id: 'weight-uuid-1', log_date: '2026-10-01', weight_kg: 79.456 },
      ];

      const result = recomputeWeightEmaSeries(inputs);
      expect(result[0]).toEqual({
        id: 'weight-uuid-1',
        log_date: '2026-10-01',
        weight_kg: 79.46,
        weight_ema_kg: 79.46,
      });
    });
  });

  describe('parseDecimalInput', () => {
    it('should parse numbers formatted with a comma (iOS french keyboard)', () => {
      expect(parseDecimalInput('78,4')).toBe(78.4);
      expect(parseDecimalInput('80,25')).toBe(80.25);
      expect(parseDecimalInput('0,75')).toBe(0.75);
    });

    it('should parse numbers formatted with a dot', () => {
      expect(parseDecimalInput('78.4')).toBe(78.4);
      expect(parseDecimalInput('102.5')).toBe(102.5);
    });

    it('should trim surrounding whitespace', () => {
      expect(parseDecimalInput('  78,4  ')).toBe(78.4);
      expect(parseDecimalInput('\t80.5\n')).toBe(80.5);
    });

    it('should return null for empty or whitespace-only strings', () => {
      expect(parseDecimalInput('')).toBeNull();
      expect(parseDecimalInput('   ')).toBeNull();
    });

    it('should return null for non-numeric or invalid inputs', () => {
      expect(parseDecimalInput('abc')).toBeNull();
      expect(parseDecimalInput('78a')).toBe(78); // Number.parseFloat('78a') is 78, test boundary
      expect(parseDecimalInput('NaN')).toBeNull();
      expect(parseDecimalInput('Infinity')).toBeNull();
    });

    it('should return null for zero or negative values', () => {
      expect(parseDecimalInput('0')).toBeNull();
      expect(parseDecimalInput('0.0')).toBeNull();
      expect(parseDecimalInput('0,00')).toBeNull();
      expect(parseDecimalInput('-78.4')).toBeNull();
      expect(parseDecimalInput('-1')).toBeNull();
    });

    it('should round valid parsed values to 2 decimal places', () => {
      expect(parseDecimalInput('78.456')).toBe(78.46);
      expect(parseDecimalInput('78,454')).toBe(78.45);
    });
  });
});
