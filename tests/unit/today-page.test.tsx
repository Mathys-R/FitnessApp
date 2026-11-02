// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TodayPage from '@/app/(protected)/page';
import { useActiveWorkoutStore } from '@/features/workout/store/active-workout.store';
import { getTdee14DaysAnalysis } from '@/features/analytics/services/kpis.service';
import { getDailyNutrition } from '@/features/nutrition/services/entries.service';
import { logWeightAndRecalculateEma } from '@/features/daily-log/services/log.service';
import { getTodayWorkoutOverview } from '@/features/workout/services/today-session.service';

const { mockDailyLog, mockProfile, mockEntries, mockTdee, push } = vi.hoisted(() => ({
  mockDailyLog: {
    id: 'log-01',
    user_id: 'user-01',
    log_date: '2026-10-30',
    weight_kg: 82.5,
    weight_ema_kg: 82.5,
    steps_count: 8500,
    target_kcal: 2400,
    target_p: 170,
    target_g: 260,
    target_l: 75,
    exclude_from_tdee: false,
    notes: 'Forme olympique',
    created_at: '2026-10-30T06:30:00Z',
    updated_at: '2026-10-30T06:30:00Z',
  },
  mockProfile: {
    id: 'user-01',
    display_name: 'Alex',
    current_target_kcal: 2400,
    current_target_p: 170,
    current_target_g: 260,
    current_target_l: 75,
    created_at: '2026-01-01T08:00:00Z',
    updated_at: '2026-01-01T08:00:00Z',
  },
  mockEntries: [
    { id: 'e1', total_kcal: 650, total_p: 40, total_g: 80, total_l: 15, meal_entry_items: [] },
    { id: 'e2', total_kcal: 525, total_p: 35, total_g: 60, total_l: null, meal_entry_items: [] },
  ],
  mockTdee: {
    status: 'ready' as const,
    estimatedTdeeKcal: 2750,
    averageIntakeKcal: 2500,
    deltaEma14dKg: -0.45,
    dailyEnergyDeltaKcal: -250,
    validNutritionDays: 12,
    excludedDaysCount: 0,
  },
  push: vi.fn(),
}));

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock('@/features/daily-log/services/log.service', () => ({
  getOrCreateDailyLog: vi.fn().mockResolvedValue(mockDailyLog),
  getPreviousWeightEma: vi.fn().mockResolvedValue(82.0),
  logWeightAndRecalculateEma: vi.fn(),
}));

vi.mock('@/features/daily-log/services/profile.service', () => ({
  getCurrentProfile: vi.fn().mockResolvedValue(mockProfile),
  updateProfileTargets: vi.fn(),
}));

vi.mock('@/features/nutrition/services/entries.service', () => ({
  getDailyNutrition: vi.fn(),
}));

vi.mock('@/features/analytics/services/kpis.service', () => ({
  getTdee14DaysAnalysis: vi.fn(),
}));

vi.mock('@/features/workout/services/today-session.service', () => ({
  getTodayWorkoutOverview: vi.fn(),
  buildStartPayloadFromPlannedSession: vi.fn(),
}));

