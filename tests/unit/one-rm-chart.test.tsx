// @vitest-environment happy-dom
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act, cleanup, within } from '@testing-library/react';
import { toast } from 'sonner';
import { OneRmChart } from '@/features/analytics/components/OneRmChart';
import {
  OneRmChartPlot,
  METRIC_LABELS,
  formatCompactKg,
  formatTooltipDate,
  type OneRmChartPlotProps,
} from '@/features/analytics/components/OneRmChartPlot';
import { getActiveExercises, type ExerciseRow } from '@/features/catalogs/services/exercises.service';
import { getExerciseOneRmHistory, type OneRmHistoryPoint } from '@/features/analytics/services/kpis.service';
import { mockExerciseBench, mockExerciseSquat, mockExercisePullup } from '../fixtures/catalogs.fixture';

vi.mock('@/features/catalogs/services/exercises.service', () => ({
  getActiveExercises: vi.fn(),
}));

vi.mock('@/features/analytics/services/kpis.service', () => ({
  getExerciseOneRmHistory: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span data-testid="number-flow">{value}</span>,
}));

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 390, height: 220 }}>
        {isValidElement(children)
          ? cloneElement(children as ReactElement<{ width?: number; height?: number }>, { width: 390, height: 220 })
          : children}
      </div>
    ),
  };
});

// Espion sur le plot : on garde le rendu réel mais on capture les props reçues.
const plotSpy = vi.fn();
vi.mock('@/features/analytics/components/OneRmChartPlot', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/analytics/components/OneRmChartPlot')>();
  return {
    ...actual,
    OneRmChartPlot: (props: OneRmChartPlotProps) => {
      plotSpy(props);
      return actual.OneRmChartPlot(props);
    },
  };
});

const mockGetExercises = vi.mocked(getActiveExercises);
const mockGetHistory = vi.mocked(getExerciseOneRmHistory);

const EXERCISES: ExerciseRow[] = [mockExerciseBench, mockExerciseSquat, mockExercisePullup];

const BENCH_POINTS: OneRmHistoryPoint[] = [
  { session_date: '2026-10-01', max_1rm_kg: 100, max_weight_kg: 90, total_tonnage_kg: 2400 },
  { session_date: '2026-10-08', max_1rm_kg: 105.5, max_weight_kg: 92.5, total_tonnage_kg: 2600 },
  { session_date: '2026-10-15', max_1rm_kg: 103, max_weight_kg: 92.5, total_tonnage_kg: 2500 },
];

const SQUAT_POINTS: OneRmHistoryPoint[] = [
  { session_date: '2026-10-02', max_1rm_kg: 140, max_weight_kg: 120, total_tonnage_kg: 4000 },
  { session_date: '2026-10-09', max_1rm_kg: 150, max_weight_kg: 130, total_tonnage_kg: 4200 },
];

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const getSelect = () => screen.getByRole('combobox', { name: 'Exercice' }) as HTMLSelectElement;
const lastPlotProps = (): OneRmChartPlotProps => plotSpy.mock.calls[plotSpy.mock.calls.length - 1][0];

async function renderLoaded() {
  render(<OneRmChart />);
  return waitFor(() => getSelect());
}

function selectExercise(id: string) {
  fireEvent.change(getSelect(), { target: { value: id } });
}

