// src/features/analytics/services/kpis.service.ts
import { createClient } from '@/lib/supabase/client';
import { getLocalTodayIso, getWeekDatesIso, shiftDateIso } from '@/lib/date.utils';
import { computeDynamicTdee14Days, type TdeeComputationResult } from '@/lib/math/tdee.math';
import { computeMuscleGroupSetVolumes } from '@/lib/math/workout-kpis.math';
import type { MuscleGroup } from '@/types/domain.types';

export interface OneRmHistoryPoint {
  session_date: string;
  max_1rm_kg: number;
  max_weight_kg: number;
  total_tonnage_kg: number;
}

/**
 * 1. Calcule le TDEE sur les 14 derniers jours révolus (J-14 à J-1 pour les calories, J-14 à J pour l'EMA)
 * afin d'offrir un chiffre fixe toute la journée sans fluctuations en cours de journée.
 */
export async function getTdee14DaysAnalysis(): Promise<TdeeComputationResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const todayIso = getLocalTodayIso();
  const startIso = shiftDateIso(todayIso, -14);

  const { data: logs, error } = await supabase
    .from('daily_logs')
    .select(`
      log_date,
      target_kcal,
      weight_ema_kg,
      exclude_from_tdee,
      meal_entries (
        total_kcal
      )
    `)
    .eq('user_id', user.id)
    .gte('log_date', startIso)
    .lte('log_date', todayIso)
    .order('log_date', { ascending: true });

  if (error) throw new Error(`Erreur calcul TDEE : ${error.message}`);

  const points = (logs ?? []).map((row) => {
    const entries = (row.meal_entries as Array<{ total_kcal: number }>) ?? [];
    const totalConsumed = entries.reduce((acc, e) => acc + (Number(e.total_kcal) || 0), 0);
    return {
      log_date: row.log_date,
      target_kcal: row.target_kcal,
      total_consumed_kcal: totalConsumed,
      weight_ema_kg: row.weight_ema_kg,
      exclude_from_tdee: row.exclude_from_tdee,
    };
  });

  return computeDynamicTdee14Days(points, todayIso);
}

/**
 * 2. Récupère la courbe d'évolution du 1RM Epley et du Tonnage pour un exercice donné,
 * groupée strictement par la date d'agenda de la séance (`workout_sessions.session_date`).
 */
export async function getExerciseOneRmHistory(exerciseId: string): Promise<OneRmHistoryPoint[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supabase
    .from('workout_sets')
    .select(`
      weight_kg,
      reps,
      epley_1rm,
      session_exercise:workout_session_exercises!inner (
        session:workout_sessions!inner (
          session_date,
          status
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .eq('is_completed', true)
    .eq('is_warmup', false);

  if (error) throw new Error(`Erreur historique 1RM : ${error.message}`);

  const groupedByDate = new Map<string, OneRmHistoryPoint>();

  for (const s of data ?? []) {
    const sessWrapper = s.session_exercise as unknown as {
      session: { session_date: string; status: string };
    };
    if (sessWrapper?.session?.status !== 'completed') continue;

    const dateKey = sessWrapper.session.session_date;
    const existing = groupedByDate.get(dateKey) ?? {
      session_date: dateKey,
      max_1rm_kg: 0,
      max_weight_kg: 0,
      total_tonnage_kg: 0,
    };

    existing.max_1rm_kg = Math.max(existing.max_1rm_kg, Number(s.epley_1rm) || 0);
    existing.max_weight_kg = Math.max(existing.max_weight_kg, Number(s.weight_kg) || 0);
    existing.total_tonnage_kg += (Number(s.weight_kg) || 0) * (s.reps || 0);
    groupedByDate.set(dateKey, existing);
  }

  return Array.from(groupedByDate.values()).sort((a, b) =>
    a.session_date.localeCompare(b.session_date)
  );
}

/**
 * 3. Calcule le volume hebdomadaire de séries effectives sur les 10 groupes musculaires
 * sur la semaine calendaire du Lundi au Dimanche contenant `referenceDateIso`.
 */
export async function getWeeklyMuscleVolume(
  referenceDateIso: string = getLocalTodayIso()
): Promise<Record<MuscleGroup, number>> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const weekDates = getWeekDatesIso(referenceDateIso);
  const mondayIso = weekDates[0];
  const sundayIso = weekDates[6];

  const { data, error } = await supabase
    .from('workout_sets')
    .select(`
      id,
      exercise:exercises (
        primary_muscle,
        secondary_muscles
      ),
      session_exercise:workout_session_exercises!inner (
        session:workout_sessions!inner (
          session_date,
          status
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('is_completed', true)
    .eq('is_warmup', false)
    .gte('session_exercise.session.session_date', mondayIso) // Correctif PostgREST : alias imbriqué
    .lte('session_exercise.session.session_date', sundayIso)
    .eq('session_exercise.session.status', 'completed');

  if (error) throw new Error(`Erreur volume musculaire : ${error.message}`);

  const volumeInputs = (data ?? []).map((row) => {
    const ex = row.exercise as unknown as {
      primary_muscle: string;
      secondary_muscles: string[];
    };
    return {
      primary_muscle: ex?.primary_muscle ?? '',
      secondary_muscles: Array.isArray(ex?.secondary_muscles) ? ex.secondary_muscles : [],
      effective_sets_count: 1,
    };
  });

  return computeMuscleGroupSetVolumes(volumeInputs);
}

