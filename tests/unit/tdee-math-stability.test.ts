import { describe, it, expect } from 'vitest';
import {
  isDayValidForTdee,
  computeDynamicTdee14Days,
  type DailyTdeePointInput,
} from '@/lib/math/tdee.math';

/** Fabrique une journée 'YYYY-MM-DD' à partir d'un offset depuis 2026-10-01. */
const isoFrom = (offset: number): string => {
  const d = new Date(Date.UTC(2026, 9, 1 + offset));
  return d.toISOString().slice(0, 10);
};

const day = (offset: number, over: Partial<DailyTdeePointInput> = {}): DailyTdeePointInput => ({
  log_date: isoFrom(offset),
  target_kcal: 2000,
  total_consumed_kcal: 2000,
  weight_ema_kg: 80,
  exclude_from_tdee: false,
  ...over,
});

/** 14 jours révolus (offsets 0..13) + aujourd'hui = offset 14. */
const TODAY = isoFrom(14);
const window14 = (
  mapper: (i: number) => Partial<DailyTdeePointInput> = () => ({})
): DailyTdeePointInput[] => Array.from({ length: 14 }, (_, i) => day(i, mapper(i)));

describe('tdee.math - stabilité & checklist spec Phase 6', () => {
  describe('isDayValidForTdee - seuil 50 %', () => {
    it('exactement 50 % de la cible -> valide ; juste en dessous -> invalide', () => {
      expect(isDayValidForTdee(day(0, { target_kcal: 2400, total_consumed_kcal: 1200 }))).toBe(true);
      expect(isDayValidForTdee(day(0, { target_kcal: 2400, total_consumed_kcal: 1199.9 }))).toBe(false);
    });

    it('exclude_from_tdee prime même si la journée est complète', () => {
      expect(isDayValidForTdee(day(0, { total_consumed_kcal: 5000, exclude_from_tdee: true }))).toBe(false);
    });

    it('target_kcal à 0 -> repli sur 2000 (seuil 1000)', () => {
      expect(isDayValidForTdee(day(0, { target_kcal: 0, total_consumed_kcal: 999 }))).toBe(false);
      expect(isDayValidForTdee(day(0, { target_kcal: 0, total_consumed_kcal: 1000 }))).toBe(true);
    });
  });

  describe('journée J exclue', () => {
    it('J incomplète n’est comptée ni dans la moyenne ni dans excludedDaysCount', () => {
      const days = [...window14(), day(14, { total_consumed_kcal: 300 })];
      const r = computeDynamicTdee14Days(days, TODAY);
      expect(r.status).toBe('ready');
      if (r.status !== 'ready') return;
      expect(r.averageIntakeKcal).toBe(2000);
      expect(r.excludedDaysCount).toBe(0);
      expect(r.validNutritionDays).toBe(14);
    });

    it('J excluse manuellement n’est pas comptée dans excludedDaysCount (calibrating)', () => {
      const days = [day(0), day(1), day(14, { exclude_from_tdee: true, total_consumed_kcal: 0 })];
      const r = computeDynamicTdee14Days(days, TODAY);
      expect(r.status).toBe('calibrating');
      expect(r.excludedDaysCount).toBe(0);
      expect(r.validNutritionDays).toBe(2);
    });

    it('J très gourmande ne gonfle pas la moyenne', () => {
      const days = [...window14(), day(14, { total_consumed_kcal: 6000 })];
      const r = computeDynamicTdee14Days(days, TODAY);
      expect(r.status === 'ready' && r.averageIntakeKcal).toBe(2000);
    });

    it('la pesée EMA du matin J compte pour l’écart de poids', () => {
      // Seules pesées : J-7 et J -> écart = 7 jours -> span suffisant
      const days = [
        ...window14((i) => ({ weight_ema_kg: i === 7 ? 80 : null })),
        day(14, { weight_ema_kg: 79.5, total_consumed_kcal: 0 }),
      ];
      const r = computeDynamicTdee14Days(days, TODAY);
      expect(r.status).toBe('ready');
    });
  });

  describe('jours passés exclus', () => {
    it('<50 % et exclude_from_tdee sont exclus de la moyenne et comptés', () => {
      const days = window14((i) => {
        if (i === 2) return { total_consumed_kcal: 500 }; // < 50 %
        if (i === 5) return { exclude_from_tdee: true, total_consumed_kcal: 4000 };
        return { total_consumed_kcal: 2200 };
      });
      const r = computeDynamicTdee14Days(days, TODAY);
      expect(r.status).toBe('ready');
      if (r.status !== 'ready') return;
      expect(r.validNutritionDays).toBe(12);
      expect(r.excludedDaysCount).toBe(2);
      expect(r.averageIntakeKcal).toBe(2200);
    });
  });

  describe('seuils de calibration', () => {
    it('9 jours valides -> calibrating ; 10 -> ready', () => {
      const nine = window14((i) => (i < 5 ? { exclude_from_tdee: true } : {}));
      const r9 = computeDynamicTdee14Days(nine, TODAY);
      expect(r9.status).toBe('calibrating');
      if (r9.status === 'calibrating') {
        expect(r9.validNutritionDays).toBe(9);
        expect(r9.requiredNutritionDays).toBe(10);
        expect(r9.excludedDaysCount).toBe(5);
        expect(r9.hasEnoughWeightSpan).toBe(true);
      }
      const ten = window14((i) => (i < 4 ? { exclude_from_tdee: true } : {}));
      expect(computeDynamicTdee14Days(ten, TODAY).status).toBe('ready');
    });

    it('une seule pesée -> hasEnoughWeightSpan false', () => {
      const days = window14((i) => ({ weight_ema_kg: i === 3 ? 80 : null }));
      const r = computeDynamicTdee14Days(days, TODAY);
      expect(r.status).toBe('calibrating');
      if (r.status === 'calibrating') expect(r.hasEnoughWeightSpan).toBe(false);
    });

    it('2 pesées à 6 jours -> calibrating ; à exactement 7 jours -> ready', () => {
      const six = window14((i) => ({ weight_ema_kg: i === 2 || i === 8 ? 80 : null }));
      const r6 = computeDynamicTdee14Days(six, TODAY);
      expect(r6.status).toBe('calibrating');
      if (r6.status === 'calibrating') expect(r6.hasEnoughWeightSpan).toBe(false);

      const seven = window14((i) => ({ weight_ema_kg: i === 2 || i === 9 ? 80 : null }));
      expect(computeDynamicTdee14Days(seven, TODAY).status).toBe('ready');
    });

    it('pesées EMA à 0 ignorées', () => {
      const days = window14((i) => ({ weight_ema_kg: i === 0 ? 0 : i === 13 ? 80 : null }));
      const r = computeDynamicTdee14Days(days, TODAY);
      expect(r.status).toBe('calibrating');
      if (r.status === 'calibrating') expect(r.hasEnoughWeightSpan).toBe(false);
    });
  });

  describe('formule 7700 / 14', () => {
    it('perte de 1 kg sur 14 jours d’écart -> -550 kcal/j, TDEE = moyenne + 550', () => {
      // Pesées J-14 (offset 0) et J (offset 14) : écart 14 j, delta -1 kg
      const days = [
        ...window14((i) => ({ weight_ema_kg: i === 0 ? 80 : null, total_consumed_kcal: 2000 })),
        day(14, { weight_ema_kg: 79, total_consumed_kcal: 0 }),
      ];
      const r = computeDynamicTdee14Days(days, TODAY);
      expect(r.status).toBe('ready');
      if (r.status !== 'ready') return;
      expect(r.deltaEma14dKg).toBe(-1);
      expect(r.dailyEnergyDeltaKcal).toBe(-550);
      expect(r.estimatedTdeeKcal).toBe(2550);
      expect(r.averageIntakeKcal).toBe(2000);
    });

    it('prise de 0,5 kg sur 7 jours normalisée à +1 kg / 14 j -> +550 kcal/j', () => {
      const days = window14((i) => ({
        weight_ema_kg: i === 6 ? 80 : i === 13 ? 80.5 : null,
        total_consumed_kcal: 3000,
        target_kcal: 3000,
      }));
      const r = computeDynamicTdee14Days(days, TODAY);
      expect(r.status).toBe('ready');
      if (r.status !== 'ready') return;
      expect(r.deltaEma14dKg).toBe(1);
      expect(r.dailyEnergyDeltaKcal).toBe(550);
      expect(r.estimatedTdeeKcal).toBe(2450);
    });

    it('delta EMA arrondi à 2 décimales', () => {
      // -0.3 kg sur 9 jours -> normalisé -0.4666… -> -0.47
      const days = window14((i) => ({ weight_ema_kg: i === 4 ? 80 : i === 13 ? 79.7 : null }));
      const r = computeDynamicTdee14Days(days, TODAY);
      expect(r.status).toBe('ready');
      if (r.status !== 'ready') return;
      expect(r.deltaEma14dKg).toBe(-0.47);
      // dailyEnergyDelta calculé sur la valeur non arrondie : -0.4666…*7700/14 = -256.67 -> -257
      expect(r.dailyEnergyDeltaKcal).toBe(-257);
      expect(r.estimatedTdeeKcal).toBe(2257);
    });
  });

  describe('robustesse', () => {
    it('ordre d’entrée indifférent', () => {
      const days = [
        ...window14((i) => ({ weight_ema_kg: i === 0 ? 80 : i === 13 ? 79 : null })),
      ];
      const shuffled = [...days].reverse();
      expect(computeDynamicTdee14Days(shuffled, TODAY)).toEqual(computeDynamicTdee14Days(days, TODAY));
    });

    it('fenêtre vide -> calibrating 0/10, aucun NaN', () => {
      const r = computeDynamicTdee14Days([], TODAY);
      expect(r).toEqual({
        status: 'calibrating',
        validNutritionDays: 0,
        requiredNutritionDays: 10,
        hasEnoughWeightSpan: false,
        excludedDaysCount: 0,
      });
    });

    it('n’altère pas le tableau d’entrée', () => {
      const days = window14().reverse();
      const snapshot = JSON.stringify(days);
      computeDynamicTdee14Days(days, TODAY);
      expect(JSON.stringify(days)).toBe(snapshot);
    });
  });
});
