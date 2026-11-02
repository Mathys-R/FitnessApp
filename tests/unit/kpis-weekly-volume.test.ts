// tests/unit/kpis-weekly-volume.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getWeeklyMuscleVolume } from '@/features/analytics/services/kpis.service';
import { MUSCLE_GROUPS } from '@/types/domain.types';

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}));

interface SetRow {
  id: string;
  is_completed: boolean;
  is_warmup: boolean;
  user_id: string;
  exercise: { primary_muscle: string; secondary_muscles: string[] } | null;
  session_exercise: { session: { session_date: string; status: string } };
}

type Call = [string, string, unknown];

const SQUAT = { primary_muscle: 'Quadriceps', secondary_muscles: ['Fessiers'] };
const HIP_THRUST = { primary_muscle: 'Fessiers', secondary_muscles: ['Ischios'] };

function makeRow(
  id: string,
  exercise: SetRow['exercise'],
  overrides: Partial<Omit<SetRow, 'session_exercise'>> & { date?: string; status?: string } = {}
): SetRow {
  const { date = '2026-10-28', status = 'completed', ...rest } = overrides;
  return {
    id,
    is_completed: true,
    is_warmup: false,
    user_id: 'usr-1',
    exercise,
    session_exercise: { session: { session_date: date, status } },
    ...rest,
  };
}

function readPath(row: SetRow, column: string): unknown {
  return column.split('.').reduce<unknown>(
    (acc, key) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined),
    row
  );
}

/** Query builder chaînable qui enregistre les appels ET applique les filtres comme PostgREST (inner join). */
function buildQuery(rows: SetRow[], calls: Call[], forcedError: { message: string } | null = null) {
  const filters: Array<(r: SetRow) => boolean> = [];
  const query = {
    select: vi.fn((cols: string) => {
      calls.push(['select', cols, undefined]);
      return query;
    }),
    eq: vi.fn((col: string, val: unknown) => {
      calls.push(['eq', col, val]);
      filters.push((r) => readPath(r, col) === val);
      return query;
    }),
    gte: vi.fn((col: string, val: string) => {
      calls.push(['gte', col, val]);
      filters.push((r) => String(readPath(r, col)) >= val);
      return query;
    }),
    lte: vi.fn((col: string, val: string) => {
      calls.push(['lte', col, val]);
      filters.push((r) => String(readPath(r, col)) <= val);
      return query;
    }),
    then: (resolve: (v: { data: SetRow[] | null; error: { message: string } | null }) => unknown) =>
      resolve(
        forcedError
          ? { data: null, error: forcedError }
          : { data: rows.filter((r) => filters.every((f) => f(r))), error: null }
      ),
  };
  return query;
}

