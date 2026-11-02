'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import NumberFlow from '@number-flow/react';
import { toast } from 'sonner';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { MuscleFilterChips } from '@/features/catalogs/components/MuscleFilterChips';
import { getActiveExercises, type ExerciseRow } from '@/features/catalogs/services/exercises.service';
import { getExerciseOneRmHistory, type OneRmHistoryPoint } from '@/features/analytics/services/kpis.service';
import { METRIC_LABELS, OneRmChartPlot, type OneRmMetric } from './OneRmChartPlot';
import type { MuscleGroup } from '@/types/domain.types';

export interface OneRmChartProps { className?: string }

type HistoryState =
  | { key: string; status: 'ready'; points: OneRmHistoryPoint[] }
  | { key: string; status: 'error' };

const METRIC_OPTIONS = (['max_1rm_kg', 'total_tonnage_kg'] satisfies OneRmMetric[]).map((m) => ({ value: m, label: METRIC_LABELS[m] }));
const RETRY_CLASS = 'min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2C2E] px-4 text-sm font-semibold text-[#0A84FF]';

const StatusBox = ({ children }: { children: ReactNode }) => (
  <div className="flex h-[220px] flex-col items-center justify-center gap-3 px-4 text-center text-sm text-[#8E8E93]">{children}</div>
);

export function OneRmChart({ className = '' }: OneRmChartProps) {
  const [exercises, setExercises] = useState<ExerciseRow[] | null>(null);
  const [exercisesError, setExercisesError] = useState(false);
  const [exercisesReload, setExercisesReload] = useState(0);
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [metric, setMetric] = useState<OneRmMetric>('max_1rm_kg');
  const [history, setHistory] = useState<HistoryState | null>(null);
  const [historyReload, setHistoryReload] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getActiveExercises()
      .then((rows) => { if (!cancelled) setExercises(rows); })
      .catch(() => {
        if (cancelled) return;
        setExercisesError(true);
        toast.error('Impossible de charger les exercices');
      });
    return () => { cancelled = true; };
  }, [exercisesReload]);

  const historyKey = `${selectedId}:${historyReload}`;
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    getExerciseOneRmHistory(selectedId)
      .then((points) => { if (!cancelled) setHistory({ key: historyKey, status: 'ready', points }); })
      .catch(() => {
        if (cancelled) return;
        setHistory({ key: historyKey, status: 'error' });
        toast.error("Impossible de charger l'historique");
      });
    return () => { cancelled = true; };
  }, [selectedId, historyKey]);

  const filtered = useMemo(
    () => (exercises ?? []).filter((ex) => muscle === null || ex.primary_muscle === muscle),
    [exercises, muscle],
  );

  // Reset dans le handler : une re-sélection repasse toujours par le skeleton.
  const selectExercise = (id: string) => { setHistory(null); setSelectedId(id); };
  const handleSelectMuscle = (next: MuscleGroup | null) => {
    setMuscle(next);
    const current = exercises?.find((ex) => ex.id === selectedId);
    if (current && next !== null && current.primary_muscle !== next) selectExercise('');
  };

  const retryExercises = () => {
    setExercisesError(false);
    setExercises(null);
    setExercisesReload((n) => n + 1);
  };

  const current = selectedId && history?.key === historyKey ? history : null;
  const points = current?.status === 'ready' ? current.points : [];
  const best1Rm = points.reduce((max, p) => Math.max(max, p.max_1rm_kg), 0);

  const renderBody = () => {
    if (!selectedId) return <StatusBox>Choisis un exercice pour afficher sa progression.</StatusBox>;
    if (!current) return <div className="h-[220px] animate-pulse rounded-xl bg-[#2C2C2E]" role="status" aria-label="Chargement" />;
    if (current.status === 'error') {
      return (
        <StatusBox>
          <span>Impossible de charger l&apos;historique.</span>
          <button type="button" onClick={() => setHistoryReload((n) => n + 1)} className={RETRY_CLASS}>
            Réessayer
          </button>
        </StatusBox>
      );
    }
    if (points.length === 0) return <StatusBox>Aucune séance validée pour cet exercice.</StatusBox>;
    return (
      <>
        <OneRmChartPlot points={points} metric={metric} />
        {points.length === 1 && <p className="text-center text-xs text-[#8E8E93]">Encore 1 séance pour tracer une tendance.</p>}
      </>
    );
  };

  return (
    <section className={`ios-card flex flex-col gap-3 py-4 ${className}`} aria-label="Progression par exercice">
      <header className="flex items-end justify-between gap-3 px-4">
        <div>
          <h2 className="text-lg font-bold text-white">Progression</h2>
          <p className="text-xs text-[#8E8E93]">1RM Epley &amp; tonnage par séance</p>
        </div>
        {points.length > 0 && (
          <div className="text-right tabular-nums">
            <p className="text-[11px] uppercase tracking-wide text-[#8E8E93]">Meilleur 1RM</p>
            <p className="text-xl font-bold text-[#0A84FF]">
              <NumberFlow value={best1Rm} format={{ maximumFractionDigits: 1 }} locales="fr-FR" /> kg
            </p>
          </div>
        )}
      </header>

      {exercisesError ? (
        <div className="flex items-center justify-between gap-3 px-4 text-sm text-[#8E8E93]">
          <span>Impossible de charger les exercices.</span>
          <button type="button" onClick={retryExercises} className={RETRY_CLASS}>Réessayer</button>
        </div>
      ) : exercises === null ? (
        <div className="mx-4 h-[44px] animate-pulse rounded-xl bg-[#2C2C2E]" role="status" aria-label="Chargement des exercices" />
      ) : (
        <>
          <MuscleFilterChips selectedMuscle={muscle} onSelectMuscle={handleSelectMuscle} />
          <div className="px-4">
            <select
              aria-label="Exercice"
              value={selectedId}
              onChange={(e) => selectExercise(e.target.value)}
              className="ios-input text-base min-h-[44px] w-full"
            >
              <option value="">Choisis un exercice</option>
              {filtered.map((ex) => (
                <option key={ex.id} value={ex.id}>{ex.name}</option>
              ))}
            </select>
          </div>
        </>
      )}

      <div className="px-4">
        <SegmentedControl ariaLabel="Métrique" options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
      </div>

      <div className="flex flex-col gap-2 px-2">{renderBody()}</div>
    </section>
  );
}
