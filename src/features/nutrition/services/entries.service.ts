// src/features/nutrition/services/entries.service.ts
import { createClient } from '@/lib/supabase/client';
import { getOrCreateDailyLog, type DailyLogRow } from '@/features/daily-log/services/log.service';
import { calculateFoodMacros, type LoggedUnit, type MacroValues } from '@/lib/math/nutrition.math';
import type { Database } from '@/types/database.types';
import {
  getPartnerInfo,
  copyMealFromSource,
  type MealCategory,
  type PartnerInfo,
} from './couple-sync.service';

export { getPartnerInfo, copyMealFromSource, type MealCategory, type PartnerInfo };

export type MealEntryRow = Database['public']['Tables']['meal_entries']['Row'];
export type MealEntryItemRow = Database['public']['Tables']['meal_entry_items']['Row'];
export type FoodRow = Database['public']['Tables']['foods']['Row'];

export interface MealEntryItemWithFood extends MealEntryItemRow {
  food?: FoodRow | null;
}

export interface MealEntryWithItems extends MealEntryRow {
  food?: FoodRow | null;
  meal_entry_items: MealEntryItemWithFood[];
}

export interface DailyNutritionData {
  dailyLog: DailyLogRow;
  entries: MealEntryWithItems[];
}

/**
 * 1. Charge le Snapshot du jour + toutes les entrées de repas et leurs sous-ingrédients
 */
export async function getDailyNutrition(logDate: string): Promise<DailyNutritionData> {
  const supabase = createClient();
  const dailyLog = await getOrCreateDailyLog(logDate);

  const { data, error } = await supabase
    .from('meal_entries')
    .select(`
      *,
      food:foods (*),
      meal_entry_items (
        *,
        food:foods (*)
      )
    `)
    .eq('daily_log_id', dailyLog.id)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Erreur chargement journal nutrition : ${error.message}`);

  return {
    dailyLog,
    entries: (data as unknown as MealEntryWithItems[]) ?? [],
  };
}

/**
 * 2. Mode 1 : Ajout ou modification d'un Quick Add
 */
export async function addQuickMealEntry(params: {
  dailyLogId: string;
  mealType: MealCategory;
  label: string;
  macros: MacroValues;
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const { error } = await supabase.from('meal_entries').insert({
    daily_log_id: params.dailyLogId,
    user_id: user.id,
    meal_type: params.mealType,
    entry_type: 'quick_add',
    label: params.label.trim() || 'Ajout rapide',
    total_kcal: params.macros.kcal,
    total_p: params.macros.p,
    total_g: params.macros.g,
    total_l: params.macros.l,
  });

  if (error) throw new Error(`Erreur Quick Add : ${error.message}`);
}

export async function updateQuickMealEntry(params: {
  entryId: string;
  label: string;
  macros: MacroValues;
}): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('meal_entries')
    .update({
      label: params.label.trim() || 'Ajout rapide',
      total_kcal: params.macros.kcal,
      total_p: params.macros.p,
      total_g: params.macros.g,
      total_l: params.macros.l,
    })
    .eq('id', params.entryId);

  if (error) throw new Error(`Erreur modification Quick Add : ${error.message}`);
}

/**
 * 3. Mode 2 : Ajout et modification de quantité d'un Aliment simple ('100g' | 'unit' | 'both')
 */
export async function addFoodMealEntry(params: {
  dailyLogId: string;
  mealType: MealCategory;
  food: FoodRow;
  quantityValue: number;
  loggedUnit: LoggedUnit;
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const computed = calculateFoodMacros(params.food, params.quantityValue, params.loggedUnit);

  const { error } = await supabase.from('meal_entries').insert({
    daily_log_id: params.dailyLogId,
    user_id: user.id,
    meal_type: params.mealType,
    entry_type: 'food',
    label: params.food.name,
    food_id: params.food.id,
    quantity_value: params.quantityValue,
    logged_unit: params.loggedUnit,
    total_kcal: computed.kcal,
    total_p: computed.p,
    total_g: computed.g,
    total_l: computed.l,
  });

  if (error) throw new Error(`Erreur ajout aliment : ${error.message}`);
}

export async function updateFoodMealEntryQuantity(params: {
  entryId: string;
  food: FoodRow;
  newQuantityValue: number;
  newLoggedUnit: LoggedUnit;
}): Promise<void> {
  const supabase = createClient();
  const computed = calculateFoodMacros(params.food, params.newQuantityValue, params.newLoggedUnit);

  const { error } = await supabase
    .from('meal_entries')
    .update({
      quantity_value: params.newQuantityValue,
      logged_unit: params.newLoggedUnit,
      total_kcal: computed.kcal,
      total_p: computed.p,
      total_g: computed.g,
      total_l: computed.l,
    })
    .eq('id', params.entryId);

  if (error) throw new Error(`Erreur modification quantité aliment : ${error.message}`);
}

/**
 * 4. Supprime n'importe quelle ligne de repas (Quick Add, Aliment simple ou Plat composé)
 */
export async function deleteMealEntry(entryId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('meal_entries').delete().eq('id', entryId);
  if (error) throw new Error(`Erreur suppression ligne de repas : ${error.message}`);
}
