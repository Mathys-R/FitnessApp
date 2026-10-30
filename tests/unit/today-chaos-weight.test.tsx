// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TodayPage from '@/app/(protected)/page';
import { WeightQuickInput } from '@/features/daily-log/components/WeightQuickInput';
import {
  getOrCreateDailyLog,
  getPreviousWeightEma,
  logWeightAndRecalculateEma,
  type DailyLogRow,
} from '@/features/daily-log/services/log.service';
import { getCurrentProfile } from '@/features/daily-log/services/profile.service';
import { toast } from 'sonner';

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

describe('WeightQuickInput Chaos & Monkey Testing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrCreateDailyLog).mockResolvedValue({ ...mockDailyLog });
    vi.mocked(getPreviousWeightEma).mockResolvedValue(82.0);
    vi.mocked(getCurrentProfile).mockResolvedValue({
      id: 'user-01',
      display_name: 'Alex',
      current_target_kcal: 2400,
      current_target_p: 170,
      current_target_g: 260,
      current_target_l: 75,
      created_at: '2026-01-01T08:00:00Z',
      updated_at: '2026-01-01T08:00:00Z',
    });
  });

  it('flux nominal : saisie pesée et mise à jour dynamique du poids et de l EMA', async () => {
    const updatedLog: DailyLogRow = {
      ...mockDailyLog,
      weight_kg: 83.5,
      weight_ema_kg: 82.75,
    };
    vi.mocked(logWeightAndRecalculateEma).mockResolvedValue(updatedLog);

    render(<TodayPage />);
    await waitFor(() => {
      expect(screen.getByText('Poids corporel')).toBeDefined();
    });

    const weightCard = screen.getByRole('button', { name: /poids corporel/i });
    fireEvent.click(weightCard);

    const weightInput = screen.getByPlaceholderText('0.0') as HTMLInputElement;
    fireEvent.change(weightInput, { target: { value: '83,5' } });

    const submitBtn = screen.getByRole('button', { name: /^enregistrer$/i });
    fireEvent.submit(submitBtn.closest('form')!);

    await waitFor(() => {
      expect(logWeightAndRecalculateEma).toHaveBeenCalledWith('2026-10-30', 83.5);
      expect(toast.success).toHaveBeenCalledWith('Pesée enregistrée');
    });

    await waitFor(() => {
      expect(screen.getAllByText('83.5').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('82.75')).toBeDefined();
    });
  });

  it('monkey test : clics frénétiques rapides sur les boutons d incrémentation', () => {
    render(<WeightQuickInput dailyLog={mockDailyLog} previousEmaKg={null} />);

    fireEvent.click(screen.getByRole('button', { name: /poids corporel/i }));
    const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
    const plusBtn = screen.getByRole('button', { name: '+0.1 kg' });
    const minusBtn = screen.getByRole('button', { name: '-0.1 kg' });

    for (let i = 0; i < 5; i++) fireEvent.click(plusBtn);
    expect(Number(input.value)).toBeGreaterThanOrEqual(82.6);

    for (let i = 0; i < 3; i++) fireEvent.click(minusBtn);
    expect(Number.isFinite(Number(input.value))).toBe(true);
  });

  it('chaos test : payloads extrêmes, négatifs, zéro et XSS rejetés sans exception', () => {
    render(<WeightQuickInput dailyLog={mockDailyLog} previousEmaKg={null} />);

    fireEvent.click(screen.getByRole('button', { name: /poids corporel/i }));
    const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /^enregistrer$/i });

    const forbidden = ['-5', '0', '-999999', '999999', '1000', '<script>alert(1)</script>', 'DROP TABLE logs;', '   ', 'abc', ',,', '..'];

    for (const payload of forbidden) {
      fireEvent.change(input, { target: { value: payload } });
      fireEvent.submit(submitBtn.closest('form')!);

      expect(toast.error).toHaveBeenCalledWith('Veuillez renseigner un poids valide (> 0 kg)');
      expect(logWeightAndRecalculateEma).not.toHaveBeenCalled();
      vi.clearAllMocks();
    }
  });

  it('chaos test : date vide dans WeightQuickInput bloque la soumission avec toast', () => {
    render(<WeightQuickInput dailyLog={mockDailyLog} previousEmaKg={null} />);

    fireEvent.click(screen.getByRole('button', { name: /poids corporel/i }));
    const dateInput = document.getElementById('weight-date') as HTMLInputElement;
    const submitBtn = screen.getByRole('button', { name: /^enregistrer$/i });

    fireEvent.change(dateInput, { target: { value: '' } });
    fireEvent.submit(submitBtn.closest('form')!);

    expect(toast.error).toHaveBeenCalledWith('Veuillez renseigner une date valide');
    expect(logWeightAndRecalculateEma).not.toHaveBeenCalled();
  });

  it('monkey test : clics doubles et répétitifs sur soumission avec protection isSaving', async () => {
    let resolveLog: (val: DailyLogRow) => void = () => {};
    const pendingPromise = new Promise<DailyLogRow>((res) => {
      resolveLog = res;
    });
    vi.mocked(logWeightAndRecalculateEma).mockReturnValue(pendingPromise);

    render(<WeightQuickInput dailyLog={mockDailyLog} previousEmaKg={null} />);

    fireEvent.click(screen.getByRole('button', { name: /poids corporel/i }));
    const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '82.8' } });

    const submitBtn = screen.getByRole('button', { name: /^enregistrer$/i });

    fireEvent.click(submitBtn);
    expect(submitBtn.getAttribute('disabled')).toBeDefined();

    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);

    expect(logWeightAndRecalculateEma).toHaveBeenCalledTimes(1);

    resolveLog({ ...mockDailyLog, weight_kg: 82.8 });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith('Pesée enregistrée');
    });
  });
});
