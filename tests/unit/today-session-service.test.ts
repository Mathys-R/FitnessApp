// tests/unit/today-session-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildStartPayloadFromPlannedSession,
  getTodayWorkoutOverview,
} from '@/features/workout/services/today-session.service';
import type { WorkoutSessionRow } from '@/features/workout/services/sessions.service';

const { mockGetUser, mockFrom, mockGetWorkoutPresets, mockBuildActiveExercisesFromPreset } =
  vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockGetWorkoutPresets: vi.fn(),
    mockBuildActiveExercisesFromPreset: vi.fn(),
  }));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}));

vi.mock('@/features/workout/services/presets.service', () => ({
  getWorkoutPresets: mockGetWorkoutPresets,
  buildActiveExercisesFromPreset: mockBuildActiveExercisesFromPreset,
}));

type SetLite = {
  weight_kg: number;
  reps: number;
  is_warmup: boolean;
  is_completed: boolean;
  is_pr: boolean;
};

function session(
  overrides: Partial<WorkoutSessionRow> & { sets?: SetLite[][] | null }
): WorkoutSessionRow & { workout_session_exercises: unknown } {
  const { sets, ...rest } = overrides;
  return {
    id: 'sess-x',
    user_id: 'usr-123',
    session_date: '2026-11-02',
    name: 'Séance',
    status: 'planned',
    preset_id: null,
    duration_seconds: null,
    session_comment: null,
    created_at: '2026-11-02T06:00:00Z',
    updated_at: '2026-11-02T06:00:00Z',
    ...rest,
    workout_session_exercises:
      sets === null ? null : (sets ?? []).map((s) => ({ workout_sets: s })),
  } as WorkoutSessionRow & { workout_session_exercises: unknown };
}

interface QueryCapture {
  table?: string;
  select?: string;
  eq: Array<[string, unknown]>;
  order: Array<[string, unknown]>;
}

function mockQuery(result: { data: unknown; error: unknown }): QueryCapture {
  const cap: QueryCapture = { eq: [], order: [] };
  const q = {
    select: vi.fn((s: string) => {
      cap.select = s;
      return q;
    }),
    eq: vi.fn((c: string, v: unknown) => {
      cap.eq.push([c, v]);
      return q;
    }),
    order: vi.fn((c: string, o: unknown) => {
      cap.order.push([c, o]);
      return Promise.resolve(result);
    }),
  };
  mockFrom.mockImplementation((t: string) => {
    cap.table = t;
    return q;
  });
  return cap;
}

const set = (p: Partial<SetLite>): SetLite => ({
  weight_kg: 100,
  reps: 5,
  is_warmup: false,
  is_completed: true,
  is_pr: false,
  ...p,
});

