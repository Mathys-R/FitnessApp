// tests/fixtures/workout.fixture.ts
import type { Database } from '@/types/database.types';
import { mockUserA } from './profiles.fixture';

export type ExerciseRow = Database['public']['Tables']['exercises']['Row'];
export type WorkoutPresetRow = Database['public']['Tables']['workout_presets']['Row'];
export type WorkoutSessionRow = Database['public']['Tables']['workout_sessions']['Row'];

export const mockExerciseBench: ExerciseRow = {
  id: '00000000-0000-4000-e000-000000000001',
  name: 'Développé couché barre',
  primary_muscle: 'Pecs',
  secondary_muscles: ['Triceps', 'Épaules'],
  image_url: null,
  setup_guide: 'Exercice polyarticulaire de base pour les pectoraux.',
  is_archived: false,
  created_by: null,
  created_at: '2026-01-01T08:00:00Z',
};

export const mockExerciseSquat: ExerciseRow = {
  id: '00000000-0000-4000-e000-000000000002',
  name: 'Squat barre nuque',
  primary_muscle: 'Quadriceps',
  secondary_muscles: ['Fessiers', 'Ischios'],
  image_url: null,
  setup_guide: 'Mouvement fondamental pour le bas du corps.',
  is_archived: false,
  created_by: null,
  created_at: '2026-01-01T08:00:00Z',
};

export const mockExercisePullup: ExerciseRow = {
  id: '00000000-0000-4000-e000-000000000003',
  name: 'Tractions pronation',
  primary_muscle: 'Dos',
  secondary_muscles: ['Biceps'],
  image_url: null,
  setup_guide: 'Traction verticale poids du corps ou lesté.',
  is_archived: false,
  created_by: null,
  created_at: '2026-01-01T08:00:00Z',
};

export const mockWorkoutPresetPush: WorkoutPresetRow = {
  id: 'preset-push-01',
  user_id: mockUserA.id,
  name: 'Push Lourd (Pecs / Épaules / Triceps)',
  description: 'Séance focus haut du corps force',
  created_at: '2026-01-01T08:00:00Z',
  updated_at: '2026-01-01T08:00:00Z',
};

export const mockCompletedSession: WorkoutSessionRow = {
  id: 'session-01',
  user_id: mockUserA.id,
  preset_id: mockWorkoutPresetPush.id,
  name: 'Push Lourd',
  session_date: '2026-10-28',
  status: 'completed',
  duration_seconds: 4500,
  session_comment: 'Bonne congestion, PR validé sur la dernière série',
  created_at: '2026-10-28T18:00:00Z',
  updated_at: '2026-10-28T19:15:00Z',
};

export const mockGhostSetsBench = [
  { set_number: 1, weight_kg: 80, reps: 10, rest_seconds: 120 },
  { set_number: 2, weight_kg: 85, reps: 8, rest_seconds: 120 },
  { set_number: 3, weight_kg: 90, reps: 6, rest_seconds: 150 },
];
