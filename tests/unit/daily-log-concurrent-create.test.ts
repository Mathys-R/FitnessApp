// tests/unit/daily-log-concurrent-create.test.ts
// [RED] Reproduction (Phase 6 monkey testing) : deux appels concurrents à getOrCreateDailyLog
// pour la même date (React StrictMode en dev : double effet de useTodayCockpitData, ou deux
// onglets) tentent chacun un INSERT. En base, UNIQUE(user_id, log_date)
// (supabase/migrations/001_initial_schema.sql:68) fait échouer le second avec 23505 → l'appel lève
// « Erreur création log journalier » au lieu de renvoyer la ligne existante.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getOrCreateDailyLog } from '@/features/daily-log/services/log.service';

type Row = Record<string, unknown>;
const { state } = vi.hoisted(() => ({
  state: { logs: [] as Row[], insertError: null as { code: string; message: string } | null },
}));

/** Faux client PostgREST minimal : select/eq/maybeSingle/single + insert avec contrainte d'unicité. */
function fakeFrom(table: string) {
  const filters: Array<[string, unknown]> = [];
  let insertPayload: Row | null = null;
  const tick = () => new Promise((r) => setTimeout(r, 5)); // latence réseau
  const builder = {
    select: () => builder,
    eq: (col: string, val: unknown) => { filters.push([col, val]); return builder; },
    insert: (payload: Row) => { insertPayload = payload; return builder; },
    maybeSingle: async () => {
      await tick();
      const rows = state.logs.filter((r) => filters.every(([c, v]) => r[c] === v));
      return { data: rows[0] ?? null, error: null };
    },
    single: async () => {
      await tick();
      if (table === 'profiles') return { data: null, error: null };
      const p = insertPayload!;
      if (state.insertError) return { data: null, error: state.insertError };
      if (state.logs.some((r) => r.user_id === p.user_id && r.log_date === p.log_date)) {
        return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "daily_logs_user_id_log_date_key"' } };
      }
      const row = { id: `log-${state.logs.length + 1}`, weight_kg: null, weight_ema_kg: null, ...p };
      state.logs.push(row);
      return { data: row, error: null };
    },
  };
  return builder;
}

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'usr-1' } } }) },
    from: fakeFrom,
  }),
}));

describe('getOrCreateDailyLog — création concurrente (UNIQUE user_id, log_date)', () => {
  beforeEach(() => { state.logs = []; state.insertError = null; });

  it('deux appels concurrents pour la même date résolvent tous deux sur la même ligne', async () => {
    const results = await Promise.allSettled([
      getOrCreateDailyLog('2026-11-02'),
      getOrCreateDailyLog('2026-11-02'),
    ]);
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'fulfilled']);
    const ids = results.map((r) => (r.status === 'fulfilled' ? r.value.id : null));
    expect(ids[0]).toBe(ids[1]);
    expect(state.logs).toHaveLength(1);
  });

  it('une erreur INSERT autre que 23505 lève toujours', async () => {
    state.insertError = { code: '42501', message: 'permission denied' };
    await expect(getOrCreateDailyLog('2026-11-02')).rejects.toThrow(
      'Erreur création log journalier : permission denied'
    );
    expect(state.logs).toHaveLength(0);
  });
});
