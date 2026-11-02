// src/features/daily-log/hooks/useTodayCockpitData.ts
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPreviousWeightEma, type DailyLogRow } from '@/features/daily-log/services/log.service';
import { getCurrentProfile, type ProfileRow } from '@/features/daily-log/services/profile.service';
import {
  getDailyNutrition,
  type MealEntryWithItems,
} from '@/features/nutrition/services/entries.service';
import { sumMacroValues, type MacroValues } from '@/lib/math/nutrition.math';

export interface TodayCockpitData {
  dailyLog: DailyLogRow | null;
  consumedMacros: MacroValues;
  profile: ProfileRow | null;
  previousEma: number | null;
  isLoading: boolean;
  hasError: boolean;
  reload: () => Promise<void>;
  setDailyLog: (log: DailyLogRow) => void;
  setProfile: (profile: ProfileRow) => void;
}

/**
 * Données du cockpit « Aujourd'hui » (Couche 3 → Couche 2 uniquement).
 * Chargements indépendants (allSettled) : un profil en échec ne bloque ni
 * la pesée ni la synthèse macros. `todayIso === null` (SSR / hydratation) → aucun chargement.
 */
export function useTodayCockpitData(todayIso: string | null): TodayCockpitData {
  const [dailyLog, setDailyLog] = useState<DailyLogRow | null>(null);
  const [entries, setEntries] = useState<MealEntryWithItems[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [previousEma, setPreviousEma] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const reload = useCallback(async () => {
    if (todayIso === null) return;
    const [nutritionRes, profileRes, emaRes] = await Promise.allSettled([
      getDailyNutrition(todayIso),
      getCurrentProfile(),
      getPreviousWeightEma(todayIso),
    ]);
    if (nutritionRes.status === 'fulfilled') {
      setDailyLog(nutritionRes.value.dailyLog);
      setEntries(nutritionRes.value.entries);
      setHasError(false);
    } else {
      setHasError(true);
    }
    if (profileRes.status === 'fulfilled') setProfile(profileRes.value);
    if (emaRes.status === 'fulfilled') setPreviousEma(emaRes.value);
    setIsLoading(false);
  }, [todayIso]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const consumedMacros = useMemo(
    () =>
      sumMacroValues(
        entries.map((e) => ({
          kcal: e.total_kcal ?? 0,
          p: e.total_p ?? 0,
          g: e.total_g ?? 0,
          l: e.total_l ?? 0,
        }))
      ),
    [entries]
  );

  return {
    dailyLog,
    consumedMacros,
    profile,
    previousEma,
    isLoading,
    hasError,
    reload,
    setDailyLog,
    setProfile,
  };
}
