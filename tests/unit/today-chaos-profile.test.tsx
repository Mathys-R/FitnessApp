// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TodayPage from '@/app/(protected)/page';
import { ProfileTargetsDrawer } from '@/features/daily-log/components/ProfileTargetsDrawer';
import {
  getOrCreateDailyLog,
  getPreviousWeightEma,
  type DailyLogRow,
} from '@/features/daily-log/services/log.service';
import {
  getCurrentProfile,
  updateProfileTargets,
  type ProfileRow,
} from '@/features/daily-log/services/profile.service';
import { toast } from 'sonner';

const mockProfile: ProfileRow = {
  id: 'user-01',
  display_name: 'Alex',
  current_target_kcal: 2400,
  current_target_p: 170,
  current_target_g: 260,
  current_target_l: 75,
  created_at: '2026-01-01T08:00:00Z',
  updated_at: '2026-01-01T08:00:00Z',
};

const mockDailyLog: DailyLogRow = {
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
  notes: null,
  created_at: '2026-10-30T06:30:00Z',
  updated_at: '2026-10-30T06:30:00Z',
};

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));

vi.mock('@/features/daily-log/services/log.service', () => ({
  getOrCreateDailyLog: vi.fn(),
  getPreviousWeightEma: vi.fn(),
  logWeightAndRecalculateEma: vi.fn(),
}));

vi.mock('@/features/daily-log/services/profile.service', () => ({
  getCurrentProfile: vi.fn(),
  updateProfileTargets: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ProfileTargetsDrawer Chaos & Monkey Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrCreateDailyLog).mockResolvedValue({ ...mockDailyLog });
    vi.mocked(getPreviousWeightEma).mockResolvedValue(82.0);
    vi.mocked(getCurrentProfile).mockResolvedValue({ ...mockProfile });
  });

  it('interaction nominale : ouverture du tiroir depuis TodayPage via action header et carte', async () => {
    render(<TodayPage />);

    // 1. Ouvrir via l icône d action du header
    const actionBtn = screen.getByLabelText('Modifier mes objectifs nutritionnels');
    fireEvent.click(actionBtn);

    expect(screen.getByText('Objectifs nutritionnels')).toBeDefined();

    // 2. Ouvrir via le résumé calories (carte cliquable)
    const caloriesCard = screen.getByText('Objectif Calories').closest('button')!;
    fireEvent.click(caloriesCard);

    expect(screen.getByText('Objectifs nutritionnels')).toBeDefined();
  });

  it('chaos test : ProfileTargetsDrawer clampe les valeurs négatives et extrêmes', async () => {
    const onTargetsUpdated = vi.fn();
    const updatedProfile: ProfileRow = {
      ...mockProfile,
      current_target_kcal: 10000,
      current_target_p: 0,
      current_target_g: 0,
      current_target_l: 10000,
    };
    vi.mocked(updateProfileTargets).mockResolvedValue(updatedProfile);

    render(
      <ProfileTargetsDrawer
        open={true}
        onOpenChange={vi.fn()}
        initialProfile={mockProfile}
        onTargetsUpdated={onTargetsUpdated}
      />
    );

    const [kcalInput, pInput, gInput, lInput] = screen.getAllByRole('spinbutton') as HTMLInputElement[];

    fireEvent.change(kcalInput, { target: { value: '999999' } });
    fireEvent.change(pInput, { target: { value: '-200' } });
    fireEvent.change(gInput, { target: { value: '-50' } });
    fireEvent.change(lInput, { target: { value: '50000' } });

    const submitBtn = screen.getByRole('button', { name: /enregistrer les objectifs/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(updateProfileTargets).toHaveBeenCalledWith({
        current_target_kcal: 10000,
        current_target_p: 0,
        current_target_g: 0,
        current_target_l: 10000,
      });
      expect(toast.success).toHaveBeenCalledWith('Objectifs mis à jour');
      expect(onTargetsUpdated).toHaveBeenCalledWith(updatedProfile);
    });
  });

  it('monkey test : clics multiples frénétiques sur calcul automatique Kcal', () => {
    render(
      <ProfileTargetsDrawer
        open={true}
        onOpenChange={vi.fn()}
        initialProfile={mockProfile}
      />
    );

    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    const [kcalInput, pInput, gInput, lInput] = inputs;

    fireEvent.change(pInput, { target: { value: '160' } });
    fireEvent.change(gInput, { target: { value: '220' } });
    fireEvent.change(lInput, { target: { value: '60' } });

    const calcBtn = screen.getByRole('button', { name: /calculer kcal depuis les macros/i });
    // 5 clics rapides successifs
    for (let i = 0; i < 5; i++) {
      fireEvent.click(calcBtn);
    }

    // 160*4 + 220*4 + 60*9 = 640 + 880 + 540 = 2060
    expect(kcalInput.value).toBe('2060');
  });

  it('monkey test : clics doubles pendant la sauvegarde avec disabled saving', async () => {
    let resolveProfile: (val: ProfileRow) => void = () => {};
    const pendingPromise = new Promise<ProfileRow>((res) => {
      resolveProfile = res;
    });
    vi.mocked(updateProfileTargets).mockReturnValue(pendingPromise);

    render(
      <ProfileTargetsDrawer
        open={true}
        onOpenChange={vi.fn()}
        initialProfile={mockProfile}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /enregistrer les objectifs/i });
    fireEvent.submit(submitBtn.closest('form')!);

    expect(submitBtn.getAttribute('disabled')).toBeDefined();

    // Clics répétés pendant saving
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    expect(updateProfileTargets).toHaveBeenCalledTimes(1);

    resolveProfile({ ...mockProfile });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Objectifs mis à jour');
    });
  });
});
