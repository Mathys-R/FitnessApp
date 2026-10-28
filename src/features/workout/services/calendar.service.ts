// src/features/workout/services/calendar.service.ts
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';
import type { ActiveWorkoutExercise } from '../store/active-workout.store';
import { getExerciseGhostAndRecords } from './presets.service';
import type { WorkoutSessionRow } from './sessions.service';

/**
 * 1. Agenda Hebdomadaire Daté : Récupère les séances de la semaine (Lundi -> Dimanche)
 */
export async function getWeekSessions(
  mondayIso: string,
  sundayIso: string
): Promise<WorkoutSessionRow[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('user_id', user.id)
    .gte('session_date', mondayIso)
    .lte('session_date', sundayIso)
    .order('session_date', { ascending: true });

  if (error) throw new Error(`Erreur chargement agenda : ${error.message}`);
  return data ?? [];
}

/**
 * 2. Planifie une séance ('planned'), un jour de repos ('rest_day') ou déplace une séance existante
 */
export async function scheduleOrMoveWeekSession(params: {
  existingSessionId?: string;
  targetDateIso: string;
  status: 'planned' | 'rest_day';
  name: string;
  presetId?: string | null;
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  if (params.existingSessionId) {
    const { error } = await supabase
      .from('workout_sessions')
      .update({
        session_date: params.targetDateIso,
        status: params.status,
        name: params.status === 'rest_day' ? 'Repos' : params.name,
        preset_id: params.presetId ?? null,
      })
      .eq('id', params.existingSessionId);
    if (error) throw new Error(`Erreur déplacement séance : ${error.message}`);
    return;
  }

  const { error } = await supabase.from('workout_sessions').insert({
    user_id: user.id,
    session_date: params.targetDateIso,
    status: params.status,
    name: params.status === 'rest_day' ? 'Repos' : params.name,
    preset_id: params.presetId ?? null,
  });
  if (error) throw new Error(`Erreur planification séance : ${error.message}`);
}

/**
 * 3. Charge une séance passée dans le format `ActiveWorkoutExercise[]` pour permettre sa modification
 * en cas d'erreur de saisie (ex: faute de frappe sur une charge).
 */
export async function loadSessionForEditing(sessionId: string): Promise<{
  session: WorkoutSessionRow;
  exercises: ActiveWorkoutExercise[];
}> {
  const supabase = createClient();
  const { data: session, error: sessErr } = await supabase
    .from('workout_sessions')
    .select('*')
    .eq('id', sessionId)
    .single();
  if (sessErr || !session) throw new Error(`Séance introuvable : ${sessErr?.message}`);

  const { data: sessionExs, error: exErr } = await supabase
    .from('workout_session_exercises')
    .select(`
      *,
      exercise:exercises (*),
      workout_sets (*)
    `)
    .eq('session_id', sessionId)
    .order('order_index', { ascending: true });
  if (exErr) throw new Error(`Erreur lecture exercices de la séance : ${exErr.message}`);

  const exercises: ActiveWorkoutExercise[] = await Promise.all(
    (sessionExs ?? []).map(async (item) => {
      const exInfo = item.exercise as unknown as Database['public']['Tables']['exercises']['Row'];
      const rawSets =
        (item.workout_sets as Array<Database['public']['Tables']['workout_sets']['Row']>) ?? [];
      const ghost = await getExerciseGhostAndRecords(item.exercise_id, sessionId);

      const sets = rawSets
        .sort((a, b) => a.set_number - b.set_number)
        .map((s) => ({
          local_id: s.id,
          set_number: s.set_number,
          weight_input: String(s.weight_kg),
          reps_input: String(s.reps),
          ghost_weight_kg: ghost.last_session_sets[s.set_number - 1]?.weight_kg ?? null,
          ghost_reps: ghost.last_session_sets[s.set_number - 1]?.reps ?? null,
          rest_seconds: s.rest_seconds,
          is_warmup: s.is_warmup,
          is_completed: s.is_completed,
          is_pr: s.is_pr,
        }));

      return {
        local_id: item.id,
        exercise_id: item.exercise_id,
        exercise_name: exInfo.name,
        primary_muscle: exInfo.primary_muscle,
        pinned_note: ghost.pinned_note,
        session_note: item.session_note ?? '',
        historical_max_weight_kg: ghost.historical_max_weight_kg,
        historical_max_1rm_kg: ghost.historical_max_1rm_kg,
        sets,
      };
    })
  );

  return { session, exercises };
}

