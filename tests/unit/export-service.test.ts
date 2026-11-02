// tests/unit/export-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  exportUserDataCsvBundle,
  exportUserDataJson,
  EXPORT_PAGE_SIZE,
} from '@/features/analytics/services/export.service';

type PageResponse = { data: unknown[] | null; error: { message: string } | null };

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({ auth: { getUser: mockGetUser }, from: mockFrom }),
}));

interface TableCalls {
  select: string[];
  eq: Array<[string, unknown]>;
  order: Array<[string, unknown]>;
  range: Array<[number, number]>;
}

let pages: Record<string, PageResponse[]>;
let calls: Record<string, TableCalls>;

function setupFrom() {
  mockFrom.mockImplementation((table: string) => {
    calls[table] ??= { select: [], eq: [], order: [], range: [] };
    const c = calls[table];
    const builder = {
      select: vi.fn((s: string) => { c.select.push(s); return builder; }),
      eq: vi.fn((col: string, v: unknown) => { c.eq.push([col, v]); return builder; }),
      order: vi.fn((col: string, o?: unknown) => { c.order.push([col, o]); return builder; }),
      range: vi.fn((from: number, to: number) => {
        c.range.push([from, to]);
        const queue = pages[table] ?? [];
        const res = queue.length > 0 ? queue.shift()! : { data: [], error: null };
        return Promise.resolve(res);
      }),
    };
    return builder;
  });
}

const dailyLog = {
  id: 'dl-1', log_date: '2026-10-30', weight_kg: 82.5, weight_ema_kg: 82.31,
  target_kcal: 2400, target_p: 170, target_g: 260, target_l: 75, exclude_from_tdee: false,
};

const mealEntry = (i: number) => ({
  id: `me-${i}`, meal_type: 'lunch', entry_type: 'food', label: `Riz ${i}`,
  quantity_value: 150, logged_unit: 'g', total_kcal: 195, total_p: 4, total_g: 42, total_l: 0.4,
  daily_log: { log_date: '2026-10-29' },
});

const session = {
  session_date: '2026-10-28', name: 'Push A', status: 'completed', session_comment: 'Bonne séance',
  workout_session_exercises: [
    {
      order_index: 0, session_note: 'Coudes serrés',
      exercise: { name: 'Développé couché', primary_muscle: 'Pecs' },
      workout_sets: [
        { set_number: 1, weight_kg: 60, reps: 10, epley_1rm: 80, is_warmup: true, is_pr: false },
        { set_number: 2, weight_kg: 90, reps: 5, epley_1rm: 105, is_warmup: false, is_pr: true },
      ],
    },
  ],
};

const lines = (csv: string) => csv.split('\n');

beforeEach(() => {
  vi.clearAllMocks();
  pages = {};
  calls = {};
  mockGetUser.mockResolvedValue({ data: { user: { id: 'usr-1' } } });
  setupFrom();
});

describe('exportUserDataCsvBundle — en-têtes (spec règle 5 + E4)', () => {
  it('produit les en-têtes exacts des 3 CSV, session_comment en dernière colonne', async () => {
    const out = await exportUserDataCsvBundle();
    expect(lines(out.dailyLogsCsv)[0]).toBe(
      'date,weight_kg,weight_ema_kg,target_kcal,target_p,target_g,target_l,exclude_from_tdee'
    );
    expect(lines(out.nutritionHistoryCsv)[0]).toBe(
      'date,meal_type,entry_type,label,quantity,unit,kcal,proteins_g,carbs_g,fats_g'
    );
    const wh = lines(out.workoutHistoryCsv)[0].split(',');
    expect(wh).toEqual([
      'session_date', 'session_name', 'exercise', 'primary_muscle', 'set_number', 'weight_kg',
      'reps', 'epley_1rm_kg', 'is_warmup', 'is_pr', 'session_note', 'session_comment',
    ]);
    expect(wh[wh.length - 1]).toBe('session_comment');
  });

  it('données vides → CSV avec en-tête seul', async () => {
    const out = await exportUserDataCsvBundle();
    expect(lines(out.dailyLogsCsv)).toHaveLength(1);
    expect(lines(out.nutritionHistoryCsv)).toHaveLength(1);
    expect(lines(out.workoutHistoryCsv)).toHaveLength(1);
  });
});

