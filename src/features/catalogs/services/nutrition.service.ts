// src/features/catalogs/services/nutrition.service.ts
import { createClient } from '@/lib/supabase/client';
import { normalizeQuantityPerSingleServing, type LoggedUnit } from '@/lib/math/nutrition.math';
import type { Database } from '@/types/database.types';

export type FoodRow = Database['public']['Tables']['foods']['Row'];
export type RecipeRow = Database['public']['Tables']['recipes']['Row'];
export type RecipeIngredientRow = Database['public']['Tables']['recipe_ingredients']['Row'];

export interface RecipeWithIngredients extends RecipeRow {
  recipe_ingredients: Array<
    RecipeIngredientRow & {
      food: FoodRow;
    }
  >;
}

export interface RecipeIngredientDraft {
  food_id: string;
  raw_quantity: number;   // Quantité totale saisie par l'utilisateur
  logged_unit: LoggedUnit; // 'g' ou 'unit'
}

/**
 * 1. ALIMENTS SIMPLES ('100g' | 'unit' | 'both')
 */
export async function getActiveFoods(): Promise<FoodRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('foods')
    .select('*')
    .eq('is_archived', false)
    .order('name', { ascending: true });

  if (error) throw new Error(`Erreur chargement aliments : ${error.message}`);
  return data ?? [];
}

export async function createOrUpdateFood(
  payload: Database['public']['Tables']['foods']['Insert']
): Promise<FoodRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('foods')
    .upsert(payload)
    .select('*')
    .single();

  if (error || !data) throw new Error(`Erreur sauvegarde aliment : ${error?.message}`);
  return data;
}

export async function archiveFood(foodId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('foods')
    .update({ is_archived: true })
    .eq('id', foodId);
  if (error) throw new Error(`Erreur archivage aliment : ${error.message}`);
}

/**
 * 2. PLATS COMPOSÉS (RECETTES — Stockées pour 1 portion individuelle de référence)
 */
export async function getActiveRecipes(): Promise<RecipeWithIngredients[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('recipes')
    .select(`
      *,
      recipe_ingredients (
        *,
        food:foods (*)
      )
    `)
    .eq('is_archived', false)
    .order('name', { ascending: true });

  if (error) throw new Error(`Erreur chargement recettes : ${error.message}`);
  return (data as unknown as RecipeWithIngredients[]) ?? [];
}

/**
 * Crée ou met à jour un plat composé.
 * Si l'utilisateur prépare un Meal Prep de `servingsPrepared` parts (ex: 4 parts),
 * chaque `raw_quantity` est divisée par `servingsPrepared` pour stocker 1 portion de référence.
 * Lors d'une ré-édition ultérieure, les quantités affichées sont directement celles d'1 portion (servingsPrepared = 1).
 */
export async function saveRecipeSingleServing(params: {
  id?: string;
  name: string;
  description?: string;
  servingsPrepared?: number;
  ingredients: RecipeIngredientDraft[];
}): Promise<string> {
  const supabase = createClient();
  const divisor = params.servingsPrepared && params.servingsPrepared > 0 ? params.servingsPrepared : 1;

  const { data: recipe, error: recipeErr } = await supabase
    .from('recipes')
    .upsert({
      id: params.id,
      name: params.name.trim(),
      description: params.description?.trim() || null,
    })
    .select('id')
    .single();

  if (recipeErr || !recipe) throw new Error(`Erreur sauvegarde plat : ${recipeErr?.message}`);

  await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipe.id);

  const normalizedRows = params.ingredients.map((ing) => ({
    recipe_id: recipe.id,
    food_id: ing.food_id,
    quantity_value: normalizeQuantityPerSingleServing(ing.raw_quantity, divisor),
    logged_unit: ing.logged_unit,
  }));

  if (normalizedRows.length > 0) {
    const { error: ingErr } = await supabase.from('recipe_ingredients').insert(normalizedRows);
    if (ingErr) throw new Error(`Erreur sauvegarde ingrédients du plat : ${ingErr.message}`);
  }

  return recipe.id;
}

export async function archiveRecipe(recipeId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('recipes')
    .update({ is_archived: true })
    .eq('id', recipeId);
  if (error) throw new Error(`Erreur archivage plat : ${error.message}`);
}

