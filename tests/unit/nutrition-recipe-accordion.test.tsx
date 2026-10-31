// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecipeSubmenuAccordion } from '@/features/nutrition/components/RecipeSubmenuAccordion';
import type { MealEntryWithItems, MealEntryItemRow } from '@/features/nutrition/services/entries.service';

vi.mock('motion/react', () => ({
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      className,
      style,
    }: {
      children?: React.ReactNode;
      className?: string;
      style?: React.CSSProperties;
    } & Record<string, unknown>) => (
      <div className={className} style={style}>
        {children}
      </div>
    ),
  },
}));

const mockItem1: MealEntryItemRow = {
  id: 'item-1',
  meal_entry_id: 'entry-1',
  user_id: 'user-1',
  food_id: 'food-1',
  ingredient_name: 'Pâtes',
  serving_type: '100g',
  unit_weight_g: 100,
  logged_unit: 'g',
  kcal_per_base: 350,
  p_per_base: 12,
  g_per_base: 70,
  l_per_base: 2,
  quantity_value: 100,
  kcal: 350,
  p: 12,
  g: 70,
  l: 2,
};

const mockItem2: MealEntryItemRow = {
  id: 'item-2',
  meal_entry_id: 'entry-1',
  user_id: 'user-1',
  food_id: 'food-2',
  ingredient_name: 'Poulet',
  serving_type: '100g',
  unit_weight_g: 100,
  logged_unit: 'unit',
  kcal_per_base: 165,
  p_per_base: 31,
  g_per_base: 0,
  l_per_base: 3.6,
  quantity_value: 2,
  kcal: 330,
  p: 62,
  g: 0,
  l: 7.2,
};

const mockEntry: MealEntryWithItems = {
  id: 'entry-1',
  daily_log_id: 'log-1',
  user_id: 'user-1',
  meal_type: 'lunch',
  entry_type: 'recipe',
  label: 'Plat Poulet & Pâtes',
  food_id: null,
  recipe_id: 'recipe-1',
  quantity_value: 1,
  logged_unit: 'unit',
  total_kcal: 680,
  total_p: 74,
  total_g: 70,
  total_l: 9.2,
  created_at: '2026-10-30T12:00:00Z',
  meal_entry_items: [mockItem1, mockItem2],
};

describe('RecipeSubmenuAccordion Component', () => {
  it('déplie et replie au clic sur l en-tête', () => {
    render(<RecipeSubmenuAccordion entry={mockEntry} />);

    expect(screen.queryByText(/Ajustements au gramme près/i)).toBeNull();

    const header = screen.getByRole('button', { name: /Plat Poulet & Pâtes/i });
    fireEvent.click(header);
    expect(screen.getByText(/Ajustements au gramme près/i)).toBeDefined();

    fireEvent.click(header);
    expect(screen.queryByText(/Ajustements au gramme près/i)).toBeNull();
  });

  it('affiche les sous-ingrédients et leurs macros lors du dépliage', () => {
    render(<RecipeSubmenuAccordion entry={mockEntry} />);

    fireEvent.click(screen.getByRole('button', { name: /Plat Poulet & Pâtes/i }));

    expect(screen.getByText('Pâtes')).toBeDefined();
    expect(screen.getByText('350 kcal | 12P 70G 2L')).toBeDefined();
    expect(screen.getByText('100 g')).toBeDefined();

    expect(screen.getByText('Poulet')).toBeDefined();
    expect(screen.getByText('330 kcal | 62P 0G 7.2L')).toBeDefined();
    expect(screen.getByText('2 u')).toBeDefined();
  });

  it('modifie la quantité inline et parse la virgule décimale', async () => {
    const handleUpdateQuantity = vi.fn().mockResolvedValue(undefined);
    render(<RecipeSubmenuAccordion entry={mockEntry} onUpdateIngredientQuantity={handleUpdateQuantity} />);

    fireEvent.click(screen.getByRole('button', { name: /Plat Poulet & Pâtes/i }));

    const qtyButton = screen.getByText('100 g');
    fireEvent.click(qtyButton);

    const input = screen.getByDisplayValue('100');
    fireEvent.change(input, { target: { value: '12,5' } });

    const checkButton = screen.getByRole('button', { name: 'Valider la quantité' });
    fireEvent.click(checkButton);

    expect(handleUpdateQuantity).toHaveBeenCalledTimes(1);
    expect(handleUpdateQuantity).toHaveBeenCalledWith(mockItem1, 12.5);
    await waitFor(() => {
      expect(screen.queryByDisplayValue('12,5')).toBeNull();
    });
  });

  it('supprime un ingrédient au clic sur sa poubelle', () => {
    const handleDeleteIngredient = vi.fn();
    render(<RecipeSubmenuAccordion entry={mockEntry} onDeleteIngredient={handleDeleteIngredient} />);

    fireEvent.click(screen.getByRole('button', { name: /Plat Poulet & Pâtes/i }));

    const deleteButtons = screen.getAllByRole('button', { name: "Supprimer l'ingrédient" });
    expect(deleteButtons.length).toBe(2);

    fireEvent.click(deleteButtons[0]);
    expect(handleDeleteIngredient).toHaveBeenCalledTimes(1);
    expect(handleDeleteIngredient).toHaveBeenCalledWith('item-1');
  });

  it('supprime le plat et stoppe la propagation vers l accordéon', () => {
    const handleDeleteRecipe = vi.fn();
    render(<RecipeSubmenuAccordion entry={mockEntry} onDeleteRecipeEntry={handleDeleteRecipe} />);

    const deleteMealBtn = screen.getByRole('button', { name: 'Supprimer le plat' });
    fireEvent.click(deleteMealBtn);

    expect(handleDeleteRecipe).toHaveBeenCalledTimes(1);
    expect(handleDeleteRecipe).toHaveBeenCalledWith('entry-1');
    expect(screen.queryByText(/Ajustements au gramme près/i)).toBeNull();
  });
});
