// src/features/workout/services/today-session.service.ts
import { createClient } from '@/lib/supabase/client';
import { computeEffectiveTonnage } from '@/lib/math/workout-kpis.math';
import type { Database } from '@/types/database.types';
import type {
  ActiveWorkoutExercise,
  StartSessionPayload,
} from '../types/workout-store.types';
import { buildActiveExercisesFromPreset, getWorkoutPresets } from './presets.service';
import type { WorkoutSessionRow } from './sessions.service';

type WorkoutSetRow = Database['public']['Tables']['workout_sets']['Row'];
type TodaySetRow = Pick<WorkoutSetRow, 'weight_kg' | 'reps' | 'is_warmup' | 'is_completed' | 'is_pr'>;

interface TodaySessionWithSets extends WorkoutSessionRow {
  workout_session_exercises: Array<{ workout_sets: TodaySetRow[] | null }> | null;
}

export type TodayWorkoutOverview =
  | { kind: 'planned'; session: WorkoutSessionRow }
  | {
      kind: 'completed';
      session: WorkoutSessionRow;
      durationSeconds: number;
      tonnageKg: number;
      prCount: number;
    }
  | { kind: 'rest_day'; session: WorkoutSessionRow }
  | { kind: 'none' };

function stripEmbeds(row: TodaySessionWithSets): WorkoutSessionRow {
  const { workout_session_exercises: _embed, ...session } = row;
  void _embed;
  return session;
}

function flattenSets(row: TodaySessionWithSets): TodaySetRow[] {
  return (row.workout_session_exercises ?? []).flatMap((ex) => ex.workout_sets ?? []);
}

/**
 * Synthèse de la séance du jour pour le cockpit « Aujourd'hui ».
 * Priorité : planned > completed > rest_day > none. Plusieurs séances du même
 * statut → la première par `created_at` ASC.
 */
export async function getTodayWorkoutOverview(todayIso: string): Promise<TodayWorkoutOverview> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { data, error } = await supabase
    .from('workout_sessions')
    .select(`
      *,
      workout_session_exercises (
        workout_sets ( weight_kg, reps, is_warmup, is_completed, is_pr )
      )
    `)
    .eq('user_id', user.id)
    .eq('session_date', todayIso)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Erreur chargement séance du jour : ${error.message}`);
  const rows = (data as unknown as TodaySessionWithSets[] | null) ?? [];

  const planned = rows.find((r) => r.status === 'planned');
  if (planned) return { kind: 'planned', session: stripEmbeds(planned) };

  const completed = rows.find((r) => r.status === 'completed');
  if (completed) {
    const sets = flattenSets(completed);
    return {
      kind: 'completed',
      session: stripEmbeds(completed),
      durationSeconds: completed.duration_seconds ?? 0,
      tonnageKg: computeEffectiveTonnage(sets),
      prCount: sets.filter((s) => s.is_pr && s.is_completed && !s.is_warmup).length,
    };
  }

  const restDay = rows.find((r) => r.status === 'rest_day');
  if (restDay) return { kind: 'rest_day', session: stripEmbeds(restDay) };

  return { kind: 'none' };
}

/**
 * Construit le payload de `startSession` pour lancer une séance planifiée.
 * Reprend à l'identique la logique historique de `workout/page.tsx` :
 * preset retrouvé → exercices avec Ghost Values ; preset absent → `exercises: []`.
 */
export async function buildStartPayloadFromPlannedSession(
  session: WorkoutSessionRow
): Promise<StartSessionPayload> {
  let exercises: ActiveWorkoutExercise[] = [];
  if (session.preset_id) {
    const presets = await getWorkoutPresets();
    const found = presets.find((p) => p.id === session.preset_id);
    if (found) {
      exercises = await buildActiveExercisesFromPreset(found);
    }
  }
  return {
    sessionName: session.name,
    sessionDate: session.session_date,
    plannedSessionId: session.id,
    sourcePresetId: session.preset_id,
    exercises,
  };
}
