'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatShortFrenchDate } from '@/lib/date.utils';
import { formatKg } from '@/lib/format.utils';
import type { OneRmHistoryPoint } from '@/features/analytics/services/kpis.service';

export type OneRmMetric = 'max_1rm_kg' | 'total_tonnage_kg';

export interface OneRmChartPlotProps {
  points: OneRmHistoryPoint[];
  metric: OneRmMetric;
}

const ACCENT = '#0A84FF';
const GRADIENT_ID = 'oneRmAreaGradient';

export const METRIC_LABELS: Record<OneRmMetric, string> = {
  max_1rm_kg: '1RM théorique',
  total_tonnage_kg: 'Tonnage',
};

const COMPACT_FORMAT = new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 });

// Axe Y compact (« 12 k ») ; tooltip avec année (« jeu. 2 nov. 2026 »).
export const formatCompactKg = (value: number): string => COMPACT_FORMAT.format(value);
export const formatTooltipDate = (dateIso: string): string =>
  format(parseISO(dateIso), 'EEE d MMM yyyy', { locale: fr });
const formatKgLabel = (value: number): string => `${formatKg(value, 1)} kg`;

export function OneRmChartPlot({ points, metric }: OneRmChartPlotProps) {
  const showAllDots = points.length <= 1;

  return (
    <div className="h-[220px] w-full tabular-nums" data-testid="one-rm-chart-plot">
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.45} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#38383A" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="session_date"
            tickFormatter={(value: string) => formatShortFrenchDate(value)}
            tick={{ fill: '#8E8E93', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: '#8E8E93', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={44}
            tickFormatter={formatCompactKg}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1C1C1E',
              border: '1px solid #38383A',
              borderRadius: 12,
              fontVariantNumeric: 'tabular-nums',
            }}
            labelStyle={{ color: '#8E8E93' }}
            itemStyle={{ color: '#FFFFFF' }}
            labelFormatter={(label: string) => formatTooltipDate(label)}
            formatter={(value: number) => [formatKgLabel(value), METRIC_LABELS[metric]]}
          />
          <Area
            type="monotone"
            dataKey={metric}
            stroke={ACCENT}
            strokeWidth={2}
            fill={`url(#${GRADIENT_ID})`}
            dot={showAllDots ? { r: 5, fill: ACCENT, stroke: ACCENT } : false}
            activeDot={{ r: 5, fill: ACCENT, stroke: '#000000', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
