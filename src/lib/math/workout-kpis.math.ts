// src/lib/math/workout-kpis.math.ts
import { MUSCLE_GROUPS, type MuscleGroup } from '@/types/domain.types';

export interface SetCalcInput {
  weight_kg: number;
  reps: number;
  is_warmup: boolean;
  is_completed: boolean;
}

export interface ExerciseVolumeInput {
  primary_muscle: string;
  secondary_muscles: string[];
  effective_sets_count: number;
}

/**
 * 1. Formule d'Epley : 1RM = Poids * (1 + Reps / 30)
 * Retourne 0 si série d'échauffement, non complétée ou reps <= 0.
 */
export function computeEpley1Rm(
  weightKg: number,
  reps: number,
  isWarmup = false
): number {
  if (isWarmup || reps <= 0 || weightKg <= 0) return 0;
  const raw = weightKg * (1 + reps / 30);
  return Math.round((raw + Number.EPSILON) * 100) / 100;
}

/**
 * 2. Détecte si une série effective bat le record de référence (poids ou 1RM Epley).
 */
export function isSetPersonalRecord(
  set: SetCalcInput,
  referenceMaxWeightKg: number,
  referenceMax1RmKg: number
): boolean {
  if (!set.is_completed || set.is_warmup || set.weight_kg <= 0 || set.reps <= 0) {
    return false;
  }
  const current1Rm = computeEpley1Rm(set.weight_kg, set.reps, false);
  return set.weight_kg > referenceMaxWeightKg || current1Rm > referenceMax1RmKg;
}

/**
 * 3. Recalcule dynamiquement le flag `is_pr` sur toutes les séries d'un exercice en séance.
 * Règle métier : Chaque série validée est comparée au maximum courant (record historique
 * d'avant-séance + séries précédentes déjà validées dans la séance). Ainsi, une série
 * ne devient PR que si elle bat à la fois l'historique et les séries précédentes de la séance !
 */
export function recomputeSessionSetsPrFlags<
  T extends {
    weight_input: string;
    reps_input: string;
    is_warmup: boolean;
    is_completed: boolean;
    is_pr: boolean;
  }
>(
  sets: T[],
  historicalMaxWeightKg: number,
  historicalMax1RmKg: number
): T[] {
  let runningMaxWeight = historicalMaxWeightKg;
  let runningMax1Rm = historicalMax1RmKg;

  return sets.map((s) => {
    const weightNum = Number.parseFloat(s.weight_input.replace(',', '.')) || 0;
    const repsNum = Number.parseInt(s.reps_input, 10) || 0;

    const isPr = isSetPersonalRecord(
      {
        weight_kg: weightNum,
        reps: repsNum,
        is_warmup: s.is_warmup,
        is_completed: s.is_completed,
      },
      runningMaxWeight,
      runningMax1Rm
    );

    if (s.is_completed && !s.is_warmup && weightNum > 0 && repsNum > 0) {
      const current1Rm = computeEpley1Rm(weightNum, repsNum, false);
      if (weightNum > runningMaxWeight) runningMaxWeight = weightNum;
      if (current1Rm > runningMax1Rm) runningMax1Rm = current1Rm;
    }

    return {
      ...s,
      is_pr: isPr,
    };
  });
}

/**
 * 4. Calcule le Tonnage total (Volume en kg) d'un exercice ou d'une séance
 * sur les séries effectives uniquement (is_completed = true && is_warmup = false).
 */
export function computeEffectiveTonnage(sets: SetCalcInput[]): number {
  const total = sets.reduce((sum, s) => {
    if (!s.is_completed || s.is_warmup || s.weight_kg <= 0 || s.reps <= 0) return sum;
    return sum + s.weight_kg * s.reps;
  }, 0);
  return Math.round((total + Number.EPSILON) * 10) / 10;
}

/**
 * 5. Calcule le volume hebdomadaire de séries effectives sur les 10 groupes musculaires :
 * - +1.0 série par série effective pour le `primary_muscle`
 * - +0.5 série par série effective pour chaque muscle présent dans `secondary_muscles`
 */
export function computeMuscleGroupSetVolumes(
  items: ExerciseVolumeInput[]
): Record<MuscleGroup, number> {
  const result = Object.fromEntries(
    MUSCLE_GROUPS.map((m) => [m, 0])
  ) as Record<MuscleGroup, number>;

  for (const item of items) {
    const count = item.effective_sets_count;
    if (count <= 0) continue;

    if (item.primary_muscle in result) {
      result[item.primary_muscle as MuscleGroup] += count;
    }

    for (const sec of item.secondary_muscles ?? []) {
      if (sec in result && sec !== item.primary_muscle) {
        result[sec as MuscleGroup] += count * 0.5;
      }
    }
  }

  return result;
}

