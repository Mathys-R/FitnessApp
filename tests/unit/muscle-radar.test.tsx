// @vitest-environment happy-dom
// tests/unit/muscle-radar.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MuscleRadar } from '@/features/analytics/components/MuscleRadar';
import { getWeeklyMuscleVolume } from '@/features/analytics/services/kpis.service';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/types/domain.types';

vi.mock('@/features/analytics/services/kpis.service', () => ({
  getWeeklyMuscleVolume: vi.fn(),
}));

const mockedGetVolume = vi.mocked(getWeeklyMuscleVolume);

// Mercredi 4 novembre 2026, midi local → semaine courante Lun. 2 nov. → Dim. 8 nov.
const NOW = new Date(2026, 10, 4, 12, 0, 0);
const TODAY = '2026-11-04';

function volumes(partial: Partial<Record<MuscleGroup, number>> = {}): Record<MuscleGroup, number> {
  const base = Object.fromEntries(MUSCLE_GROUPS.map((g) => [g, 0])) as Record<MuscleGroup, number>;
  return { ...base, ...partial };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

function expectColor(el: HTMLElement, hex: string) {
  const bg = el.style.backgroundColor.toLowerCase().replace(/\s+/g, ' ');
  expect([hex.toLowerCase(), hexToRgb(hex)]).toContain(bg);
}

const rows = () => screen.getAllByRole('listitem');
const fillOf = (li: HTMLElement) => li.querySelectorAll<HTMLElement>('div[aria-hidden="true"]')[1];

describe('MuscleRadar (Lot 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('charge la semaine courante et rend 10 barres dans l’ordre MUSCLE_GROUPS', async () => {
    mockedGetVolume.mockResolvedValue(volumes({ Quadriceps: 4, Fessiers: 6, Ischios: 2 }));
    render(<MuscleRadar />);

    expect(screen.getByLabelText('Chargement du volume')).toBeTruthy();
    await waitFor(() => expect(rows()).toHaveLength(10));

    expect(mockedGetVolume).toHaveBeenCalledTimes(1);
    expect(mockedGetVolume).toHaveBeenCalledWith(TODAY);
    expect(rows().map((li) => li.querySelector('span')?.textContent)).toEqual([...MUSCLE_GROUPS]);
    expect(screen.getByText('Lun. 2 nov. → Dim. 8 nov.')).toBeTruthy();
    expect(screen.getByText('12 séries')).toBeTruthy();
    expect(screen.getByText(/Zone optimale : 10–20 séries \/ semaine/)).toBeTruthy();
    expect(screen.queryByText('Cette semaine')).toBeNull();
    expect(screen.queryByLabelText('Chargement du volume')).toBeNull();
  });

  it('classe chaque groupe par zone (bornes 9.5 / 10 / 20 / 20.5) avec la bonne couleur', async () => {
    mockedGetVolume.mockResolvedValue(
      volumes({ Pecs: 9.5, Dos: 10, Épaules: 20, Biceps: 20.5, Triceps: 0, Quadriceps: 4.5 })
    );
    render(<MuscleRadar />);
    await waitFor(() => expect(rows()).toHaveLength(10));

    const byGroup = Object.fromEntries(rows().map((li) => [li.querySelector('span')?.textContent, li]));
    expect(byGroup.Pecs.dataset.zone).toBe('below');
    expect(byGroup.Dos.dataset.zone).toBe('optimal');
    expect(byGroup['Épaules'].dataset.zone).toBe('optimal');
    expect(byGroup.Biceps.dataset.zone).toBe('above');
    expect(byGroup.Triceps.dataset.zone).toBe('below');

    expectColor(fillOf(byGroup.Pecs), '#8E8E93');
    expectColor(fillOf(byGroup.Dos), '#30D158');
    expectColor(fillOf(byGroup.Biceps), '#FF9F0A');

    // Formatage fr-FR 1 décimale max
    expect(within(byGroup.Pecs).getByText('9,5')).toBeTruthy();
    expect(within(byGroup.Quadriceps).getByText('4,5')).toBeTruthy();
    // Échelle = max(24, ceil(20.5)) = 24 → 12 séries = 50 %, 0 → 0 %
    expect(fillOf(byGroup.Triceps).style.width).toBe('0%');
    expect(parseFloat(fillOf(byGroup.Dos).style.width)).toBeCloseTo((10 / 24) * 100, 3);
  });

  it('échelle au-delà de 24 : la barre maximale vaut 100 %', async () => {
    mockedGetVolume.mockResolvedValue(volumes({ Dos: 30, Pecs: 15 }));
    render(<MuscleRadar />);
    await waitFor(() => expect(rows()).toHaveLength(10));
    const byGroup = Object.fromEntries(rows().map((li) => [li.querySelector('span')?.textContent, li]));
    expect(fillOf(byGroup.Dos).style.width).toBe('100%');
    expect(fillOf(byGroup.Pecs).style.width).toBe('50%');
  });

  it('› est désactivé sur la semaine courante', async () => {
    mockedGetVolume.mockResolvedValue(volumes());
    render(<MuscleRadar />);
    await waitFor(() => expect(rows()).toHaveLength(10));
    const next = screen.getByRole('button', { name: 'Semaine suivante' }) as HTMLButtonElement;
    expect(next.disabled).toBe(true);
    fireEvent.click(next);
    expect(mockedGetVolume).toHaveBeenCalledTimes(1);
  });

  it('‹ recule de 7 jours, affiche « Cette semaine », puis › / « Cette semaine » reviennent', async () => {
    mockedGetVolume.mockResolvedValue(volumes());
    render(<MuscleRadar />);
    await waitFor(() => expect(rows()).toHaveLength(10));

    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    await waitFor(() => expect(mockedGetVolume).toHaveBeenLastCalledWith('2026-10-28'));
    expect(screen.getByText('Lun. 26 oct. → Dim. 1 nov.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Semaine suivante' }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole('button', { name: 'Cette semaine' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    await waitFor(() => expect(mockedGetVolume).toHaveBeenLastCalledWith('2026-10-21'));
    expect(screen.getByText('Lun. 19 oct. → Dim. 25 oct.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Semaine suivante' }));
    await waitFor(() => expect(mockedGetVolume).toHaveBeenLastCalledWith('2026-10-28'));

    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    await waitFor(() => expect(mockedGetVolume).toHaveBeenLastCalledWith('2026-10-21'));
    fireEvent.click(screen.getByRole('button', { name: 'Cette semaine' }));
    await waitFor(() => expect(mockedGetVolume).toHaveBeenLastCalledWith(TODAY));
    expect(screen.getByText('Lun. 2 nov. → Dim. 8 nov.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Cette semaine' })).toBeNull();
    expect((screen.getByRole('button', { name: 'Semaine suivante' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('semaine vide → 10 barres à 0 + message « Aucune série validée cette semaine »', async () => {
    mockedGetVolume.mockResolvedValue(volumes());
    render(<MuscleRadar />);
    await waitFor(() => expect(screen.getByText('Aucune série validée cette semaine')).toBeTruthy());
    expect(rows()).toHaveLength(10);
    expect(rows().every((li) => li.dataset.zone === 'below')).toBe(true);
    expect(screen.getByText('0 séries')).toBeTruthy();
  });

  it('erreur → role=alert + « Réessayer » relance le chargement', async () => {
    mockedGetVolume.mockRejectedValueOnce(new Error('réseau'));
    mockedGetVolume.mockResolvedValueOnce(volumes({ Dos: 12 }));
    render(<MuscleRadar />);

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Impossible de charger le volume de la semaine.');
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);

    fireEvent.click(within(alert).getByRole('button', { name: 'Réessayer' }));
    await waitFor(() => expect(rows()).toHaveLength(10));
    expect(mockedGetVolume).toHaveBeenCalledTimes(2);
    expect(mockedGetVolume).toHaveBeenLastCalledWith(TODAY);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ignore une réponse périmée arrivant après celle de la semaine affichée', async () => {
    const current = deferred<Record<MuscleGroup, number>>();
    const prev1 = deferred<Record<MuscleGroup, number>>();
    const prev2 = deferred<Record<MuscleGroup, number>>();
    mockedGetVolume
      .mockReturnValueOnce(current.promise)
      .mockReturnValueOnce(prev1.promise)
      .mockReturnValueOnce(prev2.promise);

    render(<MuscleRadar />);
    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    await waitFor(() => expect(mockedGetVolume).toHaveBeenCalledTimes(3));
    expect(mockedGetVolume.mock.calls.map((c) => c[0])).toEqual([TODAY, '2026-10-28', '2026-10-21']);

    await act(async () => {
      prev2.resolve(volumes({ Dos: 7 }));
    });
    await waitFor(() => expect(rows()).toHaveLength(10));

    await act(async () => {
      prev1.resolve(volumes({ Dos: 99 }));
      current.resolve(volumes({ Dos: 55 }));
    });

    const dos = rows().find((li) => li.querySelector('span')?.textContent === 'Dos') as HTMLElement;
    expect(within(dos).getByText('7')).toBeTruthy();
    expect(screen.queryByText('99')).toBeNull();
    expect(screen.queryByText('55')).toBeNull();
    expect(screen.getByText('Lun. 19 oct. → Dim. 25 oct.')).toBeTruthy();
  });

  it('une erreur périmée ne masque pas les données de la semaine affichée', async () => {
    const stale = deferred<Record<MuscleGroup, number>>();
    mockedGetVolume.mockReturnValueOnce(stale.promise).mockResolvedValueOnce(volumes({ Pecs: 11 }));
    render(<MuscleRadar />);
    fireEvent.click(screen.getByRole('button', { name: 'Semaine précédente' }));
    await waitFor(() => expect(rows()).toHaveLength(10));
    await act(async () => {
      stale.reject(new Error('vieille erreur'));
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(rows()).toHaveLength(10);
  });

  it('transmet className à la section', async () => {
    mockedGetVolume.mockResolvedValue(volumes());
    render(<MuscleRadar className="mt-8" />);
    const section = screen.getByLabelText('Volume hebdomadaire par groupe musculaire');
    expect(section.className).toContain('mt-8');
    await waitFor(() => expect(rows()).toHaveLength(10));
  });
});
