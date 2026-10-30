// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getWeekSessions,
  scheduleOrMoveWeekSession,
  loadSessionForEditing,
} from '@/features/workout/services/calendar.service';
import { getExerciseGhostAndRecords } from '@/features/workout/services/ghost-records.service';
import { getWeekDatesIso, shiftDateIso } from '@/lib/date.utils';
import { createClient } from '@/lib/supabase/client';
import { mockExerciseBench, mockCompletedSession } from '../fixtures/workout.fixture';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('@/features/workout/services/ghost-records.service', () => ({
  getExerciseGhostAndRecords: vi.fn(),
}));

describe('Workout Calendar Service & Navigation Suite', () => {
  const mockUserId = '00000000-0000-4000-a000-000000000001';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('génère et navigue les semaines de 7 jours (Lundi -> Dimanche)', () => {
    // Mercredi 28 octobre 2026
    const wednesdayIso = '2026-10-28';
    const weekDates = getWeekDatesIso(wednesdayIso);

    expect(weekDates).toHaveLength(7);
    expect(weekDates[0]).toBe('2026-10-26'); // Lundi
    expect(weekDates[6]).toBe('2026-11-01'); // Dimanche

    const nextWeekMonday = shiftDateIso(weekDates[0], 7);
    expect(nextWeekMonday).toBe('2026-11-02');

    const prevWeekMonday = shiftDateIso(weekDates[0], -7);
    expect(prevWeekMonday).toBe('2026-10-19');
  });

  it('charge les séances de la semaine avec statuts completed, planned, rest_day', async () => {
    const mockSessions = [
      { ...mockCompletedSession, session_date: '2026-10-26', status: 'completed' },
      { ...mockCompletedSession, id: 'sess-p', session_date: '2026-10-28', status: 'planned', name: 'Jambes' },
      { ...mockCompletedSession, id: 'sess-r', session_date: '2026-10-29', status: 'rest_day', name: 'Repos' },
    ];

    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: mockUserId } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: async () => ({ data: mockSessions, error: null }),
              }),
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);

    const sessions = await getWeekSessions('2026-10-26', '2026-11-01');
    expect(sessions).toHaveLength(3);
    expect(sessions[0].status).toBe('completed');
    expect(sessions[1].status).toBe('planned');
    expect(sessions[2].status).toBe('rest_day');
  });

  it('planifie une nouvelle séance ou un jour de repos', async () => {
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: mockUserId } } }) },
      from: () => ({ insert: mockInsert, update: mockUpdate }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);

    // 1. Nouvelle planification
    await scheduleOrMoveWeekSession({
      targetDateIso: '2026-10-31',
      status: 'planned',
      name: 'Full Body',
    });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ session_date: '2026-10-31', status: 'planned', name: 'Full Body' })
    );

    // 2. Déplacement en jour de repos
    await scheduleOrMoveWeekSession({
      existingSessionId: 'sess-p',
      targetDateIso: '2026-10-31',
      status: 'rest_day',
      name: 'Full Body',
    });
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ session_date: '2026-10-31', status: 'rest_day', name: 'Repos' })
    );
  });

  it('loadSessionForEditing : charge et reconstruit la séance passée pour correction', async () => {
    vi.mocked(getExerciseGhostAndRecords).mockResolvedValue({
      pinned_note: 'Prise large',
      historical_max_weight_kg: 100,
      historical_max_1rm_kg: 120,
      last_session_sets: [],
    });

    const mockSession = { ...mockCompletedSession, id: 'session-to-edit', name: 'Push du 28/10' };
    const mockSessionExs = [
      {
        id: 'se-1',
        session_id: 'session-to-edit',
        exercise_id: mockExerciseBench.id,
        order_index: 0,
        session_note: 'Faute de frappe sur le poids',
        exercise: mockExerciseBench,
        workout_sets: [
          { id: 'set-1', set_number: 1, weight_kg: 80, reps: 10, rest_seconds: 90, is_warmup: false, is_completed: true, is_pr: false },
          { id: 'set-2', set_number: 2, weight_kg: 85, reps: 8, rest_seconds: 120, is_warmup: false, is_completed: true, is_pr: false },
        ],
      },
    ];

    const mockSupabase = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'workout_sessions') {
          return { select: () => ({ eq: () => ({ single: async () => ({ data: mockSession, error: null }) }) }) };
        }
        return { select: () => ({ eq: () => ({ order: async () => ({ data: mockSessionExs, error: null }) }) }) };
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);

    const { session, exercises } = await loadSessionForEditing('session-to-edit');

    expect(session.id).toBe('session-to-edit');
    expect(exercises).toHaveLength(1);

    const ex = exercises[0];
    expect(ex.exercise_name).toBe(mockExerciseBench.name);
    expect(ex.session_note).toBe('Faute de frappe sur le poids');
    expect(ex.pinned_note).toBe('Prise large');
    expect(ex.sets).toHaveLength(2);

    // Série 1
    expect(ex.sets[0].weight_input).toBe('80');
    expect(ex.sets[0].reps_input).toBe('10');
    expect(ex.sets[0].is_completed).toBe(true);

    // Série 2
    expect(ex.sets[1].weight_input).toBe('85');
    expect(ex.sets[1].reps_input).toBe('8');
    expect(ex.sets[1].is_completed).toBe(true);
  });
});
