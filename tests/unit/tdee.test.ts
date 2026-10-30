import { describe, it, expect } from 'vitest';
import {
  isDayValidForTdee,
  computeDynamicTdee14Days,
  type DailyTdeePointInput,
} from '@/lib/math/tdee.math';

describe('tdee.math - 14-day Dynamic TDEE Engine', () => {
  describe('isDayValidForTdee', () => {
    it('should return false if day is explicitly excluded', () => {
      const day: DailyTdeePointInput = {
        log_date: '2026-10-15',
        target_kcal: 2000,
        total_consumed_kcal: 2100,
        weight_ema_kg: 80,
        exclude_from_tdee: true,
      };
      expect(isDayValidForTdee(day)).toBe(false);
    });

    it('should return false if consumed kcal is under 50% of target', () => {
      const day: DailyTdeePointInput = {
        log_date: '2026-10-15',
        target_kcal: 2000,
        total_consumed_kcal: 900, // < 1000
        weight_ema_kg: 80,
        exclude_from_tdee: false,
      };
      expect(isDayValidForTdee(day)).toBe(false);
    });

    it('should return true if consumed kcal >= 50% of target and not excluded', () => {
      const day: DailyTdeePointInput = {
        log_date: '2026-10-15',
        target_kcal: 2000,
        total_consumed_kcal: 1000,
        weight_ema_kg: 80,
        exclude_from_tdee: false,
      };
      expect(isDayValidForTdee(day)).toBe(true);
    });
  });

  describe('computeDynamicTdee14Days', () => {
    it('should return calibrating status when valid days < 10', () => {
      const days: DailyTdeePointInput[] = Array.from({ length: 8 }, (_, idx) => ({
        log_date: `2026-10-${String(idx + 1).padStart(2, '0')}`,
        target_kcal: 2000,
        total_consumed_kcal: 2000,
        weight_ema_kg: 80,
        exclude_from_tdee: false,
      }));

      const result = computeDynamicTdee14Days(days, '2026-10-30');
      expect(result.status).toBe('calibrating');
      if (result.status === 'calibrating') {
        expect(result.validNutritionDays).toBe(8);
        expect(result.requiredNutritionDays).toBe(10);
      }
    });

    it('should return calibrating when weight span is insufficient (< 7 days)', () => {
      const days: DailyTdeePointInput[] = Array.from({ length: 12 }, (_, idx) => ({
        log_date: `2026-10-${String(idx + 1).padStart(2, '0')}`,
        target_kcal: 2000,
        total_consumed_kcal: 2000,
        weight_ema_kg: idx < 3 ? 80 : null, // span is only 2 days
        exclude_from_tdee: false,
      }));

      const result = computeDynamicTdee14Days(days, '2026-10-30');
      expect(result.status).toBe('calibrating');
      if (result.status === 'calibrating') {
        expect(result.hasEnoughWeightSpan).toBe(false);
      }
    });

    it('should compute exact TDEE when ready (14 completed days, stable weight)', () => {
      // 14 days, consumed 2500 kcal every day, weight EMA constant at 80kg
      const days: DailyTdeePointInput[] = Array.from({ length: 14 }, (_, idx) => ({
        log_date: `2026-10-${String(idx + 10).padStart(2, '0')}`,
        target_kcal: 2500,
        total_consumed_kcal: 2500,
        weight_ema_kg: 80,
        exclude_from_tdee: false,
      }));

      const result = computeDynamicTdee14Days(days, '2026-10-25');
      expect(result.status).toBe('ready');
      if (result.status === 'ready') {
        expect(result.averageIntakeKcal).toBe(2500);
        expect(result.deltaEma14dKg).toBe(0);
        expect(result.dailyEnergyDeltaKcal).toBe(0);
        expect(result.estimatedTdeeKcal).toBe(2500);
      }
    });

    it('should calculate deficit/surplus correctly when weight changes', () => {
      // Weight decreases by 1kg over 14 days with intake of 2000 kcal/day
      // 1kg lost in 14 days -> deficit of (1 * 7700) / 14 = 550 kcal/day
      // TDEE = intake - dailyEnergyDelta = 2000 - (-550) = 2550 kcal
      const days: DailyTdeePointInput[] = Array.from({ length: 14 }, (_, idx) => ({
        log_date: `2026-10-${String(idx + 10).padStart(2, '0')}`,
        target_kcal: 2000,
        total_consumed_kcal: 2000,
        weight_ema_kg: 80 - (idx * (1 / 13)), // 80kg down to 79kg over 13 days span
        exclude_from_tdee: false,
      }));

      const result = computeDynamicTdee14Days(days, '2026-10-25');
      expect(result.status).toBe('ready');
      if (result.status === 'ready') {
        expect(result.estimatedTdeeKcal).toBeGreaterThan(2000);
      }
    });

    it('should exclude todayIso from intake calculation to avoid noon/dinner skew', () => {
      const days: DailyTdeePointInput[] = [
        ...Array.from({ length: 12 }, (_, idx) => ({
          log_date: `2026-10-${String(idx + 10).padStart(2, '0')}`,
          target_kcal: 2000,
          total_consumed_kcal: 2000,
          weight_ema_kg: 80,
          exclude_from_tdee: false,
        })),
        {
          log_date: '2026-10-22', // today
          target_kcal: 2000,
          total_consumed_kcal: 400, // breakfast only
          weight_ema_kg: 80,
          exclude_from_tdee: false,
        },
      ];

      const result = computeDynamicTdee14Days(days, '2026-10-22');
      expect(result.status).toBe('ready');
      if (result.status === 'ready') {
        // 400 kcal from today should NOT drag down the average
        expect(result.averageIntakeKcal).toBe(2000);
      }
    });
  });
});

