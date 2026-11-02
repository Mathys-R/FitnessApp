// src/features/analytics/services/export.service.ts
import { createClient } from '@/lib/supabase/client';
import { buildCsvString } from '@/lib/csv.utils';
import {
  DAILY_LOGS_HEADERS, NUTRITION_HEADERS, WORKOUT_HEADERS,
  mapDailyLogRows, mapNutritionRows, mapWorkoutRows,
  type MealEntryExportRow, type WorkoutSessionExportRow,
} from './export-csv.mappers';

export interface CsvExportBundle {
  dailyLogsCsv: string;
  nutritionHistoryCsv: string;
  workoutHistoryCsv: string;
}

/** Taille de page PostgREST (limite `max_rows` Supabase par défaut) */
export const EXPORT_PAGE_SIZE = 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

/**
 * Récupère toutes les lignes d'une requête par pages `.range(from, to)` de 1000,
 * jusqu'à obtenir une page incomplète. Lève une erreur explicite au moindre échec (E2/E3).
 */
async function fetchAllPages<T>(
  tableLabel: string,
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T>>
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += EXPORT_PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + EXPORT_PAGE_SIZE - 1);
    if (error) throw new Error(`Erreur export ${tableLabel} : ${error.message}`);
    const page = data ?? [];
    all.push(...page);
    if (page.length < EXPORT_PAGE_SIZE) return all;
  }
}

async function requireUserId(): Promise<{ supabase: ReturnType<typeof createClient>; userId: string }> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');
  return { supabase, userId: user.id };
}

/**
 * 1. Génère un export JSON complet des données personnelles
 */
export async function exportUserDataJson(): Promise<string> {
  const { supabase, userId } = await requireUserId();

  const [dailyLogs, sessions, mealEntries] = await Promise.all([
    fetchAllPages('daily_logs', (from, to) =>
      supabase.from('daily_logs').select('*').eq('user_id', userId)
        .order('log_date', { ascending: false }).order('id').range(from, to)
    ),
    fetchAllPages('workout_sessions', (from, to) =>
      supabase
        .from('workout_sessions')
        .select('*, workout_session_exercises(*, exercise:exercises(name, primary_muscle), workout_sets(*))')
        .eq('user_id', userId)
        .order('session_date', { ascending: false }).order('id')
        .order('order_index', { referencedTable: 'workout_session_exercises' })
        .order('set_number', { referencedTable: 'workout_session_exercises.workout_sets' })
        .range(from, to)
    ),
    fetchAllPages('meal_entries', (from, to) =>
      supabase
        .from('meal_entries')
        .select('*, daily_log:daily_logs(log_date), meal_entry_items(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }).order('id').range(from, to)
    ),
  ]);

  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      daily_logs: dailyLogs,
      workout_sessions: sessions,
      meal_entries: mealEntries,
    },
    null,
    2
  );
}

/**
 * 2. Génère les 3 fichiers CSV dédiés :
 * - `daily_logs.csv` (Poids brut, Poids EMA 7j, Objectifs Kcal/P/G/L, Exclusion TDEE)
 * - `nutrition_history.csv` (Date, Repas, Type, Libellé, Quantité, Unité, Kcal, P, G, L)
 * - `workout_history.csv` (Date séance, Nom séance, Exercice, Muscle, Série, Poids kg, Reps, 1RM Epley,
 *   Échauffement, PR, Note exercice, Commentaire global de séance)
 */
export async function exportUserDataCsvBundle(): Promise<CsvExportBundle> {
  const { supabase, userId } = await requireUserId();

  const [dailyLogs, mealEntries, sessions] = await Promise.all([
    fetchAllPages('daily_logs', (from, to) =>
      supabase.from('daily_logs').select('*').eq('user_id', userId)
        .order('log_date', { ascending: false }).order('id').range(from, to)
    ),
    fetchAllPages('meal_entries', (from, to) =>
      supabase
        .from('meal_entries')
        .select('*, daily_log:daily_logs(log_date)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }).order('id').range(from, to)
    ),
    fetchAllPages('workout_sessions', (from, to) =>
      supabase
        .from('workout_sessions')
        .select('session_date, name, status, session_comment, workout_session_exercises(order_index, session_note, exercise:exercises(name, primary_muscle), workout_sets(*))')
        .eq('user_id', userId)
        .eq('status', 'completed')
        .order('session_date', { ascending: false }).order('id').range(from, to)
    ),
  ]);

  // Relations imbriquées non typées par les types générés (Relationships vides) → typage explicite des embeds
  return {
    dailyLogsCsv: buildCsvString(DAILY_LOGS_HEADERS, mapDailyLogRows(dailyLogs)),
    nutritionHistoryCsv: buildCsvString(NUTRITION_HEADERS, mapNutritionRows(mealEntries as unknown as MealEntryExportRow[])),
    workoutHistoryCsv: buildCsvString(WORKOUT_HEADERS, mapWorkoutRows(sessions as unknown as WorkoutSessionExportRow[])),
  };
}
