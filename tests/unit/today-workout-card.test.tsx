// @vitest-environment happy-dom
// tests/unit/today-workout-card.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TodayWorkoutCard } from '@/features/workout/components/TodayWorkoutCard';
import type { WorkoutSessionRow } from '@/features/workout/services/sessions.service';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  getOverview: vi.fn(),
  buildPayload: vi.fn(),
  toastError: vi.fn(),
  startSession: vi.fn(),
  store: { isActive: false, sessionName: '' } as { isActive: boolean; sessionName: string },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: h.push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

vi.mock('sonner', () => ({ toast: { error: h.toastError, success: vi.fn() } }));

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span data-testid="nf">{value}</span>,
}));

vi.mock('@/features/workout/services/today-session.service', () => ({
  getTodayWorkoutOverview: h.getOverview,
  buildStartPayloadFromPlannedSession: h.buildPayload,
}));

vi.mock('@/features/workout/store/active-workout.store', () => ({
  useActiveWorkoutStore: <T,>(
    selector: (s: { isActive: boolean; sessionName: string; startSession: typeof h.startSession }) => T
  ) => selector({ ...h.store, startSession: h.startSession }),
}));

const baseSession: WorkoutSessionRow = {
  id: 'p1',
  user_id: 'usr-1',
  session_date: '2026-11-02',
  name: 'Push A',
  status: 'planned',
  preset_id: 'preset-1',
  duration_seconds: null,
  session_comment: null,
  created_at: '2026-11-02T06:00:00Z',
  updated_at: '2026-11-02T06:00:00Z',
};

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('TodayWorkoutCard (Couche 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.store.isActive = false;
    h.store.sessionName = '';
  });
  afterEach(() => cleanup());

  it('séance active → bandeau « Reprendre » prioritaire, sans fetch de l’overview', () => {
    h.store.isActive = true;
    h.store.sessionName = 'Pull B';
    h.getOverview.mockResolvedValue({ kind: 'planned', session: baseSession });
    render(<TodayWorkoutCard todayIso="2026-11-02" />);

    expect(screen.getByText('Séance en cours')).toBeDefined();
    expect(screen.getByText('Pull B')).toBeDefined();
    expect(screen.queryByText(/Lancer/)).toBeNull();
    expect(h.getOverview).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /Séance en cours — Reprendre/ }));
    expect(h.push).toHaveBeenCalledWith('/workout');
  });

  it('séance active sans nom → pas de ligne de nom vide', () => {
    h.store.isActive = true;
    const { container } = render(<TodayWorkoutCard todayIso="2026-11-02" />);
    expect(container.querySelector('p.truncate')).toBeNull();
  });

  it('affiche un skeleton pendant le chargement', () => {
    h.getOverview.mockReturnValue(new Promise(() => {}));
    const { container } = render(<TodayWorkoutCard todayIso="2026-11-02" />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByText('Séance du jour')).toBeDefined();
    expect(h.getOverview).toHaveBeenCalledWith('2026-11-02');
  });

  it('planned → « Lancer {name} » appelle buildPayload, startSession puis router.push', async () => {
    const payload = { sessionName: 'Push A', exercises: [] };
    h.getOverview.mockResolvedValue({ kind: 'planned', session: baseSession });
    h.buildPayload.mockResolvedValue(payload);
    render(<TodayWorkoutCard todayIso="2026-11-02" />);

    const btn = await screen.findByRole('button', { name: /Lancer Push A/ });
    fireEvent.click(btn);

    await waitFor(() => expect(h.push).toHaveBeenCalledWith('/workout'));
    expect(h.buildPayload).toHaveBeenCalledWith(baseSession);
    expect(h.startSession).toHaveBeenCalledWith(payload);
    expect(h.startSession.mock.invocationCallOrder[0]).toBeLessThan(
      h.push.mock.invocationCallOrder[0]
    );
  });

  it('double-tap rapide sur « Lancer » → un seul buildPayload / startSession', async () => {
    const d = deferred<{ sessionName: string; exercises: never[] }>();
    h.getOverview.mockResolvedValue({ kind: 'planned', session: baseSession });
    h.buildPayload.mockReturnValue(d.promise);
    render(<TodayWorkoutCard todayIso="2026-11-02" />);

    const btn = await screen.findByRole('button', { name: /Lancer Push A/ });
    // Deux clics dans le même tick, avant re-render (le verrou ref doit tenir)
    act(() => {
      btn.click();
      btn.click();
    });
    fireEvent.click(btn);

    expect(h.buildPayload).toHaveBeenCalledTimes(1);
    const busy = screen.getByRole('button', { name: /Préparation/ }) as HTMLButtonElement;
    expect(busy.disabled).toBe(true);

    await act(async () => {
      d.resolve({ sessionName: 'Push A', exercises: [] });
      await d.promise;
    });
    expect(h.startSession).toHaveBeenCalledTimes(1);
    expect(h.push).toHaveBeenCalledTimes(1);
  });

  it('erreur au lancement → toast, aucun startSession, bouton déverrouillé et relançable', async () => {
    h.getOverview.mockResolvedValue({ kind: 'planned', session: baseSession });
    h.buildPayload.mockRejectedValueOnce(new Error('net'));
    render(<TodayWorkoutCard todayIso="2026-11-02" />);

    fireEvent.click(await screen.findByRole('button', { name: /Lancer Push A/ }));
    await waitFor(() =>
      expect(h.toastError).toHaveBeenCalledWith('Erreur lors du lancement de la séance planifiée')
    );
    expect(h.startSession).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();

    const btn = (await screen.findByRole('button', { name: /Lancer Push A/ })) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);

    h.buildPayload.mockResolvedValueOnce({ sessionName: 'Push A', exercises: [] });
    fireEvent.click(btn);
    await waitFor(() => expect(h.startSession).toHaveBeenCalledTimes(1));
    expect(h.buildPayload).toHaveBeenCalledTimes(2);
  });

  it('completed → durée arrondie en min, tonnage NumberFlow, badge PR', async () => {
    h.getOverview.mockResolvedValue({
      kind: 'completed',
      session: { ...baseSession, status: 'completed', name: 'Legs' },
      durationSeconds: 3690, // 61.5 → 62
      tonnageKg: 8420.5,
      prCount: 3,
    });
    render(<TodayWorkoutCard todayIso="2026-11-02" />);

    expect(await screen.findByText('Legs')).toBeDefined();
    expect(screen.getByText('62 min')).toBeDefined();
    expect(screen.getByTestId('nf').textContent).toBe('8420.5');
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Lancer/ })).toBeNull();
  });

  it('completed sans PR → 0 neutre, durée 0 min', async () => {
    h.getOverview.mockResolvedValue({
      kind: 'completed',
      session: { ...baseSession, status: 'completed' },
      durationSeconds: 0,
      tonnageKg: 0,
      prCount: 0,
    });
    const { container } = render(<TodayWorkoutCard todayIso="2026-11-02" />);
    expect(await screen.findByText('0 min')).toBeDefined();
    expect(container.querySelector('.text-\\[\\#FFD60A\\]')).toBeNull();
  });

  it('rest_day → « Jour de repos »', async () => {
    h.getOverview.mockResolvedValue({ kind: 'rest_day', session: { ...baseSession, status: 'rest_day' } });
    render(<TodayWorkoutCard todayIso="2026-11-02" />);
    expect(await screen.findByText('Jour de repos')).toBeDefined();
  });

  it('none → « Aucune séance prévue » + lien vers /workout', async () => {
    h.getOverview.mockResolvedValue({ kind: 'none' });
    render(<TodayWorkoutCard todayIso="2026-11-02" />);
    expect(await screen.findByText('Aucune séance prévue')).toBeDefined();
    const link = screen.getByRole('link', { name: /Ouvrir l'agenda/ });
    expect(link.getAttribute('href')).toBe('/workout');
  });

  it('erreur de chargement → message + « Réessayer » relance le fetch', async () => {
    h.getOverview.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce({ kind: 'none' });
    render(<TodayWorkoutCard todayIso="2026-11-02" />);

    expect(await screen.findByText('Impossible de charger la séance du jour.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: /Réessayer/ }));
    expect(await screen.findByText('Aucune séance prévue')).toBeDefined();
    expect(h.getOverview).toHaveBeenCalledTimes(2);
  });

  it('applique la className fournie', async () => {
    h.getOverview.mockResolvedValue({ kind: 'none' });
    const { container } = render(<TodayWorkoutCard todayIso="2026-11-02" className="mt-9" />);
    await screen.findByText('Aucune séance prévue');
    expect((container.firstChild as HTMLElement).className).toContain('mt-9');
  });

  it('changement de todayIso → refetch avec la nouvelle date', async () => {
    h.getOverview.mockResolvedValue({ kind: 'none' });
    const { rerender } = render(<TodayWorkoutCard todayIso="2026-11-02" />);
    await screen.findByText('Aucune séance prévue');
    rerender(<TodayWorkoutCard todayIso="2026-11-03" />);
    await waitFor(() => expect(h.getOverview).toHaveBeenLastCalledWith('2026-11-03'));
  });

  it('réponse périmée : l’ancienne date résolue après la nouvelle n’écrase pas l’affichage', async () => {
    const oldReq = deferred<unknown>();
    const newReq = deferred<unknown>();
    h.getOverview.mockImplementation((iso: string) =>
      iso === '2026-11-02' ? oldReq.promise : newReq.promise
    );
    const { rerender, container } = render(<TodayWorkoutCard todayIso="2026-11-02" />);
    rerender(<TodayWorkoutCard todayIso="2026-11-03" />);

    await act(async () => {
      newReq.resolve({ kind: 'rest_day', session: { ...baseSession, status: 'rest_day' } });
      await newReq.promise;
    });
    expect(screen.getByText('Jour de repos')).toBeDefined();

    await act(async () => {
      oldReq.resolve({ kind: 'planned', session: baseSession });
      await oldReq.promise;
    });
    expect(screen.getByText('Jour de repos')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Lancer/ })).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  });

  it('changement de todayIso → skeleton tant que la nouvelle date n’est pas chargée', async () => {
    const next = deferred<unknown>();
    h.getOverview.mockResolvedValueOnce({ kind: 'none' }).mockReturnValueOnce(next.promise);
    const { rerender, container } = render(<TodayWorkoutCard todayIso="2026-11-02" />);
    await screen.findByText('Aucune séance prévue');
    rerender(<TodayWorkoutCard todayIso="2026-11-03" />);
    expect(screen.queryByText('Aucune séance prévue')).toBeNull();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });
});
