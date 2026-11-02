// src/app/(protected)/page.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, RotateCw, SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { formatShortFrenchDate } from '@/lib/date.utils';
import { useLocalTodayIso } from '@/lib/hooks/useLocalTodayIso';
import { useTodayCockpitData } from '@/features/daily-log/hooks/useTodayCockpitData';
import { WeightQuickInput } from '@/features/daily-log/components/WeightQuickInput';
import { ProfileTargetsDrawer } from '@/features/daily-log/components/ProfileTargetsDrawer';
import { DailyMacroSummary } from '@/features/nutrition/components/DailyMacroSummary';
import { TdeeBanner } from '@/features/analytics/components/TdeeBanner';
import { TodayWorkoutCard } from '@/features/workout/components/TodayWorkoutCard';

export default function TodayPage() {
  // null au SSR et pendant l'hydratation : la date de l'appareil n'est lue qu'au client.
  const todayIso = useLocalTodayIso();
  const {
    dailyLog,
    consumedMacros,
    profile,
    previousEma,
    isLoading,
    hasError,
    reload,
    setDailyLog,
    setProfile,
  } = useTodayCockpitData(todayIso);

  const [isTargetsOpen, setIsTargetsOpen] = useState(false);
  const [tdeeKey, setTdeeKey] = useState(0);

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Aujourd'hui"
        subtitle={todayIso ? formatShortFrenchDate(todayIso) : '\u00A0'}
        action={
          <button
            type="button"
            onClick={() => setIsTargetsOpen(true)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-end text-[#0A84FF] active:opacity-70 transition-opacity"
            aria-label="Modifier mes objectifs nutritionnels"
          >
            <SlidersHorizontal size={20} />
          </button>
        }
      />

      <div className="space-y-4 px-4 py-4">
        {/* 1. Bandeau maintenance TDEE 14j */}
        <TdeeBanner key={todayIso ?? 'ssr'} variant="compact" refreshKey={tdeeKey} />

        {/* 2. Synthèse calories & macros du jour */}
        {dailyLog ? (
          <div className="space-y-2">
            <DailyMacroSummary dailyLog={dailyLog} consumedMacros={consumedMacros} />
            <Link
              href="/nutrition"
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#1C1C1E] text-base font-semibold text-[#0A84FF] active:scale-[0.99] transition-transform"
            >
              <Plus className="h-4 w-4" /> Ajouter un repas
            </Link>
          </div>
        ) : hasError && !isLoading ? (
          <div role="alert" className="ios-card space-y-3 p-4">
            <p className="text-sm text-[#FF453A]">Impossible de charger le journal du jour.</p>
            <button
              type="button"
              onClick={() => void reload()}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2C2C2E] px-4 text-sm font-semibold text-white active:scale-95"
            >
              <RotateCw className="h-4 w-4" /> Réessayer
            </button>
          </div>
        ) : (
          <div
            aria-busy="true"
            aria-label="Chargement du journal"
            className="h-[236px] animate-pulse rounded-2xl bg-[#1C1C1E]"
          />
        )}

        {/* 3. Poids du matin & EMA 7j */}
        {dailyLog ? (
          <WeightQuickInput
            dailyLog={dailyLog}
            previousEmaKg={previousEma}
            onWeightUpdated={(updated) => {
              // Pesée antidatée : ne jamais remplacer le journal du jour affiché.
              if (updated.log_date === todayIso) setDailyLog(updated);
              else void reload();
              setTdeeKey((k) => k + 1);
            }}
          />
        ) : (
          <div className="ios-card flex min-h-[88px] items-center justify-center p-4">
            <span className="text-xs text-[#8E8E93]">Chargement de la pesée...</span>
          </div>
        )}

        {/* 4. Séance du jour (store persisté + date : rendu différé après hydratation) */}
        {todayIso ? (
          <TodayWorkoutCard todayIso={todayIso} />
        ) : (
          <div className="ios-card h-[104px] animate-pulse" aria-hidden />
        )}
      </div>

      <ProfileTargetsDrawer
        open={isTargetsOpen}
        onOpenChange={setIsTargetsOpen}
        initialProfile={profile}
        onTargetsUpdated={(updatedProfile) => {
          setProfile(updatedProfile);
          void reload();
          setTdeeKey((k) => k + 1);
        }}
      />
    </div>
  );
}
