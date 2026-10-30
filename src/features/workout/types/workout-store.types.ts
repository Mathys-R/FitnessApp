// src/features/workout/types/workout-store.types.ts

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

export interface StartSessionPayload {
  sessionName: string;
  sessionDate?: string;
  editingSessionId?: string | null;
  plannedSessionId?: string | null;
  sourcePresetId?: string | null;
  exercises?: ActiveWorkoutExercise[];
}

export interface ActiveWorkoutState {
  isActive: boolean;
  editingSessionId: string | null;
  plannedSessionId: string | null;
  sourcePresetId: string | null;
  sessionDate: string;
  sessionName: string;
  startedAtIso: string | null;
  exercises: ActiveWorkoutExercise[];

  startSession: (payload: StartSessionPayload) => void;
  updateSetField: (
    exLocalId: string,
    setLocalId: string,
    field: 'weight_input' | 'reps_input' | 'rest_seconds' | 'is_warmup',
    value: string | number | boolean
  ) => void;
  toggleCompleteSetWithGhostFallback: (
    exLocalId: string,
    setLocalId: string
  ) => { becamePr: boolean };
  updateExerciseNotes: (
    exLocalId: string,
    field: 'pinned_note' | 'session_note',
    value: string
  ) => void;
  addExerciseToSession: (exercise: ActiveWorkoutExercise) => void;
  removeExerciseFromSession: (exLocalId: string) => void;
  addSetToExercise: (exLocalId: string) => void;
  removeSetFromExercise: (exLocalId: string, setLocalId: string) => void;
  clearActiveSession: () => void;
}

