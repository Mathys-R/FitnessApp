// tests/unit/export-service-order.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportUserDataCsvBundle, exportUserDataJson } from '@/features/analytics/services/export.service';

type PageResponse = { data: unknown[] | null; error: { message: string } | null };

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: async () => ({ data: { user: { id: 'usr-1' } } }) }, from: mockFrom }),
}));

let pages: Record<string, PageResponse[]>;
let calls: Record<string, { order: Array<[string, unknown]> }>;

const mealEntry = (i: number) => ({
  id: `me-${i}`, meal_type: 'lunch', entry_type: 'food', label: `Riz ${i}`,
  quantity_value: 150, logged_unit: 'g', total_kcal: 195, total_p: 4, total_g: 42, total_l: 0.4,
  daily_log: { log_date: '2026-10-29' },
});
const session = { session_date: '2026-10-28', name: 'Push A', status: 'completed', session_comment: null };
const lines = (csv: string) => csv.split('\n');

beforeEach(() => {
  vi.clearAllMocks();
  pages = {};
  calls = {};
  mockFrom.mockImplementation((table: string) => {
    calls[table] ??= { order: [] };
    const builder = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      order: vi.fn((col: string, o?: unknown) => { calls[table].order.push([col, o]); return builder; }),
      range: vi.fn(() => Promise.resolve(pages[table]?.shift() ?? { data: [], error: null })),
    };
    return builder;
  });
});

describe('Ordre déterministe des lignes (rework Lot 4)', () => {
  const set = (n: number) => ({ set_number: n, weight_kg: 50 + n, reps: 8, epley_1rm: 60 + n, is_warmup: false, is_pr: false });

  it('workout_history : exercices triés par order_index, séries par set_number', async () => {
    pages.workout_sessions = [{
      data: [{
        ...session,
        workout_session_exercises: [
          { order_index: 2, session_note: null, exercise: { name: 'Dips', primary_muscle: 'Pecs' }, workout_sets: [set(2), set(1)] },
          { order_index: 0, session_note: null, exercise: { name: 'Squat', primary_muscle: 'Quadriceps' }, workout_sets: [set(3), set(1), set(2)] },
          { order_index: 1, session_note: null, exercise: { name: 'Rowing', primary_muscle: 'Dos' }, workout_sets: [set(1)] },
        ],
      }],
      error: null,
    }];
    const out = await exportUserDataCsvBundle();
    const cells = lines(out.workoutHistoryCsv).slice(1).map((l) => l.split(','));
    expect(cells.map((c) => `${c[2]}#${c[4]}`)).toEqual([
      'Squat#1', 'Squat#2', 'Squat#3', 'Rowing#1', 'Dips#1', 'Dips#2',
    ]);
  });

  it('nutrition_history : trié par date du journal DESC puis created_at DESC, date manquante en dernier', async () => {
    pages.meal_entries = [{
      data: [
        { ...mealEntry(1), created_at: '2026-10-28T08:00:00Z', daily_log: { log_date: '2026-10-28' } },
        { ...mealEntry(2), created_at: '2026-10-31T08:00:00Z', daily_log: null },
        { ...mealEntry(3), created_at: '2026-10-29T08:00:00Z', daily_log: { log_date: '2026-10-29' } },
        { ...mealEntry(4), created_at: '2026-10-29T20:00:00Z', daily_log: { log_date: '2026-10-29' } },
      ],
      error: null,
    }];
    const out = await exportUserDataCsvBundle();
    expect(lines(out.nutritionHistoryCsv).slice(1).map((l) => l.split(',')[3])).toEqual([
      'Riz 4', 'Riz 3', 'Riz 1', 'Riz 2',
    ]);
  });

  it('JSON : ordre des embeds demandé à PostgREST via referencedTable', async () => {
    await exportUserDataJson();
    expect(calls.workout_sessions.order).toEqual(expect.arrayContaining([
      ['order_index', { referencedTable: 'workout_session_exercises' }],
      ['set_number', { referencedTable: 'workout_session_exercises.workout_sets' }],
    ]));
  });
});
