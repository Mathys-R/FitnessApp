// src/lib/format.utils.ts
// Couche 1 pure : formatage numérique fr-FR partagé (aucune dépendance React / Supabase).

/** Poids fr-FR (« 82,5 »), sans unité. `minDigits` force les décimales (ex : « 80,0 »). */
export function formatKg(value: number, maxDigits = 1, minDigits = 0): string {
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: Math.min(minDigits, maxDigits),
    maximumFractionDigits: maxDigits,
  });
}

/**
 * Delta de poids signé, convention unique de l'application :
 * « + » explicite si > 0, signe moins ASCII « - » si < 0, zéro (après arrondi) sans signe.
 */
export function formatSignedKg(value: number, maxDigits = 2, minDigits = 0): string {
  const abs = Math.abs(value);
  if (!Number.isFinite(value) || Number(abs.toFixed(maxDigits)) === 0) {
    return formatKg(0, maxDigits, minDigits);
  }
  return `${value > 0 ? '+' : '-'}${formatKg(abs, maxDigits, minDigits)}`;
}

/** Calories arrondies à l'unité, séparateur de milliers fr-FR. */
export function formatKcal(value: number): string {
  return Math.round(value).toLocaleString('fr-FR');
}
