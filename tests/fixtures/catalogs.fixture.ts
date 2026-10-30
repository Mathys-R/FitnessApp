// tests/fixtures/catalogs.fixture.ts
import type { ExerciseRow } from '@/features/catalogs/services/exercises.service';
import type { FoodRow, RecipeWithIngredients } from '@/features/catalogs/services/nutrition.service';
import { mockExerciseBench, mockExerciseSquat, mockExercisePullup } from './workout.fixture';
import { mockFoodOats, mockFoodEgg, mockFoodBanana } from './nutrition.fixture';

export { mockExerciseBench, mockExerciseSquat, mockExercisePullup };
export { mockFoodOats, mockFoodEgg, mockFoodBanana };

export const mockFoodApple: FoodRow = {
  id: 'food-04',
  name: 'Pomme Pink Lady',
  brand: 'Vergers Bio',
  barcode: null,
  serving_type: 'unit',
  unit_weight_g: 150,
  kcal_per_base: 78,
  proteins_per_base: 0.4,
  carbs_per_base: 19.5,
  fats_per_base: 0.2,
  is_archived: false,
  created_by: null,
  created_at: '2026-01-01T08:00:00Z',
};

export const mockRecipePorridge: RecipeWithIngredients = {
  id: 'recipe-01',
  created_by: 'user-01',
  name: 'Porridge Protéiné',
  description: 'Petit déjeuner complet post-workout',
  created_at: '2026-01-01T08:00:00Z',
  updated_at: '2026-01-01T08:00:00Z',
  is_archived: false,
  recipe_ingredients: [
    {
      id: 'ing-01',
      recipe_id: 'recipe-01',
      food_id: mockFoodOats.id,
      quantity_value: 50,
      logged_unit: 'g',
      food: mockFoodOats,
    },
    {
      id: 'ing-02',
      recipe_id: 'recipe-01',
      food_id: mockFoodBanana.id,
      quantity_value: 1,
      logged_unit: 'unit',
      food: mockFoodBanana,
    },
  ],
};
