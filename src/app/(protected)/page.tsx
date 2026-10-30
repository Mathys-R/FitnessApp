// src/app/(protected)/page.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import NumberFlow from '@number-flow/react';
import { PageHeader } from '@/components/layout/PageHeader';
import { getLocalTodayIso, formatShortFrenchDate } from '@/lib/date.utils';
import {
  getOrCreateDailyLog,
  getPreviousWeightEma,
  type DailyLogRow,
} from '@/features/daily-log/services/log.service';
import {
  getCurrentProfile,
  type ProfileRow,
} from '@/features/daily-log/services/profile.service';
import { WeightQuickInput } from '@/features/daily-log/components/WeightQuickInput';
import { ProfileTargetsDrawer } from '@/features/daily-log/components/ProfileTargetsDrawer';

export default function TodayPage() {
  const todayIso = getLocalTodayIso();
  const formattedDate = formatShortFrenchDate(todayIso);

  const [dailyLog, setDailyLog] = useState<DailyLogRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [previousEma, setPreviousEma] = useState<number | null>(null);
  const [isTargetsOpen, setIsTargetsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [logRow, profRow, prevEma] = await Promise.all([
        getOrCreateDailyLog(todayIso),
        getCurrentProfile(),
        getPreviousWeightEma(todayIso),
      ]);
      setDailyLog(logRow);
      setProfile(profRow);
      setPreviousEma(prevEma);
    } catch {
      // Les erreurs sont isolées pour ne pas bloquer l'interface
    } finally {
      setIsLoading(false);
    }
  }, [todayIso]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const targetKcal = dailyLog?.target_kcal ?? profile?.current_target_kcal ?? 2000;
  const targetP = dailyLog?.target_p ?? profile?.current_target_p ?? 150;
  const targetG = dailyLog?.target_g ?? profile?.current_target_g ?? 200;
  const targetL = dailyLog?.target_l ?? profile?.current_target_l ?? 60;

  return (
    <div className="flex flex-col">
      <PageHeader
        title="Aujourd'hui"
        subtitle={formattedDate}
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
        {/* Résumé Calories & Macros (Cliquable pour modifier les objectifs) */}
        <button
          type="button"
          onClick={() => setIsTargetsOpen(true)}
          className="ios-card w-full space-y-3 p-4 text-left active:scale-[0.99] transition-transform"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
              Objectif Calories
            </span>
            <span className="text-xs font-medium text-[#0A84FF]">Modifier</span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-white tabular-nums">0</span>
            <span className="text-sm text-[#8E8E93] tabular-nums">
              / <NumberFlow value={targetKcal} /> kcal
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[#2C2C2E]">
            <div className="h-full rounded-full bg-[#0A84FF]" style={{ width: '0%' }} />
          </div>
          <div className="flex items-center justify-between pt-1 text-xs tabular-nums text-[#8E8E93]">
            <span>P : <strong className="text-white">{targetP}g</strong></span>
            <span>G : <strong className="text-white">{targetG}g</strong></span>
            <span>L : <strong className="text-white">{targetL}g</strong></span>
          </div>
        </button>

        {/* Poids & Tendance EMA 7j */}
        {isLoading || !dailyLog ? (
          <div className="ios-card p-4 min-h-[88px] flex items-center justify-center">
            <span className="text-xs text-[#8E8E93]">Chargement de la pesée...</span>
          </div>
        ) : (
          <WeightQuickInput
            dailyLog={dailyLog}
            previousEmaKg={previousEma}
            onWeightUpdated={(updated) => setDailyLog(updated)}
          />
        )}

        {/* Suivi Musculation */}
        <div className="ios-card space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8E8E93]">
              Séance du jour
            </span>
            <span className="text-xs text-[#8E8E93]">Phase 1</span>
          </div>
          <p className="text-sm text-[#8E8E93]">
            Aucune séance enregistrée pour aujourd&apos;hui.
          </p>
        </div>
      </div>

      <ProfileTargetsDrawer
        open={isTargetsOpen}
        onOpenChange={setIsTargetsOpen}
        initialProfile={profile}
        onTargetsUpdated={(updatedProfile) => {
          setProfile(updatedProfile);
          loadData();
        }}
      />
    </div>
  );
}
