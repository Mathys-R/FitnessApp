// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MealCard } from '@/features/nutrition/components/MealCard';
import { RecipeSubmenuAccordion } from '@/features/nutrition/components/RecipeSubmenuAccordion';
import { DailyMacroSummary } from '@/features/nutrition/components/DailyMacroSummary';
import { NutritionDateNav } from '@/features/nutrition/components/NutritionDateNav';
import { AddRecipeTab } from '@/features/nutrition/components/AddRecipeTab';
import {
  calculateFoodMacros, calculateKcalFromMacros, sumMacroValues,
  normalizeQuantityPerSingleServing, scaleQuantityByPortions,
} from '@/lib/math/nutrition.math';
import type { MealEntryWithItems, FoodRow } from '@/features/nutrition/services/entries.service';
import type { RecipeWithIngredients } from '@/features/catalogs/services/nutrition.service';
import type { DailyLogRow } from '@/features/daily-log/services/log.service';

vi.mock('@number-flow/react', () => ({ default: ({ value }: { value: number }) => <span>{value}</span> }));
vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, className, style }: { children?: React.ReactNode; className?: string; style?: React.CSSProperties } & Record<string, unknown>) => (
      <div className={className} style={style}>{children}</div>
    ),
  },
}));

const mockFood: FoodRow = {
  id: 'f-chaos-1', name: 'Poulet rôti', brand: null, barcode: null, serving_type: '100g', unit_weight_g: 100,
  kcal_per_base: 165, proteins_per_base: 31, carbs_per_base: 0, fats_per_base: 3.6,
  is_archived: false, created_by: 'u1', created_at: '2026-10-31T08:00:00Z',
};

const mockRecipe: RecipeWithIngredients = {
  id: 'r-chaos-1', name: 'Bowl Poulet', description: null, is_archived: false, created_by: 'u1',
  created_at: '2026-10-31T08:00:00Z', updated_at: '2026-10-31T08:00:00Z',
  recipe_ingredients: [{ id: 'ri-1', recipe_id: 'r-chaos-1', food_id: 'f-chaos-1', quantity_value: 100, logged_unit: 'g', food: mockFood }],
};

const mockFoodEntry: MealEntryWithItems = {
  id: 'e-food-1', daily_log_id: 'dl-1', user_id: 'u1', meal_type: 'lunch', entry_type: 'food',
  label: 'Poulet rôti', food_id: 'f-chaos-1', recipe_id: null, quantity_value: 100, logged_unit: 'g',
  total_kcal: 165, total_p: 31, total_g: 0, total_l: 3.6, created_at: '2026-10-31T12:00:00Z',
  food: mockFood, meal_entry_items: [],
};

const mockRecipeEntry: MealEntryWithItems = {
  id: 'e-rec-1', daily_log_id: 'dl-1', user_id: 'u1', meal_type: 'lunch', entry_type: 'recipe',
  label: 'Bowl Poulet', food_id: null, recipe_id: 'r-chaos-1', quantity_value: 1, logged_unit: 'unit',
  total_kcal: 165, total_p: 31, total_g: 0, total_l: 3.6, created_at: '2026-10-31T12:00:00Z', food: null,
  meal_entry_items: [{
    id: 'item-1', meal_entry_id: 'e-rec-1', user_id: 'u1', food_id: 'f-chaos-1', ingredient_name: 'Poulet rôti',
    serving_type: '100g', unit_weight_g: 100, logged_unit: 'g', kcal_per_base: 165, p_per_base: 31,
    g_per_base: 0, l_per_base: 3.6, quantity_value: 100, kcal: 165, p: 31, g: 0, l: 3.6,
  }],
};

