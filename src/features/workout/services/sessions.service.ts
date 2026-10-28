// src/features/workout/services/sessions.service.ts
import { createClient } from '@/lib/supabase/client';
import { recomputeSessionSetsPrFlags } from '@/lib/math/workout-kpis.math';
import type { Database } from '@/types/database.types';
import type { ActiveWorkoutExercise } from '../store/active-workout.store';

export type WorkoutSessionRow = Database['public']['Tables']['workout_sessions']['Row'];
export type PresetActionChoice =
  | 'keep_unchanged'
  | 'overwrite_source_preset'
  | 'create_new_preset';

/**
 * 1. Enregistre ou met à jour une séance terminée + synchronise les notes épinglées (suppression si vide)
 * + recalcule les PR finaux de la séance + applique le choix utilisateur sur le Preset.
 */
export async function finishAndSaveWorkoutSession(params: {
  editingSessionId?: string | null;
  plannedSessionId: string | null;
  sourcePresetId: string | null;
  sessionDate: string;
  sessionName: string;
  durationSeconds: number;
  sessionComment?: string;
  exercises: ActiveWorkoutExercise[];
  presetAction: PresetActionChoice;
  newPresetName?: string;
}): Promise<string> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  let sessionId = params.editingSessionId ?? params.plannedSessionId;

  if (sessionId) {
    const { error: updErr } = await supabase
      .from('workout_sessions')
      .update({
        session_date: params.sessionDate,
        name: params.sessionName.trim() || 'Séance Musculation',
        status: 'completed',
        duration_seconds: params.durationSeconds,
        session_comment: params.sessionComment ?? null,
      })
      .eq('id', sessionId);
    if (updErr) throw new Error(`Erreur mise à jour séance : ${updErr.message}`);

    await supabase.from('workout_session_exercises').delete().eq('session_id', sessionId);
  } else {
    const { data: created, error: insErr } = await supabase
      .from('workout_sessions')
      .insert({
        user_id: user.id,
        session_date: params.sessionDate,
        name: params.sessionName.trim() || 'Séance Musculation',
        status: 'completed',
        preset_id: params.sourcePresetId,
        duration_seconds: params.durationSeconds,
        session_comment: params.sessionComment ?? null,
      })
      .select('id')
      .single();
    if (insErr || !created) throw new Error(`Erreur création séance : ${insErr?.message}`);
    sessionId = created.id;
  }

  for (let i = 0; i < params.exercises.length; i++) {
    const ex = params.exercises[i];
    const trimmedPinned = ex.pinned_note.trim();

    if (trimmedPinned !== '') {
      await supabase.from('user_exercise_notes').upsert(
        {
          user_id: user.id,
          exercise_id: ex.exercise_id,
          pinned_note: trimmedPinned,
        },
        { onConflict: 'user_id,exercise_id' }
      );
    } else {
      await supabase
        .from('user_exercise_notes')
        .delete()
        .eq('user_id', user.id)
        .eq('exercise_id', ex.exercise_id);
    }

    const { data: sessionEx, error: exErr } = await supabase
      .from('workout_session_exercises')
      .insert({
        session_id: sessionId,
        user_id: user.id,
        exercise_id: ex.exercise_id,
        order_index: i,
        session_note: ex.session_note.trim() || null,
      })
      .select('id')
      .single();

    if (exErr || !sessionEx) throw new Error(`Erreur sauvegarde exercice : ${exErr?.message}`);

    const setsWithVerifiedPr = recomputeSessionSetsPrFlags(
      ex.sets,
      ex.historical_max_weight_kg,
      ex.historical_max_1rm_kg
    );

    const completedSets = setsWithVerifiedPr
      .filter((s) => s.is_completed)
      .map((s, idx) => ({
        session_exercise_id: sessionEx.id,
        user_id: user.id,
        exercise_id: ex.exercise_id,
        set_number: idx + 1,
        weight_kg: Number.parseFloat(s.weight_input.replace(',', '.')) || 0,
        reps: Number.parseInt(s.reps_input, 10) || 0,
        rest_seconds: s.rest_seconds,
        is_warmup: s.is_warmup,
        is_completed: true,
        is_pr: s.is_pr,
      }));

    if (completedSets.length > 0) {
      const { error: setsErr } = await supabase.from('workout_sets').insert(completedSets);
      if (setsErr) throw new Error(`Erreur sauvegarde séries : ${setsErr.message}`);
    }
  }

  let targetPresetId: string | null = null;
  if (params.presetAction === 'overwrite_source_preset' && params.sourcePresetId) {
    targetPresetId = params.sourcePresetId;
    await supabase.from('workout_preset_exercises').delete().eq('preset_id', targetPresetId);
  } else if (params.presetAction === 'create_new_preset') {
    const presetName = (params.newPresetName || params.sessionName || 'Nouveau Preset').trim();
    const { data: newPreset, error: presetErr } = await supabase
      .from('workout_presets')
      .insert({ user_id: user.id, name: presetName })
      .select('id')
      .single();
    if (presetErr || !newPreset) throw new Error(`Erreur création preset : ${presetErr?.message}`);
    targetPresetId = newPreset.id;
  }

  if (targetPresetId) {
    const presetExRows = params.exercises.map((ex, idx) => {
      const effectiveSets = ex.sets.filter((s) => !s.is_warmup);
      const firstSet = effectiveSets[0] ?? ex.sets[0];
      return {
        preset_id: targetPresetId!,
        exercise_id: ex.exercise_id,
        order_index: idx,
        target_sets: Math.max(effectiveSets.length, 1),
        target_rest_seconds: firstSet?.rest_seconds ?? 120,
        default_reps: firstSet ? Number.parseInt(firstSet.reps_input, 10) || null : null,
        default_weight_kg: firstSet
          ? Number.parseFloat(firstSet.weight_input.replace(',', '.')) || null
          : null,
      };
    });
    if (presetExRows.length > 0) {
      await supabase.from('workout_preset_exercises').insert(presetExRows);
    }
  }

  return sessionId;
}

/**
 * 2. Supprime une séance (planifiée ou passée) — cascade sur ses exercices et séries
 */
export async function deleteWorkoutSession(sessionId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('workout_sessions').delete().eq('id', sessionId);
  if (error) throw new Error(`Erreur suppression séance : ${error.message}`);
}
