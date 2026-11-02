// @vitest-environment happy-dom
// tests/unit/hydration.test.tsx
// B1 / B3 : SSR (date J, aucun localStorage) puis hydratation client (date J+1, séance persistée)
// → aucune erreur d'hydratation récupérable sur `/`, `/workout` et MuscleRadar.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, type ReactElement } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot, type Root } from 'react-dom/client';
import TodayPage from '@/app/(protected)/page';
import WorkoutPage from '@/app/(protected)/workout/page';
import { MuscleRadar } from '@/features/analytics/components/MuscleRadar';
import { useActiveWorkoutStore } from '@/features/workout/store/active-workout.store';
import { getWeeklyMuscleVolume, getTdee14DaysAnalysis } from '@/features/analytics/services/kpis.service';
import { getDailyNutrition } from '@/features/nutrition/services/entries.service';
import { getTodayWorkoutOverview } from '@/features/workout/services/today-session.service';
import { getWeekSessions } from '@/features/workout/services/calendar.service';
import { formatShortFrenchDate, getLocalTodayIso } from '@/lib/date.utils';

vi.mock('@number-flow/react', () => ({ default: ({ value }: { value: number }) => <span>{value}</span> }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/features/daily-log/services/log.service', () => ({
  getPreviousWeightEma: vi.fn().mockResolvedValue(null),
  logWeightAndRecalculateEma: vi.fn(),
}));
vi.mock('@/features/daily-log/services/profile.service', () => ({
  getCurrentProfile: vi.fn().mockResolvedValue(null),
  updateProfileTargets: vi.fn(),
}));
vi.mock('@/features/nutrition/services/entries.service', () => ({ getDailyNutrition: vi.fn() }));
vi.mock('@/features/analytics/services/kpis.service', () => ({
  getTdee14DaysAnalysis: vi.fn(),
  getWeeklyMuscleVolume: vi.fn(),
}));
vi.mock('@/features/workout/services/today-session.service', () => ({
  getTodayWorkoutOverview: vi.fn(),
  buildStartPayloadFromPlannedSession: vi.fn(),
}));
vi.mock('@/features/workout/services/calendar.service', () => ({
  getWeekSessions: vi.fn(),
  loadSessionForEditing: vi.fn(),
}));
vi.mock('@/features/workout/services/presets.service', () => ({
  getWorkoutPresets: vi.fn().mockResolvedValue([]),
  deleteWorkoutPreset: vi.fn(),
  buildActiveExercisesFromPreset: vi.fn(),
}));
vi.mock('@/features/catalogs/services/exercises.service', () => ({ getActiveExercises: vi.fn().mockResolvedValue([]) }));
vi.mock('@/features/workout/services/ghost-records.service', () => ({ getExerciseGhostAndRecords: vi.fn() }));
vi.mock('@/features/workout/services/sessions.service', () => ({ finishAndSaveWorkoutSession: vi.fn() }));

const STORE_KEY = 'fitcouple-active-workout-v1';
// Build / SSR le 30 oct. à 23h30, ouverture sur l'iPhone le 31 oct. à 0h30 (changement de jour).
const DAY_J = new Date(2026, 9, 30, 23, 30, 0);
const DAY_J1 = new Date(2026, 9, 31, 0, 30, 0);
const ISO_J1 = '2026-10-31';

const hydrationLogs = (spy: ReturnType<typeof vi.spyOn>) =>
  spy.mock.calls.filter((args: unknown[]) => args.some((a) => /hydrat/i.test(String(a))));

let root: Root | null = null;
let container: HTMLElement | null = null;

