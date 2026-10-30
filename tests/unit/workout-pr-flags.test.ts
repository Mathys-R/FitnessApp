import { describe, it, expect } from 'vitest';
import { recomputeSessionSetsPrFlags } from '@/lib/math/workout-kpis.math';

describe('workout-kpis.math - Dynamic Session PR Flags', () => {
  it('should flag PRs dynamically and ratchet thresholds within the same session', () => {
    // Historical references: Max weight 90kg, Max 1RM 110kg
    const sets = [
      // Set 1: 100kg x 5 -> 1RM = 100 * (1 + 5/30) = 116.67. Beats both 90kg and 110kg -> PR!
      {
        id: 's1',
        weight_input: '100',
        reps_input: '5',
        is_warmup: false,
        is_completed: true,
        is_pr: false,
      },
      // Set 2: Same performance -> does NOT beat running max (100kg / 116.67) -> NOT PR
      {
        id: 's2',
        weight_input: '100',
        reps_input: '5',
        is_warmup: false,
        is_completed: true,
        is_pr: false,
      },
      // Set 3: 105kg x 3 -> 1RM = 105 * (1 + 3/30) = 115.5. Beats running weight (105 > 100) -> PR!
      {
        id: 's3',
        weight_input: '105',
        reps_input: '3',
        is_warmup: false,
        is_completed: true,
        is_pr: false,
      },
      // Set 4: 95kg x 10 -> 1RM = 95 * (1 + 10/30) = 126.67. Beats running 1RM (126.67 > 116.67) -> PR!
      {
        id: 's4',
        weight_input: '95',
        reps_input: '10',
        is_warmup: false,
        is_completed: true,
        is_pr: false,
      },
      // Set 5: 90kg x 8 -> 1RM = 114. Beats neither 105kg nor 126.67kg -> NOT PR
      {
        id: 's5',
        weight_input: '90',
        reps_input: '8',
        is_warmup: false,
        is_completed: true,
        is_pr: false,
      },
    ];

    const result = recomputeSessionSetsPrFlags(sets, 90, 110);
    expect(result.map((s) => s.is_pr)).toEqual([true, false, true, true, false]);
  });

  it('should ignore warmup sets and uncompleted sets for PR flags and threshold updates', () => {
    const sets = [
      {
        id: 'w1',
        weight_input: '200',
        reps_input: '10',
        is_warmup: true,
        is_completed: true,
        is_pr: false,
      },
      {
        id: 'i1',
        weight_input: '200',
        reps_input: '10',
        is_warmup: false,
        is_completed: false,
        is_pr: false,
      },
      {
        id: 's1',
        weight_input: '100',
        reps_input: '5',
        is_warmup: false,
        is_completed: true,
        is_pr: false,
      },
    ];

    const result = recomputeSessionSetsPrFlags(sets, 90, 110);
    expect(result[0].is_pr).toBe(false);
    expect(result[1].is_pr).toBe(false);
    expect(result[2].is_pr).toBe(true);
  });

  it('should support comma decimal inputs (e.g. "82,5")', () => {
    const sets = [
      {
        id: 's1',
        weight_input: '82,5',
        reps_input: '10',
        is_warmup: false,
        is_completed: true,
        is_pr: false,
      },
    ];

    const result = recomputeSessionSetsPrFlags(sets, 80, 100);
    expect(result[0].is_pr).toBe(true);
  });

  it('should handle empty or zero string inputs without throwing', () => {
    const sets = [
      {
        id: 'empty',
        weight_input: '',
        reps_input: '',
        is_warmup: false,
        is_completed: true,
        is_pr: false,
      },
      {
        id: 'zeros',
        weight_input: '0',
        reps_input: '0',
        is_warmup: false,
        is_completed: true,
        is_pr: false,
      },
    ];

    const result = recomputeSessionSetsPrFlags(sets, 50, 60);
    expect(result[0].is_pr).toBe(false);
    expect(result[1].is_pr).toBe(false);
  });
});

