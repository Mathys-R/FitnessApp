// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import NutritionPage from '@/app/(protected)/nutrition/page';
import { getLocalTodayIso, shiftDateIso, formatShortFrenchDate } from '@/lib/date.utils';
import { getDailyNutrition, copyMealFromSource } from '@/features/nutrition/services/entries.service';
import { toggleExcludeFromTdee } from '@/features/daily-log/services/log.service';

const today = getLocalTodayIso();
const mockDailyLog = {
  id: 'log-01', user_id: 'user-01', log_date: today, weight_kg: 80, weight_ema_kg: 80,
  steps_count: 5000, target_kcal: 2200, target_p: 160, target_g: 220, target_l: 70,
  exclude_from_tdee: false, notes: null, created_at: `${today}T06:00:00Z`, updated_at: `${today}T06:00:00Z`,
};

const mockEntries = [{
  id: 'entry-1', daily_log_id: 'log-01', user_id: 'user-01', meal_type: 'breakfast' as const,
  entry_type: 'food' as const, label: 'Flocons d avoine', food_id: 'food-1', recipe_id: null,
  quantity_value: 80, logged_unit: 'g' as const, total_kcal: 296, total_p: 10.8, total_g: 47, total_l: 5.6,
  created_at: `${today}T07:00:00Z`, updated_at: `${today}T07:00:00Z`, food: null, meal_entry_items: [],
}];

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock('@/features/nutrition/services/entries.service', () => ({
  getDailyNutrition: vi.fn().mockImplementation((date: string) => Promise.resolve({
    dailyLog: { ...mockDailyLog, log_date: date }, entries: mockEntries,
  })),
  addFoodMealEntry: vi.fn().mockResolvedValue(undefined),
  updateFoodMealEntryQuantity: vi.fn().mockResolvedValue(undefined),
  addQuickMealEntry: vi.fn().mockResolvedValue(undefined),
  deleteMealEntry: vi.fn().mockResolvedValue(undefined),
  getPartnerInfo: vi.fn().mockResolvedValue({ partner_id: 'partner-99', partner_name: 'Camille' }),
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

describe('NutritionPage - Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('1. Rendu initial : en-tête, sous-titre date courte, résumé macros et 5 cartes ordonnées', async () => {
    render(<NutritionPage />);

    await waitFor(() => {
      expect(screen.getByText('Nutrition')).toBeDefined();
      expect(screen.getByText(formatShortFrenchDate(today))).toBeDefined();
      expect(screen.getByText('Calories')).toBeDefined();
      expect(screen.getByText('Protéines')).toBeDefined();
      expect(screen.getByText('Glucides')).toBeDefined();
      expect(screen.getByText('Lipides')).toBeDefined();
    });

    const headings = screen.getAllByRole('heading', { level: 3 });
    const titles = headings.map((h) => h.textContent);
    expect(titles).toEqual(['Petit-déjeuner', 'Déjeuner', 'Dîner', 'Collation', 'Pré / Post-Workout']);
  });

  it('2. Navigation par date : chevrons précédent / suivant et badge retour Aujourd hui', async () => {
    render(<NutritionPage />);

    await waitFor(() => {
      expect(screen.getByLabelText('Jour précédent')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Jour précédent'));
    const yesterday = shiftDateIso(today, -1);
    await waitFor(() => {
      expect(getDailyNutrition).toHaveBeenCalledWith(yesterday);
      expect(screen.getByRole('button', { name: "Aujourd'hui" })).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: "Aujourd'hui" }));
    await waitFor(() => {
      expect(getDailyNutrition).toHaveBeenCalledWith(today);
      expect(screen.queryByRole('button', { name: "Aujourd'hui" })).toBeNull();
    });

    fireEvent.click(screen.getByLabelText('Jour suivant'));
    const tomorrow = shiftDateIso(today, 1);
    await waitFor(() => {
      expect(getDailyNutrition).toHaveBeenCalledWith(tomorrow);
    });
  });

  it('3. Flux interactifs : ouverture du tiroir AddNutritionItemDrawer via bouton +', async () => {
    render(<NutritionPage />);

    await waitFor(() => {
      expect(screen.getAllByLabelText('Ajouter un aliment')).toHaveLength(5);
    });

    fireEvent.click(screen.getAllByLabelText('Ajouter un aliment')[0]);
    await waitFor(() => {
      expect(screen.getByText('Ajouter au Petit-déjeuner')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Aliments' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Mes Plats' })).toBeDefined();
      expect(screen.getByRole('button', { name: 'Quick Add' })).toBeDefined();
    });
  });

  it('4. Flux interactifs : interaction avec interrupteur TDEE', async () => {
    render(<NutritionPage />);

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Journée atypique (exclure du TDEE)' })).toBeDefined();
    });

    const tdeeSwitch = screen.getByRole('switch', { name: 'Journée atypique (exclure du TDEE)' });
    fireEvent.click(tdeeSwitch);
    await waitFor(() => {
      expect(toggleExcludeFromTdee).toHaveBeenCalledWith('log-01', true);
    });
  });

  it('5. Flux interactifs : copie de repas depuis hier ou depuis le partenaire', async () => {
    render(<NutritionPage />);

    await waitFor(() => {
      expect(screen.getAllByLabelText("Menu d'actions du repas")).toHaveLength(5);
    });

    const menuButtons = screen.getAllByLabelText("Menu d'actions du repas");

    // Copie repas hier
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText("Copier mon repas d'hier"));
    await waitFor(() => {
      expect(copyMealFromSource).toHaveBeenCalledWith({
        sourceUserId: 'user-01', sourceDate: shiftDateIso(today, -1),
        sourceMealType: 'breakfast', targetDailyLogId: 'log-01', targetMealType: 'breakfast',
      });
    });

    // Copie repas partenaire
    fireEvent.click(menuButtons[0]);
    fireEvent.click(screen.getByText('Importer le repas de Camille'));
    await waitFor(() => {
      expect(copyMealFromSource).toHaveBeenCalledWith({
        sourceUserId: 'partner-99', sourceDate: today,
        sourceMealType: 'breakfast', targetDailyLogId: 'log-01', targetMealType: 'breakfast',
      });
    });
  });
});