describe('TodayPage — Cockpit « Aujourd’hui » (Couche 3 UI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useActiveWorkoutStore.getState().clearActiveSession();
    vi.mocked(getDailyNutrition).mockResolvedValue({
      dailyLog: { ...mockDailyLog },
      entries: mockEntries,
    } as unknown as Awaited<ReturnType<typeof getDailyNutrition>>);
    vi.mocked(getTdee14DaysAnalysis).mockResolvedValue({ ...mockTdee });
    vi.mocked(getTodayWorkoutOverview).mockResolvedValue({ kind: 'none' });
  });

  it('affiche les kcal consommées et les cibles via DailyMacroSummary', async () => {
    render(<TodayPage />);
    expect(screen.getByText("Aujourd'hui")).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('1175')).toBeDefined(); // 650 + 525
      expect(screen.getByText('/ 2400 kcal')).toBeDefined();
      expect(screen.getByText('/ 170g')).toBeDefined();
      expect(screen.getByText('/ 260g')).toBeDefined();
      expect(screen.getByText('/ 75g')).toBeDefined();
    });
    expect(getDailyNutrition).toHaveBeenCalledTimes(1);
  });

  it('n’expose pas le switch d’exclusion TDEE dans le cockpit', async () => {
    render(<TodayPage />);
    await waitFor(() => expect(screen.getByText('/ 2400 kcal')).toBeDefined());
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('propose le lien « Ajouter un repas » vers /nutrition et l’action cibles', async () => {
    render(<TodayPage />);
    expect(screen.getByLabelText('Modifier mes objectifs nutritionnels')).toBeDefined();
    const link = await screen.findByRole('link', { name: /ajouter un repas/i });
    expect(link.getAttribute('href')).toBe('/nutrition');
  });

  it('assemble le bandeau TDEE compact et la carte Séance du jour', async () => {
    render(<TodayPage />);
    await waitFor(() => {
      expect(screen.getByLabelText('Maintenance Réelle 14j')).toBeDefined();
      expect(screen.getByText('Aucune séance prévue')).toBeDefined();
    });
    expect(getTodayWorkoutOverview).toHaveBeenCalledTimes(1);
  });

  it('une pesée enregistrée recharge le TdeeBanner (refreshKey)', async () => {
    vi.mocked(logWeightAndRecalculateEma).mockResolvedValue({
      ...mockDailyLog,
      weight_kg: 83.5,
      weight_ema_kg: 82.75,
    });
    render(<TodayPage />);

    await waitFor(() => expect(screen.getByText('Poids corporel')).toBeDefined());
    await waitFor(() => expect(getTdee14DaysAnalysis).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole('button', { name: /poids corporel/i }));
    fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value: '83,5' } });
    const submitBtn = screen.getByRole('button', { name: /^enregistrer$/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(logWeightAndRecalculateEma).toHaveBeenCalledTimes(1);
      expect(getTdee14DaysAnalysis).toHaveBeenCalledTimes(2);
    });
  });

  describe('B2 — pesée antidatée vs pesée du jour', () => {
    const TODAY = '2026-10-30';

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 30, 9, 0, 0));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function submitWeighIn(dateIso: string, value: string) {
      await waitFor(() => expect(screen.getByText('Poids corporel')).toBeDefined());
      await waitFor(() => expect(getTdee14DaysAnalysis).toHaveBeenCalledTimes(1));
      fireEvent.click(screen.getByRole('button', { name: /poids corporel/i }));
      fireEvent.change(screen.getByLabelText('Date'), { target: { value: dateIso } });
      fireEvent.change(screen.getByPlaceholderText('0.0'), { target: { value } });
      fireEvent.submit(screen.getByRole('button', { name: /^enregistrer$/i }).closest('form')!);
    }

    it('pesée sur J-1 → la journée affichée reste J et getDailyNutrition(J) est rappelé', async () => {
      vi.mocked(logWeightAndRecalculateEma).mockResolvedValue({
        ...mockDailyLog,
        id: 'log-yesterday',
        log_date: '2026-10-29',
        weight_kg: 90.4,
        weight_ema_kg: 90.4,
      });
      render(<TodayPage />);
      await waitFor(() => expect(getDailyNutrition).toHaveBeenCalledTimes(1));
      expect(getDailyNutrition).toHaveBeenLastCalledWith(TODAY);

      await submitWeighIn('2026-10-29', '90,4');

      await waitFor(() => {
        expect(logWeightAndRecalculateEma).toHaveBeenCalledWith('2026-10-29', 90.4);
        expect(getDailyNutrition).toHaveBeenCalledTimes(2);
        expect(getTdee14DaysAnalysis).toHaveBeenCalledTimes(2);
      });
      expect(vi.mocked(getDailyNutrition).mock.calls.every(([d]) => d === TODAY)).toBe(true);
      expect(screen.queryByText('90.4')).toBeNull();
      expect(screen.getAllByText('82.5').length).toBeGreaterThan(0);
    });

    it('pesée sur J → setDailyLog direct sans rechargement du journal', async () => {
      vi.mocked(logWeightAndRecalculateEma).mockResolvedValue({
        ...mockDailyLog,
        weight_kg: 83.5,
        weight_ema_kg: 82.75,
      });
      render(<TodayPage />);
      await waitFor(() => expect(getDailyNutrition).toHaveBeenCalledTimes(1));

      await submitWeighIn(TODAY, '83,5');

      await waitFor(() => {
        expect(screen.getByText('83.5')).toBeDefined();
        expect(getTdee14DaysAnalysis).toHaveBeenCalledTimes(2);
      });
      expect(getDailyNutrition).toHaveBeenCalledTimes(1);
    });
  });
});