/** SSR à J, hydratation à J+1 (après `beforeHydrate`) ; renvoie l'espion onRecoverableError. */
async function serverThenHydrate(ui: ReactElement, beforeHydrate?: () => void) {
  vi.setSystemTime(DAY_J);
  const html = renderToString(ui);
  container = document.createElement('div');
  container.innerHTML = html;
  document.body.appendChild(container);
  vi.setSystemTime(DAY_J1);
  beforeHydrate?.();
  const onRecoverableError = vi.fn();
  await act(async () => {
    root = hydrateRoot(container!, ui, { onRecoverableError });
  });
  await act(async () => {}); // flush des effets / promesses mockées
  return { html, onRecoverableError, el: container };
}

describe('Hydratation SSR → client sans mismatch (B1 / B3)', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    window.localStorage.clear();
    useActiveWorkoutStore.getState().clearActiveSession();
    window.localStorage.clear();
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getDailyNutrition).mockResolvedValue(
      { dailyLog: null, entries: [] } as unknown as Awaited<ReturnType<typeof getDailyNutrition>>
    );
    vi.mocked(getTdee14DaysAnalysis).mockReturnValue(new Promise(() => {}));
    vi.mocked(getTodayWorkoutOverview).mockResolvedValue({ kind: 'none' });
    vi.mocked(getWeekSessions).mockResolvedValue([]);
    vi.mocked(getWeeklyMuscleVolume).mockReturnValue(new Promise(() => {}));
  });

  afterEach(() => {
    act(() => root?.unmount());
    root = null;
    container?.remove();
    container = null;
    consoleErrorSpy.mockRestore();
    vi.useRealTimers();
  });

  it('témoin : une date lue au rendu provoque bien une erreur d’hydratation', async () => {
    function NaiveDate() {
      return <p>{getLocalTodayIso()}</p>;
    }
    const { onRecoverableError } = await serverThenHydrate(<NaiveDate />);
    expect(onRecoverableError).toHaveBeenCalled();
  });

  it('page `/` : date neutre au SSR, date J+1 et chargements J+1 après hydratation', async () => {
    const { html, onRecoverableError, el } = await serverThenHydrate(<TodayPage />);
    expect(html).not.toContain(formatShortFrenchDate('2026-10-30'));
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(hydrationLogs(consoleErrorSpy)).toEqual([]);
    expect(el!.textContent).toContain(formatShortFrenchDate(ISO_J1));
    expect(getDailyNutrition).toHaveBeenCalledWith(ISO_J1);
    expect(vi.mocked(getDailyNutrition).mock.calls.every(([d]) => d === ISO_J1)).toBe(true);
    expect(getTodayWorkoutOverview).toHaveBeenCalledWith(ISO_J1);
  });

  it('page `/workout` : séance active persistée côté client → skeleton puis ActiveSession', async () => {
    const { html, onRecoverableError, el } = await serverThenHydrate(<WorkoutPage />, () => {
      useActiveWorkoutStore.getState().startSession({ sessionName: 'Push lourd' });
      expect(window.localStorage.getItem(STORE_KEY)).toContain('"isActive":true');
    });
    expect(html).not.toContain('Push lourd');
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(hydrationLogs(consoleErrorSpy)).toEqual([]);
    expect(el!.textContent).toContain('Push lourd');
  });

  it('page `/workout` sans séance : agenda daté monté seulement après hydratation', async () => {
    const { onRecoverableError, el } = await serverThenHydrate(<WorkoutPage />);
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(hydrationLogs(consoleErrorSpy)).toEqual([]);
    expect(el!.textContent).toContain('Démarrer une séance libre');
  });

  it('MuscleRadar : skeleton sans libellé de semaine au SSR, semaine J+1 ensuite', async () => {
    const { html, onRecoverableError, el } = await serverThenHydrate(<MuscleRadar />);
    expect(html).not.toContain('→');
    expect(onRecoverableError).not.toHaveBeenCalled();
    expect(hydrationLogs(consoleErrorSpy)).toEqual([]);
    expect(getWeeklyMuscleVolume).toHaveBeenCalledTimes(1);
    expect(getWeeklyMuscleVolume).toHaveBeenCalledWith(ISO_J1);
    expect(el!.textContent).toContain('→');
  });
});
