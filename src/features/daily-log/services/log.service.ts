// src/features/daily-log/services/log.service.ts
import { createClient } from '@/lib/supabase/client';
import { recomputeWeightEmaSeries, type WeightPointInput } from '@/lib/math/weight-ema.math';
import type { Database } from '@/types/database.types';

export type DailyLogRow = Database['public']['Tables']['daily_logs']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export { getCurrentProfile, updateProfileTargets } from './profile.service';
export type { MacroTargetsInput } from './profile.service';

/**
 * 1. Récupère ou crée la ligne `daily_logs` pour une date donnée (YYYY-MM-DD)
 */
export async function getOrCreateDailyLog(logDate: string): Promise<DailyLogRow> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilisateur non authentifié');

  const { data: existing, error: selectErr } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('log_date', logDate)
    .maybeSingle();

  if (selectErr) throw new Error(`Erreur récupération log journalier : ${selectErr.message}`);
  if (existing) return existing;

  const { data: profile } = await supabase
    .from('profiles')
    .select('current_target_kcal, current_target_p, current_target_g, current_target_l')
    .eq('id', user.id)
    .single();

  const { data: created, error: insertErr } = await supabase
    .from('daily_logs')
    .insert({
      user_id: user.id,
      log_date: logDate,
      target_kcal: profile?.current_target_kcal ?? 2000,
      target_p: profile?.current_target_p ?? 150,
      target_g: profile?.current_target_g ?? 200,
      target_l: profile?.current_target_l ?? 60,
    })
    .select('*')
    .single();

  if (insertErr || !created) throw new Error(`Erreur création log journalier : ${insertErr?.message}`);
  return created;
}

/**
 * 2. Enregistre une pesée et déclenche le recalcul complet de l'EMA 7j
 */
export async function logWeightAndRecalculateEma(
  logDate: string,
  weightKg: number | null
): Promise<DailyLogRow> {
  const supabase = createClient();
  const targetLog = await getOrCreateDailyLog(logDate);

  await supabase
    .from('daily_logs')
    .update({ weight_kg: weightKg })
    .eq('id', targetLog.id);

  const { data: logs, error: histError } = await supabase
    .from('daily_logs')
    .select('id, log_date, weight_kg, weight_ema_kg')
    .eq('user_id', targetLog.user_id)
    .order('log_date', { ascending: true });

  if (histError || !logs) throw new Error('Impossible de charger l historique pour recalculer l EMA');

  const series: WeightPointInput[] = logs
    .filter((l): l is typeof l & { weight_kg: number } => l.weight_kg !== null)
    .map((l) => ({
      id: l.id,
      log_date: l.log_date,
      weight_kg: Number(l.weight_kg),
    }));

  const recomputed = recomputeWeightEmaSeries(series);
  const emaByLogDate = new Map(recomputed.map((r) => [r.log_date, r.weight_ema_kg]));

  for (const l of logs) {
    const newEma = emaByLogDate.get(l.log_date) ?? null;
    if (newEma !== l.weight_ema_kg) {
      await supabase
        .from('daily_logs')
        .update({ weight_ema_kg: newEma })
        .eq('id', l.id);
    }
  }

  return getOrCreateDailyLog(targetLog.log_date);
}

/**
 * 3. Active ou désactive l'exclusion manuelle d'une journée pour le calcul du TDEE 14j
 */
export async function toggleExcludeFromTdee(
  dailyLogId: string,
  excludeFromTdee: boolean
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('daily_logs')
    .update({ exclude_from_tdee: excludeFromTdee })
    .eq('id', dailyLogId);

  if (error) throw new Error(`Erreur mise à jour exclusion TDEE : ${error.message}`);
}

/**
 * 4. Récupère le dernier EMA connu avant une date donnée (requis par WeightQuickInput)
 */
export async function getPreviousWeightEma(logDate: string): Promise<number | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilisateur non authentifié');

  const { data, error } = await supabase
    .from('daily_logs')
    .select('weight_ema_kg')
    .eq('user_id', user.id)
    .lt('log_date', logDate)
    .not('weight_ema_kg', 'is', null)
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Erreur récupération EMA précédent : ${error.message}`);
  return data?.weight_ema_kg ? Number(data.weight_ema_kg) : null;
}

/**
 * 5. Récupère l'historique des pesées pour le graphique WeightEmaChart
 */
export async function getWeightHistory(limitDays = 90): Promise<DailyLogRow[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilisateur non authentifié');

  const { data, error } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', user.id)
    .not('weight_kg', 'is', null)
    .order('log_date', { ascending: false })
    .limit(limitDays);

  if (error) throw new Error(`Erreur chargement historique poids : ${error.message}`);
  return (data ?? []).reverse();
}
