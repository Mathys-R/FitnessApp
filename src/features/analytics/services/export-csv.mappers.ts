// src/features/analytics/services/export-csv.mappers.ts
// Fonctions pures de mapping lignes Supabase → lignes CSV (aucun appel réseau).
import type { Database } from '@/types/database.types';
import type { CsvCell } from '@/lib/csv.utils';

type Tables = Database['public']['Tables'];
type DailyLogRow = Tables['daily_logs']['Row'];
type MealEntryRow = Tables['meal_entries']['Row'];
type SessionRow = Tables['workout_sessions']['Row'];
type SetRow = Tables['workout_sets']['Row'];

export const DAILY_LOGS_HEADERS = ['date', 'weight_kg', 'weight_ema_kg', 'target_kcal', 'target_p', 'target_g', 'target_l', 'exclude_from_tdee'];
export const NUTRITION_HEADERS = ['date', 'meal_type', 'entry_type', 'label', 'quantity', 'unit', 'kcal', 'proteins_g', 'carbs_g', 'fats_g'];
export const WORKOUT_HEADERS = ['session_date', 'session_name', 'exercise', 'primary_muscle', 'set_number', 'weight_kg', 'reps', 'epley_1rm_kg', 'is_warmup', 'is_pr', 'session_note', 'session_comment'];

export type DailyLogExportRow = Pick<DailyLogRow, 'log_date' | 'weight_kg' | 'weight_ema_kg' | 'target_kcal' | 'target_p' | 'target_g' | 'target_l' | 'exclude_from_tdee'>;

export type MealEntryExportRow = Pick<MealEntryRow, 'meal_type' | 'entry_type' | 'label' | 'quantity_value' | 'logged_unit' | 'total_kcal' | 'total_p' | 'total_g' | 'total_l'> & {
  created_at?: string | null;
  daily_log: { log_date: string } | null;
};

export interface WorkoutExerciseExportShape {
  order_index: number | null;
  session_note: string | null;
  exercise: { name: string; primary_muscle: string } | null;
  workout_sets: Array<Pick<SetRow, 'set_number' | 'weight_kg' | 'reps' | 'epley_1rm' | 'is_warmup' | 'is_pr'>> | null;
}

export type WorkoutSessionExportRow = Pick<SessionRow, 'session_date' | 'name' | 'session_comment'> & {
  workout_session_exercises: WorkoutExerciseExportShape[] | null;
};

/** Comparaison descendante de chaînes ISO, valeurs manquantes en dernier */
function compareDesc(a: string | null | undefined, b: string | null | undefined): number {
  if (a === b) return 0;
  if (!a) return 1;
  if (!b) return -1;
  return a < b ? 1 : -1;
}

export function mapDailyLogRows(rows: DailyLogExportRow[]): CsvCell[][] {
  return rows.map((d) => [
    d.log_date, d.weight_kg, d.weight_ema_kg, d.target_kcal, d.target_p, d.target_g, d.target_l, d.exclude_from_tdee,
  ]);
}

/** Tri : date du journal DESC puis created_at DESC (cohérent avec les autres exports, plus récent en tête) */
export function mapNutritionRows(rows: MealEntryExportRow[]): CsvCell[][] {
  return [...rows]
    .sort((a, b) => compareDesc(a.daily_log?.log_date, b.daily_log?.log_date) || compareDesc(a.created_at, b.created_at))
    .map((m) => [
      m.daily_log?.log_date ?? '', m.meal_type, m.entry_type, m.label, m.quantity_value, m.logged_unit,
      m.total_kcal, m.total_p, m.total_g, m.total_l,
    ]);
}

/** Exercices triés par order_index ASC, séries par set_number ASC (ordre PostgREST des embeds non garanti) */
export function mapWorkoutRows(sessions: WorkoutSessionExportRow[]): CsvCell[][] {
  const rows: CsvCell[][] = [];
  for (const sess of sessions) {
    const exercises = [...(sess.workout_session_exercises ?? [])].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    for (const ex of exercises) {
      const sets = [...(ex.workout_sets ?? [])].sort((a, b) => a.set_number - b.set_number);
      for (const s of sets) {
        rows.push([
          sess.session_date, sess.name, ex.exercise?.name ?? '', ex.exercise?.primary_muscle ?? '',
          s.set_number, s.weight_kg, s.reps, s.epley_1rm, s.is_warmup, s.is_pr,
          ex.session_note ?? '', sess.session_comment ?? '',
        ]);
      }
    }
  }
  return rows;
}
