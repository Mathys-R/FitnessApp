// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SetRow } from '@/features/workout/components/SetRow';
import { useActiveWorkoutStore } from '@/features/workout/store/active-workout.store';
import type { ActiveWorkoutSet } from '@/features/workout/types/workout-store.types';
import { toast } from 'sonner';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

describe('Workout SetRow Component Suite', () => {
  const initialSet: ActiveWorkoutSet = {
    local_id: 'set-1', set_number: 1, weight_input: '', reps_input: '',
    ghost_weight_kg: 80, ghost_reps: 10, rest_seconds: 90,
    is_warmup: false, is_completed: false, is_pr: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    useActiveWorkoutStore.setState({
      isActive: true,
      exercises: [{
        local_id: 'ex-1',
        exercise_id: '00000000-0000-4000-e000-000000000001',
        exercise_name: 'Développé couché',
        primary_muscle: 'Pecs',
        pinned_note: '',
        session_note: '',
        historical_max_weight_kg: 90,
        historical_max_1rm_kg: 110,
        sets: [{ ...initialSet }],
      }],
    });
  });

  it('affiche le numéro de série, les ghost values et les placeholders', () => {
    render(<SetRow exerciseLocalId="ex-1" set={initialSet} />);

    expect(screen.getByRole('button', { name: 'Série 1' })).toBeDefined();
    expect(screen.getByText('80kg × 10')).toBeDefined();

    const weightInput = screen.getByLabelText('Poids série 1') as HTMLInputElement;
    const repsInput = screen.getByLabelText('Répétitions série 1') as HTMLInputElement;

    expect(weightInput.placeholder).toBe('80');
    expect(repsInput.placeholder).toBe('10');
    expect(weightInput.value).toBe('');
    expect(repsInput.value).toBe('');
  });

  it('1-Tap Ghost Fallback : valide la série avec les ghost values si inputs vides', () => {
    const onTimerStart = vi.fn();
    render(<SetRow exerciseLocalId="ex-1" set={initialSet} onTimerStart={onTimerStart} />);

    const validateBtn = screen.getByLabelText('Valider série 1');
    fireEvent.click(validateBtn);

    const state = useActiveWorkoutStore.getState();
    const currentSet = state.exercises[0].sets[0];

    expect(currentSet.is_completed).toBe(true);
    expect(currentSet.weight_input).toBe('80');
    expect(currentSet.reps_input).toBe('10');
    expect(onTimerStart).toHaveBeenCalledWith(90);
  });

  it('affiche une erreur toast si inputs vides ET aucune ghost value', () => {
    const emptyGhostSet: ActiveWorkoutSet = {
      ...initialSet,
      ghost_weight_kg: null,
      ghost_reps: null,
    };
    render(<SetRow exerciseLocalId="ex-1" set={emptyGhostSet} />);

    fireEvent.click(screen.getByLabelText('Valider série 1'));
    expect(toast.error).toHaveBeenCalledWith('Renseignez charge et répétitions');
  });

  it('préserve la saisie avec virgule française (ex: 82,5)', () => {
    render(<SetRow exerciseLocalId="ex-1" set={initialSet} />);

    const weightInput = screen.getByLabelText('Poids série 1');
    fireEvent.change(weightInput, { target: { value: '82,5' } });

    const state = useActiveWorkoutStore.getState();
    expect(state.exercises[0].sets[0].weight_input).toBe('82,5');
  });

  it('bascule en échauffement (is_warmup: true) et exclut le PR', () => {
    useActiveWorkoutStore.setState({
      isActive: true,
      exercises: [
        {
          local_id: 'ex-1',
          exercise_id: '00000000-0000-4000-e000-000000000001',
          exercise_name: 'Développé couché',
          primary_muscle: 'Pecs',
          pinned_note: '',
          session_note: '',
          historical_max_weight_kg: 90,
          historical_max_1rm_kg: 110,
          sets: [
            {
              ...initialSet,
              weight_input: '100',
              reps_input: '10',
              is_warmup: false,
              is_completed: false,
            },
          ],
        },
      ],
    });

    const setObj = useActiveWorkoutStore.getState().exercises[0].sets[0];
    const { rerender } = render(<SetRow exerciseLocalId="ex-1" set={setObj} />);

    const warmupBtn = screen.getByRole('button', { name: 'Série 1' });
    fireEvent.click(warmupBtn);

    const stateAfterWarmup = useActiveWorkoutStore.getState();
    expect(stateAfterWarmup.exercises[0].sets[0].is_warmup).toBe(true);

    rerender(
      <SetRow exerciseLocalId="ex-1" set={stateAfterWarmup.exercises[0].sets[0]} />
    );

    const validateBtn = screen.getByLabelText('Valider série 1');
    fireEvent.click(validateBtn);

    const stateFinal = useActiveWorkoutStore.getState();
    const validatedSet = stateFinal.exercises[0].sets[0];
    expect(validatedSet.is_completed).toBe(true);
    expect(validatedSet.is_pr).toBe(false);
  });
});
