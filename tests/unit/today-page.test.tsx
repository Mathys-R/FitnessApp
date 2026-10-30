// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TodayPage from '@/app/(protected)/page';

const { mockDailyLog, mockProfile } = vi.hoisted(() => ({
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
}));

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));

vi.mock('@/features/daily-log/services/log.service', () => ({
  getOrCreateDailyLog: vi.fn().mockResolvedValue(mockDailyLog),
  getPreviousWeightEma: vi.fn().mockResolvedValue(82.0),
  logWeightAndRecalculateEma: vi.fn(),
}));

vi.mock('@/features/daily-log/services/profile.service', () => ({
  getCurrentProfile: vi.fn().mockResolvedValue(mockProfile),
  updateProfileTargets: vi.fn(),
}));

describe('TodayPage Component (Couche 3 UI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('monte correctement et affiche les informations du jour', async () => {
    render(<TodayPage />);

    expect(screen.getByText("Aujourd'hui")).toBeDefined();
    expect(screen.getByText('Objectif Calories')).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText('2400')).toBeDefined();
      expect(screen.getByText('170g')).toBeDefined();
      expect(screen.getByText('260g')).toBeDefined();
      expect(screen.getByText('75g')).toBeDefined();
    });
  });

  it('affiche le bouton d action pour ouvrir les objectifs du profil', async () => {
    render(<TodayPage />);
    const actionBtn = screen.getByLabelText('Modifier mes objectifs nutritionnels');
    expect(actionBtn).toBeDefined();
    await waitFor(() => {
      expect(screen.getByText('2400')).toBeDefined();
    });
  });
});
