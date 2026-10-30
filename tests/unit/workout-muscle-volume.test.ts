import { describe, it, expect } from 'vitest';
import {
  computeMuscleGroupSetVolumes,
  type ExerciseVolumeInput,
} from '@/lib/math/workout-kpis.math';
import { MUSCLE_GROUPS } from '@/types/domain.types';

describe('workout-kpis.math - Muscle Group Set Volumes', () => {
  it('should initialize all 10 muscle groups to 0', () => {
    const result = computeMuscleGroupSetVolumes([]);
    expect(Object.keys(result)).toHaveLength(10);
    for (const group of MUSCLE_GROUPS) {
      expect(result[group]).toBe(0);
    }
  });

  it('should allocate +1.0 for primary_muscle and +0.5 for each secondary_muscles', () => {
    const exercises: ExerciseVolumeInput[] = [
      {
        primary_muscle: 'Pecs',
        secondary_muscles: ['Triceps', 'Épaules'],
        effective_sets_count: 4,
      },
    ];

    const result = computeMuscleGroupSetVolumes(exercises);
    expect(result['Pecs']).toBe(4);
    expect(result['Triceps']).toBe(2);
    expect(result['Épaules']).toBe(2);
    expect(result['Dos']).toBe(0);
  });

  it('should not double-count if secondary_muscles includes primary_muscle', () => {
    const exercises: ExerciseVolumeInput[] = [
      {
        primary_muscle: 'Dos',
        secondary_muscles: ['Dos', 'Biceps'],
        effective_sets_count: 3,
      },
    ];

    const result = computeMuscleGroupSetVolumes(exercises);
    expect(result['Dos']).toBe(3);
    expect(result['Biceps']).toBe(1.5);
  });

  it('should accumulate correctly across multiple exercises', () => {
    const exercises: ExerciseVolumeInput[] = [
      {
        primary_muscle: 'Dos',
        secondary_muscles: ['Biceps'],
        effective_sets_count: 4,
      },
      {
        primary_muscle: 'Biceps',
        secondary_muscles: [],
        effective_sets_count: 3,
      },
    ];

    const result = computeMuscleGroupSetVolumes(exercises);
    expect(result['Dos']).toBe(4);
    expect(result['Biceps']).toBe(5);
  });

  it('should skip exercises with effective_sets_count <= 0', () => {
    const exercises: ExerciseVolumeInput[] = [
      {
        primary_muscle: 'Pecs',
        secondary_muscles: ['Triceps'],
        effective_sets_count: 0,
      },
      {
        primary_muscle: 'Dos',
        secondary_muscles: ['Biceps'],
        effective_sets_count: -2,
      },
    ];

    const result = computeMuscleGroupSetVolumes(exercises);
    expect(result['Pecs']).toBe(0);
    expect(result['Triceps']).toBe(0);
    expect(result['Dos']).toBe(0);
  });

  it('should ignore unrecognized muscle strings gracefully', () => {
    const exercises: ExerciseVolumeInput[] = [
      {
        primary_muscle: 'UnknownMuscle',
        secondary_muscles: ['AnotherUnknown', 'Triceps'],
        effective_sets_count: 2,
      },
    ];

    const result = computeMuscleGroupSetVolumes(exercises);
    expect(result['Triceps']).toBe(1);
    for (const group of MUSCLE_GROUPS) {
      if (group !== 'Triceps') {
        expect(result[group]).toBe(0);
      }
    }
  });
});

