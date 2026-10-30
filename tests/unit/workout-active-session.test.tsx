// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActiveSession } from '@/features/workout/components/ActiveSession';
import { useActiveWorkoutStore } from '@/features/workout/store/active-workout.store';
import type { ActiveWorkoutExercise } from '@/features/workout/types/workout-store.types';

describe('Workout Active Session & Store Resilience Suite', () => {
  const sampleExercise: ActiveWorkoutExercise = {
    local_id: 'ex-bench-01',
    exercise_id: '00000000-0000-4000-e000-000000000001',
    exercise_name: 'Développé couché barre',
    primary_muscle: 'Pecs',
    pinned_note: 'Banc au cran 3',
    session_note: 'Bonne forme',
    historical_max_weight_kg: 100,
    historical_max_1rm_kg: 120,
    sets: [
      {
        local_id: 'set-s1',
        set_number: 1,
        weight_input: '90',
        reps_input: '8',
        ghost_weight_kg: 85,
        ghost_reps: 10,
        rest_seconds: 120,
        is_warmup: false,
        is_completed: true,
        is_pr: false,
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useActiveWorkoutStore.getState().clearActiveSession();
  });

  it('persiste l état complet dans localStorage fitcouple-active-workout-v1 résistant aux crashs', () => {
    const store = useActiveWorkoutStore.getState();
    store.startSession({
      sessionName: 'Séance Push Force',
      sessionDate: '2026-10-30',
      exercises: [{ ...sampleExercise }],
    });

    store.updateExerciseNotes('ex-bench-01', 'session_note', 'Épaule droite échauffée');
    store.updateSetField('ex-bench-01', 'set-s1', 'weight_input', '92.5');

    // Vérification du localStorage
    const storedRaw = window.localStorage.getItem('fitcouple-active-workout-v1');
    expect(storedRaw).toBeDefined();
    expect(storedRaw).not.toBeNull();

    const parsed = JSON.parse(storedRaw!);
    expect(parsed.state.isActive).toBe(true);
    expect(parsed.state.sessionName).toBe('Séance Push Force');
    expect(parsed.state.startedAtIso).toBeDefined();
    expect(parsed.state.exercises[0].session_note).toBe('Épaule droite échauffée');
    expect(parsed.state.exercises[0].sets[0].weight_input).toBe('92.5');
  });

  it('gère l ajout, suppression d exercice et la ré-indexation stricte des séries', () => {
    const store = useActiveWorkoutStore.getState();
    store.startSession({
      sessionName: 'Full Body Test',
      exercises: [{ ...sampleExercise }],
    });

    // Ajout d'une 2e série
    store.addSetToExercise('ex-bench-01');
    let ex = useActiveWorkoutStore.getState().exercises[0];
    expect(ex.sets).toHaveLength(2);
    expect(ex.sets[1].set_number).toBe(2);

    // Ajout d'une 3e série
    store.addSetToExercise('ex-bench-01');
    ex = useActiveWorkoutStore.getState().exercises[0];
    expect(ex.sets).toHaveLength(3);
    expect(ex.sets[2].set_number).toBe(3);

    const set1Id = ex.sets[0].local_id;
    // Suppression de la 1ère série -> ré-indexation des séries 2 et 3 qui deviennent 1 et 2
    store.removeSetFromExercise('ex-bench-01', set1Id);
    ex = useActiveWorkoutStore.getState().exercises[0];
    expect(ex.sets).toHaveLength(2);
    expect(ex.sets[0].set_number).toBe(1);
    expect(ex.sets[1].set_number).toBe(2);

    // Suppression de l'exercice
    store.removeExerciseFromSession('ex-bench-01');
    expect(useActiveWorkoutStore.getState().exercises).toHaveLength(0);
  });

  it('sécurise l abandon de séance via dialogue de confirmation pour éviter les pertes accidentelles', () => {
    useActiveWorkoutStore.getState().startSession({
      sessionName: 'Séance Anti-Perte',
      exercises: [{ ...sampleExercise }],
    });

    const confirmSpy = vi.spyOn(window, 'confirm');

    // 1. L'utilisateur clique sur Abandonner mais ANNULE la confirmation
    confirmSpy.mockReturnValueOnce(false);
    render(<ActiveSession />);

    const abandonBtn = screen.getByRole('button', { name: /abandonner/i });
    fireEvent.click(abandonBtn);

    expect(confirmSpy).toHaveBeenCalledTimes(1);
    expect(useActiveWorkoutStore.getState().isActive).toBe(true);
    expect(useActiveWorkoutStore.getState().exercises).toHaveLength(1);

    // 2. L'utilisateur clique sur Abandonner et CONFIRME
    confirmSpy.mockReturnValueOnce(true);
    fireEvent.click(abandonBtn);

    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(useActiveWorkoutStore.getState().isActive).toBe(false);
    expect(useActiveWorkoutStore.getState().exercises).toHaveLength(0);
  });
});

