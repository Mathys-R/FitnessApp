// src/features/workout/store/active-workout.store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getLocalTodayIso } from '@/lib/date.utils';
import { recomputeSessionSetsPrFlags } from '@/lib/math/workout-kpis.math';

export interface ActiveWorkoutSet {
  local_id: string;
  set_number: number;
  weight_input: string;
  reps_input: string;
  ghost_weight_kg: number | null;
  ghost_reps: number | null;
  rest_seconds: number;
  is_warmup: boolean;
  is_completed: boolean;
  is_pr: boolean;
}

export interface ActiveWorkoutExercise {
  local_id: string;
  exercise_id: string;
  exercise_name: string;
  primary_muscle: string;
  pinned_note: string;
  session_note: string;
  historical_max_weight_kg: number;
  historical_max_1rm_kg: number;
  sets: ActiveWorkoutSet[];
}

interface ActiveWorkoutState {
  isActive: boolean;
  editingSessionId: string | null;
  plannedSessionId: string | null;
  sourcePresetId: string | null;
  sessionDate: string;
  sessionName: string;
  startedAtIso: string | null;
  exercises: ActiveWorkoutExercise[];

  startSession: (payload: {
    sessionName: string;
    sessionDate?: string;
    editingSessionId?: string | null;
    plannedSessionId?: string | null;
    sourcePresetId?: string | null;
    exercises?: ActiveWorkoutExercise[];
  }) => void;
  updateSetField: (
    exLocalId: string,
    setLocalId: string,
    field: 'weight_input' | 'reps_input' | 'rest_seconds' | 'is_warmup',
    value: string | number | boolean
  ) => void;
  toggleCompleteSetWithGhostFallback: (exLocalId: string, setLocalId: string) => { becamePr: boolean };
  updateExerciseNotes: (exLocalId: string, field: 'pinned_note' | 'session_note', value: string) => void;
  addExerciseToSession: (exercise: ActiveWorkoutExercise) => void;
  removeExerciseFromSession: (exLocalId: string) => void;
  addSetToExercise: (exLocalId: string) => void;
  removeSetFromExercise: (exLocalId: string, setLocalId: string) => void;
  clearActiveSession: () => void;
}

const INITIAL_STATE = {
  isActive: false, editingSessionId: null, plannedSessionId: null, sourcePresetId: null,
  sessionDate: getLocalTodayIso(), sessionName: '', startedAtIso: null, exercises: [] as ActiveWorkoutExercise[],
};

export const useActiveWorkoutStore = create<ActiveWorkoutState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      startSession: ({
        sessionName,
        sessionDate = getLocalTodayIso(),
        editingSessionId = null,
        plannedSessionId = null,
        sourcePresetId = null,
        exercises = [],
      }) =>
        set({
          isActive: true,
          sessionName,
          sessionDate,
          editingSessionId,
          plannedSessionId,
          sourcePresetId,
          startedAtIso: new Date().toISOString(),
          exercises,
        }),

      updateSetField: (exLocalId, setLocalId, field, value) =>
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.local_id !== exLocalId) return ex;
            const updated = ex.sets.map((s) => (s.local_id === setLocalId ? { ...s, [field]: value } : s));
            return {
              ...ex,
              sets: recomputeSessionSetsPrFlags(updated, ex.historical_max_weight_kg, ex.historical_max_1rm_kg),
            };
          }),
        })),

      toggleCompleteSetWithGhostFallback: (exLocalId, setLocalId) => {
        let becamePr = false;
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.local_id !== exLocalId) return ex;
            const rawSets = ex.sets.map((s) => {
              if (s.local_id !== setLocalId) return s;
              const nextCompleted = !s.is_completed;
              return {
                ...s,
                weight_input:
                  nextCompleted && s.weight_input.trim() === '' && s.ghost_weight_kg !== null
                    ? String(s.ghost_weight_kg)
                    : s.weight_input,
                reps_input:
                  nextCompleted && s.reps_input.trim() === '' && s.ghost_reps !== null
                    ? String(s.ghost_reps)
                    : s.reps_input,
                is_completed: nextCompleted,
              };
            });

            const recomputed = recomputeSessionSetsPrFlags(
              rawSets,
              ex.historical_max_weight_kg,
              ex.historical_max_1rm_kg
            );
            const target = recomputed.find((s) => s.local_id === setLocalId);
            if (target?.is_completed && target.is_pr) becamePr = true;
            return { ...ex, sets: recomputed };
          }),
        }));
        return { becamePr };
      },

      updateExerciseNotes: (exLocalId, field, value) =>
        set((state) => ({
          exercises: state.exercises.map((ex) => (ex.local_id === exLocalId ? { ...ex, [field]: value } : ex)),
        })),

      addExerciseToSession: (exercise) => set((state) => ({ exercises: [...state.exercises, exercise] })),

      removeExerciseFromSession: (exLocalId) =>
        set((state) => ({ exercises: state.exercises.filter((ex) => ex.local_id !== exLocalId) })),

      addSetToExercise: (exLocalId) =>
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.local_id !== exLocalId) return ex;
            const prev = ex.sets.at(-1);
            return {
              ...ex,
              sets: [
                ...ex.sets,
                {
                  local_id: crypto.randomUUID(),
                  set_number: ex.sets.length + 1,
                  weight_input: '',
                  reps_input: '',
                  ghost_weight_kg: prev?.ghost_weight_kg ?? null,
                  ghost_reps: prev?.ghost_reps ?? null,
                  rest_seconds: prev?.rest_seconds ?? 120,
                  is_warmup: false,
                  is_completed: false,
                  is_pr: false,
                },
              ],
            };
          }),
        })),

      removeSetFromExercise: (exLocalId, setLocalId) =>
        set((state) => ({
          exercises: state.exercises.map((ex) => {
            if (ex.local_id !== exLocalId) return ex;
            const filtered = ex.sets
              .filter((s) => s.local_id !== setLocalId)
              .map((s, idx) => ({ ...s, set_number: idx + 1 }));
            return {
              ...ex,
              sets: recomputeSessionSetsPrFlags(filtered, ex.historical_max_weight_kg, ex.historical_max_1rm_kg),
            };
          }),
        })),

      clearActiveSession: () => set({ ...INITIAL_STATE, sessionDate: getLocalTodayIso() }),
    }),
    { name: 'fitcouple-active-workout-v1' }
  )
);