describe('exportUserDataCsvBundle — contenu', () => {
  it('sérialise daily_logs, nutrition et séries de musculation', async () => {
    pages.daily_logs = [{ data: [dailyLog, { ...dailyLog, id: 'dl-2', log_date: '2026-10-29', weight_kg: null, weight_ema_kg: null, exclude_from_tdee: true }], error: null }];
    pages.meal_entries = [{ data: [mealEntry(1), { ...mealEntry(2), daily_log: null }], error: null }];
    pages.workout_sessions = [{ data: [session], error: null }];

    const out = await exportUserDataCsvBundle();

    expect(lines(out.dailyLogsCsv).slice(1)).toEqual([
      '2026-10-30,82.5,82.31,2400,170,260,75,false',
      '2026-10-29,,,2400,170,260,75,true',
    ]);
    expect(lines(out.nutritionHistoryCsv).slice(1)).toEqual([
      '2026-10-29,lunch,food,Riz 1,150,g,195,4,42,0.4',
      ',lunch,food,Riz 2,150,g,195,4,42,0.4',
    ]);
    expect(lines(out.workoutHistoryCsv).slice(1)).toEqual([
      '2026-10-28,Push A,Développé couché,Pecs,1,60,10,80,true,false,Coudes serrés,Bonne séance',
      '2026-10-28,Push A,Développé couché,Pecs,2,90,5,105,false,true,Coudes serrés,Bonne séance',
    ]);
  });

  it('session_comment / session_note / exercise null → cellules vides', async () => {
    pages.workout_sessions = [{
      data: [{
        ...session, session_comment: null,
        workout_session_exercises: [{ ...session.workout_session_exercises[0], session_note: null, exercise: null, workout_sets: [session.workout_session_exercises[0].workout_sets[0]] }],
      }],
      error: null,
    }];
    const out = await exportUserDataCsvBundle();
    expect(lines(out.workoutHistoryCsv)[1]).toBe('2026-10-28,Push A,,,1,60,10,80,true,false,,');
  });

  it('séance sans exercices ou sans séries → aucune ligne', async () => {
    pages.workout_sessions = [{
      data: [
        { ...session, workout_session_exercises: null },
        { ...session, workout_session_exercises: [{ ...session.workout_session_exercises[0], workout_sets: null }] },
      ],
      error: null,
    }];
    const out = await exportUserDataCsvBundle();
    expect(lines(out.workoutHistoryCsv)).toHaveLength(1);
  });

  it('neutralise une injection de formule =SUM(...) dans un libellé', async () => {
    pages.meal_entries = [{ data: [{ ...mealEntry(1), label: '=SUM(A1:A9)' }], error: null }];
    const out = await exportUserDataCsvBundle();
    const row = lines(out.nutritionHistoryCsv)[1];
    expect(row).toContain(`"'=SUM(A1:A9)"`);
    expect(row.split(',')[3].startsWith('=')).toBe(false);
  });

  it('filtre user_id + status completed sur workout_sessions et sélectionne session_comment', async () => {
    await exportUserDataCsvBundle();
    expect(calls.workout_sessions.eq).toEqual([['user_id', 'usr-1'], ['status', 'completed']]);
    expect(calls.workout_sessions.select[0]).toContain('session_comment');
    expect(calls.daily_logs.eq).toEqual([['user_id', 'usr-1']]);
    expect(calls.meal_entries.eq).toEqual([['user_id', 'usr-1']]);
  });
});

