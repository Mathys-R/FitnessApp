// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExerciseFormDrawer } from '@/features/catalogs/components/ExerciseFormDrawer';
import { FoodFormDrawer } from '@/features/catalogs/components/FoodFormDrawer';
import { RecipeBuilderDrawer } from '@/features/catalogs/components/RecipeBuilderDrawer';
import { createOrUpdateExercise, type ExerciseRow } from '@/features/catalogs/services/exercises.service';
import { createOrUpdateFood, saveRecipeSingleServing, type FoodRow } from '@/features/catalogs/services/nutrition.service';
import { normalizeQuantityPerSingleServing } from '@/lib/math/nutrition.math';
import { mockFoodEgg, mockFoodOats, mockExerciseBench } from '../fixtures/catalogs.fixture';
import { toast } from 'sonner';

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));
vi.mock('@/features/catalogs/services/exercises.service', () => ({ createOrUpdateExercise: vi.fn() }));
vi.mock('@/features/catalogs/services/nutrition.service', () => ({
  createOrUpdateFood: vi.fn(),
  saveRecipeSingleServing: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

describe('Catalog Chaos & Monkey Testing Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clics frénétiques & soumissions rapides : protection contre doubles appels', async () => {
    let resolveEx: (val: ExerciseRow) => void = () => { };
    vi.mocked(createOrUpdateExercise).mockReturnValue(new Promise((r) => { resolveEx = r; }));

    const { unmount } = render(
      <ExerciseFormDrawer open={true} onOpenChange={vi.fn()} onSaved={vi.fn()} />
    );

    fireEvent.change(screen.getByLabelText(/Nom de l'exercice/i), {
      target: { value: 'Dips lestés' },
    });
    const exSubmitBtn = screen.getByRole('button', { name: /^enregistrer$/i });

    fireEvent.click(exSubmitBtn);
    fireEvent.click(exSubmitBtn);
    fireEvent.click(exSubmitBtn);

    expect(createOrUpdateExercise).toHaveBeenCalledTimes(1);
    expect(exSubmitBtn.getAttribute('disabled')).toBeDefined();
    resolveEx(mockExerciseBench);
    unmount();
  });

  it('double soumission concurrente sur FoodForm et RecipeBuilder', async () => {
    let resolveFood: (val: FoodRow) => void = () => { };
    vi.mocked(createOrUpdateFood).mockReturnValue(new Promise((r) => { resolveFood = r; }));

    const { unmount: unmountFood } = render(
      <FoodFormDrawer open={true} onOpenChange={vi.fn()} onSaved={vi.fn()} />
    );
    fireEvent.change(screen.getByPlaceholderText(/Nom de l'aliment/i), {
      target: { value: 'Skyr Vanille' },
    });
    const foodSubmitBtn = screen.getByRole('button', { name: /^enregistrer$/i });
    fireEvent.click(foodSubmitBtn);
    fireEvent.click(foodSubmitBtn);
    expect(createOrUpdateFood).toHaveBeenCalledTimes(1);
    resolveFood(mockFoodEgg);
    unmountFood();

    let resolveRecipe: (val: string) => void = () => { };
    vi.mocked(saveRecipeSingleServing).mockReturnValue(new Promise((r) => { resolveRecipe = r; }));

    const { unmount: unmountRecipe } = render(
      <RecipeBuilderDrawer
        open={true}
        onOpenChange={vi.fn()}
        availableFoods={[mockFoodEgg]}
        onSaved={vi.fn()}
      />
    );
    fireEvent.change(screen.getByPlaceholderText(/Nom du plat/i), {
      target: { value: 'Bowl Chaos' },
    });
    fireEvent.change(screen.getByPlaceholderText('Qté'), {
      target: { value: '150' },
    });
    const recipeSubmitBtn = screen.getByRole('button', { name: /enregistrer le plat/i });
    fireEvent.click(recipeSubmitBtn);
    fireEvent.click(recipeSubmitBtn);
    expect(saveRecipeSingleServing).toHaveBeenCalledTimes(1);
    resolveRecipe('rec-chaos-id');
    unmountRecipe();
  });

  it('injection de payloads extrêmes (0, négatif, NaN, espaces) rejetés sans crash', () => {
    render(
      <RecipeBuilderDrawer
        open={true}
        onOpenChange={vi.fn()}
        availableFoods={[mockFoodEgg]}
        onSaved={vi.fn()}
      />
    );

    fireEvent.change(screen.getByPlaceholderText(/Nom du plat/i), {
      target: { value: 'Recette Test' },
    });

    const qtyInput = screen.getByPlaceholderText('Qté');
    const submitBtn = screen.getByRole('button', { name: /enregistrer le plat/i });
    const extremePayloads = ['0', '-50', '   ', 'abc', 'NaN', '0.0000', '-0.01'];

    for (const val of extremePayloads) {
      fireEvent.change(qtyInput, { target: { value: val } });
      fireEvent.click(submitBtn);

      expect(toast.error).toHaveBeenCalledWith('Ajoutez au moins 1 ingrédient avec une quantité > 0');
      expect(saveRecipeSingleServing).not.toHaveBeenCalled();
      vi.clearAllMocks();
    }
  });

  it('résilience calcul Atwater avec macros négatives, nulles et virgules françaises', () => {
    render(<FoodFormDrawer open={true} onOpenChange={vi.fn()} onSaved={vi.fn()} />);

    const pInput = screen.getByLabelText(/Protéines/i);
    const gInput = screen.getByLabelText(/Glucides/i);
    const lInput = screen.getByLabelText(/Lipides/i);
    const kcalBtn = screen.getByRole('button', { name: /calculer kcal/i });

    fireEvent.change(pInput, { target: { value: '-20' } });
    fireEvent.change(gInput, { target: { value: 'NaN' } });
    fireEvent.change(lInput, { target: { value: '-5' } });
    fireEvent.click(kcalBtn);

    expect(toast.info).toHaveBeenCalledWith('Calories calculées : 0 kcal');
    expect((screen.getByLabelText(/Calories/i) as HTMLInputElement).value).toBe('0');

    fireEvent.change(pInput, { target: { value: '12,5' } });
    fireEvent.change(gInput, { target: { value: '0,25' } });
    fireEvent.change(lInput, { target: { value: '3,5' } });
    fireEvent.click(kcalBtn);

    expect(toast.info).toHaveBeenCalledWith('Calories calculées : 83 kcal');
    expect((screen.getByLabelText(/Calories/i) as HTMLInputElement).value).toBe('83');
  });

  it('stress diviseur Meal Prep : division par 0, négatifs et grand volume (99 parts)', () => {
    expect(normalizeQuantityPerSingleServing(200, 0)).toBe(200);
    expect(normalizeQuantityPerSingleServing(200, -5)).toBe(200);
    expect(normalizeQuantityPerSingleServing(198, 99)).toBe(2);

    render(
      <RecipeBuilderDrawer
        open={true}
        onOpenChange={vi.fn()}
        availableFoods={[mockFoodOats]}
        onSaved={vi.fn()}
      />
    );

    const minusBtn = screen.getByRole('button', { name: '-' });
    const plusBtn = screen.getByRole('button', { name: '+' });

    for (let i = 0; i < 5; i++) fireEvent.click(minusBtn);
    expect(screen.getByText('1')).toBeDefined();

    for (let i = 0; i < 98; i++) fireEvent.click(plusBtn);
    expect(screen.getByText('99')).toBeDefined();
  });

  it('limitation stricte des muscles secondaires à 3 sans crash UI', () => {
    render(<ExerciseFormDrawer open={true} onOpenChange={vi.fn()} onSaved={vi.fn()} />);

    const muscles = ['Dos', 'Épaules', 'Triceps', 'Biceps'];
    muscles.forEach((muscle) => {
      fireEvent.click(screen.getByRole('button', { name: muscle }));
    });

    expect(toast.info).toHaveBeenCalledWith('Maximum 3 muscles secondaires');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
