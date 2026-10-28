// src/lib/math/tdee.math.ts

export interface DailyTdeePointInput {
  log_date: string;          // 'YYYY-MM-DD'
  target_kcal: number;
  total_consumed_kcal: number;
  weight_ema_kg: number | null;
  exclude_from_tdee: boolean;
}

export type TdeeComputationResult =
  | {
      status: 'calibrating';
      validNutritionDays: number;
      requiredNutritionDays: number;
      hasEnoughWeightSpan: boolean;
      excludedDaysCount: number;
    }
  | {
      status: 'ready';
      estimatedTdeeKcal: number;
      averageIntakeKcal: number;
      deltaEma14dKg: number;
      dailyEnergyDeltaKcal: number;
      validNutritionDays: number;
      excludedDaysCount: number;
    };

const KCAL_PER_KG_BODYWEIGHT = 7700;
const MIN_VALID_NUTRITION_DAYS = 10;
const MIN_WEIGHT_SPAN_DAYS = 7;

/**
 * Vérifie si une journée révolue est valide pour entrer dans la moyenne calorique 14j
 */
export function isDayValidForTdee(day: DailyTdeePointInput): boolean {
  if (day.exclude_from_tdee) return false;
  const minThreshold = (day.target_kcal || 2000) * 0.5;
  return day.total_consumed_kcal >= minThreshold;
}

/**
 * Calcule le nombre de jours d'écart entre deux dates 'YYYY-MM-DD'
 */
function daysBetween(dateA: string, dateB: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const a = new Date(`${dateA}T00:00:00Z`).getTime();
  const b = new Date(`${dateB}T00:00:00Z`).getTime();
  return Math.round(Math.abs(b - a) / msPerDay);
}

/**
 * Calcule la Maintenance Calorique Réelle (TDEE) sur une fenêtre de 14 jours révolus (J-14 à J-1).
 * Règle métier : La journée en cours (`todayIso`) est exclue du calcul calorique pour que le TDEE
 * reste fixe toute la journée sans être faussé par les repas non encore pris (ex: entre midi et soir).
 */
export function computeDynamicTdee14Days(
  daysWindow: DailyTdeePointInput[],
  todayIso?: string
): TdeeComputationResult {
  const sorted = [...daysWindow].sort((a, b) => a.log_date.localeCompare(b.log_date));

  // Seules les journées strictement antérieures à aujourd'hui (J-14 à J-1) entrent dans la moyenne kcal
  const completedDays = todayIso
    ? sorted.filter((d) => d.log_date < todayIso)
    : sorted;

  const validNutriDays = completedDays.filter(isDayValidForTdee);
  const excludedDaysCount = completedDays.length - validNutriDays.length;

  // Les pesées EMA incluent toutes les pesées disponibles sur la fenêtre (y compris la pesée du matin J)
  const emaPoints = sorted.filter(
    (d): d is DailyTdeePointInput & { weight_ema_kg: number } =>
      d.weight_ema_kg !== null && d.weight_ema_kg > 0
  );

  const firstEma = emaPoints[0];
  const lastEma = emaPoints[emaPoints.length - 1];
  const weightSpanDays =
    firstEma && lastEma ? daysBetween(firstEma.log_date, lastEma.log_date) : 0;
  const hasEnoughWeightSpan = emaPoints.length >= 2 && weightSpanDays >= MIN_WEIGHT_SPAN_DAYS;

  if (validNutriDays.length < MIN_VALID_NUTRITION_DAYS || !hasEnoughWeightSpan) {
    return {
      status: 'calibrating',
      validNutritionDays: validNutriDays.length,
      requiredNutritionDays: MIN_VALID_NUTRITION_DAYS,
      hasEnoughWeightSpan,
      excludedDaysCount,
    };
  }

  // 1. Moyenne des calories ingérées sur les jours révolus valides
  const sumKcal = validNutriDays.reduce((acc, d) => acc + d.total_consumed_kcal, 0);
  const averageIntakeKcal = Math.round(sumKcal / validNutriDays.length);

  // 2. Variation d'EMA normalisée sur 14 jours
  const rawEmaDiff = lastEma.weight_ema_kg - firstEma.weight_ema_kg;
  const normalizedDeltaEma14d = (rawEmaDiff / weightSpanDays) * 14;
  const deltaEma14dKg = Math.round((normalizedDeltaEma14d + Number.EPSILON) * 100) / 100;

  // 3. Surplus ou déficit quotidien réel induit par la variation de poids
  const dailyEnergyDeltaKcal = Math.round(
    (normalizedDeltaEma14d * KCAL_PER_KG_BODYWEIGHT) / 14
  );

  // 4. TDEE réel = Calories moyennes ingérées - Surplus/Déficit stocké par jour
  const estimatedTdeeKcal = Math.round(averageIntakeKcal - dailyEnergyDeltaKcal);

  return {
    status: 'ready',
    estimatedTdeeKcal,
    averageIntakeKcal,
    deltaEma14dKg,
    dailyEnergyDeltaKcal,
    validNutritionDays: validNutriDays.length,
    excludedDaysCount,
  };
}

