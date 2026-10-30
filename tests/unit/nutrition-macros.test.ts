import { describe, it, expect } from 'vitest';
import {
  roundMacro,
  roundQuantity,
  computeFoodMultiplier,
  calculateFoodMacros,
  type FoodBaseNutritionalInfo,
} from '@/lib/math/nutrition.math';

describe('nutrition.math - macros & multipliers', () => {
  describe('roundMacro & roundQuantity', () => {
    it('should round macro values to 1 decimal place', () => {
      expect(roundMacro(24.56)).toBe(24.6);
      expect(roundMacro(24.54)).toBe(24.5);
      expect(roundMacro(24.0)).toBe(24);
      expect(roundMacro(0)).toBe(0);
      expect(roundMacro(-5.55)).toBe(-5.5);
    });

    it('should handle floating point representation inaccuracies', () => {
      expect(roundMacro(0.1 + 0.2)).toBe(0.3);
      expect(roundMacro(1.05)).toBe(1.1);
    });

    it('should round quantities to 2 decimal places', () => {
      expect(roundQuantity(12.345)).toBe(12.35);
      expect(roundQuantity(12.344)).toBe(12.34);
      expect(roundQuantity(100)).toBe(100);
      expect(roundQuantity(0)).toBe(0);
    });
  });

  describe('computeFoodMultiplier', () => {
    describe('when serving_type is "100g"', () => {
      it('should return quantityValue / 100', () => {
        expect(computeFoodMultiplier('100g', 0, 150, 'g')).toBe(1.5);
        expect(computeFoodMultiplier('100g', 0, 100, 'g')).toBe(1.0);
        expect(computeFoodMultiplier('100g', 0, 50, 'g')).toBe(0.5);
        expect(computeFoodMultiplier('100g', 0, 25, 'g')).toBe(0.25);
      });

      it('should return 0 when quantityValue <= 0', () => {
        expect(computeFoodMultiplier('100g', 0, 0, 'g')).toBe(0);
        expect(computeFoodMultiplier('100g', 0, -50, 'g')).toBe(0);
      });
    });

    describe('when serving_type is "unit"', () => {
      it('should return quantityValue directly regardless of unitWeightG', () => {
        expect(computeFoodMultiplier('unit', 0, 2, 'unit')).toBe(2);
        expect(computeFoodMultiplier('unit', 50, 1.5, 'unit')).toBe(1.5);
        expect(computeFoodMultiplier('unit', 100, 0.5, 'unit')).toBe(0.5);
      });

      it('should return 0 when quantityValue <= 0', () => {
        expect(computeFoodMultiplier('unit', 50, 0, 'unit')).toBe(0);
        expect(computeFoodMultiplier('unit', 50, -1, 'unit')).toBe(0);
      });
    });

    describe('when serving_type is "both"', () => {
      it('should return quantityValue / 100 when logged in grams ("g")', () => {
        expect(computeFoodMultiplier('both', 60, 250, 'g')).toBe(2.5);
        expect(computeFoodMultiplier('both', 60, 100, 'g')).toBe(1.0);
      });

      it('should return (quantityValue * unitWeightG) / 100 when logged in units ("unit")', () => {
        expect(computeFoodMultiplier('both', 60, 2, 'unit')).toBe(1.2);
        expect(computeFoodMultiplier('both', 55, 1, 'unit')).toBe(0.55);
      });

      it('should fallback to unitWeightG = 100 when unitWeightG <= 0 and logged in units', () => {
        expect(computeFoodMultiplier('both', 0, 2, 'unit')).toBe(2);
        expect(computeFoodMultiplier('both', -10, 3, 'unit')).toBe(3);
      });

      it('should return 0 when quantityValue <= 0', () => {
        expect(computeFoodMultiplier('both', 60, 0, 'unit')).toBe(0);
        expect(computeFoodMultiplier('both', 60, -2, 'g')).toBe(0);
      });
    });
  });

  describe('calculateFoodMacros', () => {
    it('should compute macros for a 100g base food logged in grams', () => {
      const chickenBreast: FoodBaseNutritionalInfo = {
        serving_type: '100g',
        unit_weight_g: 0,
        kcal_per_base: 120,
        proteins_per_base: 26,
        carbs_per_base: 0,
        fats_per_base: 1.8,
      };

      const macros = calculateFoodMacros(chickenBreast, 150, 'g');
      expect(macros).toEqual({
        kcal: 180,
        p: 39,
        g: 0,
        l: 2.7,
      });
    });

    it('should compute macros for a unit base food', () => {
      const proteinBar: FoodBaseNutritionalInfo = {
        serving_type: 'unit',
        unit_weight_g: 60,
        kcal_per_base: 210,
        proteins_per_base: 20,
        carbs_per_base: 22.4,
        fats_per_base: 6.2,
      };

      const macros = calculateFoodMacros(proteinBar, 1.5, 'unit');
      expect(macros).toEqual({
        kcal: 315,
        p: 30,
        g: 33.6,
        l: 9.3,
      });
    });

    it('should compute macros for a "both" food logged in units', () => {
      const wholeEgg: FoodBaseNutritionalInfo = {
        serving_type: 'both',
        unit_weight_g: 60,
        kcal_per_base: 143,
        proteins_per_base: 13,
        carbs_per_base: 0.7,
        fats_per_base: 9.5,
      };

      const macros = calculateFoodMacros(wholeEgg, 2, 'unit');
      expect(macros).toEqual({
        kcal: 171.6,
        p: 15.6,
        g: 0.8,
        l: 11.4,
      });
    });

    it('should use default loggedUnit depending on serving_type when omitted', () => {
      const unitFood: FoodBaseNutritionalInfo = {
        serving_type: 'unit',
        unit_weight_g: 50,
        kcal_per_base: 100,
        proteins_per_base: 10,
        carbs_per_base: 10,
        fats_per_base: 2,
      };
      expect(calculateFoodMacros(unitFood, 2)).toEqual({
        kcal: 200,
        p: 20,
        g: 20,
        l: 4,
      });

      const hundredGFood: FoodBaseNutritionalInfo = {
        serving_type: '100g',
        unit_weight_g: 0,
        kcal_per_base: 100,
        proteins_per_base: 10,
        carbs_per_base: 10,
        fats_per_base: 2,
      };
      expect(calculateFoodMacros(hundredGFood, 200)).toEqual({
        kcal: 200,
        p: 20,
        g: 20,
        l: 4,
      });
    });

    it('should return all zeros when quantity is 0', () => {
      const food: FoodBaseNutritionalInfo = {
        serving_type: '100g',
        unit_weight_g: 0,
        kcal_per_base: 350,
        proteins_per_base: 20,
        carbs_per_base: 50,
        fats_per_base: 8,
      };
      expect(calculateFoodMacros(food, 0)).toEqual({
        kcal: 0,
        p: 0,
        g: 0,
        l: 0,
      });
    });
  });
});

