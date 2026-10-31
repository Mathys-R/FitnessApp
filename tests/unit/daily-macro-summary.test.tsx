// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DailyMacroSummary } from '@/features/nutrition/components/DailyMacroSummary';
import type { DailyLogRow } from '@/features/daily-log/services/log.service';

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));

vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, className, style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties }) => (
      <div className={className} style={style}>
        {children}
      </div>
    ),
  },
}));

const mockDailyLog: DailyLogRow = {
  id: 'log-01',
  user_id: 'user-01',
  log_date: '2026-10-30',
  weight_kg: 80,
  weight_ema_kg: 80,
  steps_count: 8000,
  target_kcal: 2400,
  target_p: 160,
  target_g: 250,
  target_l: 70,
  exclude_from_tdee: false,
  notes: null,
  created_at: '2026-10-30T00:00:00Z',
  updated_at: '2026-10-30T00:00:00Z',
};

describe('DailyMacroSummary Component', () => {
  it('affiche les calories consommées, la cible et les kcal restantes en déficit', () => {
    render(
      <DailyMacroSummary
        dailyLog={mockDailyLog}
        consumedMacros={{ kcal: 1800, p: 120, g: 190, l: 50 }}
      />
    );

    expect(screen.getByText('Calories')).toBeDefined();
    expect(screen.getByText('1800')).toBeDefined();
    expect(screen.getByText('/ 2400 kcal')).toBeDefined();
    expect(screen.getByText('600')).toBeDefined();
    expect(screen.getByText(/kcal restantes/)).toBeDefined();
  });

  it('affiche le badge de surplus calorique quand la cible est dépassée', () => {
    render(
      <DailyMacroSummary
        dailyLog={mockDailyLog}
        consumedMacros={{ kcal: 2650, p: 180, g: 290, l: 80 }}
      />
    );

    expect(screen.getByText('2650')).toBeDefined();
    expect(screen.getByText('250')).toBeDefined();
    expect(screen.getByText(/kcal en surplus/)).toBeDefined();
  });

  it('affiche les 3 macros avec leurs cibles', () => {
    render(
      <DailyMacroSummary
        dailyLog={mockDailyLog}
        consumedMacros={{ kcal: 2000, p: 140, g: 200, l: 60 }}
      />
    );

    expect(screen.getByText('Protéines')).toBeDefined();
    expect(screen.getByText('140')).toBeDefined();
    expect(screen.getByText('/ 160g')).toBeDefined();

    expect(screen.getByText('Glucides')).toBeDefined();
    expect(screen.getByText('200')).toBeDefined();
    expect(screen.getByText('/ 250g')).toBeDefined();

    expect(screen.getByText('Lipides')).toBeDefined();
    expect(screen.getByText('60')).toBeDefined();
    expect(screen.getByText('/ 70g')).toBeDefined();
  });

  it('gère l interaction avec le switch exclusion TDEE', () => {
    const handleToggle = vi.fn();
    render(
      <DailyMacroSummary
        dailyLog={mockDailyLog}
        consumedMacros={{ kcal: 2000, p: 140, g: 200, l: 60 }}
        onToggleExcludeTdee={handleToggle}
      />
    );

    const toggleBtn = screen.getByRole('switch', { name: /Journée atypique/i });
    expect(toggleBtn).toBeDefined();
    expect(toggleBtn.getAttribute('aria-checked')).toBe('false');

    fireEvent.click(toggleBtn);
    expect(handleToggle).toHaveBeenCalledTimes(1);
    expect(handleToggle).toHaveBeenCalledWith(true);
  });

  it('désactive le switch quand isTogglingTdee est true', () => {
    const handleToggle = vi.fn();
    render(
      <DailyMacroSummary
        dailyLog={{ ...mockDailyLog, exclude_from_tdee: true }}
        consumedMacros={{ kcal: 2000, p: 140, g: 200, l: 60 }}
        onToggleExcludeTdee={handleToggle}
        isTogglingTdee={true}
      />
    );

    const toggleBtn = screen.getByRole('switch', { name: /Journée atypique/i });
    expect(toggleBtn.getAttribute('aria-checked')).toBe('true');
    expect(toggleBtn.hasAttribute('disabled')).toBe(true);

    fireEvent.click(toggleBtn);
    expect(handleToggle).not.toHaveBeenCalled();
  });
});
