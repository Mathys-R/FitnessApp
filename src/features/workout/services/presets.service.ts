// src/features/workout/services/presets.service.ts
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';
import type { ActiveWorkoutExercise } from '../store/active-workout.store';

export type WorkoutPresetRow = Database['public']['Tables']['workout_presets']['Row'];
export type WorkoutPresetExerciseRow = Database['public']['Tables']['workout_preset_exercises']['Row'];

export interface WorkoutPresetWithExercises extends WorkoutPresetRow {
  workout_preset_exercises: Array<
    WorkoutPresetExerciseRow & {
      exercise: Database['public']['Tables']['exercises']['Row'];
    }
  >;
}

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
 * 1. Récupère pour un exercice :
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

  let sessionsQuery = supabase
    .from('workout_session_exercises')
    .select(`
      id,
      session_id,
      session:workout_sessions!inner (
        session_date,
        status,
        created_at
      ),
      workout_sets (
        set_number,
        weight_kg,
        reps,
        rest_seconds,
        is_warmup,
        is_completed,
        epley_1rm
      )
    `)
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .eq('workout_sessions.status', 'completed');

  if (excludeSessionId) {
    sessionsQuery = sessionsQuery.neq('session_id', excludeSessionId);
  }

  const { data: allCompletedEntries } = await sessionsQuery;

  // Tri strict sur `session_date DESC` (date de l'agenda) puis `created_at DESC`
  const sortedEntries = [...(allCompletedEntries ?? [])].sort((a, b) => {
    const sessA = a.session as unknown as { session_date: string; created_at: string };
    const sessB = b.session as unknown as { session_date: string; created_at: string };
    const dateCmp = sessB.session_date.localeCompare(sessA.session_date);
    return dateCmp !== 0 ? dateCmp : sessB.created_at.localeCompare(sessA.created_at);
  });

  const lastEntry = sortedEntries[0];
  const lastSets = (lastEntry?.workout_sets ?? [])
    .filter((s) => s.is_completed)
    .sort((a, b) => a.set_number - b.set_number)
    .map((s) => ({
      set_number: s.set_number,
      weight_kg: Number(s.weight_kg),
      reps: s.reps,
      rest_seconds: s.rest_seconds,
    }));

  // Calcul du record historique sur toutes les séances validées (hors séance ré-éditée éventuelle)
  let maxWeightKg = 0;
  let max1RmKg = 0;
  for (const entry of sortedEntries) {
    for (const s of entry.workout_sets ?? []) {
      if (s.is_completed && !s.is_warmup) {
        if (Number(s.weight_kg) > maxWeightKg) maxWeightKg = Number(s.weight_kg);
        if (Number(s.epley_1rm) > max1RmKg) max1RmKg = Number(s.epley_1rm);
      }
    }
  }

  return {
    pinned_note: noteRow?.pinned_note ?? '',
    historical_max_weight_kg: maxWeightKg,
    historical_max_1rm_kg: max1RmKg,
    last_session_sets: lastSets,
  };
}

/**
 * 2. Liste tous les Presets de l'utilisateur avec leurs exercices ordonnés
 */
export async function getWorkoutPresets(): Promise<WorkoutPresetWithExercises[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supabase
    .from('workout_presets')
    .select(`
      *,
      workout_preset_exercises (
        *,
        exercise:exercises (*)
      )
    `)
    .eq('user_id', user.id)
    .order('name', { ascending: true });

  if (error) throw new Error(`Erreur chargement presets : ${error.message}`);
  return (data as unknown as WorkoutPresetWithExercises[]) ?? [];
}

/**
 * 3. Construit les exercices prêts pour `useActiveWorkoutStore` à partir d'un Preset
 * en injectant automatiquement les Ghost Values et les records historiques.
 */
export async function buildActiveExercisesFromPreset(
  preset: WorkoutPresetWithExercises
): Promise<ActiveWorkoutExercise[]> {
  const sortedPresetEx = [...preset.workout_preset_exercises].sort(
    (a, b) => a.order_index - b.order_index
  );

  return Promise.all(
    sortedPresetEx.map(async (item) => {
      const ghost = await getExerciseGhostAndRecords(item.exercise_id);
      const setsCount = Math.max(item.target_sets || 3, 1);

      const sets = Array.from({ length: setsCount }, (_, idx) => {
        const ghostSet = ghost.last_session_sets[idx] ?? ghost.last_session_sets.at(-1);
        return {
          local_id: crypto.randomUUID(),
          set_number: idx + 1,
          weight_input: '',
          reps_input: '',
          ghost_weight_kg: ghostSet?.weight_kg ?? item.default_weight_kg ?? null,
          ghost_reps: ghostSet?.reps ?? item.default_reps ?? null,
          rest_seconds: ghostSet?.rest_seconds ?? item.target_rest_seconds ?? 120,
          is_warmup: false,
          is_completed: false,
          is_pr: false,
        };
      });

      return {
        local_id: crypto.randomUUID(),
        exercise_id: item.exercise_id,
        exercise_name: item.exercise.name,
        primary_muscle: item.exercise.primary_muscle,
        pinned_note: ghost.pinned_note,
        session_note: '',
        historical_max_weight_kg: ghost.historical_max_weight_kg,
        historical_max_1rm_kg: ghost.historical_max_1rm_kg,
        sets,
      };
    })
  );
}

/**
 * 4. Supprime un Preset
 */
export async function deleteWorkoutPreset(presetId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('workout_presets').delete().eq('id', presetId);
  if (error) throw new Error(`Erreur suppression preset : ${error.message}`);
}