describe('OneRmChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetExercises.mockResolvedValue(EXERCISES);
    mockGetHistory.mockResolvedValue(BENCH_POINTS);
  });

  afterEach(() => cleanup());

  describe('chargement des exercices', () => {
    it('affiche un squelette pendant le chargement des exercices puis le select', async () => {
      const d = deferred<ExerciseRow[]>();
      mockGetExercises.mockReturnValueOnce(d.promise);
      render(<OneRmChart />);

      expect(screen.getByLabelText('Chargement des exercices')).toBeDefined();
      expect(screen.queryByRole('combobox', { name: 'Exercice' })).toBeNull();
      expect(mockGetExercises).toHaveBeenCalledTimes(1);

      await act(async () => { d.resolve(EXERCISES); });

      expect(screen.queryByLabelText('Chargement des exercices')).toBeNull();
      const select = getSelect();
      const options = within(select).getAllByRole('option');
      expect(options.map((o) => o.textContent)).toEqual([
        'Choisis un exercice',
        'Développé couché barre',
        'Squat barre nuque',
        'Tractions pronation',
      ]);
      expect(select.value).toBe('');
    });

    it('affiche l’invite tant qu’aucun exercice n’est sélectionné, sans appeler l’historique', async () => {
      await renderLoaded();
      expect(screen.getByText('Choisis un exercice pour afficher sa progression.')).toBeDefined();
      expect(mockGetHistory).not.toHaveBeenCalled();
      expect(screen.queryByText('Meilleur 1RM')).toBeNull();
      expect(screen.queryByTestId('one-rm-chart-plot')).toBeNull();
    });

    it('erreur exercices : toast + Réessayer relance le chargement', async () => {
      mockGetExercises.mockRejectedValueOnce(new Error('boom'));
      render(<OneRmChart />);

      await waitFor(() => expect(screen.getByText('Impossible de charger les exercices.')).toBeDefined());
      expect(toast.error).toHaveBeenCalledWith('Impossible de charger les exercices');
      expect(screen.queryByRole('combobox', { name: 'Exercice' })).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
      // Retour immédiat à l'état chargement
      expect(screen.getByLabelText('Chargement des exercices')).toBeDefined();

      await waitFor(() => getSelect());
      expect(mockGetExercises).toHaveBeenCalledTimes(2);
      expect(screen.queryByText('Impossible de charger les exercices.')).toBeNull();
    });
  });

  describe('sélection et historique', () => {
    it('la sélection déclenche getExerciseOneRmHistory(id) et affiche le plot + meilleur 1RM', async () => {
      const d = deferred<OneRmHistoryPoint[]>();
      mockGetHistory.mockReturnValueOnce(d.promise);
      await renderLoaded();

      selectExercise(mockExerciseBench.id);
      expect(mockGetHistory).toHaveBeenCalledWith(mockExerciseBench.id);
      expect(screen.getByLabelText('Chargement')).toBeDefined();

      await act(async () => { d.resolve(BENCH_POINTS); });

      expect(screen.queryByLabelText('Chargement')).toBeNull();
      expect(screen.getByTestId('one-rm-chart-plot')).toBeDefined();
      expect(screen.getByText('Meilleur 1RM')).toBeDefined();
      expect(screen.getByTestId('number-flow').textContent).toBe('105.5');
      expect(lastPlotProps()).toEqual({ points: BENCH_POINTS, metric: 'max_1rm_kg' });
      expect(screen.queryByText('Encore 1 séance pour tracer une tendance.')).toBeNull();
    });

    it('historique vide : message dédié, pas de plot ni d’en-tête', async () => {
      mockGetHistory.mockResolvedValueOnce([]);
      await renderLoaded();
      selectExercise(mockExerciseBench.id);

      await waitFor(() => expect(screen.getByText('Aucune séance validée pour cet exercice.')).toBeDefined());
      expect(screen.queryByTestId('one-rm-chart-plot')).toBeNull();
      expect(screen.queryByText('Meilleur 1RM')).toBeNull();
    });

    it('un seul point : plot affiché + mention « Encore 1 séance »', async () => {
      mockGetHistory.mockResolvedValueOnce([BENCH_POINTS[0]]);
      await renderLoaded();
      selectExercise(mockExerciseBench.id);

      await waitFor(() => expect(screen.getByText('Encore 1 séance pour tracer une tendance.')).toBeDefined());
      expect(screen.getByTestId('one-rm-chart-plot')).toBeDefined();
      expect(screen.getByTestId('number-flow').textContent).toBe('100');
      expect(lastPlotProps().points).toHaveLength(1);
    });

    it('erreur historique : toast + Réessayer relance le fetch du même exercice', async () => {
      mockGetHistory.mockRejectedValueOnce(new Error('network'));
      await renderLoaded();
      selectExercise(mockExerciseBench.id);

      await waitFor(() => expect(screen.getByText("Impossible de charger l'historique.")).toBeDefined());
      expect(toast.error).toHaveBeenCalledWith("Impossible de charger l'historique");
      expect(screen.queryByTestId('one-rm-chart-plot')).toBeNull();

      const d = deferred<OneRmHistoryPoint[]>();
      mockGetHistory.mockReturnValueOnce(d.promise);
      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));

      expect(screen.getByLabelText('Chargement')).toBeDefined();
      expect(mockGetHistory).toHaveBeenCalledTimes(2);
      expect(mockGetHistory).toHaveBeenLastCalledWith(mockExerciseBench.id);

      await act(async () => { d.resolve(BENCH_POINTS); });
      expect(screen.getByTestId('one-rm-chart-plot')).toBeDefined();
      expect(screen.queryByText("Impossible de charger l'historique.")).toBeNull();
    });

    it('revenir sur l’option vide réaffiche l’invite', async () => {
      await renderLoaded();
      selectExercise(mockExerciseBench.id);
      await waitFor(() => screen.getByTestId('one-rm-chart-plot'));

      selectExercise('');
      expect(screen.getByText('Choisis un exercice pour afficher sa progression.')).toBeDefined();
      expect(screen.queryByTestId('one-rm-chart-plot')).toBeNull();
      expect(screen.queryByText('Meilleur 1RM')).toBeNull();
    });
  });

  describe('re-sélection', () => {
    it('A → vide → A repasse par le skeleton au lieu de réafficher l’ancien résultat', async () => {
      await renderLoaded();
      selectExercise(mockExerciseBench.id);
      await waitFor(() => screen.getByTestId('one-rm-chart-plot'));

      selectExercise('');
      const d = deferred<OneRmHistoryPoint[]>();
      mockGetHistory.mockReturnValueOnce(d.promise);
      selectExercise(mockExerciseBench.id);

      expect(screen.getByRole('status', { name: 'Chargement' })).toBeDefined();
      expect(screen.queryByTestId('one-rm-chart-plot')).toBeNull();
      expect(screen.queryByText('Meilleur 1RM')).toBeNull();
      expect(mockGetHistory).toHaveBeenCalledTimes(2);

      await act(async () => { d.resolve(SQUAT_POINTS); });
      expect(screen.getByTestId('number-flow').textContent).toBe('150');
    });

    it('A (erreur) → vide → A ne réaffiche pas l’erreur périmée', async () => {
      mockGetHistory.mockRejectedValueOnce(new Error('network'));
      await renderLoaded();
      selectExercise(mockExerciseBench.id);
      await waitFor(() => screen.getByText("Impossible de charger l'historique."));

      selectExercise('');
      const d = deferred<OneRmHistoryPoint[]>();
      mockGetHistory.mockReturnValueOnce(d.promise);
      selectExercise(mockExerciseBench.id);

      expect(screen.queryByText("Impossible de charger l'historique.")).toBeNull();
      expect(screen.getByRole('status', { name: 'Chargement' })).toBeDefined();
      await act(async () => { d.resolve(BENCH_POINTS); });
      expect(screen.getByTestId('one-rm-chart-plot')).toBeDefined();
    });

    it('A → filtre excluant (désélection) → Tous → A repasse par le skeleton', async () => {
      await renderLoaded();
      selectExercise(mockExerciseBench.id);
      await waitFor(() => screen.getByTestId('one-rm-chart-plot'));

      fireEvent.click(screen.getByRole('button', { name: 'Dos' }));
      fireEvent.click(screen.getByRole('button', { name: 'Tous' }));
      mockGetHistory.mockReturnValueOnce(deferred<OneRmHistoryPoint[]>().promise);
      selectExercise(mockExerciseBench.id);

      expect(screen.getByRole('status', { name: 'Chargement' })).toBeDefined();
      expect(screen.queryByTestId('one-rm-chart-plot')).toBeNull();
    });

    it('les squelettes exposent role="status"', async () => {
      mockGetExercises.mockReturnValueOnce(deferred<ExerciseRow[]>().promise);
      render(<OneRmChart />);
      expect(screen.getByRole('status', { name: 'Chargement des exercices' })).toBeDefined();
    });
  });

  describe('anti-course', () => {
    it('sélection rapide de 2 exercices : seule la réponse du dernier est affichée (réponses inversées)', async () => {
      const dBench = deferred<OneRmHistoryPoint[]>();
      const dSquat = deferred<OneRmHistoryPoint[]>();
      mockGetHistory.mockImplementation((id: string) =>
        id === mockExerciseBench.id ? dBench.promise : dSquat.promise,
      );
      await renderLoaded();

      selectExercise(mockExerciseBench.id);
      selectExercise(mockExerciseSquat.id);
      expect(mockGetHistory).toHaveBeenCalledTimes(2);

      await act(async () => { dSquat.resolve(SQUAT_POINTS); });
      expect(screen.getByTestId('number-flow').textContent).toBe('150');

      // La réponse obsolète arrive après : ne doit rien écraser.
      await act(async () => { dBench.resolve(BENCH_POINTS); });
      expect(screen.getByTestId('number-flow').textContent).toBe('150');
      expect(lastPlotProps().points).toEqual(SQUAT_POINTS);
    });

    it('réponse obsolète arrivée en premier : reste en chargement jusqu’à la réponse du dernier', async () => {
      const dBench = deferred<OneRmHistoryPoint[]>();
      const dSquat = deferred<OneRmHistoryPoint[]>();
      mockGetHistory.mockImplementation((id: string) =>
        id === mockExerciseBench.id ? dBench.promise : dSquat.promise,
      );
      await renderLoaded();

      selectExercise(mockExerciseBench.id);
      selectExercise(mockExerciseSquat.id);

      await act(async () => { dBench.resolve(BENCH_POINTS); });
      expect(screen.getByLabelText('Chargement')).toBeDefined();
      expect(screen.queryByTestId('one-rm-chart-plot')).toBeNull();
      expect(screen.queryByText('Meilleur 1RM')).toBeNull();

      await act(async () => { dSquat.resolve(SQUAT_POINTS); });
      expect(screen.getByTestId('number-flow').textContent).toBe('150');
      expect(lastPlotProps().points).toEqual(SQUAT_POINTS);
    });

    it('erreur obsolète ignorée : pas de toast ni d’état erreur pour l’exercice abandonné', async () => {
      const dBench = deferred<OneRmHistoryPoint[]>();
      mockGetHistory.mockImplementation((id: string) =>
        id === mockExerciseBench.id ? dBench.promise : Promise.resolve(SQUAT_POINTS),
      );
      await renderLoaded();

      selectExercise(mockExerciseBench.id);
      selectExercise(mockExerciseSquat.id);
      await waitFor(() => expect(screen.getByTestId('number-flow').textContent).toBe('150'));

      await act(async () => { dBench.reject(new Error('late')); });
      expect(toast.error).not.toHaveBeenCalled();
      expect(screen.queryByText("Impossible de charger l'historique.")).toBeNull();
      expect(screen.getByTestId('one-rm-chart-plot')).toBeDefined();
    });
  });

  describe('filtre musculaire', () => {
    it('filtre localement les options sur primary_muscle, sans refetch', async () => {
      await renderLoaded();
      fireEvent.click(screen.getByRole('button', { name: 'Dos' }));

      const names = within(getSelect()).getAllByRole('option').map((o) => o.textContent);
      expect(names).toEqual(['Choisis un exercice', 'Tractions pronation']);
      expect(mockGetExercises).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: 'Abdos' }));
      expect(within(getSelect()).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choisis un exercice']);

      fireEvent.click(screen.getByRole('button', { name: 'Tous' }));
      expect(within(getSelect()).getAllByRole('option')).toHaveLength(4);
    });

    it('désélectionne l’exercice qui sort du filtre et réaffiche l’invite', async () => {
      await renderLoaded();
      selectExercise(mockExerciseBench.id);
      await waitFor(() => screen.getByTestId('one-rm-chart-plot'));

      fireEvent.click(screen.getByRole('button', { name: 'Dos' }));
      expect(getSelect().value).toBe('');
      expect(screen.getByText('Choisis un exercice pour afficher sa progression.')).toBeDefined();
      expect(screen.queryByTestId('one-rm-chart-plot')).toBeNull();
      expect(screen.queryByText('Meilleur 1RM')).toBeNull();
    });

    it('conserve l’exercice sélectionné s’il reste dans le filtre (ou sur « Tous »)', async () => {
      await renderLoaded();
      selectExercise(mockExerciseBench.id);
      await waitFor(() => screen.getByTestId('one-rm-chart-plot'));

      fireEvent.click(screen.getByRole('button', { name: 'Pecs' }));
      expect(getSelect().value).toBe(mockExerciseBench.id);
      fireEvent.click(screen.getByRole('button', { name: 'Tous' }));
      expect(getSelect().value).toBe(mockExerciseBench.id);
      expect(screen.getByTestId('one-rm-chart-plot')).toBeDefined();
      expect(mockGetHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe('bascule métrique', () => {
    it('le toggle bascule aria-pressed et la clé passée au plot, sans refetch', async () => {
      await renderLoaded();
      const group = screen.getByRole('group', { name: 'Métrique' });
      const oneRmBtn = within(group).getByRole('button', { name: '1RM théorique' });
      const tonnageBtn = within(group).getByRole('button', { name: 'Tonnage' });
      expect(oneRmBtn.getAttribute('aria-pressed')).toBe('true');
      expect(tonnageBtn.getAttribute('aria-pressed')).toBe('false');

      selectExercise(mockExerciseBench.id);
      await waitFor(() => screen.getByTestId('one-rm-chart-plot'));
      expect(lastPlotProps().metric).toBe('max_1rm_kg');

      fireEvent.click(tonnageBtn);
      expect(tonnageBtn.getAttribute('aria-pressed')).toBe('true');
      expect(oneRmBtn.getAttribute('aria-pressed')).toBe('false');
      expect(lastPlotProps().metric).toBe('total_tonnage_kg');
      expect(lastPlotProps().points).toEqual(BENCH_POINTS);
      // L'en-tête reste sur le meilleur 1RM quelle que soit la métrique
      expect(screen.getByTestId('number-flow').textContent).toBe('105.5');
      expect(mockGetHistory).toHaveBeenCalledTimes(1);

      fireEvent.click(oneRmBtn);
      expect(lastPlotProps().metric).toBe('max_1rm_kg');
    });

    it('la métrique choisie avant sélection est appliquée au premier rendu du plot', async () => {
      await renderLoaded();
      fireEvent.click(screen.getByRole('button', { name: 'Tonnage' }));
      selectExercise(mockExerciseSquat.id);
      await waitFor(() => screen.getByTestId('one-rm-chart-plot'));
      expect(lastPlotProps().metric).toBe('total_tonnage_kg');
    });
  });
});

describe('OneRmChartPlot', () => {
  afterEach(() => cleanup());

  it('expose les libellés de métriques', () => {
    expect(METRIC_LABELS).toEqual({ max_1rm_kg: '1RM théorique', total_tonnage_kg: 'Tonnage' });
  });

  it('rend un graphique SVG dans un conteneur à taille fixe', () => {
    const { container } = render(<OneRmChartPlot points={BENCH_POINTS} metric="max_1rm_kg" />);
    expect(screen.getByTestId('one-rm-chart-plot')).toBeDefined();
    expect(screen.getByTestId('responsive-container')).toBeDefined();
    expect(container.querySelector('svg.recharts-surface')).not.toBeNull();
    expect(container.querySelector('#oneRmAreaGradient')).not.toBeNull();
  });

  it('l’axe Y suit la métrique : échelle 1RM vs tonnage', () => {
    // Graduations compactes fr-FR (« 2,4 k ») : on reconvertit en nombre.
    const parseCompact = (t: string) => {
      const n = Number(t.replace(/[^\d,]/g, '').replace(',', '.'));
      return /k/i.test(t) ? n * 1000 : n;
    };
    const yTicks = (c: HTMLElement) =>
      Array.from(c.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value'))
        .map((n) => parseCompact(n.textContent ?? ''));

    const oneRm = render(<OneRmChartPlot points={BENCH_POINTS} metric="max_1rm_kg" />);
    const oneRmTicks = yTicks(oneRm.container);
    oneRm.unmount();

    const tonnage = render(<OneRmChartPlot points={BENCH_POINTS} metric="total_tonnage_kg" />);
    const tonnageTicks = yTicks(tonnage.container);

    expect(oneRmTicks.length).toBeGreaterThan(0);
    expect(tonnageTicks.length).toBeGreaterThan(0);
    expect(Math.max(...oneRmTicks)).toBeLessThan(200);
    expect(Math.max(...tonnageTicks)).toBeGreaterThanOrEqual(2000);
    const labels = Array.from(tonnage.container.querySelectorAll('.recharts-yAxis .recharts-cartesian-axis-tick-value'))
      .map((n) => n.textContent ?? '');
    expect(labels.every((l) => !l.includes('kg'))).toBe(true);
    expect(labels.some((l) => /k/.test(l))).toBe(true);
  });

  it('formatCompactKg : notation compacte fr-FR, 1 décimale max', () => {
    expect(formatCompactKg(105.5)).toBe('105,5');
    expect(formatCompactKg(12000).replace(/\s/g, ' ')).toBe('12 k');
    expect(formatCompactKg(2450).replace(/\s/g, ' ')).toBe('2,5 k');
    expect(formatCompactKg(0)).toBe('0');
  });

  it('formatTooltipDate : inclut l’année', () => {
    expect(formatTooltipDate('2026-11-02')).toBe('lun. 2 nov. 2026');
    expect(formatTooltipDate('2025-10-30')).toBe('jeu. 30 oct. 2025');
  });

  it('rend sans crash avec un seul point (dot visible)', () => {
    const { container } = render(<OneRmChartPlot points={[BENCH_POINTS[0]]} metric="max_1rm_kg" />);
    expect(container.querySelector('svg.recharts-surface')).not.toBeNull();
    expect(container.querySelectorAll('.recharts-area-dot').length).toBe(1);
  });
});
