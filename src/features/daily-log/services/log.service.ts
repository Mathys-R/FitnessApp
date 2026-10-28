// src/features/daily-log/services/log.service.ts
import { createClient } from '@/lib/supabase/client';
import { recomputeWeightEmaSeries } from '@/lib/math/weight-ema.math';
import type { Database } from '@/types/database.types';

export type DailyLogRow = Database['public']['Tables']['daily_logs']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface MacroTargetsInput {
  current_target_kcal: number;
  current_target_p: number;
  current_target_g: number;
  current_target_l: number;
}

/**
 * 1. Récupère le profil de l'utilisateur connecté
 */
export async function getCurrentProfile(): Promise<ProfileRow> {
  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Utilisateur non authentifié');

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !data) throw new Error(`Impossible de charger le profil : ${error?.message}`);
  return data;
}

/**
 * 2. Met à jour les objectifs caloriques et macros du profil.
 * Le trigger SQL `trg_sync_today_daily_log_targets` synchronise uniquement aujourd'hui (Europe/Paris).
 */
export async function updateProfileTargets(targets: MacroTargetsInput): Promise<ProfileRow> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilisateur non authentifié');

  const { data, error } = await supabase
    .from('profiles')
    .update(targets)
    .eq('id', user.id)
    .select('*')
    .single();

  if (error || !data) throw new Error(`Erreur mise à jour des objectifs : ${error?.message}`);
  return data;
}

/**
 * 3. Récupère ou crée automatiquement le Snapshot Journalier (`daily_logs`) pour une date donnée ('YYYY-MM-DD').
 */
export async function getOrCreateDailyLog(logDate: string): Promise<DailyLogRow> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilisateur non authentifié');

  const { data: existing } = await supabase
    .from('daily_logs')
    .select('*')
    .eq('user_id', user.id)
    .eq('log_date', logDate)
    .maybeSingle();

  if (existing) return existing;

  const { data: created, error: insertError } = await supabase
    .from('daily_logs')
    .insert({ user_id: user.id, log_date: logDate })
    .select('*')
    .single();

  if (insertError || !created) {
    throw new Error(`Impossible d'initialiser la journée ${logDate} : ${insertError?.message}`);
  }
  return created;
}

/**
 * 4. Enregistre ou modifie une pesée à la date `logDate` et recalcule en cascade
 * l'EMA 7 jours pour cette date et toutes les pesées postérieures éventuelles.
 */
export async function upsertWeightAndRecalculateEma(
  logDate: string,
  weightKg: number
): Promise<DailyLogRow> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilisateur non authentifié');

  const targetLog = await getOrCreateDailyLog(logDate);

  const { data: prevPoint } = await supabase
    .from('daily_logs')
    .select('weight_ema_kg')
    .eq('user_id', user.id)
    .lt('log_date', logDate)
    .not('weight_ema_kg', 'is', null)
    .order('log_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const initialPreviousEma = prevPoint?.weight_ema_kg ?? null;

  const { data: subsequentLogs, error: fetchError } = await supabase
    .from('daily_logs')
    .select('id, log_date, weight_kg, weight_ema_kg')
    .eq('user_id', user.id)
    .gte('log_date', logDate)
    .order('log_date', { ascending: true });

  if (fetchError) throw new Error(`Erreur lecture historique poids : ${fetchError.message}`);

  const pointsToCompute = (subsequentLogs ?? [])
    .map((row) => ({
      id: row.id,
      log_date: row.log_date,
      weight_kg: row.log_date === logDate ? weightKg : (row.weight_kg ?? 0),
    }))
    .filter((row) => row.weight_kg > 0);

  const recomputedSeries = recomputeWeightEmaSeries(pointsToCompute, initialPreviousEma);

  for (const item of recomputedSeries) {
    if (!item.id) continue;
    const { error: updateErr } = await supabase
      .from('daily_logs')
      .update({
        weight_kg: item.weight_kg,
        weight_ema_kg: item.weight_ema_kg,
      })
      .eq('id', item.id);
    if (updateErr) throw new Error(`Erreur sauvegarde EMA (${item.log_date}) : ${updateErr.message}`);
  }

  return getOrCreateDailyLog(targetLog.log_date);
}

/**
 * 5. Active ou désactive l'exclusion manuelle d'une journée pour le calcul du TDEE 14j
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
 * 6. Récupère l'historique des pesées pour le graphique WeightEmaChart
 */
export async function getWeightHistory(limitDays = 90): Promise<DailyLogRow[]> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
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

