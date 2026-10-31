// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddNutritionItemDrawer } from '@/features/nutrition/components/AddNutritionItemDrawer';
import { mockFoodOats, mockFoodEgg, mockRecipePorridge } from '../fixtures/catalogs.fixture';

describe('AddNutritionItemDrawer Component', () => {
  const onOpenChange = vi.fn();
  const onAddFood = vi.fn().mockResolvedValue(undefined);
  const onAddRecipe = vi.fn().mockResolvedValue(undefined);
  const onAddQuick = vi.fn().mockResolvedValue(undefined);

  const baseProps = {
    open: true,
    onOpenChange,
    mealType: 'breakfast' as const,
    mealLabel: 'Petit déjeuner',
    foods: [mockFoodOats, mockFoodEgg],
    recipes: [mockRecipePorridge],
    onAddFood,
    onAddRecipe,
    onAddQuick,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rend le tiroir avec le titre, la poignée et les 3 onglets', () => {
    render(<AddNutritionItemDrawer {...baseProps} />);

    expect(screen.getByText('Ajouter au Petit déjeuner')).toBeDefined();
    expect(document.querySelector('[data-vaul-handle]')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Aliments' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Mes Plats' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Quick Add' })).toBeDefined();
  });

  it('bascule correctement entre les 3 onglets', () => {
    render(<AddNutritionItemDrawer {...baseProps} />);

    expect(screen.getByPlaceholderText('Rechercher un aliment...')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Mes Plats' }));
    expect(screen.getByPlaceholderText('Rechercher une recette...')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Quick Add' }));
    expect(screen.getByRole('button', { name: "Valider l'ajout rapide" })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Aliments' }));
    expect(screen.getByPlaceholderText('Rechercher un aliment...')).toBeDefined();
  });

  it('filtre les aliments par marque et ajoute un aliment 100g en grammes', async () => {
    render(<AddNutritionItemDrawer {...baseProps} />);

    const searchInput = screen.getByPlaceholderText('Rechercher un aliment...');
    fireEvent.change(searchInput, { target: { value: 'Bio' } });
    expect(screen.getByText(mockFoodOats.name)).toBeDefined();
    expect(screen.queryByText(mockFoodEgg.name)).toBeNull();

    fireEvent.click(screen.getByText(mockFoodOats.name));
    expect(screen.getByText("Changer d'aliment")).toBeDefined();

    const qtyInput = screen.getByDisplayValue('100');
    fireEvent.change(qtyInput, { target: { value: '150' } });

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    await waitFor(() => {
      expect(onAddFood).toHaveBeenCalledTimes(1);
      expect(onAddFood).toHaveBeenCalledWith({
        food: mockFoodOats,
        quantity: 150,
        unit: 'g',
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('gère la bascule [g | u] pour un aliment de type both', async () => {
    render(<AddNutritionItemDrawer {...baseProps} />);

    fireEvent.click(screen.getByText(mockFoodEgg.name));

    const unitBtn = screen.getByRole('button', { name: 'Unité' });
    fireEvent.click(unitBtn);

    const qtyInput = screen.getByDisplayValue('1');
    fireEvent.change(qtyInput, { target: { value: '2' } });

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter' }));

    await waitFor(() => {
      expect(onAddFood).toHaveBeenCalledTimes(1);
      expect(onAddFood).toHaveBeenCalledWith({
        food: mockFoodEgg,
        quantity: 2,
        unit: 'unit',
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('sélectionne un plat, choisit une portion décimale et valide l ajout', async () => {
    render(<AddNutritionItemDrawer {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Mes Plats' }));
    fireEvent.click(screen.getByText(mockRecipePorridge.name));

    expect(screen.getByText('Changer de plat')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '1.5 part' }));
    expect(screen.getByDisplayValue('1.5')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Ajouter au repas' }));

    await waitFor(() => {
      expect(onAddRecipe).toHaveBeenCalledTimes(1);
      expect(onAddRecipe).toHaveBeenCalledWith({
        recipeId: mockRecipePorridge.id,
        portions: 1.5,
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('calcule automatiquement les kcal depuis P, G, L dans Quick Add et valide', async () => {
    render(<AddNutritionItemDrawer {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quick Add' }));

    const labelInput = screen.getByDisplayValue('Ajout rapide');
    fireEvent.change(labelInput, { target: { value: 'Collation amandes' } });

    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    const [kcalInput, pInput, gInput, lInput] = inputs;

    fireEvent.change(pInput, { target: { value: '10' } });
    fireEvent.change(gInput, { target: { value: '20' } });
    fireEvent.change(lInput, { target: { value: '5' } });

    // 10*4 + 20*4 + 5*9 = 40 + 80 + 45 = 165
    expect(kcalInput.value).toBe('165');

    fireEvent.click(screen.getByRole('button', { name: "Valider l'ajout rapide" }));

    await waitFor(() => {
      expect(onAddQuick).toHaveBeenCalledTimes(1);
      expect(onAddQuick).toHaveBeenCalledWith({
        label: 'Collation amandes',
        macros: { kcal: 165, p: 10, g: 20, l: 5 },
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('permet la saisie directe de calories dans Quick Add', async () => {
    render(<AddNutritionItemDrawer {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Quick Add' }));

    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    const [kcalInput] = inputs;
    fireEvent.change(kcalInput, { target: { value: '250' } });

    fireEvent.click(screen.getByRole('button', { name: "Valider l'ajout rapide" }));

    await waitFor(() => {
      expect(onAddQuick).toHaveBeenCalledTimes(1);
      expect(onAddQuick).toHaveBeenCalledWith({
        label: 'Ajout rapide',
        macros: { kcal: 250, p: 0, g: 0, l: 0 },
      });
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
