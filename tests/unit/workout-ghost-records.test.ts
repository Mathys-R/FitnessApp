// tests/unit/workout-ghost-records.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getExerciseGhostAndRecords } from '@/features/workout/services/ghost-records.service';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: mockGetUser,
    },
    from: mockFrom,
  }),
}));

describe('getExerciseGhostAndRecords (Couche 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'usr-123' } },
    });
  });

  it('interroge workout_sessions trié par session_date DESC pour les ghost values', async () => {
    const orderCalls: Array<{ column: string; options: { ascending: boolean } }> = [];
    const eqCalls: Array<[string, unknown]> = [];

    const mockSessionsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockImplementation((col, val) => {
        eqCalls.push([col, val]);
        return mockSessionsQuery;
      }),
      neq: vi.fn().mockReturnThis(),
      order: vi.fn().mockImplementation((col, opt) => {
        orderCalls.push({ column: col, options: opt });
        return mockSessionsQuery;
      }),
      limit: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'sess-recent',
            session_date: '2026-10-30',
            workout_session_exercises: [
              {
                id: 'wse-1',
                exercise_id: 'ex-bench',
                workout_sets: [
                  {
                    set_number: 2,
                    weight_kg: 82.5,
                    reps: 8,
                    rest_seconds: 90,
                    is_completed: true,
                    is_warmup: false,
                    epley_1rm: 104,
                  },
                  {
                    set_number: 1,
                    weight_kg: 80,
                    reps: 10,
                    rest_seconds: 90,
                    is_completed: true,
                    is_warmup: false,
                    epley_1rm: 106.7,
                  },
                  {
                    set_number: 3,
                    weight_kg: 85,
                    reps: 5,
                    rest_seconds: 90,
                    is_completed: false, // Incomplète, doit être ignorée
                    is_warmup: false,
                    epley_1rm: 95,
                  },
                ],
              },
            ],
          },
        ],
        error: null,
      }),
    };

    const mockNotesQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { pinned_note: 'Grip large' },
        error: null,
      }),
    };

    const mockBestSetsQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((resolve) =>
        resolve({
          data: [
            { weight_kg: 90, epley_1rm: 110 },
            { weight_kg: 100, epley_1rm: 115 },
          ],
          error: null,
        })
      ),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_exercise_notes') return mockNotesQuery;
      if (table === 'workout_sessions') return mockSessionsQuery;
      if (table === 'workout_sets') return mockBestSetsQuery;
      throw new Error(`Table inattendue : ${table}`);
    });

    const result = await getExerciseGhostAndRecords('ex-bench', 'sess-excluded');

    // 1. Vérification que la table interrogée pour les ghost values est bien workout_sessions
    expect(mockFrom).toHaveBeenCalledWith('workout_sessions');

    // 2. Vérification du tri sur session_date DESC (date de l'agenda)
    expect(orderCalls).toEqual([
      { column: 'session_date', options: { ascending: false } },
    ]);

    // 3. Vérification des filtres
    expect(eqCalls).toContainEqual(['user_id', 'usr-123']);
    expect(eqCalls).toContainEqual(['status', 'completed']);
    expect(eqCalls).toContainEqual(['workout_session_exercises.exercise_id', 'ex-bench']);
    expect(mockSessionsQuery.neq).toHaveBeenCalledWith('id', 'sess-excluded');

    // 4. Vérification des séries extraites (triées par set_number, uniquement complétées)
    expect(result.last_session_sets).toEqual([
      { set_number: 1, weight_kg: 80, reps: 10, rest_seconds: 90 },
      { set_number: 2, weight_kg: 82.5, reps: 8, rest_seconds: 90 },
    ]);

    // 5. Vérification des records historiques et notes épinglées
    expect(result.pinned_note).toBe('Grip large');
    expect(result.historical_max_weight_kg).toBe(100);
    expect(result.historical_max_1rm_kg).toBe(115);
  });
});
