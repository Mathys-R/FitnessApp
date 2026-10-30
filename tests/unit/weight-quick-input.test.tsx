// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WeightQuickInput } from '@/features/daily-log/components/WeightQuickInput';
import { logWeightAndRecalculateEma, type DailyLogRow } from '@/features/daily-log/services/log.service';
import { toast } from 'sonner';

vi.mock('@/features/daily-log/services/log.service', () => ({
  logWeightAndRecalculateEma: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));

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

describe('WeightQuickInput Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche le poids actuel et l EMA 7j', () => {
    render(<WeightQuickInput dailyLog={mockDailyLog} previousEmaKg={null} />);

    expect(screen.getByText('Poids corporel')).toBeDefined();
    expect(screen.getAllByText('82.5').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/EMA 7j :/)).toBeDefined();
  });

  it('affiche le placeholder quand le poids est null', () => {
    const nullWeightLog: DailyLogRow = {
      ...mockDailyLog,
      weight_kg: null,
      weight_ema_kg: 81.0,
    };

    render(<WeightQuickInput dailyLog={nullWeightLog} previousEmaKg={null} />);

    expect(screen.getByText('— kg')).toBeDefined();
    expect(screen.getByText('81')).toBeDefined();
  });

  it('permet la modification de la valeur avec une virgule', async () => {
    render(<WeightQuickInput dailyLog={mockDailyLog} previousEmaKg={null} />);

    const triggerBtn = screen.getByRole('button', { name: /poids corporel/i });
    fireEvent.click(triggerBtn);

    const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '83,4' } });

    expect(input.value).toBe('83,4');
  });

  it('ajuste le poids avec les boutons rapides -0.1 et +0.1', async () => {
    render(<WeightQuickInput dailyLog={mockDailyLog} previousEmaKg={null} />);

    const triggerBtn = screen.getByRole('button', { name: /poids corporel/i });
    fireEvent.click(triggerBtn);

    const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
    const minusBtn = screen.getByRole('button', { name: '-0.1 kg' });
    const plusBtn = screen.getByRole('button', { name: '+0.1 kg' });

    fireEvent.click(plusBtn);
    expect(input.value).toBe('82.6');

    fireEvent.click(minusBtn);
    expect(input.value).toBe('82.5');
  });

  it('soumet la pesee et declenche logWeightAndRecalculateEma, toast et callback', async () => {
    const updatedLog: DailyLogRow = {
      ...mockDailyLog,
      weight_kg: 83.4,
      weight_ema_kg: 82.72,
    };
    vi.mocked(logWeightAndRecalculateEma).mockResolvedValueOnce(updatedLog);
    const mockOnWeightUpdated = vi.fn();

    render(
      <WeightQuickInput
        dailyLog={mockDailyLog}
        onWeightUpdated={mockOnWeightUpdated}
      />
    );

    const triggerBtn = screen.getByRole('button', { name: /poids corporel/i });
    fireEvent.click(triggerBtn);

    const input = screen.getByPlaceholderText('0.0') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '83,4' } });

    const submitBtn = screen.getByRole('button', { name: 'Enregistrer' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(logWeightAndRecalculateEma).toHaveBeenCalledWith('2026-10-30', 83.4);
      expect(toast.success).toHaveBeenCalledWith('Pesée enregistrée');
      expect(mockOnWeightUpdated).toHaveBeenCalledWith(updatedLog);
    });
  });
});
