// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import type { DailyLogRow } from '@/features/daily-log/services/log.service';
import { WeightEmaChart } from '@/features/analytics/components/WeightEmaChart';
import { getWeightHistory } from '@/features/daily-log/services/log.service';

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span data-testid="number-flow">{value}</span>,
}));

vi.mock('@/features/daily-log/services/log.service', () => ({
  getWeightHistory: vi.fn(),
}));

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  const ResponsiveContainer = ({ children }: { children: React.ReactElement<{ width?: number; height?: number }> }) => (
    <div data-testid="responsive-container" style={{ width: 400, height: 220 }}>
      {React.cloneElement(children, { width: 400, height: 220 })}
    </div>
  );
  const ComposedChart = (props: React.ComponentProps<typeof actual.ComposedChart>) => {
    const data = (props.data ?? []) as Array<{ date: string; weight: number | null; ema: number | null }>;
    return (
      <div data-testid="composed-chart" data-count={data.length} data-dates={data.map((d) => d.date).join(',')}>
        <actual.ComposedChart {...props} />
      </div>
    );
  };
  return { ...actual, ResponsiveContainer, ComposedChart };
});

const mockedHistory = vi.mocked(getWeightHistory);

function row(log_date: string, weight_kg: number | null, weight_ema_kg: number | null): DailyLogRow {
  return {
    id: `id-${log_date}`,
    user_id: 'u1',
    log_date,
    weight_kg,
    weight_ema_kg,
    steps_count: null,
    target_kcal: 2500,
    target_p: 150,
    target_g: 300,
    target_l: 70,
    exclude_from_tdee: false,
    notes: null,
    created_at: `${log_date}T08:00:00Z`,
    updated_at: `${log_date}T08:00:00Z`,
  };
}

// Today frozen at 2026-06-15 local -> fenêtre aujourd'hui inclus : 30 j dès 2026-05-17, 90 j dès 2026-03-18
const HISTORY: DailyLogRow[] = [
  row('2026-04-01', 82.0, 82.0),
  row('2026-05-10', 81.0, 81.5),
  row('2026-05-20', 80.4, 80.8),
  row('2026-06-01', 80.0, null),
  row('2026-06-14', 79.8, 79.6),
];

