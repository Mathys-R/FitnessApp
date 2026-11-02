// @vitest-environment happy-dom
// tests/unit/export-data-card.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ExportDataCard } from '@/features/analytics/components/ExportDataCard';
import { exportUserDataCsvBundle, exportUserDataJson } from '@/features/analytics/services/export.service';
import { saveTextFile, buildCsvBlobContent } from '@/features/analytics/utils/file-save.utils';
import { toast } from 'sonner';

vi.mock('@/features/analytics/services/export.service', () => ({
  exportUserDataCsvBundle: vi.fn(),
  exportUserDataJson: vi.fn(),
}));
vi.mock('@/features/analytics/utils/file-save.utils', () => ({
  saveTextFile: vi.fn(),
  buildCsvBlobContent: vi.fn((csv: string) => (csv.startsWith('﻿') ? csv : `﻿${csv}`)),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/date.utils', async (orig) => ({
  ...(await orig<typeof import('@/lib/date.utils')>()),
  getLocalTodayIso: () => '2026-11-02',
}));

const BOM = '﻿';
const bundle = { dailyLogsCsv: 'date\nD', nutritionHistoryCsv: 'date\nN', workoutHistoryCsv: 'session_date\nW' };
const json = '{"daily_logs":[]}';

const mCsv = vi.mocked(exportUserDataCsvBundle);
const mJson = vi.mocked(exportUserDataJson);
const mSave = vi.mocked(saveTextFile);

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

const prepareBtn = () => screen.getByRole('button', { name: /Préparer mes exports|Préparation/ });

async function renderReady() {
  render(<ExportDataCard />);
  fireEvent.click(prepareBtn());
  await screen.findByText('(daily_logs.csv)');
}

const fileBtn = (filename: string) => screen.getByText(`(${filename})`).closest('button')!;

beforeEach(() => {
  vi.clearAllMocks();
  mCsv.mockResolvedValue(bundle);
  mJson.mockResolvedValue(json);
  mSave.mockResolvedValue('downloaded');
});

describe('ExportDataCard — flux en 2 temps', () => {
  it('idle : bouton « Préparer mes exports », aucun appel service au montage', () => {
    render(<ExportDataCard className="mt-4" />);
    expect(prepareBtn()).toHaveProperty('disabled', false);
    expect(prepareBtn().getAttribute('aria-busy')).toBe('false');
    expect(mCsv).not.toHaveBeenCalled();
    expect(mJson).not.toHaveBeenCalled();
  });

  it('idle → loading (désactivé, aria-busy) → ready avec 4 boutons + aide iOS', async () => {
    const d = deferred<typeof bundle>();
    mCsv.mockReturnValue(d.promise);
    render(<ExportDataCard />);
    fireEvent.click(prepareBtn());

    const loadingBtn = screen.getByRole('button', { name: /Préparation/ });
    expect(loadingBtn).toHaveProperty('disabled', true);
    expect(loadingBtn.getAttribute('aria-busy')).toBe('true');
    expect(mCsv).toHaveBeenCalledTimes(1);
    expect(mJson).toHaveBeenCalledTimes(1); // lancés en parallèle

    await act(async () => { d.resolve(bundle); });
    for (const f of ['daily_logs.csv', 'nutrition_history.csv', 'workout_history.csv', 'fitness_backup_2026-11-02.json']) {
      expect(screen.getByText(`(${f})`)).toBeTruthy();
    }
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(screen.getByText(/Sur iPhone : Partager → Enregistrer dans Fichiers/)).toBeTruthy();
    expect(screen.queryByText(/Préparer mes exports/)).toBeNull();
  });

  it('double-tap sur « Préparer » → un seul appel par service', async () => {
    const d = deferred<string>();
    mJson.mockReturnValue(d.promise);
    render(<ExportDataCard />);
    const btn = prepareBtn();
    fireEvent.click(btn);
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(mCsv).toHaveBeenCalledTimes(1);
    expect(mJson).toHaveBeenCalledTimes(1);
    await act(async () => { d.resolve(json); });
    await screen.findByText('(daily_logs.csv)');
  });

  it('erreur service → toast.error(message) et retour à l\'état initial réactivé', async () => {
    mCsv.mockRejectedValue(new Error('Erreur export meal_entries : RLS'));
    render(<ExportDataCard />);
    fireEvent.click(prepareBtn());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erreur export meal_entries : RLS'));
    await waitFor(() => expect(screen.getByRole('button', { name: /Préparer mes exports/ })).toHaveProperty('disabled', false));
    expect(screen.queryByText('(daily_logs.csv)')).toBeNull();

    // nouvel essai possible
    mCsv.mockResolvedValue(bundle);
    fireEvent.click(prepareBtn());
    await screen.findByText('(daily_logs.csv)');
    expect(mCsv).toHaveBeenCalledTimes(2);
  });

  it('erreur non-Error → message générique', async () => {
    mJson.mockRejectedValue('oops');
    render(<ExportDataCard />);
    fireEvent.click(prepareBtn());
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Erreur lors de la préparation des exports'));
  });
});

