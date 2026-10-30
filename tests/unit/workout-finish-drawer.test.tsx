// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FinishSessionDrawer } from '@/features/workout/components/FinishSessionDrawer';
import { useActiveWorkoutStore } from '@/features/workout/store/active-workout.store';
import { finishAndSaveWorkoutSession } from '@/features/workout/services/sessions.service';
import { createClient } from '@/lib/supabase/client';

vi.mock('@/lib/supabase/client', () => ({ createClient: vi.fn() }));
vi.mock('@/features/workout/services/sessions.service', () => ({
  finishAndSaveWorkoutSession: vi.fn().mockResolvedValue('session-saved-id'),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

describe('Workout FinishSessionDrawer Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useActiveWorkoutStore.setState({
      isActive: true,
      sessionName: 'Push Lourd',
      sessionDate: '2026-10-30',
      startedAtIso: new Date(Date.now() - 3600000).toISOString(),
      sourcePresetId: 'preset-push-01',
      exercises: [
        {
          local_id: 'ex-1',
          exercise_id: '00000000-0000-4000-e000-000000000001',
          exercise_name: 'Développé couché',
          primary_muscle: 'Pecs',
          pinned_note: 'Banc cran 3',
          session_note: 'Top sensation',
          historical_max_weight_kg: 90,
          historical_max_1rm_kg: 110,
          sets: [
            {
              local_id: 's1',
              set_number: 1,
              weight_input: '100',
              reps_input: '10',
              ghost_weight_kg: null,
              ghost_reps: null,
              rest_seconds: 90,
              is_warmup: false,
              is_completed: true,
              is_pr: true,
            },
            {
              local_id: 's2',
              set_number: 2,
              weight_input: '80',
              reps_input: '10',
              ghost_weight_kg: null,
              ghost_reps: null,
              rest_seconds: 90,
              is_warmup: true,
              is_completed: true,
              is_pr: false,
            },
          ],
        },
      ],
    });
  });

  it('calcule correctement le tonnage total et le décompte des PRs', () => {
    render(<FinishSessionDrawer open={true} onOpenChange={vi.fn()} onFinished={vi.fn()} />);
    expect(screen.getByText('1000kg')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
    expect(screen.getByText('1 🏆')).toBeDefined();
  });

  it('flux 1 : enregistre uniquement la séance (keep_unchanged)', async () => {
    const onFinished = vi.fn();
    const onOpenChange = vi.fn();
    render(<FinishSessionDrawer open={true} onOpenChange={onOpenChange} onFinished={onFinished} />);
    fireEvent.click(screen.getByRole('button', { name: /enregistrer uniquement la séance/i }));

    await waitFor(() => {
      expect(finishAndSaveWorkoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ presetAction: 'keep_unchanged', sessionName: 'Push Lourd' })
      );
      expect(onFinished).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('flux 2 : met à jour le preset source (overwrite_source_preset)', async () => {
    render(<FinishSessionDrawer open={true} onOpenChange={vi.fn()} onFinished={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /mettre à jour le preset source/i }));

    await waitFor(() => {
      expect(finishAndSaveWorkoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ presetAction: 'overwrite_source_preset', sourcePresetId: 'preset-push-01' })
      );
    });
  });

  it('flux 3 : crée un nouveau preset avec son nom personnalisé', async () => {
    render(<FinishSessionDrawer open={true} onOpenChange={vi.fn()} onFinished={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText('Nom du nouveau preset'), { target: { value: 'Push Varié 2.0' } });
    fireEvent.click(screen.getByRole('button', { name: /créer un nouveau preset à partir de cette séance/i }));

    await waitFor(() => {
      expect(finishAndSaveWorkoutSession).toHaveBeenCalledWith(
        expect.objectContaining({ presetAction: 'create_new_preset', newPresetName: 'Push Varié 2.0' })
      );
    });
  });

  it('purge user_exercise_notes si la note permanente est vidée', async () => {
    const mockDelete = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) });
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'workout_sessions') return { insert: () => ({ select: () => ({ single: async () => ({ data: { id: 's-new' }, error: null }) }) }) };
        if (table === 'user_exercise_notes') return { delete: mockDelete, upsert: async () => ({ error: null }) };
        if (table === 'workout_session_exercises') return { insert: () => ({ select: async () => ({ data: [{ id: 'se-1', order_index: 0 }], error: null }) }) };
        return { insert: async () => ({ error: null }), update: () => ({ eq: async () => ({ error: null }) }) };
      }),
    };

    const actual = await vi.importActual<typeof import('@/features/workout/services/sessions.service')>(
      '@/features/workout/services/sessions.service'
    );
    vi.mocked(createClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createClient>);

    await actual.finishAndSaveWorkoutSession({
      plannedSessionId: null,
      sourcePresetId: null,
      sessionDate: '2026-10-30',
      sessionName: 'Test Purge Note',
      durationSeconds: 1800,
      exercises: [{
        local_id: 'ex-1',
        exercise_id: 'ex-id-empty',
        exercise_name: 'Poulie',
        primary_muscle: 'Pecs',
        pinned_note: '   ',
        session_note: '',
        historical_max_weight_kg: 30,
        historical_max_1rm_kg: 40,
        sets: [],
      }],
      presetAction: 'keep_unchanged',
    });

    expect(mockSupabase.from).toHaveBeenCalledWith('user_exercise_notes');
    expect(mockDelete).toHaveBeenCalled();
  });
});
