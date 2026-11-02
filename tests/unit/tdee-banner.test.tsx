// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup, act } from '@testing-library/react';
import type { TdeeComputationResult } from '@/lib/math/tdee.math';
import { TdeeBanner } from '@/features/analytics/components/TdeeBanner';
import { getTdee14DaysAnalysis } from '@/features/analytics/services/kpis.service';

vi.mock('@number-flow/react', () => ({
  default: ({ value, locales }: { value: number; locales?: string }) => (
    <span data-testid="number-flow" data-locales={locales}>
      {value}
    </span>
  ),
}));

vi.mock('@/features/analytics/services/kpis.service', () => ({
  getTdee14DaysAnalysis: vi.fn(),
}));

const mockedGet = vi.mocked(getTdee14DaysAnalysis);

const calibrating = (
  over: Partial<Extract<TdeeComputationResult, { status: 'calibrating' }>> = {}
): TdeeComputationResult => ({
  status: 'calibrating',
  validNutritionDays: 4,
  requiredNutritionDays: 10,
  hasEnoughWeightSpan: true,
  excludedDaysCount: 0,
  ...over,
});

const ready = (
  over: Partial<Extract<TdeeComputationResult, { status: 'ready' }>> = {}
): TdeeComputationResult => ({
  status: 'ready',
  estimatedTdeeKcal: 2550.4,
  averageIntakeKcal: 2450,
  deltaEma14dKg: -0.35,
  dailyEnergyDeltaKcal: -193,
  validNutritionDays: 12,
  excludedDaysCount: 2,
  ...over,
});

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Texte de la sous-ligne « Moyenne ingérée … » (full ready), espaces normalisés. */
const subline = (): string => {
  const el = screen.getByText(/Moyenne ingérée/);
  return (el.textContent ?? '').replace(/\s+/g, ' ');
};

