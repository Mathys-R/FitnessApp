// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWorkoutPresets,
  createWorkoutPreset,
  updateWorkoutPreset,
  deleteWorkoutPreset,
  buildActiveExercisesFromPreset,
  type WorkoutPresetWithExercises,
} from '@/features/workout/services/presets.service';
import { getExerciseGhostAndRecords } from '@/features/workout/services/ghost-records.service';
import { createClient } from '@/lib/supabase/client';
import { mockExerciseBench, mockWorkoutPresetPush } from '../fixtures/workout.fixture';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('@/features/workout/services/ghost-records.service', () => ({
  getExerciseGhostAndRecords: vi.fn(),
}));

describe('Workout Presets Service Suite', () => {
  const mockUserId = '00000000-0000-4000-a000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('charge la liste des presets ordonnée pour l utilisateur courant', async () => {
    const mockPresetsData: WorkoutPresetWithExercises[] = [
      {
        ...mockWorkoutPresetPush,
        workout_preset_exercises: [{
          id: 'wpe-1',
          preset_id: mockWorkoutPresetPush.id,
          exercise_id: mockExerciseBench.id,
          order_index: 0,
          target_sets: 4,
          default_weight_kg: 80,
          default_reps: 10,
          target_rest_seconds: 90,
          exercise: mockExerciseBench,
        }],
      },
    ];

    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: mockUserId } } }) },
      from: () => ({ select: () => ({ eq: () => ({ order: async () => ({ data: mockPresetsData, error: null }) }) }) }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);

    const result = await getWorkoutPresets();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Push Lourd (Pecs / Épaules / Triceps)');
    expect(result[0].workout_preset_exercises[0].exercise.name).toBe('Développé couché barre');
  });

  it('crée un nouveau preset avec ses exercices associés', async () => {
    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: mockUserId } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'workout_presets') {
          return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: 'preset-created-id' }, error: null }) }) }) };
        }
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);

    const presetId = await createWorkoutPreset({
      name: 'Legs Focus',
      description: 'Quadriceps et ischios',
      exercises: [{ exercise_id: mockExerciseBench.id, target_sets: 4, default_weight_kg: 100, default_reps: 8, target_rest_seconds: 120 }],
    });

    expect(presetId).toBe('preset-created-id');
    expect(mockSupabase.from).toHaveBeenCalledWith('workout_presets');
    expect(mockSupabase.from).toHaveBeenCalledWith('workout_preset_exercises');
  });

  it('met à jour et supprime un preset existant', async () => {
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const mockInsert = vi.fn().mockResolvedValue({ error: null });

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'workout_presets') {
          return { update: mockUpdate, delete: mockDelete };
        }
        return { delete: mockDelete, insert: mockInsert };
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);

    await updateWorkoutPreset('preset-push-01', {
      name: 'Push Modifié',
      exercises: [{ exercise_id: mockExerciseBench.id, target_sets: 3 }],
    });

    expect(mockUpdate).toHaveBeenCalled();
    expect(mockDelete).toHaveBeenCalled();
    expect(mockInsert).toHaveBeenCalled();

    await deleteWorkoutPreset('preset-push-01');
    expect(mockDelete).toHaveBeenCalled();
  });

  it('buildActiveExercisesFromPreset : injecte les ghost values et target sets', async () => {
    vi.mocked(getExerciseGhostAndRecords).mockResolvedValue({
      pinned_note: 'Banc incliné à 30°',
      historical_max_weight_kg: 100,
      historical_max_1rm_kg: 120,
      last_session_sets: [
        { set_number: 1, weight_kg: 85, reps: 10, rest_seconds: 90 },
        { set_number: 2, weight_kg: 90, reps: 8, rest_seconds: 120 },
      ],
    });

    const preset: WorkoutPresetWithExercises = {
      ...mockWorkoutPresetPush,
      workout_preset_exercises: [
        {
          id: 'wpe-1',
          preset_id: mockWorkoutPresetPush.id,
          exercise_id: mockExerciseBench.id,
          order_index: 0,
          target_sets: 3,
          default_weight_kg: 80,
          default_reps: 10,
          target_rest_seconds: 90,
          exercise: mockExerciseBench,
        },
      ],
    };

    const activeExercises = await buildActiveExercisesFromPreset(preset);

    expect(activeExercises).toHaveLength(1);
    const ex = activeExercises[0];
    expect(ex.exercise_name).toBe(mockExerciseBench.name);
    expect(ex.pinned_note).toBe('Banc incliné à 30°');
    expect(ex.historical_max_weight_kg).toBe(100);
    expect(ex.sets).toHaveLength(3);

    // Série 1 : prend le 1er ghost set (85kg x 10)
    expect(ex.sets[0].ghost_weight_kg).toBe(85);
    expect(ex.sets[0].ghost_reps).toBe(10);
    // Série 2 : prend le 2e ghost set (90kg x 8)
    expect(ex.sets[1].ghost_weight_kg).toBe(90);
    expect(ex.sets[1].ghost_reps).toBe(8);
    // Série 3 : fallback sur le dernier ghost set disponible (90kg x 8)
    expect(ex.sets[2].ghost_weight_kg).toBe(90);
    expect(ex.sets[2].ghost_reps).toBe(8);
  });
});