describe('getTodayWorkoutOverview (Couche 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-123' } } });
  });

  it('filtre par user_id + session_date et trie par created_at ASC avec embed des séries', async () => {
    const cap = mockQuery({ data: [], error: null });
    await getTodayWorkoutOverview('2026-11-02');
    expect(cap.table).toBe('workout_sessions');
    expect(cap.eq).toEqual([
      ['user_id', 'usr-123'],
      ['session_date', '2026-11-02'],
    ]);
    expect(cap.order).toEqual([['created_at', { ascending: true }]]);
    expect(cap.select).toMatch(/workout_session_exercises/);
    expect(cap.select).toMatch(/workout_sets/);
    expect(cap.select).toMatch(/is_pr/);
  });

  it('retourne none quand aucune séance', async () => {
    mockQuery({ data: [], error: null });
    expect(await getTodayWorkoutOverview('2026-11-02')).toEqual({ kind: 'none' });
  });

  it('retourne none quand data est null', async () => {
    mockQuery({ data: null, error: null });
    expect(await getTodayWorkoutOverview('2026-11-02')).toEqual({ kind: 'none' });
  });

  it('ignore les séances in_progress (→ none)', async () => {
    mockQuery({ data: [session({ status: 'in_progress' })], error: null });
    expect(await getTodayWorkoutOverview('2026-11-02')).toEqual({ kind: 'none' });
  });

  it('priorité planned > completed > rest_day même si planned créé en dernier', async () => {
    mockQuery({
      data: [
        session({ id: 'r', status: 'rest_day' }),
        session({ id: 'c', status: 'completed', sets: [[set({})]] }),
        session({ id: 'p', status: 'planned', name: 'Push' }),
      ],
      error: null,
    });
    const res = await getTodayWorkoutOverview('2026-11-02');
    expect(res.kind).toBe('planned');
    if (res.kind === 'planned') {
      expect(res.session.id).toBe('p');
      expect(res.session.name).toBe('Push');
      expect('workout_session_exercises' in res.session).toBe(false);
    }
  });

  it('plusieurs planned le même jour → la première par created_at (ordre renvoyé)', async () => {
    mockQuery({
      data: [
        session({ id: 'p1', status: 'planned' }),
        session({ id: 'p2', status: 'planned' }),
      ],
      error: null,
    });
    const res = await getTodayWorkoutOverview('2026-11-02');
    expect(res.kind === 'planned' && res.session.id).toBe('p1');
  });

  it('completed prioritaire sur rest_day', async () => {
    mockQuery({
      data: [
        session({ id: 'r', status: 'rest_day' }),
        session({ id: 'c', status: 'completed', sets: [] }),
      ],
      error: null,
    });
    const res = await getTodayWorkoutOverview('2026-11-02');
    expect(res.kind).toBe('completed');
  });

  it('completed : tonnage hors échauffement / non validées, prCount strict, durée', async () => {
    mockQuery({
      data: [
        session({
          id: 'c',
          status: 'completed',
          duration_seconds: 3725,
          sets: [
            [
              set({ weight_kg: 100, reps: 5, is_pr: true }), // 500, PR
              set({ weight_kg: 60, reps: 10, is_warmup: true, is_pr: true }), // exclu
              set({ weight_kg: 110, reps: 3, is_completed: false, is_pr: true }), // exclu
            ],
            [
              set({ weight_kg: 42.5, reps: 8 }), // 340
              set({ weight_kg: 0, reps: 12 }), // 0
            ],
          ],
        }),
      ],
      error: null,
    });
    const res = await getTodayWorkoutOverview('2026-11-02');
    expect(res).toMatchObject({
      kind: 'completed',
      durationSeconds: 3725,
      tonnageKg: 840,
      prCount: 1,
    });
    if (res.kind === 'completed') {
      expect('workout_session_exercises' in res.session).toBe(false);
      expect(res.session.id).toBe('c');
    }
  });

  it('completed : duration_seconds null → 0, embeds null → tonnage 0', async () => {
    mockQuery({
      data: [session({ status: 'completed', duration_seconds: null, sets: null })],
      error: null,
    });
    expect(await getTodayWorkoutOverview('2026-11-02')).toMatchObject({
      kind: 'completed',
      durationSeconds: 0,
      tonnageKg: 0,
      prCount: 0,
    });
  });

  it('completed : workout_sets null dans un exercice toléré', async () => {
    mockQuery({
      data: [
        {
          ...session({ status: 'completed' }),
          workout_session_exercises: [{ workout_sets: null }, { workout_sets: [set({ reps: 2 })] }],
        },
      ],
      error: null,
    });
    expect(await getTodayWorkoutOverview('2026-11-02')).toMatchObject({ tonnageKg: 200 });
  });

  it('plusieurs completed → la première par created_at', async () => {
    mockQuery({
      data: [
        session({ id: 'c1', status: 'completed', sets: [[set({ weight_kg: 10, reps: 1 })]] }),
        session({ id: 'c2', status: 'completed', sets: [[set({ weight_kg: 99, reps: 1 })]] }),
      ],
      error: null,
    });
    const res = await getTodayWorkoutOverview('2026-11-02');
    expect(res).toMatchObject({ kind: 'completed', tonnageKg: 10 });
    expect(res.kind === 'completed' && res.session.id).toBe('c1');
  });

  it('rest_day seul → rest_day', async () => {
    mockQuery({
      data: [session({ id: 'r', status: 'rest_day' }), session({ status: 'in_progress' })],
      error: null,
    });
    const res = await getTodayWorkoutOverview('2026-11-02');
    expect(res.kind).toBe('rest_day');
    expect(res.kind === 'rest_day' && res.session.id).toBe('r');
  });

  it('throw si utilisateur non authentifié (sans requête)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(getTodayWorkoutOverview('2026-11-02')).rejects.toThrow('Non authentifié');
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('throw sur erreur PostgREST', async () => {
    mockQuery({ data: null, error: { message: 'boom' } });
    await expect(getTodayWorkoutOverview('2026-11-02')).rejects.toThrow(/boom/);
  });
});

describe('buildStartPayloadFromPlannedSession (Couche 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const planned = session({
    id: 'p1',
    name: 'Legs',
    session_date: '2026-11-02',
    status: 'planned',
    preset_id: 'preset-2',
  }) as WorkoutSessionRow;

  it('preset trouvé → exercices construits depuis le preset', async () => {
    const preset = { id: 'preset-2', name: 'Legs' };
    const exercises = [{ exerciseId: 'ex-squat' }];
    mockGetWorkoutPresets.mockResolvedValue([{ id: 'preset-1' }, preset]);
    mockBuildActiveExercisesFromPreset.mockResolvedValue(exercises);

    const payload = await buildStartPayloadFromPlannedSession(planned);
    expect(mockBuildActiveExercisesFromPreset).toHaveBeenCalledWith(preset);
    expect(payload).toEqual({
      sessionName: 'Legs',
      sessionDate: '2026-11-02',
      plannedSessionId: 'p1',
      sourcePresetId: 'preset-2',
      exercises,
    });
  });

  it('preset introuvable → exercises []', async () => {
    mockGetWorkoutPresets.mockResolvedValue([{ id: 'other' }]);
    const payload = await buildStartPayloadFromPlannedSession(planned);
    expect(payload.exercises).toEqual([]);
    expect(payload.sourcePresetId).toBe('preset-2');
    expect(mockBuildActiveExercisesFromPreset).not.toHaveBeenCalled();
  });

  it('preset_id null → exercises [] sans charger les presets', async () => {
    const payload = await buildStartPayloadFromPlannedSession({ ...planned, preset_id: null });
    expect(payload).toEqual({
      sessionName: 'Legs',
      sessionDate: '2026-11-02',
      plannedSessionId: 'p1',
      sourcePresetId: null,
      exercises: [],
    });
    expect(mockGetWorkoutPresets).not.toHaveBeenCalled();
  });

  it('propage les erreurs de getWorkoutPresets', async () => {
    mockGetWorkoutPresets.mockRejectedValue(new Error('net'));
    await expect(buildStartPayloadFromPlannedSession(planned)).rejects.toThrow('net');
  });
});
