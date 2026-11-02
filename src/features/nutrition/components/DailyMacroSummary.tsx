'use client';

import React from 'react';
import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import type { DailyLogRow } from '@/features/daily-log/services/log.service';
import type { MacroValues } from '@/lib/math/nutrition.math';

export interface DailyMacroSummaryProps {
  dailyLog: DailyLogRow;
  consumedMacros: MacroValues;
  onToggleExcludeTdee?: (exclude: boolean) => Promise<void> | void;
  isTogglingTdee?: boolean;
  className?: string;
}

export function DailyMacroSummary({
  dailyLog,
  consumedMacros,
  onToggleExcludeTdee,
  isTogglingTdee = false,
  className = '',
}: DailyMacroSummaryProps) {
  const targetKcal = Math.max(1, dailyLog.target_kcal);
  const remainingKcal = dailyLog.target_kcal - consumedMacros.kcal;
  const kcalPercent = Math.min(100, Math.round((consumedMacros.kcal / targetKcal) * 100));
  const isExcluded = Boolean(dailyLog.exclude_from_tdee);

  const macroBars = [
    { label: 'Protéines', current: consumedMacros.p, target: dailyLog.target_p, color: '#32ADE6' },
    { label: 'Glucides', current: consumedMacros.g, target: dailyLog.target_g, color: '#FF9F0A' },
    { label: 'Lipides', current: consumedMacros.l, target: dailyLog.target_l, color: '#BF5AF2' },
  ];

  return (
    <section className={`rounded-2xl border border-[#38383A] bg-[#1C1C1E] p-4 space-y-4 ${className}`}>
      {/* Jauge Principale des Calories */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">Calories</span>
          {remainingKcal >= 0 ? (
            <span className="text-xs tabular-nums text-[#8E8E93]">
              <NumberFlow value={remainingKcal} /> kcal restantes
            </span>
          ) : (
            <span className="inline-flex items-center rounded-full border border-[#FF375F]/30 bg-[#FF375F]/15 px-2 py-0.5 text-xs font-medium tabular-nums text-[#FF375F]">
              <NumberFlow value={Math.abs(remainingKcal)} /> kcal en surplus
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold tracking-tight text-white tabular-nums">
            <NumberFlow value={consumedMacros.kcal} />
          </span>
          <span className="text-sm tabular-nums text-[#8E8E93]">/ {dailyLog.target_kcal} kcal</span>
        </div>

        <div className="h-2 w-full overflow-hidden rounded-full bg-[#2C2C2E]">
          <motion.div
            className="h-full rounded-full bg-[#FF375F]"
            initial={{ width: 0 }}
            animate={{ width: `${kcalPercent}%` }}
            transition={{ type: 'spring', bounce: 0, duration: 0.6 }}
          />
        </div>
      </div>

      {/* 3 Barres de progression Macros */}
      <div className="grid grid-cols-3 gap-3">
        {macroBars.map((m) => {
          const maxTarget = Math.max(1, m.target);
          const pct = Math.min(100, Math.round((m.current / maxTarget) * 100));
          return (
            <div key={m.label} className="space-y-1.5">
              <span className="block text-xs font-medium text-[#8E8E93]">{m.label}</span>
              <div className="text-xs font-semibold tabular-nums text-white">
                <NumberFlow value={m.current} />
                <span className="font-normal text-[#8E8E93]"> / {m.target}g</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2C2C2E]">
                <motion.div
                  className="h-full rounded-full"
                  style={{ backgroundColor: m.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ type: 'spring', bounce: 0, duration: 0.6 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Switch iOS d'exclusion TDEE (masqué si non pilotable, ex : cockpit) */}
      {onToggleExcludeTdee && (
        <div className="border-t border-[#2C2C2E] pt-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-white">Journée atypique (exclure du TDEE)</p>
              <p className="text-xs text-[#8E8E93]">
                N&apos;affectera pas le calcul de votre dépense sur 14 jours
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={isExcluded}
              aria-label="Journée atypique (exclure du TDEE)"
              disabled={isTogglingTdee}
              onClick={() => onToggleExcludeTdee(!isExcluded)}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center p-1 transition-opacity disabled:opacity-50"
            >
              <div
                className={`relative h-[31px] w-[51px] rounded-full transition-colors duration-200 ${
                  isExcluded ? 'bg-[#34C759]' : 'bg-[#39393D]'
                }`}
              >
                <motion.div
                  className="h-[27px] w-[27px] rounded-full bg-white shadow-md"
                  animate={{ x: isExcluded ? 22 : 2 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{ marginTop: 2 }}
                />
              </div>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

export default DailyMacroSummary;
