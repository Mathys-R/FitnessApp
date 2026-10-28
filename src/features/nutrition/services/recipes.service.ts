// src/features/nutrition/services/recipes.service.ts
import { createClient } from '@/lib/supabase/client';
import {
  calculateFoodMacros,
  scaleQuantityByPortions,
  type LoggedUnit,
} from '@/lib/math/nutrition.math';
import type { FoodRow, MealCategory, MealEntryItemRow } from './entries.service';

/**
 * 1. Mode 3 : Ajout d'un Plat Composé avec support des portions décimales (ex: 1, 1.5, 0.5 part)
 * et CLONAGE de ses ingrédients dans `meal_entry_items` pour permettre l'adaptation locale le jour J.
 */
export async function addRecipeMealEntryWithClonedItems(params: {
  dailyLogId: string;
  mealType: MealCategory;
  recipeId: string;
  portionsMultiplier?: number; // 1 par défaut ; accepte les décimales (ex: 1.5 ou 0.5)
}): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non authentifié');

  const portions = params.portionsMultiplier && params.portionsMultiplier > 0
    ? params.portionsMultiplier
    : 1;

  const { data: recipe, error: recErr } = await supabase
    .from('recipes')
    .select(`
      id, name,
      recipe_ingredients (
        quantity_value,
        logged_unit,
        food:foods (*)
      )
    `)
    .eq('id', params.recipeId)
    .single();

  if (recErr || !recipe) throw new Error(`Recette introuvable : ${recErr?.message}`);

  const { data: parentEntry, error: parentErr } = await supabase
    .from('meal_entries')
    .insert({
      daily_log_id: params.dailyLogId,
      user_id: user.id,
      meal_type: params.mealType,
      entry_type: 'recipe',
      label: recipe.name,
      recipe_id: recipe.id,
      quantity_value: portions,
      logged_unit: 'unit',
    })
    .select('id')
    .single();

  if (parentErr || !parentEntry) throw new Error(`Erreur création plat du jour : ${parentErr?.message}`);

  const rawIngredients = (recipe.recipe_ingredients as unknown as Array<{
    quantity_value: number;
    logged_unit: LoggedUnit;
    food: FoodRow;
  }>) ?? [];

  const clonedItems = rawIngredients.map((item) => {
    const scaledQuantity = scaleQuantityByPortions(item.quantity_value, portions);
    const macros = calculateFoodMacros(item.food, scaledQuantity, item.logged_unit);
    return {
      meal_entry_id: parentEntry.id,
      user_id: user.id,
      food_id: item.food.id,
      ingredient_name: item.food.name,
      serving_type: item.food.serving_type,
      unit_weight_g: item.food.unit_weight_g,
      logged_unit: item.logged_unit,
      kcal_per_base: item.food.kcal_per_base,
      p_per_base: item.food.proteins_per_base,
      g_per_base: item.food.carbs_per_base,
      l_per_base: item.food.fats_per_base,
      quantity_value: scaledQuantity,
      kcal: macros.kcal,
      p: macros.p,
      g: macros.g,
      l: macros.l,
    };
  });

  if (clonedItems.length > 0) {
    const { error: itemsErr } = await supabase.from('meal_entry_items').insert(clonedItems);
    if (itemsErr) throw new Error(`Erreur clonage ingrédients du plat : ${itemsErr.message}`);
  }
}

/**
 * 2. SURCHARGE LOCALE (OVERRIDE) : Modifie la quantité (ou l'unité) d'un ingrédient cloné
 * dans le sous-menu du jour (ex: passer le riz de 60g à 75g).
 * Le trigger SQL `trg_sync_parent_meal_entry_totals` met à jour le repas parent automatiquement.
 */
export async function updateClonedIngredientQuantity(params: {
  item: MealEntryItemRow;
  newQuantity: number;
  newLoggedUnit?: LoggedUnit;
}): Promise<void> {
  const supabase = createClient();
  const unitToUse = (params.newLoggedUnit ?? params.item.logged_unit) as LoggedUnit;

  const updatedMacros = calculateFoodMacros(
    {
      serving_type: params.item.serving_type,
      unit_weight_g: params.item.unit_weight_g,
      kcal_per_base: params.item.kcal_per_base,
      proteins_per_base: params.item.p_per_base,
      carbs_per_base: params.item.g_per_base,
      fats_per_base: params.item.l_per_base,
    },
    params.newQuantity,
    unitToUse
  );

  const { error } = await supabase
    .from('meal_entry_items')
    .update({
      quantity_value: params.newQuantity,
      logged_unit: unitToUse,
      kcal: updatedMacros.kcal,
      p: updatedMacros.p,
      g: updatedMacros.g,
      l: updatedMacros.l,
    })
    .eq('id', params.item.id);

  if (error) throw new Error(`Erreur modification ingrédient du jour : ${error.message}`);
}

/**
 * 3. Supprime un sous-ingrédient du plat cloné du jour (sans toucher à la recette du catalogue)
 * Le trigger SQL recalcule automatiquement le total du plat parent.
 */
export async function deleteClonedIngredient(itemId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('meal_entry_items').delete().eq('id', itemId);
  if (error) throw new Error(`Erreur suppression sous-ingrédient : ${error.message}`);
}

