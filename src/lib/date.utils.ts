// src/lib/date.utils.ts
import { format, addDays, startOfWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Retourne la date locale actuelle de l'iPhone au format 'YYYY-MM-DD'
 */
export function getLocalTodayIso(now: Date = new Date()): string {
  return format(now, 'yyyy-MM-dd');
}

/**
 * Ajoute ou retire des jours à une date 'YYYY-MM-DD' sans décalage UTC
 */
export function shiftDateIso(dateIso: string, deltaDays: number): string {
  const parsed = parseISO(dateIso);
  return format(addDays(parsed, deltaDays), 'yyyy-MM-dd');
}

/**
 * Retourne les 7 dates 'YYYY-MM-DD' (Lundi -> Dimanche) de la semaine contenant `referenceDateIso`
 */
export function getWeekDatesIso(referenceDateIso: string = getLocalTodayIso()): string[] {
  const monday = startOfWeek(parseISO(referenceDateIso), { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, idx) => format(addDays(monday, idx), 'yyyy-MM-dd'));
}

/**
 * Formate une date 'YYYY-MM-DD' en français lisible sur mobile (ex: "Mer. 28 oct.")
 */
export function formatShortFrenchDate(dateIso: string): string {
  return format(parseISO(dateIso), 'EEE d MMM', { locale: fr });
}

