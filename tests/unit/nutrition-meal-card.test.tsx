// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MealCard } from '@/features/nutrition/components/MealCard';
import type { MealEntryWithItems, FoodRow } from '@/features/nutrition/services/entries.service';

vi.mock('@/features/nutrition/components/RecipeSubmenuAccordion', () => ({
  RecipeSubmenuAccordion: ({ entry }: { entry: MealEntryWithItems }) => (
    <div data-testid="recipe-accordion">{entry.label}</div>
  ),
}));

const mockFood: FoodRow = {
  id: 'food-1',
  name: "Flocons d'avoine",
  brand: null,
  barcode: null,
  serving_type: '100g',
  unit_weight_g: 100,
  kcal_per_base: 370,
  proteins_per_base: 13,
  carbs_per_base: 60,
  fats_per_base: 7,
  is_archived: false,
  created_by: 'user-1',
  created_at: '2026-10-30T10:00:00Z',
};

const baseEntry = {
  daily_log_id: 'log-1',
  user_id: 'user-1',
  meal_type: 'breakfast' as const,
  created_at: '2026-10-30T08:00:00Z',
  meal_entry_items: [],
};

const foodEntry: MealEntryWithItems = {
  ...baseEntry,
  id: 'entry-food-1',
  entry_type: 'food',
  label: "Flocons d'avoine",
  food_id: 'food-1',
  recipe_id: null,
  quantity_value: 50,
  logged_unit: 'g',
  total_kcal: 185,
  total_p: 7,
  total_g: 30,
  total_l: 4,
  food: mockFood,
};

const quickAddEntry: MealEntryWithItems = {
  ...baseEntry,
  id: 'entry-quick-1',
  entry_type: 'quick_add',
  label: 'Collation Rapide',
  food_id: null,
  recipe_id: null,
  quantity_value: 1,
  logged_unit: 'unit',
  total_kcal: 250,
  total_p: 20,
  total_g: 15,
  total_l: 10,
  food: null,
};

const recipeEntry: MealEntryWithItems = {
  ...baseEntry,
  id: 'entry-recipe-1',
  entry_type: 'recipe',
  label: 'Bowl Cake Chocolat',
  food_id: null,
  recipe_id: 'recipe-1',
  quantity_value: 1,
  logged_unit: 'unit',
  total_kcal: 400,
  total_p: 25,
  total_g: 45,
  total_l: 12,
  food: null,
};

const category = { key: 'breakfast' as const, label: 'Petit-déjeuner' };

describe('MealCard Component', () => {
  it('calcule et affiche la somme exacte des calories avec tabular-nums', () => {
    render(<MealCard mealCategory={category} entries={[foodEntry, quickAddEntry, recipeEntry]} onAddItemClick={vi.fn()} />);
    const caloriesElement = screen.getByText('835 kcal');
    expect(caloriesElement).toBeDefined();
    expect(caloriesElement.className).toContain('tabular-nums');
  });

  it('affiche le libellé et l état vide si aucune entrée', () => {
    render(<MealCard mealCategory={category} entries={[]} onAddItemClick={vi.fn()} />);
    expect(screen.getByText('Petit-déjeuner')).toBeDefined();
    expect(screen.getByText('Aucun aliment enregistré')).toBeDefined();
    expect(screen.getByText('0 kcal')).toBeDefined();
  });

  it('appelle onAddItemClick avec la catégorie lors du clic sur le bouton +', () => {
    const handleAdd = vi.fn();
    render(<MealCard mealCategory={category} entries={[]} onAddItemClick={handleAdd} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter un aliment' }));
    expect(handleAdd).toHaveBeenCalledTimes(1);
    expect(handleAdd).toHaveBeenCalledWith('breakfast');
  });

  it('ouvre le menu rapide et déclenche onCopyYesterday et onCopyPartner', () => {
    const handleCopyYesterday = vi.fn();
    const handleCopyPartner = vi.fn();
    render(
      <MealCard
        mealCategory={category}
        entries={[]}
        partnerName="Camille"
        onAddItemClick={vi.fn()}
        onCopyYesterday={handleCopyYesterday}
        onCopyPartner={handleCopyPartner}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: "Menu d'actions du repas" }));
    fireEvent.click(screen.getByRole('button', { name: "Copier mon repas d'hier" }));
    expect(handleCopyYesterday).toHaveBeenCalledWith('breakfast');

    fireEvent.click(screen.getByRole('button', { name: "Menu d'actions du repas" }));
    fireEvent.click(screen.getByRole('button', { name: 'Importer le repas de Camille' }));
    expect(handleCopyPartner).toHaveBeenCalledWith('breakfast');
  });

  it('gère les entrées de type food (affichage, édition inline, suppression)', async () => {
    const handleUpdateQuantity = vi.fn().mockResolvedValue(undefined);
    const handleDelete = vi.fn();
    render(
      <MealCard
        mealCategory={category}
        entries={[foodEntry]}
        onAddItemClick={vi.fn()}
        onUpdateFoodQuantity={handleUpdateQuantity}
        onDeleteEntry={handleDelete}
      />
    );
    expect(screen.getByText("Flocons d'avoine")).toBeDefined();
    expect(screen.getByText('185 kcal • 7P 30G 4L')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: "Modifier la quantité de Flocons d'avoine" }));
    const input = screen.getByDisplayValue('50');
    fireEvent.change(input, { target: { value: '75,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Valider la quantité' }));

    await waitFor(() => {
      expect(handleUpdateQuantity).toHaveBeenCalledWith('entry-food-1', mockFood, 75.5, 'g');
    });

    fireEvent.click(screen.getByRole('button', { name: "Supprimer Flocons d'avoine" }));
    expect(handleDelete).toHaveBeenCalledWith('entry-food-1');
  });

  it('gère les entrées de type quick_add (affichage macros et suppression)', () => {
    const handleDelete = vi.fn();
    render(<MealCard mealCategory={category} entries={[quickAddEntry]} onAddItemClick={vi.fn()} onDeleteEntry={handleDelete} />);
    expect(screen.getByText('Collation Rapide')).toBeDefined();
    expect(screen.getByText('250 kcal • 20P 15G 10L')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Supprimer Collation Rapide' }));
    expect(handleDelete).toHaveBeenCalledWith('entry-quick-1');
  });

  it('rend RecipeSubmenuAccordion pour les entrées de type recipe', () => {
    render(<MealCard mealCategory={category} entries={[recipeEntry]} onAddItemClick={vi.fn()} />);
    const accordion = screen.getByTestId('recipe-accordion');
    expect(accordion).toBeDefined();
    expect(accordion.textContent).toBe('Bowl Cake Chocolat');
  });
});
