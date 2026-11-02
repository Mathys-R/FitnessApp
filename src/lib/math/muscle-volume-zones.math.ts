// src/lib/math/muscle-volume-zones.math.ts
// Couche 1 — Fonctions pures : zones de volume hebdomadaire (séries effectives / groupe musculaire).

export const OPTIMAL_WEEKLY_SETS_MIN = 10;
export const OPTIMAL_WEEKLY_SETS_MAX = 20;
export const MIN_VOLUME_SCALE_MAX = 24;

export type VolumeZone = 'below' | 'optimal' | 'above';

/** NaN → below ; < 10 → below ; 10..20 (bornes incluses) → optimal ; > 20 → above */
export function classifyWeeklyVolume(sets: number): VolumeZone {
  if (Number.isNaN(sets)) return 'below';
  if (sets < OPTIMAL_WEEKLY_SETS_MIN) return 'below';
  if (sets > OPTIMAL_WEEKLY_SETS_MAX) return 'above';
  return 'optimal';
}

/** Échelle des barres : max(24, ceil(max(values))). Valeurs non finies ignorées. */
export function computeVolumeScaleMax(values: number[]): number {
  const finite = values.filter((v) => Number.isFinite(v));
  const highest = finite.length > 0 ? Math.ceil(Math.max(...finite)) : 0;
  return Math.max(MIN_VOLUME_SCALE_MAX, highest);
}

/** Pourcentage de largeur de barre, borné à [0 ; 100]. scaleMax <= 0 → 0. */
export function toBarPercent(value: number, scaleMax: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(scaleMax) || scaleMax <= 0) return 0;
  const percent = (value / scaleMax) * 100;
  return Math.min(100, Math.max(0, percent));
}
