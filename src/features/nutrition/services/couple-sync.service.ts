// src/features/nutrition/services/couple-sync.service.ts
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';

export type MealCategory = Database['public']['Enums']['meal_category'];

export interface PartnerInfo {
  partner_id: string;
  partner_name: string;
}

/**
 * 1. Récupère l'ID et le prénom du partenaire du couple
 */
export async function getPartnerInfo(): Promise<PartnerInfo | null> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('get_partner_info');
  if (error || !data || data.length === 0) return null;
  return data[0];
}

/**
 * 2. Copie rapide d'un repas complet (Hier ou Partenaire) via RPC Supabase
 */
export async function copyMealFromSource(params: {
  sourceUserId: string;
  sourceDate: string;
  sourceMealType: MealCategory;
  targetDailyLogId: string;
  targetMealType: MealCategory;
}): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc('copy_meal_entries', {
    p_source_user_id: params.sourceUserId,
    p_source_date: params.sourceDate,
    p_source_meal_type: params.sourceMealType,
    p_target_daily_log_id: params.targetDailyLogId,
    p_target_meal_type: params.targetMealType,
  });

  if (error) throw new Error(`Erreur copie du repas : ${error.message}`);
  return data ?? 0;
}

