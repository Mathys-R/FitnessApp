// src/features/analytics/components/WeightEmaChart.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { getWeightHistory, type DailyLogRow } from '@/features/daily-log/services/log.service';
import { formatShortFrenchDate, getLocalTodayIso, shiftDateIso } from '@/lib/date.utils';
import { formatKg, formatSignedKg } from '@/lib/format.utils';

export interface WeightEmaChartProps {
  refreshKey?: number;
  className?: string;
}

type RangeDays = 30 | 90;
type LoadState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; rows: DailyLogRow[] };

interface ChartPoint {
  date: string;
  weight: number | null;
  ema: number | null;
}

const RANGE_OPTIONS = ([30, 90] satisfies RangeDays[]).map((r) => ({ value: r, label: `${r} j` }));
const AXIS_TICK = { fill: '#8E8E93', fontSize: 11 };
const formatKg1 = (value: number): string => formatKg(value, 1, 1);

export function WeightEmaChart({ refreshKey = 0, className }: WeightEmaChartProps) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [range, setRange] = useState<RangeDays>(30);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getWeightHistory(90)
      .then((rows) => { if (!cancelled) setState({ status: 'ready', rows }); })
      .catch(() => { if (!cancelled) setState({ status: 'error' }); });
    return () => { cancelled = true; };
  }, [refreshKey, reloadToken]);

  const points = useMemo<ChartPoint[]>(() => {
    if (state.status !== 'ready') return [];
    // Fenêtre de `range` jours calendaires, aujourd'hui inclus (≤ 90 lignes : cohérent avec getWeightHistory(90)).
    const fromIso = shiftDateIso(getLocalTodayIso(), -(range - 1));
    return state.rows
      .filter((row) => row.log_date >= fromIso)
      .map((row) => ({ date: row.log_date, weight: row.weight_kg, ema: row.weight_ema_kg }));
  }, [state, range]);

  const lastPoint = points.length > 0 ? points[points.length - 1] : null;
  const latestKg = lastPoint ? lastPoint.ema ?? lastPoint.weight : null;
  // Delta homogène : EMA contre EMA ; repli sur le poids brut seulement s'il y a moins de 2 EMA dans la plage.
  const emas = points.map((p) => p.ema).filter((v): v is number => v != null);
  const series = emas.length >= 2 ? emas : points.map((p) => p.weight).filter((v): v is number => v != null);
  const deltaKg = series.length >= 2 ? series[series.length - 1] - series[0] : null;

  const handleRetry = () => {
    setState({ status: 'loading' });
    setReloadToken((t) => t + 1);
  };

  return (
    <section className={`ios-card p-4 ${className ?? ''}`} aria-label="Historique du poids et tendance EMA 7 jours">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-white">Poids &amp; tendance EMA 7j</h2>
          {state.status === 'ready' && latestKg != null && (
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold text-white tabular-nums">
                <NumberFlow value={latestKg} locales="fr-FR" format={{ minimumFractionDigits: 1, maximumFractionDigits: 1 }} /> kg
              </span>
              {deltaKg != null && (
                <span className="text-sm text-[#8E8E93] tabular-nums" data-testid="weight-ema-delta">
                  {formatSignedKg(deltaKg, 1, 1)} kg sur {range} j
                </span>
              )}
            </div>
          )}
        </div>
        <SegmentedControl
          ariaLabel="Période affichée"
          options={RANGE_OPTIONS}
          value={range}
          onChange={setRange}
          fullWidth={false}
        />
      </div>

      <div className="mt-4 h-[220px]">
        {state.status === 'loading' && <div className="h-full w-full animate-pulse rounded-xl bg-[#2C2C2E]" aria-busy="true" />}

        {state.status === 'error' && (
          <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-[#FF453A]">Impossible de charger l&apos;historique de poids.</p>
            <button type="button" onClick={handleRetry}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2C2E] px-4 text-sm font-semibold text-[#0A84FF]">
              Réessayer
            </button>
          </div>
        )}

        {state.status === 'ready' && points.length < 2 && (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <p className="text-sm text-[#8E8E93]">
              {points.length === 0 ? `Aucune pesée sur les ${range} derniers jours.` : 'Pas encore assez de pesées pour tracer la tendance'}
            </p>
          </div>
        )}

        {state.status === 'ready' && points.length >= 2 && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid stroke="#38383A" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tickFormatter={formatShortFrenchDate} tick={AXIS_TICK} axisLine={false} tickLine={false} minTickGap={24} />
              <YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} tickFormatter={(v: number) => formatKg1(v)}
                tick={AXIS_TICK} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                contentStyle={{ background: '#1C1C1E', border: '1px solid #38383A', borderRadius: 12 }}
                labelStyle={{ color: '#FFFFFF' }}
                labelFormatter={(label: string) => formatShortFrenchDate(label)}
                formatter={(value: number, name: string) => [`${formatKg1(value)} kg`, name]}
              />
              <Line type="monotone" dataKey="weight" name="Pesée" stroke="none" isAnimationActive={false}
                dot={{ r: 3, fill: '#8E8E93', stroke: 'none' }} activeDot={{ r: 4, fill: '#8E8E93' }} />
              <Line type="monotone" dataKey="ema" name="EMA 7j" stroke="#0A84FF" strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}