describe('getWeeklyMuscleVolume (Couche 2, contrat Supabase)', () => {
  let calls: Call[];

  beforeEach(() => {
    vi.clearAllMocks();
    calls = [];
    mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-1' } } });
  });

  function arrange(rows: SetRow[], error: { message: string } | null = null) {
    mockFrom.mockImplementation((table: string) => {
      if (table !== 'workout_sets') throw new Error(`Table inattendue : ${table}`);
      return buildQuery(rows, calls, error);
    });
  }

  it('applique les filtres alias imbriqués Lundi→Dimanche + status completed (référence mercredi)', async () => {
    arrange([]);
    await getWeeklyMuscleVolume('2026-10-28');

    expect(mockFrom).toHaveBeenCalledWith('workout_sets');
    expect(calls).toContainEqual(['gte', 'session_exercise.session.session_date', '2026-10-26']);
    expect(calls).toContainEqual(['lte', 'session_exercise.session.session_date', '2026-11-01']);
    expect(calls).toContainEqual(['eq', 'session_exercise.session.status', 'completed']);
    expect(calls).toContainEqual(['eq', 'user_id', 'usr-1']);
    expect(calls).toContainEqual(['eq', 'is_completed', true]);
    expect(calls).toContainEqual(['eq', 'is_warmup', false]);
    const select = calls.find((c) => c[0] === 'select')?.[1] as string;
    expect(select).toMatch(/session_exercise:workout_session_exercises!inner/);
    expect(select).toMatch(/session:workout_sessions!inner/);
  });

  it.each([
    ['2026-10-26', '2026-10-26', '2026-11-01'], // lundi
    ['2026-11-01', '2026-10-26', '2026-11-01'], // dimanche
    ['2026-11-02', '2026-11-02', '2026-11-08'], // lundi suivant
    ['2026-12-31', '2026-12-28', '2027-01-03'], // chevauchement d'année
  ])('référence %s → semaine %s → %s', async (ref, monday, sunday) => {
    arrange([]);
    await getWeeklyMuscleVolume(ref);
    expect(calls).toContainEqual(['gte', 'session_exercise.session.session_date', monday]);
    expect(calls).toContainEqual(['lte', 'session_exercise.session.session_date', sunday]);
  });

  it('scénario spec : 4 Squat + 4 Hip Thrust → Quadriceps 4, Fessiers 6, Ischios 2, autres 0', async () => {
    const rows = [
      ...[1, 2, 3, 4].map((i) => makeRow(`sq-${i}`, SQUAT)),
      ...[1, 2, 3, 4].map((i) => makeRow(`ht-${i}`, HIP_THRUST, { date: '2026-10-30' })),
    ];
    arrange(rows);
    const result = await getWeeklyMuscleVolume('2026-10-28');

    expect(Object.keys(result).sort()).toEqual([...MUSCLE_GROUPS].sort());
    expect(result.Quadriceps).toBe(4);
    expect(result.Fessiers).toBe(6);
    expect(result.Ischios).toBe(2);
    for (const g of MUSCLE_GROUPS) {
      if (!['Quadriceps', 'Fessiers', 'Ischios'].includes(g)) expect(result[g]).toBe(0);
    }
  });

  it('exclut échauffements, séries non validées, séances non terminées et hors semaine', async () => {
    const rows = [
      ...[1, 2, 3, 4].map((i) => makeRow(`sq-${i}`, SQUAT)),
      ...[1, 2, 3, 4].map((i) => makeRow(`ht-${i}`, HIP_THRUST)),
      makeRow('warm-1', SQUAT, { is_warmup: true }),
      makeRow('warm-2', HIP_THRUST, { is_warmup: true }),
      makeRow('undone-1', SQUAT, { is_completed: false }),
      makeRow('planned-1', SQUAT, { status: 'planned' }),
      makeRow('in-progress', HIP_THRUST, { status: 'in_progress' }),
      makeRow('prev-week', SQUAT, { date: '2026-10-25' }),
      makeRow('next-week', SQUAT, { date: '2026-11-02' }),
      makeRow('other-user', SQUAT, { user_id: 'usr-2' }),
    ];
    arrange(rows);
    const result = await getWeeklyMuscleVolume('2026-10-28');
    expect(result.Quadriceps).toBe(4);
    expect(result.Fessiers).toBe(6);
    expect(result.Ischios).toBe(2);
  });

  it('semaine vide → 10 groupes à 0', async () => {
    arrange([]);
    const result = await getWeeklyMuscleVolume('2026-10-28');
    expect(Object.keys(result)).toHaveLength(10);
    expect(Object.values(result).every((v) => v === 0)).toBe(true);
  });

  it('exercice null (jointure absente) ou muscle inconnu → ignoré sans crash', async () => {
    arrange([
      makeRow('null-ex', null),
      makeRow('unknown', { primary_muscle: 'Avant-bras', secondary_muscles: ['Inconnu'] }),
      makeRow('sq', SQUAT),
    ]);
    const result = await getWeeklyMuscleVolume('2026-10-28');
    expect(result.Quadriceps).toBe(1);
    expect(result.Fessiers).toBe(0.5);
  });

  it('erreur Supabase → rejette avec message explicite', async () => {
    arrange([], { message: 'RLS refusée' });
    await expect(getWeeklyMuscleVolume('2026-10-28')).rejects.toThrow('Erreur volume musculaire : RLS refusée');
  });

  it('non authentifié → rejette sans requêter workout_sets', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    arrange([]);
    await expect(getWeeklyMuscleVolume('2026-10-28')).rejects.toThrow('Non authentifié');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});
