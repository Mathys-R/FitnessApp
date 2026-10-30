// src/features/workout/services/presets.service.ts
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';
import type { ActiveWorkoutExercise } from '../store/active-workout.store';
import {
  getExerciseGhostAndRecords,
  type GhostAndRecordResult,
} from './ghost-records.service';

export { getExerciseGhostAndRecords, type GhostAndRecordResult };

export type WorkoutPresetRow = Database['public']['Tables']['workout_presets']['Row'];
export type WorkoutPresetExerciseRow = Database['public']['Tables']['workout_preset_exercises']['Row'];

export interface WorkoutPresetWithExercises extends WorkoutPresetRow {
  workout_preset_exercises: Array<
    WorkoutPresetExerciseRow & {
      exercise: Database['public']['Tables']['exercises']['Row'];
    }
  >;
}

/**
 * 1. Liste tous les Presets de l'utilisateur avec leurs exercices ordonnés
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
 * 2. Construit les exercices prêts pour `useActiveWorkoutStore` à partir d'un Preset
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
 * 3. Supprime un Preset
 */
export async function deleteWorkoutPreset(presetId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('workout_presets').delete().eq('id', presetId);
  if (error) throw new Error(`Erreur suppression preset : ${error.message}`);
}

export interface CreatePresetExerciseInput {
  exercise_id: string;
  order_index?: number;
  target_sets?: number | null;
  default_weight_kg?: number | null;
  default_reps?: number | null;
  target_rest_seconds?: number | null;
}

/**
 * 4. Crée un nouveau Preset avec ses exercices associés
 */
export async function createWorkoutPreset(params: {
  name: string;
  description?: string | null;
  exercises?: CreatePresetExerciseInput[];
}): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data: preset, error: presetErr } = await supabase
    .from('workout_presets')
    .insert({
      user_id: user.id,
      name: params.name.trim(),
      description: params.description?.trim() || null,
    })
    .select('id')
    .single();

  if (presetErr || !preset) throw new Error(`Erreur création preset : ${presetErr?.message}`);

  if (params.exercises && params.exercises.length > 0) {
    const exRows = params.exercises.map((ex, idx) => ({
      preset_id: preset.id,
      exercise_id: ex.exercise_id,
      order_index: ex.order_index ?? idx,
      target_sets: ex.target_sets ?? 3,
      default_weight_kg: ex.default_weight_kg ?? null,
      default_reps: ex.default_reps ?? null,
      target_rest_seconds: ex.target_rest_seconds ?? 120,
    }));
    const { error: exErr } = await supabase.from('workout_preset_exercises').insert(exRows);
    if (exErr) throw new Error(`Erreur ajout exercices preset : ${exErr.message}`);
  }

  return preset.id;
}

/**
 * 5. Met à jour un Preset existant (nom, description et liste d'exercices)
 */
export async function updateWorkoutPreset(
  presetId: string,
  params: {
    name?: string;
    description?: string | null;
    exercises?: CreatePresetExerciseInput[];
  }
): Promise<void> {
  const supabase = createClient();
  if (params.name || params.description !== undefined) {
    const updates: Partial<WorkoutPresetRow> = {};
    if (params.name) updates.name = params.name.trim();
    if (params.description !== undefined) updates.description = params.description?.trim() || null;
    const { error } = await supabase.from('workout_presets').update(updates).eq('id', presetId);
    if (error) throw new Error(`Erreur modification preset : ${error.message}`);
  }

  if (params.exercises !== undefined) {
    await supabase.from('workout_preset_exercises').delete().eq('preset_id', presetId);
    if (params.exercises.length > 0) {
      const exRows = params.exercises.map((ex, idx) => ({
        preset_id: presetId,
        exercise_id: ex.exercise_id,
        order_index: ex.order_index ?? idx,
        target_sets: ex.target_sets ?? 3,
        default_weight_kg: ex.default_weight_kg ?? null,
        default_reps: ex.default_reps ?? null,
        target_rest_seconds: ex.target_rest_seconds ?? 120,
      }));
      const { error: exErr } = await supabase.from('workout_preset_exercises').insert(exRows);
      if (exErr) throw new Error(`Erreur mise à jour exercices preset : ${exErr.message}`);
    }
  }
}