describe('TdeeBanner (Lot 1)', () => {
  beforeEach(() => {
    mockedGet.mockReset();
  });
  afterEach(() => cleanup());

  describe('chargement', () => {
    it('affiche un squelette aria-busy pendant le chargement', () => {
      mockedGet.mockReturnValue(new Promise(() => {}));
      render(<TdeeBanner />);
      const skel = screen.getByLabelText('Chargement de la maintenance');
      expect(skel.getAttribute('aria-busy')).toBe('true');
      expect(screen.getByRole('status')).toBe(skel);
      expect(mockedGet).toHaveBeenCalledTimes(1);
    });

    it('propage className sur la carte', () => {
      mockedGet.mockReturnValue(new Promise(() => {}));
      render(<TdeeBanner className="my-extra" />);
      expect(screen.getByLabelText('Chargement de la maintenance').className).toContain('my-extra');
    });
  });

  describe('calibrating', () => {
    it('rend titre, progression 4/10 et progressbar à 40', async () => {
      mockedGet.mockResolvedValue(calibrating());
      render(<TdeeBanner />);
      expect(await screen.findByText('Calibration de ta Maintenance Réelle')).toBeDefined();
      expect(screen.getByText('4 / 10 jours complets')).toBeDefined();
      const bar = screen.getByRole('progressbar');
      expect(bar.getAttribute('aria-valuenow')).toBe('40');
      expect(bar.getAttribute('aria-valuemin')).toBe('0');
      expect(bar.getAttribute('aria-valuemax')).toBe('100');
    });

    it('arrondit aria-valuenow (1/3 -> 33)', async () => {
      mockedGet.mockResolvedValue(calibrating({ validNutritionDays: 1, requiredNutritionDays: 3 }));
      render(<TdeeBanner />);
      const bar = await screen.findByRole('progressbar');
      expect(bar.getAttribute('aria-valuenow')).toBe('33');
    });

    it('plafonne la progression à 100 si valid > required', async () => {
      mockedGet.mockResolvedValue(
        calibrating({ validNutritionDays: 13, requiredNutritionDays: 10, hasEnoughWeightSpan: false })
      );
      render(<TdeeBanner />);
      const bar = await screen.findByRole('progressbar');
      expect(bar.getAttribute('aria-valuenow')).toBe('100');
      const fill = bar.firstElementChild as HTMLElement;
      expect(fill.style.width).toBe('100%');
      expect(screen.getByText('13 / 10 jours complets')).toBeDefined();
    });

    it('requiredNutritionDays = 0 -> progression 0 (pas de NaN)', async () => {
      mockedGet.mockResolvedValue(calibrating({ validNutritionDays: 0, requiredNutritionDays: 0 }));
      render(<TdeeBanner />);
      const bar = await screen.findByRole('progressbar');
      expect(bar.getAttribute('aria-valuenow')).toBe('0');
    });

    it('full : pas de mention exclus si excludedDaysCount = 0', async () => {
      mockedGet.mockResolvedValue(calibrating({ excludedDaysCount: 0 }));
      render(<TdeeBanner />);
      await screen.findByRole('progressbar');
      expect(screen.queryByText(/exclu/)).toBeNull();
      expect(screen.queryByText(/2 pesées/)).toBeNull();
    });

    it('full : singulier « 1 jour passé exclu »', async () => {
      mockedGet.mockResolvedValue(calibrating({ excludedDaysCount: 1 }));
      render(<TdeeBanner />);
      expect(await screen.findByText('1 jour passé exclu')).toBeDefined();
    });

    it('full : pluriel « 3 jours passés exclus »', async () => {
      mockedGet.mockResolvedValue(calibrating({ excludedDaysCount: 3 }));
      render(<TdeeBanner />);
      expect(await screen.findByText('3 jours passés exclus')).toBeDefined();
    });

    it('full : message des 2 pesées si !hasEnoughWeightSpan', async () => {
      mockedGet.mockResolvedValue(calibrating({ hasEnoughWeightSpan: false }));
      render(<TdeeBanner />);
      expect(await screen.findByText("Il faut 2 pesées espacées d'au moins 7 jours")).toBeDefined();
    });

    it('compact : progression visible mais ni exclus ni message pesées', async () => {
      mockedGet.mockResolvedValue(calibrating({ excludedDaysCount: 3, hasEnoughWeightSpan: false }));
      render(<TdeeBanner variant="compact" />);
      const title = await screen.findByRole('heading', { name: 'Calibration maintenance' });
      expect(title.className).toContain('truncate');
      expect(title.className).toContain('min-w-0');
      expect(screen.queryByText('Calibration de ta Maintenance Réelle')).toBeNull();
      expect(screen.getByText('4 / 10 jours complets')).toBeDefined();
      expect(screen.getByRole('progressbar')).toBeDefined();
      expect(screen.queryByText(/exclu/)).toBeNull();
      expect(screen.queryByText(/pesées/)).toBeNull();
    });

    it('compact : « Pesées manquantes » si jours complets atteints sans écart de pesées', async () => {
      mockedGet.mockResolvedValue(
        calibrating({ validNutritionDays: 10, requiredNutritionDays: 10, hasEnoughWeightSpan: false })
      );
      render(<TdeeBanner variant="compact" />);
      expect(await screen.findByText('Pesées manquantes')).toBeDefined();
      expect(screen.queryByText(/jours complets/)).toBeNull();
      expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    });

    it('compact : compteur conservé si jours complets atteints et pesées OK', async () => {
      mockedGet.mockResolvedValue(calibrating({ validNutritionDays: 11, hasEnoughWeightSpan: true }));
      render(<TdeeBanner variant="compact" />);
      expect(await screen.findByText('11 / 10 jours complets')).toBeDefined();
      expect(screen.queryByText('Pesées manquantes')).toBeNull();
    });

    it('full : jamais « Pesées manquantes » (message détaillé à la place)', async () => {
      mockedGet.mockResolvedValue(calibrating({ validNutritionDays: 10, hasEnoughWeightSpan: false }));
      render(<TdeeBanner />);
      expect(await screen.findByText('10 / 10 jours complets')).toBeDefined();
      expect(screen.queryByText('Pesées manquantes')).toBeNull();
    });
  });

  describe('ready', () => {
    it('full : libellé, valeur arrondie via NumberFlow, unité', async () => {
      mockedGet.mockResolvedValue(ready({ estimatedTdeeKcal: 2550.6 }));
      render(<TdeeBanner />);
      expect(await screen.findByRole('heading', { name: 'Maintenance Réelle 14j' })).toBeDefined();
      expect(screen.getByTestId('number-flow').textContent).toBe('2551');
      expect(screen.getByTestId('number-flow').getAttribute('data-locales')).toBe('fr-FR');
      expect(screen.getByText('kcal / jour')).toBeDefined();
    });

    it('full : sous-ligne moyenne ingérée + tendance négative ASCII + pluriel exclus', async () => {
      mockedGet.mockResolvedValue(ready({ averageIntakeKcal: 2450, deltaEma14dKg: -0.35, excludedDaysCount: 2 }));
      render(<TdeeBanner />);
      await screen.findByText('Maintenance Réelle 14j');
      const txt = subline();
      expect(txt).toMatch(/Moyenne ingérée \(14j passés\) : 2\s?450 kcal\/j/);
      expect(txt).toContain('Tendance EMA 14j : -0,35 kg (2 jours exclus)');
      expect(txt).not.toContain('−');
    });

    it('full : tendance positive avec « + » explicite et singulier', async () => {
      mockedGet.mockResolvedValue(ready({ deltaEma14dKg: 0.4, excludedDaysCount: 1 }));
      render(<TdeeBanner />);
      await screen.findByText('Maintenance Réelle 14j');
      expect(subline()).toContain('Tendance EMA 14j : +0,4 kg (1 jour exclu)');
    });

    it('full : delta 0 -> « 0 kg » sans signe, « 0 jour exclu »', async () => {
      mockedGet.mockResolvedValue(ready({ deltaEma14dKg: 0, excludedDaysCount: 0 }));
      render(<TdeeBanner />);
      await screen.findByText('Maintenance Réelle 14j');
      const txt = subline();
      expect(txt).toContain('Tendance EMA 14j : 0 kg (0 jour exclu)');
      expect(txt).not.toMatch(/[+-]0 kg/);
    });

    it('full : delta minuscule arrondi à 0 (±0,001) -> « 0 kg » sans signe', async () => {
      mockedGet.mockResolvedValue(ready({ deltaEma14dKg: -0.001 }));
      render(<TdeeBanner />);
      await screen.findByText('Maintenance Réelle 14j');
      expect(subline()).toContain('Tendance EMA 14j : 0 kg');
      cleanup();
      mockedGet.mockResolvedValue(ready({ deltaEma14dKg: 0.004 }));
      render(<TdeeBanner />);
      await screen.findByText('Maintenance Réelle 14j');
      expect(subline()).toContain('Tendance EMA 14j : 0 kg');
    });

    it('full : delta limité à 2 décimales (fr-FR)', async () => {
      mockedGet.mockResolvedValue(ready({ deltaEma14dKg: -1.23456 }));
      render(<TdeeBanner />);
      await screen.findByText('Maintenance Réelle 14j');
      expect(subline()).toContain('-1,23 kg');
    });

    it('full : moyenne ingérée arrondie à l’entier', async () => {
      mockedGet.mockResolvedValue(ready({ averageIntakeKcal: 1999.6 }));
      render(<TdeeBanner />);
      await screen.findByText('Maintenance Réelle 14j');
      expect(subline()).toMatch(/: 2\s?000 kcal\/j/);
    });

    it('compact : valeur et libellé, sans sous-ligne', async () => {
      mockedGet.mockResolvedValue(ready());
      render(<TdeeBanner variant="compact" />);
      expect(await screen.findByText('Maintenance Réelle 14j')).toBeDefined();
      expect(screen.getByTestId('number-flow').textContent).toBe('2550');
      expect(screen.getByText('kcal / jour')).toBeDefined();
      expect(screen.queryByText(/Moyenne ingérée/)).toBeNull();
      expect(screen.queryByText(/Tendance EMA/)).toBeNull();
      expect(screen.queryByText(/exclu/)).toBeNull();
    });
  });

  describe('erreur & retry', () => {
    it('affiche une alerte discrète puis Réessayer relance le service et réussit', async () => {
      mockedGet.mockRejectedValueOnce(new Error('Non authentifié')).mockResolvedValueOnce(ready());
      render(<TdeeBanner />);
      const alert = await screen.findByRole('alert');
      expect(alert.textContent).toContain('Maintenance indisponible pour le moment.');
      expect(mockedGet).toHaveBeenCalledTimes(1);

      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
      // repasse par l'état chargement
      expect(screen.getByLabelText('Chargement de la maintenance')).toBeDefined();
      expect(await screen.findByText('Maintenance Réelle 14j')).toBeDefined();
      expect(mockedGet).toHaveBeenCalledTimes(2);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('erreur répétée -> reste en erreur après retry', async () => {
      mockedGet.mockRejectedValue(new Error('réseau'));
      render(<TdeeBanner />);
      await screen.findByRole('alert');
      fireEvent.click(screen.getByRole('button', { name: 'Réessayer' }));
      await waitFor(() => expect(mockedGet).toHaveBeenCalledTimes(2));
      expect(await screen.findByRole('alert')).toBeDefined();
    });

    it('bouton Réessayer : cible tactile ≥ 44 px', async () => {
      mockedGet.mockRejectedValue(new Error('x'));
      render(<TdeeBanner />);
      const btn = await screen.findByRole('button', { name: 'Réessayer' });
      expect(btn.className).toContain('min-h-[44px]');
      expect(btn.getAttribute('type')).toBe('button');
    });
  });

  describe('refreshKey & anti-race', () => {
    it('changement de refreshKey rappelle le service et affiche le nouveau résultat', async () => {
      mockedGet.mockResolvedValueOnce(calibrating()).mockResolvedValueOnce(ready());
      const { rerender } = render(<TdeeBanner refreshKey={0} />);
      await screen.findByRole('progressbar');
      expect(mockedGet).toHaveBeenCalledTimes(1);

      rerender(<TdeeBanner refreshKey={1} />);
      expect(await screen.findByText('Maintenance Réelle 14j')).toBeDefined();
      expect(mockedGet).toHaveBeenCalledTimes(2);
    });

    it('re-render sans changement de refreshKey ne rappelle pas le service', async () => {
      mockedGet.mockResolvedValue(ready());
      const { rerender } = render(<TdeeBanner refreshKey={3} />);
      await screen.findByText('Maintenance Réelle 14j');
      rerender(<TdeeBanner refreshKey={3} className="x" />);
      rerender(<TdeeBanner refreshKey={3} variant="compact" />);
      expect(mockedGet).toHaveBeenCalledTimes(1);
    });

    it('ignore une réponse périmée arrivant après la plus récente', async () => {
      const first = deferred<TdeeComputationResult>();
      const second = deferred<TdeeComputationResult>();
      mockedGet.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

      const { rerender } = render(<TdeeBanner refreshKey={0} />);
      rerender(<TdeeBanner refreshKey={1} />);
      expect(mockedGet).toHaveBeenCalledTimes(2);

      await act(async () => {
        second.resolve(ready({ estimatedTdeeKcal: 2800 }));
      });
      expect(screen.getByTestId('number-flow').textContent).toBe('2800');

      await act(async () => {
        first.resolve(calibrating());
      });
      expect(screen.queryByRole('progressbar')).toBeNull();
      expect(screen.getByTestId('number-flow').textContent).toBe('2800');
    });

    it('ignore un rejet périmé (ne bascule pas en erreur)', async () => {
      const first = deferred<TdeeComputationResult>();
      mockedGet.mockReturnValueOnce(first.promise).mockResolvedValueOnce(ready());
      const { rerender } = render(<TdeeBanner refreshKey={0} />);
      rerender(<TdeeBanner refreshKey={1} />);
      await screen.findByText('Maintenance Réelle 14j');
      await act(async () => {
        first.reject(new Error('late'));
      });
      expect(screen.queryByRole('alert')).toBeNull();
      expect(screen.getByText('Maintenance Réelle 14j')).toBeDefined();
    });

    it('démontage avant résolution : aucune erreur console', async () => {
      const pending = deferred<TdeeComputationResult>();
      mockedGet.mockReturnValueOnce(pending.promise);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const { unmount } = render(<TdeeBanner />);
      unmount();
      await act(async () => {
        pending.resolve(ready());
      });
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
