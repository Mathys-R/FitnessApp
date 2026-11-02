'use client';

import { useCallback, useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { getTdee14DaysAnalysis } from '@/features/analytics/services/kpis.service';
import type { TdeeComputationResult } from '@/lib/math/tdee.math';
import { formatKcal, formatSignedKg } from '@/lib/format.utils';

export interface TdeeBannerProps {
  variant?: 'full' | 'compact'; // 'full' (analytics) | 'compact' (cockpit, ≤ 72 px)
  refreshKey?: number; // relance getTdee14DaysAnalysis() quand il change
  className?: string;
}

type LoadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'loaded'; result: TdeeComputationResult };

/** « 1 jour exclu » / « 3 jours exclus » */
const pluralDays = (n: number, adjective: string): string =>
  `${n} jour${n > 1 ? 's' : ''} ${adjective}${n > 1 ? 's' : ''}`;

export function TdeeBanner({ variant = 'full', refreshKey = 0, className = '' }: TdeeBannerProps) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [retryCount, setRetryCount] = useState(0);
  const isCompact = variant === 'compact';

  useEffect(() => {
    let cancelled = false;
    getTdee14DaysAnalysis()
      .then((result) => {
        if (!cancelled) setState({ kind: 'loaded', result });
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'error' });
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, retryCount]);

  const handleRetry = useCallback(() => {
    setState({ kind: 'loading' });
    setRetryCount((c) => c + 1);
  }, []);

  const cardClass = `ios-card ${isCompact ? 'p-3' : 'p-4'} ${className}`.trim();

  if (state.kind === 'loading') {
    return (
      <div
        role="status"
        aria-busy="true"
        aria-label="Chargement de la maintenance"
        className={`${cardClass} animate-pulse ${isCompact ? 'h-[64px]' : 'h-[132px]'}`} />
    );
  }

  if (state.kind === 'error') {
    return (
      <div role="alert" className={`${cardClass} flex items-center justify-between gap-3`}>
        <p className="text-sm text-[#8E8E93]">Maintenance indisponible pour le moment.</p>
        <button
          type="button"
          onClick={handleRetry}
          className="min-h-[44px] min-w-[44px] rounded-xl px-3 text-sm font-semibold text-[#0A84FF] active:opacity-60"
        >
          Réessayer
        </button>
      </div>
    );
  }

  const { result } = state;

  if (result.status === 'calibrating') {
    const { validNutritionDays: valid, requiredNutritionDays: required, excludedDaysCount } = result;
    const progress = required > 0 ? Math.min(100, (valid / required) * 100) : 0;
    const missingWeighIns = isCompact && valid >= required && !result.hasEnoughWeightSpan;
    return (
      <section className={cardClass} aria-label="Calibration de la maintenance">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className={`${isCompact ? 'min-w-0 truncate text-sm' : 'text-base'} font-semibold text-white`}>
            {isCompact ? 'Calibration maintenance' : 'Calibration de ta Maintenance Réelle'}
          </h2>
          <span className="shrink-0 text-xs text-[#8E8E93] tabular-nums">
            {missingWeighIns ? 'Pesées manquantes' : `${valid} / ${required} jours complets`}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#2C2C2E]"
        >
          <div className="h-full rounded-full bg-[#0A84FF]" style={{ width: `${progress}%` }} />
        </div>
        {!isCompact && (
          <div className="mt-2 space-y-1 text-xs text-[#8E8E93]">
            {excludedDaysCount > 0 && (
              <p className="tabular-nums">
                {pluralDays(excludedDaysCount, 'passé')} {excludedDaysCount > 1 ? 'exclus' : 'exclu'}
              </p>
            )}
            {!result.hasEnoughWeightSpan && <p>Il faut 2 pesées espacées d&apos;au moins 7 jours</p>}
          </div>
        )}
      </section>
    );
  }

  return (
    <section className={cardClass} aria-label="Maintenance Réelle 14j">
      <div className={isCompact ? 'flex items-baseline justify-between gap-2' : ''}>
        <h2 className="text-xs font-medium uppercase tracking-wide text-[#8E8E93]">
          Maintenance Réelle 14j
        </h2>
        <p className={`${isCompact ? 'text-xl' : 'text-4xl'} font-bold text-white tabular-nums`}>
          <NumberFlow value={Math.round(result.estimatedTdeeKcal)} locales="fr-FR" />
          <span className="ml-1 text-sm font-medium text-[#8E8E93]">kcal / jour</span>
        </p>
      </div>
      {!isCompact && (
        <p className="mt-1 text-xs text-[#8E8E93] tabular-nums">
          Moyenne ingérée (14j passés) : {formatKcal(result.averageIntakeKcal)} kcal/j • Tendance
          EMA 14j : {formatSignedKg(result.deltaEma14dKg, 2)} kg (
          {pluralDays(result.excludedDaysCount, 'exclu')})
        </p>
      )}
    </section>
  );
}
