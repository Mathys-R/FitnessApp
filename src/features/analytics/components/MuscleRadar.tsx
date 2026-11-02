'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Dumbbell } from 'lucide-react';
import { formatShortFrenchDate, getWeekDatesIso, shiftDateIso } from '@/lib/date.utils';
import { useLocalTodayIso } from '@/lib/hooks/useLocalTodayIso';
import {
  OPTIMAL_WEEKLY_SETS_MAX,
  OPTIMAL_WEEKLY_SETS_MIN,
  classifyWeeklyVolume,
  computeVolumeScaleMax,
  toBarPercent,
  type VolumeZone,
} from '@/lib/math/muscle-volume-zones.math';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/types/domain.types';
import { getWeeklyMuscleVolume } from '../services/kpis.service';

export interface MuscleRadarProps {
  className?: string;
}

type VolumeState =
  | { key: string; status: 'ready'; data: Record<MuscleGroup, number> }
  | { key: string; status: 'error' };

const ZONE_COLORS: Record<VolumeZone, string> = { below: '#8E8E93', optimal: '#30D158', above: '#FF9F0A' };

const formatSets = (value: number) => value.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
const formatDayLabel = (iso: string) => {
  const label = formatShortFrenchDate(iso);
  return label.charAt(0).toUpperCase() + label.slice(1);
};

export function MuscleRadar({ className = '' }: MuscleRadarProps) {
  // null au SSR / hydratation : aucune semaine ni requête avant la lecture de la date client.
  const todayIso = useLocalTodayIso();
  // null = « semaine courante » (suit todayIso, y compris après minuit).
  const [pickedDateIso, setPickedDateIso] = useState<string | null>(null);
  const [reloadCount, setReloadCount] = useState(0);
  const [result, setResult] = useState<VolumeState | null>(null);

  const referenceDateIso = pickedDateIso ?? todayIso;
  const weekDates = useMemo(() => (referenceDateIso ? getWeekDatesIso(referenceDateIso) : []), [referenceDateIso]);
  const mondayIso = weekDates[0] ?? '';
  const sundayIso = weekDates[6] ?? '';
  const isCurrentWeek = todayIso !== null && todayIso >= mondayIso && todayIso <= sundayIso;
  const requestKey = `${referenceDateIso}#${reloadCount}`;
  const shiftWeek = (days: number) => setPickedDateIso((prev) => shiftDateIso(prev ?? todayIso ?? '', days));

  useEffect(() => {
    if (referenceDateIso === null) return;
    let cancelled = false;
    getWeeklyMuscleVolume(referenceDateIso)
      .then((data) => !cancelled && setResult({ key: requestKey, status: 'ready', data }))
      .catch(() => !cancelled && setResult({ key: requestKey, status: 'error' }));
    return () => { cancelled = true; };
  }, [referenceDateIso, requestKey]);

  const current = result?.key === requestKey ? result : null;
  const volumes = current?.status === 'ready' ? current.data : null;
  const values = volumes ? MUSCLE_GROUPS.map((group) => volumes[group] ?? 0) : [];
  const scaleMax = computeVolumeScaleMax(values);
  const totalSets = values.reduce((sum, v) => (Number.isFinite(v) ? sum + v : sum), 0);
  const zoneLeft = toBarPercent(OPTIMAL_WEEKLY_SETS_MIN, scaleMax);
  const zoneWidth = toBarPercent(OPTIMAL_WEEKLY_SETS_MAX, scaleMax) - zoneLeft;

  if (todayIso === null) {
    return (
      <section className={`ios-card p-4 ${className}`} aria-label="Volume hebdomadaire par groupe musculaire">
        <div className="h-[440px] animate-pulse rounded-xl bg-[#2C2C2E]" aria-busy="true" aria-label="Chargement du volume" />
      </section>
    );
  }

  return (
    <section className={`ios-card p-4 space-y-4 ${className}`} aria-label="Volume hebdomadaire par groupe musculaire">
      <header className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Dumbbell className="h-4 w-4 text-[#0A84FF]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-white">Volume hebdo</h2>
          </div>
          <span className="text-sm text-[#8E8E93] tabular-nums">{volumes ? `${formatSets(totalSets)} séries` : '—'}</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          <button
            type="button"
            aria-label="Semaine précédente"
            onClick={() => shiftWeek(-7)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#8E8E93] active:scale-95 active:bg-white/5"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-sm font-medium text-white tabular-nums">
              {formatDayLabel(mondayIso)} → {formatDayLabel(sundayIso)}
            </span>
            {!isCurrentWeek && (
              <button
                type="button"
                onClick={() => setPickedDateIso(null)}
                className="min-h-[44px] px-3 text-xs font-medium text-[#0A84FF] active:scale-95"
              >
                Cette semaine
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Semaine suivante"
            disabled={isCurrentWeek}
            onClick={() => shiftWeek(7)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#8E8E93] active:scale-95 active:bg-white/5 disabled:opacity-30 disabled:active:scale-100"
          >
            <ChevronRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </header>

      {current === null && (
        <div className="h-[340px] animate-pulse rounded-xl bg-[#2C2C2E]" aria-busy="true" aria-label="Chargement du volume" />
      )}

      {current?.status === 'error' && (
        <div className="flex h-[340px] flex-col items-center justify-center gap-3 text-center" role="alert">
          <p className="text-sm text-[#8E8E93]">Impossible de charger le volume de la semaine.</p>
          <button
            type="button"
            onClick={() => setReloadCount((c) => c + 1)}
            className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2C2E] px-4 text-sm font-medium text-[#0A84FF] active:scale-95"
          >
            Réessayer
          </button>
        </div>
      )}

      {volumes && (
        <div className="space-y-2.5">
          {totalSets === 0 && <p className="text-center text-sm text-[#8E8E93]">Aucune série validée cette semaine</p>}
          <ul className="space-y-2.5">
            {MUSCLE_GROUPS.map((group) => {
              const value = volumes[group] ?? 0;
              const zone = classifyWeeklyVolume(value);
              return (
                <li key={group} className="grid grid-cols-[84px_1fr_40px] items-center gap-2" data-zone={zone}>
                  <span className="truncate text-sm text-white">{group}</span>
                  <div className="relative h-3 overflow-hidden rounded-full bg-[#2C2C2E]">
                    <div className="absolute inset-y-0 bg-[#30D158]/15" style={{ left: `${zoneLeft}%`, width: `${zoneWidth}%` }} aria-hidden="true" />
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500"
                      style={{ width: `${toBarPercent(value, scaleMax)}%`, backgroundColor: ZONE_COLORS[zone] }}
                      aria-hidden="true"
                    />
                  </div>
                  <span className="text-right text-sm font-semibold text-white tabular-nums">{formatSets(value)}</span>
                </li>
              );
            })}
          </ul>
          <p className="flex items-center gap-2 pt-1 text-xs text-[#8E8E93]">
            <span className="inline-block h-2.5 w-4 rounded-sm bg-[#30D158]/30" aria-hidden="true" />
            Zone optimale : {OPTIMAL_WEEKLY_SETS_MIN}–{OPTIMAL_WEEKLY_SETS_MAX} séries / semaine
          </p>
        </div>
      )}
    </section>
  );
}