describe('ExportDataCard — sauvegarde des fichiers', () => {
  it.each([
    ['daily_logs.csv', `${BOM}date\nD`],
    ['nutrition_history.csv', `${BOM}date\nN`],
    ['workout_history.csv', `${BOM}session_date\nW`],
  ])('%s : saveTextFile avec BOM et MIME CSV', async (filename, content) => {
    await renderReady();
    fireEvent.click(fileBtn(filename));
    expect(mSave).toHaveBeenCalledWith({ filename, content, mimeType: 'text/csv;charset=utf-8' });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(`${filename} exporté`));
  });

  it('JSON : fitness_backup_<date>.json, sans BOM, MIME application/json', async () => {
    await renderReady();
    fireEvent.click(fileBtn('fitness_backup_2026-11-02.json'));
    expect(mSave).toHaveBeenCalledWith({ filename: 'fitness_backup_2026-11-02.json', content: json, mimeType: 'application/json' });
    const arg = mSave.mock.calls[0][0];
    expect(arg.content.startsWith(BOM)).toBe(false);
    expect(vi.mocked(buildCsvBlobContent)).not.toHaveBeenCalledWith(json);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('saveTextFile appelé de façon synchrone dans le geste (aucun await préalable)', async () => {
    await renderReady();
    fireEvent.click(fileBtn('daily_logs.csv'));
    expect(mSave).toHaveBeenCalledTimes(1); // pas de waitFor : appel synchrone
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it('outcome "shared" → toast succès ; "cancelled" → aucun toast', async () => {
    mSave.mockResolvedValueOnce('shared').mockResolvedValueOnce('cancelled');
    await renderReady();
    fireEvent.click(fileBtn('daily_logs.csv'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('daily_logs.csv exporté'));
    await waitFor(() => expect(fileBtn('nutrition_history.csv')).toHaveProperty('disabled', false));
    fireEvent.click(fileBtn('nutrition_history.csv'));
    await waitFor(() => expect(fileBtn('nutrition_history.csv')).toHaveProperty('disabled', false));
    expect(mSave).toHaveBeenCalledTimes(2);
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('échec saveTextFile → toast.error et boutons réactivés', async () => {
    mSave.mockRejectedValue(new Error('NotAllowedError'));
    await renderReady();
    fireEvent.click(fileBtn('workout_history.csv'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Échec de l'export workout_history.csv"));
    await waitFor(() => expect(fileBtn('daily_logs.csv')).toHaveProperty('disabled', false));
  });

  it('verrou anti-sauvegarde concurrente : taps rapides → un seul saveTextFile, boutons désactivés', async () => {
    const d = deferred<'downloaded'>();
    mSave.mockReturnValue(d.promise);
    await renderReady();
    fireEvent.click(fileBtn('daily_logs.csv'));
    fireEvent.click(fileBtn('daily_logs.csv'));
    fireEvent.click(fileBtn('fitness_backup_2026-11-02.json'));
    expect(mSave).toHaveBeenCalledTimes(1);
    for (const f of ['daily_logs.csv', 'nutrition_history.csv', 'workout_history.csv', 'fitness_backup_2026-11-02.json']) {
      expect(fileBtn(f)).toHaveProperty('disabled', true);
    }
    await act(async () => { d.resolve('downloaded'); });
    await waitFor(() => expect(fileBtn('nutrition_history.csv')).toHaveProperty('disabled', false));
    fireEvent.click(fileBtn('nutrition_history.csv'));
    expect(mSave).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2));
  });
});
