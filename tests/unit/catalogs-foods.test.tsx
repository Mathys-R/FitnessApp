// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FoodList } from '@/features/catalogs/components/FoodList';
import { FoodFormDrawer } from '@/features/catalogs/components/FoodFormDrawer';
import {
  createOrUpdateFood,
  type FoodRow,
} from '@/features/catalogs/services/nutrition.service';
import {
  mockFoodOats,
  mockFoodEgg,
  mockFoodApple,
} from '../fixtures/catalogs.fixture';
import { toast } from 'sonner';

vi.mock('@/features/catalogs/services/nutrition.service', () => ({
  createOrUpdateFood: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Catalog Foods Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('FoodList', () => {
    const foods: FoodRow[] = [mockFoodOats, mockFoodEgg, mockFoodApple];

    it('affiche les badges de mesure et les 4 macros par aliment', () => {
      render(
        <FoodList
          foods={foods}
          onEditFood={vi.fn()}
          onArchiveFood={vi.fn()}
          onCreateFood={vi.fn()}
        />
      );

      expect(screen.getByText('Pour 100g')).toBeDefined();
      expect(screen.getByText('100g & Unité (50g)')).toBeDefined();
      expect(screen.getByText('Par Unité')).toBeDefined();
      expect(screen.getByText('375 kcal')).toBeDefined();
      expect(screen.getByText('P: 13.5g')).toBeDefined();
      expect(screen.getByText('G: 62g')).toBeDefined();
      expect(screen.getByText('L: 7g')).toBeDefined();
    });

    it('filtre par nom ou marque et supporte les clics éditer et archiver', async () => {
      const onEdit = vi.fn();
      const onArchive = vi.fn().mockResolvedValue(undefined);

      render(
        <FoodList
          foods={foods}
          onEditFood={onEdit}
          onArchiveFood={onArchive}
          onCreateFood={vi.fn()}
        />
      );

      const searchInput = screen.getByPlaceholderText(/Rechercher un aliment/i);
      fireEvent.change(searchInput, { target: { value: 'Pink Lady' } });
      expect(screen.getByText('Pomme Pink Lady')).toBeDefined();
      expect(screen.queryByText('Flocons d avoine complets')).toBeNull();

      fireEvent.click(screen.getByLabelText('Modifier Pomme Pink Lady'));
      expect(onEdit).toHaveBeenCalledWith(mockFoodApple);

      fireEvent.click(screen.getByLabelText('Archiver Pomme Pink Lady'));
      await waitFor(() => {
        expect(onArchive).toHaveBeenCalledWith(mockFoodApple.id);
      });
    });
  });

  describe('FoodFormDrawer', () => {
    it('conditionne le champ unit_weight_g selon le mode serving_type', () => {
      render(<FoodFormDrawer open={true} onOpenChange={vi.fn()} onSaved={vi.fn()} />);

      expect(screen.queryByLabelText(/Poids moyen d'1 unité/i)).toBeNull();

      fireEvent.click(screen.getByRole('button', { name: '100g & Unité' }));
      expect(screen.getByLabelText(/Poids moyen d'1 unité/i)).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Par unité' }));
      expect(screen.queryByLabelText(/Poids moyen d'1 unité/i)).toBeNull();
    });

    it('calcule automatiquement les kcal via 4-4-9 avec virgules décimales', () => {
      render(<FoodFormDrawer open={true} onOpenChange={vi.fn()} onSaved={vi.fn()} />);

      const pInput = screen.getByLabelText(/Protéines/i) as HTMLInputElement;
      const gInput = screen.getByLabelText(/Glucides/i) as HTMLInputElement;
      const lInput = screen.getByLabelText(/Lipides/i) as HTMLInputElement;
      const kcalInput = screen.getByLabelText(/Calories/i) as HTMLInputElement;

      fireEvent.change(pInput, { target: { value: '10,5' } });
      fireEvent.change(gInput, { target: { value: '20,0' } });
      fireEvent.change(lInput, { target: { value: '5,0' } });

      fireEvent.click(screen.getByRole('button', { name: /Calculer kcal/i }));

      expect(kcalInput.value).toBe('167');
      expect(toast.info).toHaveBeenCalledWith('Calories calculées : 167 kcal');
    });

    it('valide et enregistre un aliment avec succès', async () => {
      const onSaved = vi.fn();
      const onOpenChange = vi.fn();
      const savedRow: FoodRow = { ...mockFoodEgg, id: 'food-new' };
      vi.mocked(createOrUpdateFood).mockResolvedValueOnce(savedRow);

      render(
        <FoodFormDrawer
          open={true}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      );

      fireEvent.change(screen.getByPlaceholderText(/Nom de l'aliment/i), {
        target: { value: 'Fromage Blanc 0%' },
      });
      fireEvent.change(screen.getByPlaceholderText(/Marque/i), {
        target: { value: 'Bio Village' },
      });

      fireEvent.click(screen.getByRole('button', { name: '100g & Unité' }));
      fireEvent.change(screen.getByLabelText(/Poids moyen d'1 unité/i), {
        target: { value: '100' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() => {
        expect(createOrUpdateFood).toHaveBeenCalledWith({
          id: undefined,
          name: 'Fromage Blanc 0%',
          brand: 'Bio Village',
          serving_type: 'both',
          unit_weight_g: 100,
          kcal_per_base: 0,
          proteins_per_base: 0,
          carbs_per_base: 0,
          fats_per_base: 0,
          is_archived: false,
        });
        expect(toast.success).toHaveBeenCalledWith('Aliment créé');
        expect(onSaved).toHaveBeenCalledWith(savedRow);
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });
});
