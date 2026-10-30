// src/features/analytics/services/export.service.ts
import { createClient } from '@/lib/supabase/client';

export interface CsvExportBundle {
  dailyLogsCsv: string;
  nutritionHistoryCsv: string;
  workoutHistoryCsv: string;
}

/**
 * Échappe proprement une valeur pour un fichier CSV compatible Excel / Numbers iOS
 * Neutralise les attaques par injection de formule (CWE-1236 / OWASP)
 */
function escapeCsvCell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // Neutralisation Formula Injection (CWE-1236) si début par =, +, -, @, \t, \r
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes("'")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvString(headers: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const bodyLines = rows.map((r) => r.map(escapeCsvCell).join(','));
  return [headerLine, ...bodyLines].join('\n');
}

/**
 * 1. Génère un export JSON complet des données personnelles
 */
export async function exportUserDataJson(): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const [dailyLogs, sessions, mealEntries] = await Promise.all([
    supabase.from('daily_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }),
    supabase
      .from('workout_sessions')
      .select('*, workout_session_exercises(*, exercise:exercises(name, primary_muscle), workout_sets(*))')
      .eq('user_id', user.id)
      .order('session_date', { ascending: false }),
    supabase
      .from('meal_entries')
      .select('*, daily_log:daily_logs(log_date), meal_entry_items(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  return JSON.stringify(
    {
      exported_at: new Date().toISOString(),
      daily_logs: dailyLogs.data ?? [],
      workout_sessions: sessions.data ?? [],
      meal_entries: mealEntries.data ?? [],
    },
    null,
    2
  );
}

/**
 * 2. Génère les 3 fichiers CSV dédiés :
 * - `daily_logs.csv` (Poids brut, Poids EMA 7j, Objectifs Kcal/P/G/L, Exclusion TDEE)
 * - `nutrition_history.csv` (Date, Repas, Type, Libellé, Quantité, Unité, Kcal, P, G, L)
 * - `workout_history.csv` (Date séance, Nom séance, Exercice, Muscle, Série, Poids kg, Reps, 1RM Epley, Échauffement, PR)
 */
export async function exportUserDataCsvBundle(): Promise<CsvExportBundle> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const [dailyLogsRes, mealEntriesRes, sessionsRes] = await Promise.all([
    supabase.from('daily_logs').select('*').eq('user_id', user.id).order('log_date', { ascending: false }),
    supabase
      .from('meal_entries')
      .select('*, daily_log:daily_logs(log_date)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('workout_sessions')
      .select('session_date, name, status, workout_session_exercises(order_index, session_note, exercise:exercises(name, primary_muscle), workout_sets(*))')
      .eq('user_id', user.id)
      .eq('status', 'completed')
      .order('session_date', { ascending: false }),
  ]);

  // CSV 1 : Journal Quotidien & Poids EMA
  const dailyLogsCsv = buildCsvString(
    ['date', 'weight_kg', 'weight_ema_kg', 'target_kcal', 'target_p', 'target_g', 'target_l', 'exclude_from_tdee'],
    (dailyLogsRes.data ?? []).map((d) => [
      d.log_date,
      d.weight_kg,
      d.weight_ema_kg,
      d.target_kcal,
      d.target_p,
      d.target_g,
      d.target_l,
      d.exclude_from_tdee,
    ])
  );

  // CSV 2 : Historique Nutritionnel
  const nutritionHistoryCsv = buildCsvString(
    ['date', 'meal_type', 'entry_type', 'label', 'quantity', 'unit', 'kcal', 'proteins_g', 'carbs_g', 'fats_g'],
    (mealEntriesRes.data ?? []).map((m) => {
      const dl = m.daily_log as unknown as { log_date: string } | null;
      return [
        dl?.log_date ?? '',
        m.meal_type,
        m.entry_type,
        m.label,
        m.quantity_value,
        m.logged_unit,
        m.total_kcal,
        m.total_p,
        m.total_g,
        m.total_l,
      ];
    })
  );

  // CSV 3 : Historique Séances & Séries de Musculation
  const workoutRows: Array<Array<string | number | boolean | null | undefined>> = [];
  for (const sess of sessionsRes.data ?? []) {
    const exList = (sess.workout_session_exercises as unknown as Array<{
      session_note: string | null;
      exercise: { name: string; primary_muscle: string } | null;
      workout_sets: Array<{
        set_number: number;
        weight_kg: number;
        reps: number;
        epley_1rm: number;
        is_warmup: boolean;
        is_pr: boolean;
      }>;
    }>) ?? [];

    for (const ex of exList) {
      for (const s of ex.workout_sets ?? []) {
        workoutRows.push([
          sess.session_date,
          sess.name,
          ex.exercise?.name ?? '',
          ex.exercise?.primary_muscle ?? '',
          s.set_number,
          s.weight_kg,
          s.reps,
          s.epley_1rm,
          s.is_warmup,
          s.is_pr,
          ex.session_note ?? '',
        ]);
      }
    }
  }

  const workoutHistoryCsv = buildCsvString(
    ['session_date', 'session_name', 'exercise', 'primary_muscle', 'set_number', 'weight_kg', 'reps', 'epley_1rm_kg', 'is_warmup', 'is_pr', 'session_note'],
    workoutRows
  );

  return {
    dailyLogsCsv,
    nutritionHistoryCsv,
    workoutHistoryCsv,
  };
}

