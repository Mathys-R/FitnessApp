// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetRow } from '@/features/workout/components/SetRow';
import { useActiveWorkoutStore } from '@/features/workout/store/active-workout.store';
import { finishAndSaveWorkoutSession } from '@/features/workout/services/sessions.service';
import { getWeekSessions } from '@/features/workout/services/calendar.service';
import { computeEffectiveTonnage, computeEpley1Rm } from '@/lib/math/workout-kpis.math';
import { createClient } from '@/lib/supabase/client';
import type { ActiveWorkoutSet } from '@/features/workout/types/workout-store.types';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('Workout Chaos & Monkey Testing Suite', () => {
  const initialSet: ActiveWorkoutSet = {
    local_id: 'chaos-set-1',
    set_number: 1,
    weight_input: '100',
    reps_input: '10',
    ghost_weight_kg: 90,
    ghost_reps: 10,
    rest_seconds: 90,
    is_warmup: false,
    is_completed: false,
    is_pr: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useActiveWorkoutStore.setState({
      isActive: true,
      exercises: [
        {
          local_id: 'ex-chaos',
          exercise_id: '00000000-0000-4000-e000-000000000001',
          exercise_name: 'Développé couché',
          primary_muscle: 'Pecs',
          pinned_note: '',
          session_note: '',
          historical_max_weight_kg: 80,
          historical_max_1rm_kg: 100,
          sets: [{ ...initialSet }],
        },
      ],
    });
  });

  it('clics frénétiques (5 clics en 100ms) sur validation : idempotence et 0 crash', () => {
    const onTimerStart = vi.fn();
    const { rerender } = render(<SetRow exerciseLocalId="ex-chaos" set={initialSet} onTimerStart={onTimerStart} />);
    const validateBtn = screen.getByLabelText('Valider série 1');

    for (let i = 0; i < 5; i++) {
      fireEvent.click(validateBtn);
      const currentSet = useActiveWorkoutStore.getState().exercises[0].sets[0];
      rerender(<SetRow exerciseLocalId="ex-chaos" set={currentSet} onTimerStart={onTimerStart} />);
    }

    const currentEx = useActiveWorkoutStore.getState().exercises[0];
    expect(currentEx.sets).toHaveLength(1);
    expect(currentEx.sets[0].is_completed).toBe(true);
  });

  it('injection de valeurs aberrantes : résilience sans NaN', () => {
    render(<SetRow exerciseLocalId="ex-chaos" set={initialSet} />);
    const weightInput = screen.getByLabelText('Poids série 1');
    const repsInput = screen.getByLabelText('Répétitions série 1');

    fireEvent.change(weightInput, { target: { value: '-500' } });
    fireEvent.change(repsInput, { target: { value: '999999999' } });
    expect(useActiveWorkoutStore.getState().exercises[0].sets[0].weight_input).toBe('-500');

    expect(Number.isFinite(computeEpley1Rm(-500, 999999999))).toBe(true);

    fireEvent.change(weightInput, { target: { value: '🏋️‍♂️💥@@#$%' } });
    expect(useActiveWorkoutStore.getState().exercises[0].sets[0].weight_input).toBe('🏋️‍♂️💥@@#$%');

    const rawSets = [
      { weight_input: '-50', reps_input: '10', is_warmup: false, is_completed: true },
      { weight_input: 'invalid_text_!@#', reps_input: '10', is_warmup: false, is_completed: true },
      { weight_input: '100', reps_input: '5', is_warmup: false, is_completed: true },
    ];
    const sanitized = rawSets.map((s) => ({
      weight_kg: Number.parseFloat(s.weight_input.replace(',', '.')) || 0,
      reps: Number.parseInt(s.reps_input, 10) || 0,
      is_warmup: s.is_warmup,
      is_completed: s.is_completed,
    }));
    expect(computeEffectiveTonnage(sanitized)).toBe(500);
  });

  it('effacement d une note avec uniquement des espaces : appel DELETE bien ciblé', async () => {
    const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
    const mockUpsert = vi.fn();
    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'u-chaos' } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'workout_sessions') return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: 's1' }, error: null }) }) }) };
        if (table === 'user_exercise_notes') return { delete: mockDelete, upsert: mockUpsert };
        if (table === 'workout_session_exercises') return { insert: () => ({ select: async () => ({ data: [{ id: 'se-1', order_index: 0 }], error: null }) }) };
        return { insert: async () => ({ error: null }), update: () => ({ eq: async () => ({ error: null }) }) };
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);

    await finishAndSaveWorkoutSession({
      plannedSessionId: null,
      sourcePresetId: null,
      sessionDate: '2026-10-30',
      sessionName: 'Chaos Session',
      durationSeconds: 1200,
      exercises: [{
        local_id: 'ex-1',
        exercise_id: '00000000-0000-4000-e000-000000000001',
        exercise_name: 'Pecs',
        primary_muscle: 'Pecs',
        pinned_note: '     \t\n  ',
        session_note: 'Note',
        historical_max_weight_kg: 0,
        historical_max_1rm_kg: 0,
        sets: [],
      }],
      presetAction: 'keep_unchanged',
    });

    expect(mockDelete).toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('bascules de semaines rapides concurrentes (Race Condition Network) : stabilité des données', async () => {
    let resolveWeek1: (val: unknown) => void = () => { };
    let resolveWeek2: (val: unknown) => void = () => { };

    const promise1 = new Promise((r) => { resolveWeek1 = r; });
    const promise2 = new Promise((r) => { resolveWeek2 = r; });

    let callCount = 0;
    const mockSupabase = {
      auth: { getUser: async () => ({ data: { user: { id: 'u-chaos' } } }) },
      from: () => ({
        select: () => ({
          eq: () => ({
            gte: () => ({
              lte: () => ({
                order: () => {
                  callCount++;
                  return callCount === 1 ? promise1 : promise2;
                },
              }),
            }),
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);

    // L'utilisateur clique sur Semaine 1 puis immédiatement sur Semaine 2
    const req1 = getWeekSessions('2026-10-19', '2026-10-25');
    const req2 = getWeekSessions('2026-10-26', '2026-11-01');

    // La requête 2 répond avant la requête 1 (inversion réseau)
    resolveWeek2({ data: [{ id: 'sess-week-2', session_date: '2026-10-28', status: 'completed' }], error: null });
    const res2 = await req2;
    expect(res2[0].id).toBe('sess-week-2');

    resolveWeek1({ data: [{ id: 'sess-week-1', session_date: '2026-10-20', status: 'completed' }], error: null });
    const res1 = await req1;
    expect(res1[0].id).toBe('sess-week-1');
  });
});
