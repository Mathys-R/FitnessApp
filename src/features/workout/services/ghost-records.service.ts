// src/features/workout/services/ghost-records.service.ts
import { createClient } from '@/lib/supabase/client';

export interface GhostAndRecordResult {
  pinned_note: string;
  historical_max_weight_kg: number;
  historical_max_1rm_kg: number;
  last_session_sets: Array<{
    set_number: number;
    weight_kg: number;
    reps: number;
    rest_seconds: number;
  }>;
}

/**
 * Récupère pour un exercice :
 * - La note épinglée permanente (user_exercise_notes)
 * - Les séries de la DERNIÈRE séance validée ('completed') triée par `session_date DESC` (Ghost Values)
 * - Le record historique de poids et de 1RM Epley (en excluant optionnellement une séance en cours de ré-édition)
 */
export async function getExerciseGhostAndRecords(
  exerciseId: string,
  excludeSessionId?: string | null
): Promise<GhostAndRecordResult> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data: noteRow } = await supabase
    .from('user_exercise_notes')
    .select('pinned_note')
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .maybeSingle();

  let query = supabase
    .from('workout_sessions')
    .select(`
      id,
      session_date,
      workout_session_exercises!inner (
        id,
        exercise_id,
        workout_sets (
          set_number,
          weight_kg,
          reps,
          rest_seconds,
          is_warmup,
          is_completed,
          epley_1rm
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'completed')
    .eq('workout_session_exercises.exercise_id', exerciseId)
    .order('session_date', { ascending: false });

  if (excludeSessionId) {
    query = query.neq('id', excludeSessionId);
  }

  // Optimisation : charge uniquement la dernière séance effectuée selon la date d'agenda
  const { data: lastSessions } = await query.limit(1);

  const sessionExercises = lastSessions?.[0]?.workout_session_exercises ?? [];
  const matchedExercise =
    sessionExercises.find((ex) => ex.exercise_id === exerciseId) ?? sessionExercises[0];

  const lastSets = (matchedExercise?.workout_sets ?? [])
    .filter((s) => s.is_completed)
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => ({
      set_number: s.set_number,
      weight_kg: Number(s.weight_kg),
      reps: s.reps,
      rest_seconds: s.rest_seconds,
    }));

  // Calcul du record historique sur toutes les séries validées de cet exercice
  const { data: bestSets } = await supabase
    .from('workout_sets')
    .select('weight_kg, epley_1rm')
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .eq('is_completed', true)
    .eq('is_warmup', false);

  let maxWeightKg = 0;
  let max1RmKg = 0;
  for (const s of bestSets ?? []) {
    const w = Number(s.weight_kg);
    const rm = Number(s.epley_1rm);
    if (w > maxWeightKg) maxWeightKg = w;
    if (rm > max1RmKg) max1RmKg = rm;
  }

  return {
    pinned_note: noteRow?.pinned_note ?? '',
    historical_max_weight_kg: maxWeightKg,
    historical_max_1rm_kg: max1RmKg,
    last_session_sets: lastSets,
  };
}

