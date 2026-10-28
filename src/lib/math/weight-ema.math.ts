// src/lib/math/weight-ema.math.ts

export interface WeightPointInput {
  id?: string;
  log_date: string; // Format 'YYYY-MM-DD'
  weight_kg: number;
  weight_ema_kg?: number | null;
}

export interface WeightPointComputed {
  id?: string;
  log_date: string;
  weight_kg: number;
  weight_ema_kg: number;
}

const EMA_PERIOD_DAYS = 7;
const EMA_ALPHA = 2 / (EMA_PERIOD_DAYS + 1); // 0.25

/**
 * Arrondit un nombre à 2 décimales (ex: 75.436 -> 75.44)
 */
export function roundToTwoDecimals(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Calcule la valeur EMA du jour J à partir du poids du jour et de la dernière EMA connue.
 * Si previousEma est null/undefined (1ère pesée historique), retourne currentWeight.
 */
export function computeSingleDayEma(
  currentWeightKg: number,
  previousEmaKg: number | null | undefined
): number {
  if (previousEmaKg === null || previousEmaKg === undefined || previousEmaKg <= 0) {
    return roundToTwoDecimals(currentWeightKg);
  }
  const rawEma = currentWeightKg * EMA_ALPHA + previousEmaKg * (1 - EMA_ALPHA);
  return roundToTwoDecimals(rawEma);
}

/**
 * Recalcule l'intégralité d'une série de pesées triée chronologiquement (ASC).
 * Utilisé lors d'une saisie ou modification rétroactive pour garantir la cohérence de la chaîne EMA.
 */
export function recomputeWeightEmaSeries(
  points: WeightPointInput[],
  initialPreviousEmaKg: number | null = null
): WeightPointComputed[] {
  const sorted = [...points].sort((a, b) => a.log_date.localeCompare(b.log_date));
  let runningEma: number | null = initialPreviousEmaKg;

  return sorted.map((point) => {
    const computedEma = computeSingleDayEma(point.weight_kg, runningEma);
    runningEma = computedEma;
    return {
      id: point.id,
      log_date: point.log_date,
      weight_kg: roundToTwoDecimals(point.weight_kg),
      weight_ema_kg: computedEma,
    };
  });
}

/**
 * Convertit une saisie clavier iOS (ex: "78,4" ou "78.4") en nombre valide.
 */
export function parseDecimalInput(raw: string): number | null {
  const normalized = raw.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? roundToTwoDecimals(parsed) : null;
}

