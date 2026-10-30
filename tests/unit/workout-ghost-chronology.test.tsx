// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getExerciseGhostAndRecords } from '@/features/workout/services/ghost-records.service';
import { createClient } from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));

interface MockSession {
  id: string;
  session_date: string;
  workout_session_exercises: Array<{
    id: string;
    exercise_id: string;
    workout_sets: Array<{
      set_number: number;
      weight_kg: number;
      reps: number;
      rest_seconds: number;
      is_warmup: boolean;
      is_completed: boolean;
      epley_1rm: number;
    }>;
  }>;
}

describe('Workout Ghost Values Chronological Order Suite', () => {
  const mockUserId = '00000000-0000-4000-a000-000000000001';
  const exerciseBenchId = 'ex-bench-001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('récupère les Ghost Values selon session_date DESC (et non created_at)', async () => {
    // Séance A : 28/10/2026 (agenda récent), created_at ancien
    const sessionRecentAgenda: MockSession = {
      id: 'session-recent-agenda',
      session_date: '2026-10-28',
      workout_session_exercises: [{
        id: 'wse-recent',
        exercise_id: exerciseBenchId,
        workout_sets: [
          { set_number: 1, weight_kg: 100, reps: 8, rest_seconds: 90, is_warmup: false, is_completed: true, epley_1rm: 124 },
          { set_number: 2, weight_kg: 105, reps: 6, rest_seconds: 120, is_warmup: false, is_completed: true, epley_1rm: 126 },
        ],
      }],
    };

    // Séance B : 20/10/2026 (agenda ancien), mais created_at récent (saisie rétroactive)
    const sessionOlderAgenda: MockSession = {
      id: 'session-older-agenda',
      session_date: '2026-10-20',
      workout_session_exercises: [{
        id: 'wse-older',
        exercise_id: exerciseBenchId,
        workout_sets: [{ set_number: 1, weight_kg: 80, reps: 10, rest_seconds: 90, is_warmup: false, is_completed: true, epley_1rm: 106.67 }],
      }],
    };

    let capturedOrderCol = '';
    let capturedOrderAsc = true;

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation((col: string, opt: { ascending: boolean }) => {
        capturedOrderCol = col;
        capturedOrderAsc = opt.ascending;
        return mockQuery;
      }),
      neq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockImplementation(async () => ({
        data: capturedOrderCol === 'session_date' && !capturedOrderAsc ? [sessionRecentAgenda] : [sessionOlderAgenda],
        error: null,
      })),
    };

    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: mockUserId } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'user_exercise_notes') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { pinned_note: 'Banc plat' } }) }) }) }) };
        }
        if (table === 'workout_sessions') return mockQuery;
        if (table === 'workout_sets') {
          return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ eq: async () => ({
            data: [{ weight_kg: 105, epley_1rm: 126 }, { weight_kg: 100, epley_1rm: 124 }],
            error: null,
          }) }) }) }) }) };
        }
        return {};
      }),
    };

    vi.mocked(createClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);

    const result = await getExerciseGhostAndRecords(exerciseBenchId);

    expect(capturedOrderCol).toBe('session_date');
    expect(capturedOrderAsc).toBe(false);
    expect(result.last_session_sets).toHaveLength(2);
    expect(result.last_session_sets[0].weight_kg).toBe(100);
    expect(result.last_session_sets[0].reps).toBe(8);
    expect(result.last_session_sets[1].weight_kg).toBe(105);
    expect(result.last_session_sets[1].reps).toBe(6);
    expect(result.pinned_note).toBe('Banc plat');
    expect(result.historical_max_weight_kg).toBe(105);
    expect(result.historical_max_1rm_kg).toBe(126);
  });

  it('exclut la session en cours d édition avec excludeSessionId', async () => {
    let capturedNeqCol = '';
    let capturedNeqVal = '';

    const mockQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      neq: vi.fn().mockImplementation((col: string, val: string) => {
        capturedNeqCol = col;
        capturedNeqVal = val;
        return mockQuery;
      }),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    };

    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: mockUserId } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'user_exercise_notes') {
          return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }) };
        }
        if (table === 'workout_sessions') return mockQuery;
        if (table === 'workout_sets') {
          return { select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ eq: async () => ({ data: [], error: null }) }) }) }) }) };
        }
        return {};
      }),
    };

    vi.mocked(createClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);

    await getExerciseGhostAndRecords(exerciseBenchId, 'session-current-edited');

    expect(capturedNeqCol).toBe('id');
    expect(capturedNeqVal).toBe('session-current-edited');
  });
});