const MINUS = '-'; // convention unique : signe moins ASCII (format.utils)

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('WeightEmaChart', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 5, 15, 12, 0, 0));
    mockedHistory.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('affiche le skeleton aria-busy pendant le chargement et appelle getWeightHistory(90)', async () => {
    const d = deferred<DailyLogRow[]>();
    mockedHistory.mockReturnValue(d.promise);
    const { container } = render(<WeightEmaChart className="extra" />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(mockedHistory).toHaveBeenCalledTimes(1);
    expect(mockedHistory).toHaveBeenCalledWith(90);
    expect(container.querySelector('section')?.className).toContain('extra');
    await act(async () => { d.resolve(HISTORY); });
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('30 j par défaut : filtre les points, affiche la dernière EMA et le delta signé', async () => {
    mockedHistory.mockResolvedValue(HISTORY);
    render(<WeightEmaChart />);
    const chart = await screen.findByTestId('composed-chart');
    expect(chart.getAttribute('data-count')).toBe('3');
    expect(chart.getAttribute('data-dates')).toBe('2026-05-20,2026-06-01,2026-06-14');
    expect(screen.getByRole('button', { name: '30 j' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '90 j' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByTestId('number-flow').textContent).toBe('79.6');
    // Delta EMA contre EMA : 79.6 - 80.8 = -1.2 (le point 06-01 à EMA null est ignoré)
    expect(screen.getByTestId('weight-ema-delta').textContent).toMatch(new RegExp(`^${MINUS}1,2\\s?kg sur 30 j$`));
  });

  it('bascule 90 j : plus de points et delta recalculé vs le premier point de la plage', async () => {
    mockedHistory.mockResolvedValue(HISTORY);
    render(<WeightEmaChart />);
    await screen.findByTestId('composed-chart');
    fireEvent.click(screen.getByRole('button', { name: '90 j' }));
    const chart = screen.getByTestId('composed-chart');
    expect(chart.getAttribute('data-count')).toBe('5');
    expect(screen.getByRole('button', { name: '90 j' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: '30 j' }).getAttribute('aria-pressed')).toBe('false');
    // 79.6 - 82.0 = -2.4
    expect(screen.getByTestId('weight-ema-delta').textContent).toMatch(new RegExp(`^${MINUS}2,4\\s?kg sur 90 j$`));
    fireEvent.click(screen.getByRole('button', { name: '30 j' }));
    expect(screen.getByTestId('composed-chart').getAttribute('data-count')).toBe('3');
    expect(screen.getByTestId('weight-ema-delta').textContent).toMatch(/1,2\s?kg sur 30 j$/);
    expect(mockedHistory).toHaveBeenCalledTimes(1);
  });

  it('delta positif signé avec "+"', async () => {
    mockedHistory.mockResolvedValue([row('2026-06-01', 70, 70.0), row('2026-06-10', 71, 70.5)]);
    render(<WeightEmaChart />);
    expect((await screen.findByTestId('weight-ema-delta')).textContent).toMatch(/^\+0,5\s?kg sur 30 j$/);
  });

  it('moins de 2 EMA dans la plage → fallback sur le poids brut (dernière valeur et delta)', async () => {
    mockedHistory.mockResolvedValue([
      row('2026-06-01', 80.0, null),
      row('2026-06-07', 79.5, 79.8),
      row('2026-06-14', 79.1, null),
    ]);
    render(<WeightEmaChart />);
    await screen.findByTestId('composed-chart');
    expect(screen.getByTestId('number-flow').textContent).toBe('79.1');
    // 79.1 - 80.0 = -0.9
    expect(screen.getByTestId('weight-ema-delta').textContent).toMatch(new RegExp(`^${MINUS}0,9\\s?kg sur 30 j$`));
  });

  it('premier point de la plage sans EMA → delta calculé uniquement sur les EMA', async () => {
    mockedHistory.mockResolvedValue([
      row('2026-06-01', 80.0, null),
      row('2026-06-07', 79.5, 79.8),
      row('2026-06-14', 79.1, 79.4),
    ]);
    render(<WeightEmaChart />);
    await screen.findByTestId('composed-chart');
    expect(screen.getByTestId('number-flow').textContent).toBe('79.4');
    // 79.4 - 79.8 = -0.4 (et non 79.4 - 80.0 brut = -0.6)
    expect(screen.getByTestId('weight-ema-delta').textContent).toMatch(new RegExp(`^${MINUS}0,4\\s?kg sur 30 j$`));
  });

  it('refreshKey qui change → nouvel appel getWeightHistory', async () => {
    mockedHistory.mockResolvedValue(HISTORY);
    const { rerender } = render(<WeightEmaChart refreshKey={0} />);
    await screen.findByTestId('composed-chart');
    expect(mockedHistory).toHaveBeenCalledTimes(1);
    mockedHistory.mockResolvedValue([...HISTORY, row('2026-06-15', 79.0, 79.4)]);
    rerender(<WeightEmaChart refreshKey={1} />);
    await waitFor(() => expect(screen.getByTestId('number-flow').textContent).toBe('79.4'));
    expect(mockedHistory).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('composed-chart').getAttribute('data-count')).toBe('4');
    rerender(<WeightEmaChart refreshKey={1} />);
    expect(mockedHistory).toHaveBeenCalledTimes(2);
  });

  it('anti-course : une réponse obsolète ne remplace pas la plus récente', async () => {
    const first = deferred<DailyLogRow[]>();
    const second = deferred<DailyLogRow[]>();
    mockedHistory.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { rerender } = render(<WeightEmaChart refreshKey={0} />);
    rerender(<WeightEmaChart refreshKey={1} />);
    await act(async () => { second.resolve([row('2026-06-10', 75, 75.0), row('2026-06-14', 74, 74.5)]); });
    await act(async () => { first.resolve(HISTORY); });
    expect(screen.getByTestId('number-flow').textContent).toBe('74.5');
  });

  it('erreur → role=alert + Réessayer → succès', async () => {
    mockedHistory.mockRejectedValueOnce(new Error('réseau KO')).mockResolvedValueOnce(HISTORY);
    render(<WeightEmaChart />);
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain("Impossible de charger l'historique de poids.");
    fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
    await screen.findByTestId('composed-chart');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(mockedHistory).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('number-flow').textContent).toBe('79.6');
  });

  it('erreur non-Error (rejet string) → pas de crash, alerte affichée', async () => {
    mockedHistory.mockRejectedValueOnce('boom');
    render(<WeightEmaChart />);
    expect(await screen.findByRole('alert')).toBeTruthy();
  });

  it('aucune pesée → message vide, pas de graphe ni d’en-tête chiffré', async () => {
    mockedHistory.mockResolvedValue([]);
    render(<WeightEmaChart />);
    expect(await screen.findByText('Aucune pesée sur les 30 derniers jours.')).toBeTruthy();
    expect(screen.queryByTestId('composed-chart')).toBeNull();
    expect(screen.queryByTestId('number-flow')).toBeNull();
    expect(screen.queryByTestId('weight-ema-delta')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '90 j' }));
    expect(screen.getByText('Aucune pesée sur les 90 derniers jours.')).toBeTruthy();
  });

  it('pesées hors plage 30 j uniquement → vide en 30 j, graphe en 90 j', async () => {
    mockedHistory.mockResolvedValue([row('2026-04-01', 82, 82), row('2026-05-01', 81, 81.5)]);
    render(<WeightEmaChart />);
    expect(await screen.findByText('Aucune pesée sur les 30 derniers jours.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '90 j' }));
    expect(screen.getByTestId('composed-chart').getAttribute('data-count')).toBe('2');
  });

  it('une seule pesée → valeur affichée, pas de delta, message « pas assez »', async () => {
    mockedHistory.mockResolvedValue([row('2026-06-14', 80.2, 80.2)]);
    render(<WeightEmaChart />);
    expect(await screen.findByText('Pas encore assez de pesées pour tracer la tendance')).toBeTruthy();
    expect(screen.getByTestId('number-flow').textContent).toBe('80.2');
    expect(screen.queryByTestId('weight-ema-delta')).toBeNull();
    expect(screen.queryByTestId('composed-chart')).toBeNull();
  });

  it('borne : 30 j = today-29 inclus, today-30 exclu ; 90 j = today-89 inclus, today-90 exclu', async () => {
    mockedHistory.mockResolvedValue([
      row('2026-03-17', 85, 85),
      row('2026-03-18', 84, 84),
      row('2026-05-16', 83, 83),
      row('2026-05-17', 82, 82),
      row('2026-06-15', 81, 81),
    ]);
    render(<WeightEmaChart />);
    const chart = await screen.findByTestId('composed-chart');
    expect(chart.getAttribute('data-dates')).toBe('2026-05-17,2026-06-15');
    fireEvent.click(screen.getByRole('button', { name: '90 j' }));
    expect(screen.getByTestId('composed-chart').getAttribute('data-dates')).toBe('2026-03-18,2026-05-16,2026-05-17,2026-06-15');
  });
});
