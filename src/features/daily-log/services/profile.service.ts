// src/features/daily-log/services/profile.service.ts
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';

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
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
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
 * Le trigger SQL `trg_sync_today_daily_log_targets` synchronise automatiquement la journée active.
 */
export async function updateProfileTargets(targets: MacroTargetsInput): Promise<ProfileRow> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Utilisateur non authentifié');

  const payload = {
    current_target_kcal: Math.max(0, Math.round(targets.current_target_kcal)),
    current_target_p: Math.max(0, Math.round(targets.current_target_p)),
    current_target_g: Math.max(0, Math.round(targets.current_target_g)),
    current_target_l: Math.max(0, Math.round(targets.current_target_l)),
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', user.id)
    .select('*')
    .single();

  if (error || !data) throw new Error(`Erreur mise à jour des objectifs : ${error?.message}`);
  return data;
}

