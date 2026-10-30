// tests/fixtures/nutrition.fixture.ts
import type { Database } from '@/types/database.types';
import { mockUserA } from './profiles.fixture';

export type FoodRow = Database['public']['Tables']['foods']['Row'];
export type MealEntryRow = Database['public']['Tables']['meal_entries']['Row'];

export const mockFoodOats: FoodRow = {
  id: 'food-01',
  name: 'Flocons d avoine complets',
  brand: 'Bio',
  barcode: null,
  serving_type: '100g',
  unit_weight_g: 100,
  kcal_per_base: 375,
  proteins_per_base: 13.5,
  carbs_per_base: 62.0,
  fats_per_base: 7.0,
  is_archived: false,
  created_by: null,
  created_at: '2026-01-01T08:00:00Z',
};

export const mockFoodEgg: FoodRow = {
  id: 'food-02',
  name: 'Œuf entier plein air',
  brand: null,
  barcode: null,
  serving_type: 'both',
  unit_weight_g: 50,
  kcal_per_base: 140,
  proteins_per_base: 12.5,
  carbs_per_base: 0.7,
  fats_per_base: 9.9,
  is_archived: false,
  created_by: null,
  created_at: '2026-01-01T08:00:00Z',
};

export const mockFoodBanana: FoodRow = {
  id: 'food-03',
  name: 'Banane mûre',
  brand: null,
  barcode: null,
  serving_type: 'both',
  unit_weight_g: 118,
  kcal_per_base: 89,
  proteins_per_base: 1.1,
  carbs_per_base: 22.8,
  fats_per_base: 0.3,
  is_archived: false,
  created_by: null,
  created_at: '2026-01-01T08:00:00Z',
};

export const mockBreakfastEntry: MealEntryRow = {
  id: 'meal-entry-01',
  daily_log_id: 'log-01',
  user_id: mockUserA.id,
  meal_type: 'breakfast',
  entry_type: 'food',
  label: 'Flocons d avoine complets',
  food_id: mockFoodOats.id,
  recipe_id: null,
  quantity_value: 80,
  logged_unit: 'g',
  total_kcal: 300,
  total_p: 10.8,
  total_g: 49.6,
  total_l: 5.6,
  created_at: '2026-10-30T07:30:00Z',
};