describe('Nutrition Chaos & Monkey Testing Suite', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('1. Clics frénétiques : accordéon, chevrons, ajouts et déduplication de soumission', async () => {
    const { unmount: uAcc } = render(<RecipeSubmenuAccordion entry={mockRecipeEntry} />);
    const header = screen.getByRole('button', { name: /Bowl Poulet/i });
    for (let i = 0; i < 7; i++) fireEvent.click(header);
    expect(screen.getByText(/Ajustements au gramme près/i)).toBeDefined();
    fireEvent.click(header);
    expect(screen.queryByText(/Ajustements au gramme près/i)).toBeNull();
    uAcc();

    const onDateChange = vi.fn();
    const { unmount: uNav } = render(<NutritionDateNav selectedDate="2026-10-31" todayIso="2026-10-31" onDateChange={onDateChange} />);
    const prevBtn = screen.getByLabelText('Jour précédent');
    for (let i = 0; i < 6; i++) fireEvent.click(prevBtn);
    expect(onDateChange).toHaveBeenCalledTimes(6);
    uNav();

    const onAddClick = vi.fn();
    const { unmount: uMeal } = render(<MealCard mealCategory={{ key: 'lunch', label: 'Déjeuner' }} entries={[]} onAddItemClick={onAddClick} />);
    const addBtn = screen.getByLabelText('Ajouter un aliment');
    for (let i = 0; i < 4; i++) fireEvent.click(addBtn);
    expect(onAddClick).toHaveBeenCalledTimes(4);
    uMeal();

    let resolveAdd: () => void = () => {};
    const onAddRecipe = vi.fn().mockImplementation(() => new Promise<void>((r) => { resolveAdd = r; }));
    const { unmount: uRecipe } = render(<AddRecipeTab recipes={[mockRecipe]} onAdd={onAddRecipe} />);
    fireEvent.click(screen.getByText('Bowl Poulet'));
    const submitBtn = screen.getByRole('button', { name: /Ajouter au repas/i });
    fireEvent.click(submitBtn);
    fireEvent.click(submitBtn);
    expect(onAddRecipe).toHaveBeenCalledTimes(1);
    resolveAdd();
    uRecipe();
  });

  it('2. Saisie de valeurs chaotiques : chaînes vides, espaces, négatifs et démesurés', async () => {
    const onUpdateQty = vi.fn().mockResolvedValue(undefined);
    const { unmount: uMeal } = render(
      <MealCard mealCategory={{ key: 'lunch', label: 'Déjeuner' }} entries={[mockFoodEntry]} onAddItemClick={vi.fn()} onUpdateFoodQuantity={onUpdateQty} />
    );

    for (const chaotic of ['   ', '-50', 'abc', '0', '']) {
      fireEvent.click(screen.getByRole('button', { name: /Modifier la quantité/i }));
      fireEvent.change(screen.getByDisplayValue('100'), { target: { value: chaotic } });
      fireEvent.click(screen.getByLabelText('Valider la quantité'));
      expect(onUpdateQty).not.toHaveBeenCalled();
    }

    fireEvent.click(screen.getByRole('button', { name: /Modifier la quantité/i }));
    fireEvent.change(screen.getByDisplayValue('100'), { target: { value: '150,5' } });
    fireEvent.click(screen.getByLabelText('Valider la quantité'));
    await waitFor(() => { expect(onUpdateQty).toHaveBeenCalledWith('e-food-1', mockFood, 150.5, 'g'); });
    uMeal();

    const onAdd = vi.fn().mockResolvedValue(undefined);
    const { unmount: uRecipe } = render(<AddRecipeTab recipes={[mockRecipe]} onAdd={onAdd} />);
    fireEvent.click(screen.getByText('Bowl Poulet'));
    const portionInput = screen.getByRole('spinbutton');
    const addRecipeBtn = screen.getByRole('button', { name: /Ajouter au repas/i });

    for (const invalidPortion of ['-10', '0', 'abc']) {
      fireEvent.change(portionInput, { target: { value: invalidPortion } });
      expect(addRecipeBtn.hasAttribute('disabled')).toBe(true);
      fireEvent.click(addRecipeBtn);
      expect(onAdd).not.toHaveBeenCalled();
    }

    fireEvent.change(portionInput, { target: { value: '9999999999' } });
    expect(screen.getByText(/kcal/i)).toBeDefined();
    expect(screen.queryByText(/NaN/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '1.5 part' }));
    expect(addRecipeBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(addRecipeBtn);
    await waitFor(() => { expect(onAdd).toHaveBeenCalledWith({ recipeId: 'r-chaos-1', portions: 1.5 }); });
    uRecipe();
  });

  it('3. Fallback sans partenaire : affichage "Importer le repas du partenaire" et clic gracieux', () => {
    const onCopyPartner = vi.fn();
    const onCopyYesterday = vi.fn();
    const { unmount } = render(
      <MealCard
        mealCategory={{ key: 'dinner', label: 'Dîner' }}
        entries={[]}
        partnerName={null}
        onAddItemClick={vi.fn()}
        onCopyYesterday={onCopyYesterday}
        onCopyPartner={onCopyPartner}
      />
    );

    fireEvent.click(screen.getByLabelText("Menu d'actions du repas"));
    const partnerBtn = screen.getByRole('button', { name: 'Importer le repas du partenaire' });
    expect(partnerBtn).toBeDefined();

    fireEvent.click(partnerBtn);
    expect(onCopyPartner).toHaveBeenCalledWith('dinner');

    fireEvent.click(screen.getByLabelText("Menu d'actions du repas"));
    fireEvent.click(screen.getByRole('button', { name: "Copier mon repas d'hier" }));
    expect(onCopyYesterday).toHaveBeenCalledWith('dinner');
    unmount();
  });

  it('4. Robustesse des calculs : 0 NaN, targets nulles, portions et macros limites', () => {
    const zeroTargetLog: DailyLogRow = {
      id: 'dl-zero', user_id: 'u1', log_date: '2026-10-31', weight_kg: 80, weight_ema_kg: 80,
      steps_count: 5000, target_kcal: 0, target_p: 0, target_g: 0, target_l: 0,
      exclude_from_tdee: false, notes: null, created_at: '2026-10-31T06:00:00Z', updated_at: '2026-10-31T06:00:00Z',
    };
    const { container, unmount: uSummary } = render(
      <DailyMacroSummary dailyLog={zeroTargetLog} consumedMacros={{ kcal: -50, p: -5, g: 0, l: 0 }} />
    );
    expect(container.textContent).not.toContain('NaN');
    uSummary();

    const corruptedEntry: MealEntryWithItems = {
      ...mockFoodEntry,
      total_kcal: undefined as unknown as number,
      total_p: 0,
      total_g: -10,
      total_l: null as unknown as number,
    };
    const { unmount: uMeal } = render(
      <MealCard mealCategory={{ key: 'breakfast', label: 'Petit-déjeuner' }} entries={[corruptedEntry]} onAddItemClick={vi.fn()} />
    );
    expect(screen.queryByText(/NaN/)).toBeNull();
    uMeal();

    expect(calculateFoodMacros(mockFood, 0)).toEqual({ kcal: 0, p: 0, g: 0, l: 0 });
    expect(calculateFoodMacros(mockFood, -50)).toEqual({ kcal: 0, p: 0, g: 0, l: 0 });
    expect(calculateKcalFromMacros(NaN, -10, Infinity)).toBe(0);
    expect(normalizeQuantityPerSingleServing(150, 0)).toBe(150);
    expect(normalizeQuantityPerSingleServing(150, -3)).toBe(150);
    expect(scaleQuantityByPortions(100, -2)).toBe(100);
    expect(sumMacroValues([{ kcal: 0, p: -5, g: 10, l: 0 }])).toEqual({ kcal: 0, p: -5, g: 10, l: 0 });
  });
});
