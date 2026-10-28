// src/lib/math/nutrition.math.ts
import type { Database } from '@/types/database.types';

export type FoodServingType = Database['public']['Enums']['food_serving_type']; // '100g' | 'unit' | 'both'
export type LoggedUnit = 'g' | 'unit';

export interface MacroValues {
  kcal: number;
  p: number;
  g: number;
  l: number;
}

export interface FoodBaseNutritionalInfo {
  serving_type: FoodServingType;
  unit_weight_g: number;
  kcal_per_base: number;
  proteins_per_base: number;
  carbs_per_base: number;
  fats_per_base: number;
}

/**
 * Arrondit une valeur nutritionnelle à 1 décimale (ex: 24.56 -> 24.6)
 */
export function roundMacro(val: number): number {
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

/**
 * Arrondit une quantité (grammes ou portions décimales) à 2 décimales
 */
export function roundQuantity(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Détermine le facteur multiplicateur par rapport aux valeurs `*_per_base` d'un aliment :
 * - Si serving_type === '100g' : les valeurs de base sont pour 100g -> ratio = quantity / 100
 * - Si serving_type === 'unit' : les valeurs de base sont pour 1 unité -> ratio = quantity
 * - Si serving_type === 'both' : les valeurs de base sont pour 100g :
 *     - si l'utilisateur saisit en 'g' -> ratio = quantity / 100
 *     - si l'utilisateur saisit en 'unit' -> ratio = (quantity * unit_weight_g) / 100
 */
export function computeFoodMultiplier(
  servingType: FoodServingType,
  unitWeightG: number,
  quantityValue: number,
  loggedUnit: LoggedUnit
): number {
  if (quantityValue <= 0) return 0;

  if (servingType === 'unit') {
    return quantityValue;
  }

  if (servingType === 'both' && loggedUnit === 'unit') {
    const effectiveGrams = quantityValue * (unitWeightG > 0 ? unitWeightG : 100);
    return effectiveGrams / 100;
  }

  // Cas '100g' ou 'both' saisi en grammes ('g')
  return quantityValue / 100;
}

/**
 * Calcule les macros exactes (kcal, p, g, l) pour une quantité donnée d'un aliment
 */
export function calculateFoodMacros(
  food: FoodBaseNutritionalInfo,
  quantityValue: number,
  loggedUnit: LoggedUnit = food.serving_type === 'unit' ? 'unit' : 'g'
): MacroValues {
  const ratio = computeFoodMultiplier(
    food.serving_type,
    food.unit_weight_g,
    quantityValue,
    loggedUnit
  );

  return {
    kcal: roundMacro(food.kcal_per_base * ratio),
    p: roundMacro(food.proteins_per_base * ratio),
    g: roundMacro(food.carbs_per_base * ratio),
    l: roundMacro(food.fats_per_base * ratio),
  };
}

/**
 * Divise une quantité totale saisie lors d'un Meal Prep par le nombre de parts (servingsDivisor >= 1)
 * pour obtenir la quantité de référence d'1 portion individuelle.
 */
export function normalizeQuantityPerSingleServing(
  totalQuantity: number,
  servingsDivisor: number
): number {
  const safeDivisor = servingsDivisor > 0 ? servingsDivisor : 1;
  return roundQuantity(totalQuantity / safeDivisor);
}

/**
 * Multiplie la quantité de référence d'1 portion par un nombre de parts décimal (ex: 1.5 part ou 0.5 part)
 * lors de l'ajout d'un plat composé dans le journal quotidien.
 */
export function scaleQuantityByPortions(
  baseSingleServingQuantity: number,
  portionsMultiplier = 1
): number {
  const safeMultiplier = portionsMultiplier > 0 ? portionsMultiplier : 1;
  return roundQuantity(baseSingleServingQuantity * safeMultiplier);
}

/**
 * Additionne une liste d'objets MacroValues (ex: total d'une recette, d'un repas ou d'une journée)
 */
export function sumMacroValues(items: MacroValues[]): MacroValues {
  const raw = items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + (item.kcal || 0),
      p: acc.p + (item.p || 0),
      g: acc.g + (item.g || 0),
      l: acc.l + (item.l || 0),
    }),
    { kcal: 0, p: 0, g: 0, l: 0 }
  );

  return {
    kcal: roundMacro(raw.kcal),
    p: roundMacro(raw.p),
    g: roundMacro(raw.g),
    l: roundMacro(raw.l),
  };
}

