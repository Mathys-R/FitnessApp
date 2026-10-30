// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CatalogsPage from '@/app/(protected)/catalogs/page';
import {
  getActiveExercises,
  archiveExercise,
} from '@/features/catalogs/services/exercises.service';
import {
  getActiveFoods,
  getActiveRecipes,
} from '@/features/catalogs/services/nutrition.service';
import {
  mockExerciseBench,
  mockFoodOats,
  mockRecipePorridge,
} from '../fixtures/catalogs.fixture';
import { toast } from 'sonner';

vi.mock('@number-flow/react', () => ({
  default: ({ value }: { value: number }) => <span>{value}</span>,
}));

vi.mock('@/features/catalogs/services/exercises.service', () => ({
  getActiveExercises: vi.fn(),
  archiveExercise: vi.fn(),
  createOrUpdateExercise: vi.fn(),
}));

vi.mock('@/features/catalogs/services/nutrition.service', () => ({
  getActiveFoods: vi.fn(),
  getActiveRecipes: vi.fn(),
  archiveFood: vi.fn(),
  archiveRecipe: vi.fn(),
  createOrUpdateFood: vi.fn(),
  saveRecipeSingleServing: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('CatalogsPage (Couche 3 UI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getActiveExercises).mockResolvedValue([mockExerciseBench]);
    vi.mocked(getActiveFoods).mockResolvedValue([mockFoodOats]);
    vi.mocked(getActiveRecipes).mockResolvedValue([mockRecipePorridge]);
  });

  it('charge les 3 catalogues au montage et affiche les exercices par défaut', async () => {
    render(<CatalogsPage />);

    await waitFor(() => {
      expect(getActiveExercises).toHaveBeenCalledTimes(1);
      expect(getActiveFoods).toHaveBeenCalledTimes(1);
      expect(getActiveRecipes).toHaveBeenCalledTimes(1);
      expect(screen.getByText('Développé couché barre')).toBeDefined();
    });
  });

  it('permet de naviguer entre les onglets Aliments et Mes Plats', async () => {
    render(<CatalogsPage />);

    await waitFor(() => {
      expect(screen.getByText('Développé couché barre')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aliments' }));
    expect(screen.getByText('Flocons d avoine complets')).toBeDefined();
    expect(screen.queryByText('Développé couché barre')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Mes Plats' }));
    expect(screen.getByText('Porridge Protéiné')).toBeDefined();
    expect(screen.queryByText('Flocons d avoine complets')).toBeNull();
  });

  it('ouvre le Drawer exercice au clic sur ajouter un exercice', async () => {
    render(<CatalogsPage />);
    await waitFor(() => {
      expect(screen.getByText('Développé couché barre')).toBeDefined();
    });

    fireEvent.click(screen.getByLabelText('Ajouter un exercice'));
    expect(screen.getByRole('heading', { name: 'Nouvel exercice' })).toBeDefined();
  });

  it('ouvre le Drawer aliment au clic sur ajouter un aliment', async () => {
    render(<CatalogsPage />);
    await waitFor(() => {
      expect(screen.getByText('Développé couché barre')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aliments' }));
    fireEvent.click(screen.getByLabelText('Ajouter un aliment'));
    expect(screen.getByRole('heading', { name: 'Nouvel aliment' })).toBeDefined();
  });

  it('ouvre le Drawer plat au clic sur créer un plat', async () => {
    render(<CatalogsPage />);
    await waitFor(() => {
      expect(screen.getByText('Développé couché barre')).toBeDefined();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Mes Plats' }));
    fireEvent.click(screen.getByLabelText('Créer un plat'));
    expect(screen.getByRole('heading', { name: 'Composer un plat' })).toBeDefined();
  });

  it('archive un exercice et affiche le toast de confirmation', async () => {
    vi.mocked(archiveExercise).mockResolvedValueOnce(undefined);
    render(<CatalogsPage />);

    await waitFor(() => {
      expect(screen.getByText('Développé couché barre')).toBeDefined();
    });

    const archiveBtn = screen.getByLabelText(`Archiver ${mockExerciseBench.name}`);
    fireEvent.click(archiveBtn);

    await waitFor(() => {
      expect(archiveExercise).toHaveBeenCalledWith(mockExerciseBench.id);
      expect(toast.success).toHaveBeenCalledWith('Exercice archivé');
      expect(screen.queryByText('Développé couché barre')).toBeNull();
    });
  });
});
