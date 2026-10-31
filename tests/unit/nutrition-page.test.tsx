// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import NutritionPage from '@/app/(protected)/nutrition/page';

const { mockDailyLog, mockEntries } = vi.hoisted(() => ({
  mockDailyLog: {
    id: 'log-01',
    user_id: 'user-01',
    log_date: '2026-10-31',
    weight_kg: 80,
    weight_ema_kg: 80,
    steps_count: 5000,
    target_kcal: 2200,
    target_p: 160,
    target_g: 220,
    target_l: 70,
    exclude_from_tdee: false,
    notes: null,
    created_at: '2026-10-31T06:00:00Z',
    updated_at: '2026-10-31T06:00:00Z',
  },
  mockEntries: [
    {
      id: 'entry-1',
      daily_log_id: 'log-01',
      user_id: 'user-01',
      meal_type: 'breakfast',
      entry_type: 'food',
      label: 'Flocons d avoine',
      food_id: 'food-1',
      recipe_id: null,
      quantity_value: 80,
      logged_unit: 'g',
      total_kcal: 296,
      total_p: 10.8,
      total_g: 47,
      total_l: 5.6,
      created_at: '2026-10-31T07:00:00Z',
      updated_at: '2026-10-31T07:00:00Z',
      food: null,
      meal_entry_items: [],
    },
  ],
}));

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));

vi.mock('@/features/nutrition/services/entries.service', () => ({
  getDailyNutrition: vi.fn().mockResolvedValue({
    dailyLog: mockDailyLog,
    entries: mockEntries,
  }),
  addFoodMealEntry: vi.fn().mockResolvedValue(undefined),
  updateFoodMealEntryQuantity: vi.fn().mockResolvedValue(undefined),
  addQuickMealEntry: vi.fn().mockResolvedValue(undefined),
  deleteMealEntry: vi.fn().mockResolvedValue(undefined),
  getPartnerInfo: vi.fn().mockResolvedValue({
    partner_id: 'user-02',
    partner_name: 'Camille',
  }),
  copyMealFromSource: vi.fn().mockResolvedValue(1),
}));

vi.mock('@/features/nutrition/services/recipes.service', () => ({
  addRecipeMealEntryWithClonedItems: vi.fn().mockResolvedValue(undefined),
  updateClonedIngredientQuantity: vi.fn().mockResolvedValue(undefined),
  deleteClonedIngredient: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/features/catalogs/services/nutrition.service', () => ({
  getActiveFoods: vi.fn().mockResolvedValue([]),
  getActiveRecipes: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/features/daily-log/services/log.service', () => ({
  toggleExcludeFromTdee: vi.fn().mockResolvedValue(undefined),
}));

describe('NutritionPage Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page header and daily macro summary', async () => {
    render(<NutritionPage />);

    await waitFor(() => {
      expect(screen.getByText('Nutrition')).toBeDefined();
      expect(screen.getByText('Journal & Macro-nutriments')).toBeDefined();
      expect(screen.getByText('2200', { exact: false })).toBeDefined();
    });
  });

  it('renders all 5 meal categories in order', async () => {
    render(<NutritionPage />);

    await waitFor(() => {
      expect(screen.getByText('Petit-déjeuner')).toBeDefined();
      expect(screen.getByText('Déjeuner')).toBeDefined();
      expect(screen.getByText('Dîner')).toBeDefined();
      expect(screen.getByText('Collation')).toBeDefined();
      expect(screen.getByText('Pré / Post-Workout')).toBeDefined();
    });
  });

  it('renders logged food item in breakfast', async () => {
    render(<NutritionPage />);

    await waitFor(() => {
      expect(screen.getByText('Flocons d avoine')).toBeDefined();
      expect(screen.getAllByText(/296/).length).toBeGreaterThan(0);
    });
  });

  it('allows navigating dates with chevrons', async () => {
    render(<NutritionPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Jour précédent')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Jour précédent'));

    await waitFor(() => {
      expect(screen.getByText(/Aujourd'hui/i)).toBeDefined();
    });
  });
});