describe('Pagination .range() (E3)', () => {
  it('EXPORT_PAGE_SIZE vaut 1000', () => {
    expect(EXPORT_PAGE_SIZE).toBe(1000);
  });

  it('meal_entries 1000 + 3 → 2 appels range et 1003 lignes CSV + en-tête', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => mealEntry(i));
    const page2 = Array.from({ length: 3 }, (_, i) => mealEntry(1000 + i));
    pages.meal_entries = [{ data: page1, error: null }, { data: page2, error: null }];

    const out = await exportUserDataCsvBundle();
    expect(calls.meal_entries.range).toEqual([[0, 999], [1000, 1999]]);
    expect(lines(out.nutritionHistoryCsv)).toHaveLength(1004);
    expect(lines(out.nutritionHistoryCsv)[1004 - 1]).toContain('Riz 1002');
  });

  it.each(['daily_logs', 'workout_sessions'])('%s est aussi paginé (1000 + 3)', async (table) => {
    const row = table === 'daily_logs' ? dailyLog : { ...session, workout_session_exercises: [] };
    pages[table] = [
      { data: Array.from({ length: 1000 }, () => row), error: null },
      { data: Array.from({ length: 3 }, () => row), error: null },
    ];
    const out = await exportUserDataCsvBundle();
    expect(calls[table].range).toEqual([[0, 999], [1000, 1999]]);
    if (table === 'daily_logs') expect(lines(out.dailyLogsCsv)).toHaveLength(1004);
  });

  it('page pleine exacte (1000) puis page vide → 2 appels, 1000 lignes', async () => {
    pages.daily_logs = [{ data: Array.from({ length: 1000 }, () => dailyLog), error: null }, { data: [], error: null }];
    const out = await exportUserDataCsvBundle();
    expect(calls.daily_logs.range).toEqual([[0, 999], [1000, 1999]]);
    expect(lines(out.dailyLogsCsv)).toHaveLength(1001);
  });

  it('data null traité comme page vide (1 seul appel)', async () => {
    pages.daily_logs = [{ data: null, error: null }];
    const out = await exportUserDataCsvBundle();
    expect(calls.daily_logs.range).toEqual([[0, 999]]);
    expect(lines(out.dailyLogsCsv)).toHaveLength(1);
  });

  it('JSON : meal_entries paginé → 1003 entrées', async () => {
    pages.meal_entries = [
      { data: Array.from({ length: 1000 }, (_, i) => mealEntry(i)), error: null },
      { data: Array.from({ length: 3 }, (_, i) => mealEntry(1000 + i)), error: null },
    ];
    const parsed = JSON.parse(await exportUserDataJson());
    expect(parsed.meal_entries).toHaveLength(1003);
    expect(calls.meal_entries.range).toEqual([[0, 999], [1000, 1999]]);
  });
});

describe('Propagation des erreurs (E2)', () => {
  it.each(['daily_logs', 'meal_entries', 'workout_sessions'])('CSV : erreur sur %s → rejet explicite', async (table) => {
    pages[table] = [{ data: null, error: { message: 'RLS denied' } }];
    await expect(exportUserDataCsvBundle()).rejects.toThrow(`Erreur export ${table} : RLS denied`);
  });

  it.each(['daily_logs', 'meal_entries', 'workout_sessions'])('JSON : erreur sur %s → rejet explicite', async (table) => {
    pages[table] = [{ data: null, error: { message: 'network' } }];
    await expect(exportUserDataJson()).rejects.toThrow(`Erreur export ${table} : network`);
  });

  it('erreur sur la 2e page → rejet (pas d\'export tronqué silencieux)', async () => {
    pages.meal_entries = [
      { data: Array.from({ length: 1000 }, (_, i) => mealEntry(i)), error: null },
      { data: null, error: { message: 'timeout' } },
    ];
    await expect(exportUserDataCsvBundle()).rejects.toThrow('Erreur export meal_entries : timeout');
  });

  it('non authentifié → Non authentifié (CSV et JSON), aucune requête', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    await expect(exportUserDataCsvBundle()).rejects.toThrow('Non authentifié');
    await expect(exportUserDataJson()).rejects.toThrow('Non authentifié');
    expect(mockFrom).not.toHaveBeenCalled();
  });
});

describe('exportUserDataJson', () => {
  it('produit un JSON complet indenté avec exported_at et les 3 collections', async () => {
    pages.daily_logs = [{ data: [dailyLog], error: null }];
    pages.meal_entries = [{ data: [mealEntry(1)], error: null }];
    pages.workout_sessions = [{ data: [session], error: null }];

    const json = await exportUserDataJson();
    expect(json).toContain('\n  "daily_logs"');
    const parsed = JSON.parse(json);
    expect(Object.keys(parsed)).toEqual(['exported_at', 'daily_logs', 'workout_sessions', 'meal_entries']);
    expect(Number.isNaN(Date.parse(parsed.exported_at))).toBe(false);
    expect(parsed.daily_logs).toEqual([dailyLog]);
    expect(parsed.meal_entries).toEqual([mealEntry(1)]);
    expect(parsed.workout_sessions).toEqual([session]);
  });

  it('JSON : pas de filtre status sur workout_sessions (toutes séances) et jointures imbriquées', async () => {
    await exportUserDataJson();
    expect(calls.workout_sessions.eq).toEqual([['user_id', 'usr-1']]);
    expect(calls.workout_sessions.select[0]).toContain('workout_sets');
    expect(calls.meal_entries.select[0]).toContain('meal_entry_items');
  });
});
