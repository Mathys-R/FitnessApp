// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RecipeList } from '@/features/catalogs/components/RecipeList';
import { RecipeBuilderDrawer } from '@/features/catalogs/components/RecipeBuilderDrawer';
import {
  saveRecipeSingleServing,
  type RecipeWithIngredients,
} from '@/features/catalogs/services/nutrition.service';
import {
  mockRecipePorridge,
  mockFoodOats,
  mockFoodEgg,
  mockFoodBanana,
} from '../fixtures/catalogs.fixture';
import { toast } from 'sonner';

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));

vi.mock('@/features/catalogs/services/nutrition.service', () => ({
  saveRecipeSingleServing: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Catalog Recipes Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('RecipeList', () => {
    const recipes: RecipeWithIngredients[] = [mockRecipePorridge];

    it('affiche le plat, ses macros unitaires et le résumé des ingrédients', () => {
      render(
        <RecipeList
          recipes={recipes}
          onEditRecipe={vi.fn()}
          onArchiveRecipe={vi.fn()}
          onCreateRecipe={vi.fn()}
        />
      );

      expect(screen.getByText('Porridge Protéiné')).toBeDefined();
      expect(screen.getByText('2 ingrédients')).toBeDefined();
      expect(screen.getByText(/292\.5/)).toBeDefined();
      expect(screen.getByText(/Flocons d avoine complets \(50g\), Banane mûre \(1u\)/)).toBeDefined();
    });

    it('permet la recherche par ingrédient et déclenche les clics éditer / archiver', async () => {
      const onEdit = vi.fn();
      const onArchive = vi.fn().mockResolvedValue(undefined);

      render(
        <RecipeList
          recipes={recipes}
          onEditRecipe={onEdit}
          onArchiveRecipe={onArchive}
          onCreateRecipe={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Rechercher un plat/i);
      fireEvent.change(searchInput, { target: { value: 'Banane' } });
      expect(screen.getByText('Porridge Protéiné')).toBeDefined();

      fireEvent.click(screen.getByLabelText('Modifier Porridge Protéiné'));
      expect(onEdit).toHaveBeenCalledWith(mockRecipePorridge);

      fireEvent.click(screen.getByLabelText('Archiver Porridge Protéiné'));
      await waitFor(() => {
        expect(onArchive).toHaveBeenCalledWith(mockRecipePorridge.id);
      });
    });
  });

  describe('RecipeBuilderDrawer', () => {
    const availableFoods = [mockFoodEgg, mockFoodOats, mockFoodBanana];

    it('gère le diviseur Meal Prep et le switch d unité [g | u] pour un aliment both', () => {
      render(
        <RecipeBuilderDrawer
          open={true}
          onOpenChange={vi.fn()}
          availableFoods={availableFoods}
          onSaved={vi.fn()}
        />
      );

      const plusBtn = screen.getByRole('button', { name: '+' });
      const minusBtn = screen.getByRole('button', { name: '-' });

      fireEvent.click(plusBtn);
      expect(screen.getByText('2')).toBeDefined();

      fireEvent.click(minusBtn);
      expect(screen.getByText('1')).toBeDefined();

      const uBtn = screen.getByRole('button', { name: 'u' });
      const gBtn = screen.getByRole('button', { name: 'g' });
      expect(uBtn).toBeDefined();
      expect(gBtn).toBeDefined();

      fireEvent.click(uBtn);
      const qtyInput = screen.getByPlaceholderText('Qté');
      fireEvent.change(qtyInput, { target: { value: '2' } });

      expect(screen.getByText('140')).toBeDefined();
    });

    it('valide et enregistre un plat composé avec division Meal Prep', async () => {
      const onSaved = vi.fn();
      const onOpenChange = vi.fn();
      vi.mocked(saveRecipeSingleServing).mockResolvedValueOnce('rec-created-id');

      render(
        <RecipeBuilderDrawer
          open={true}
          onOpenChange={onOpenChange}
          availableFoods={availableFoods}
          onSaved={onSaved}
        />
      );

      fireEvent.change(screen.getByPlaceholderText(/Nom du plat/i), {
        target: { value: 'Omelette 2 Parts' },
      });

      fireEvent.click(screen.getByRole('button', { name: '+' }));

      const qtyInput = screen.getByPlaceholderText('Qté');
      fireEvent.change(qtyInput, { target: { value: '4' } });

      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer le plat' }));

      await waitFor(() => {
        expect(saveRecipeSingleServing).toHaveBeenCalledWith({
          id: undefined,
          name: 'Omelette 2 Parts',
          description: undefined,
          servingsPrepared: 2,
          ingredients: [
            {
              food_id: mockFoodEgg.id,
              raw_quantity: 4,
              logged_unit: 'g',
            },
          ],
        });
        expect(toast.success).toHaveBeenCalledWith('Plat enregistré');
        expect(onSaved).toHaveBeenCalledWith('rec-created-id');
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });
});
