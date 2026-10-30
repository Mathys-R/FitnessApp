// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MuscleFilterChips } from '@/features/catalogs/components/MuscleFilterChips';
import { ExerciseList } from '@/features/catalogs/components/ExerciseList';
import { ExerciseFormDrawer } from '@/features/catalogs/components/ExerciseFormDrawer';
import {
  createOrUpdateExercise,
  type ExerciseRow,
} from '@/features/catalogs/services/exercises.service';
import { MUSCLE_GROUPS } from '@/types/domain.types';
import {
  mockExerciseBench,
  mockExerciseSquat,
  mockExercisePullup,
} from '../fixtures/catalogs.fixture';
import { toast } from 'sonner';

vi.mock('@/features/catalogs/services/exercises.service', () => ({
  createOrUpdateExercise: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Catalog Exercises Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('MuscleFilterChips', () => {
    it('affiche Tous et les 10 groupes musculaires, et déclenche onSelectMuscle', () => {
      const onSelectMuscle = vi.fn();
      render(<MuscleFilterChips selectedMuscle={null} onSelectMuscle={onSelectMuscle} />);

      expect(screen.getByRole('button', { name: 'Tous' })).toBeDefined();
      MUSCLE_GROUPS.forEach((muscle) => {
        expect(screen.getByRole('button', { name: muscle })).toBeDefined();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Dos' }));
      expect(onSelectMuscle).toHaveBeenCalledWith('Dos');

      fireEvent.click(screen.getByRole('button', { name: 'Tous' }));
      expect(onSelectMuscle).toHaveBeenCalledWith(null);
    });
  });

  describe('ExerciseList', () => {
    const exercises: ExerciseRow[] = [mockExerciseBench, mockExerciseSquat, mockExercisePullup];

    it('filtre les exercices par texte de recherche', () => {
      render(
        <ExerciseList
          exercises={exercises}
          selectedMuscle={null}
          onSelectMuscle={vi.fn()}
          onEditExercise={vi.fn()}
          onArchiveExercise={vi.fn()}
          onCreateExercise={vi.fn()}
        />
      );

      expect(screen.getByText('Développé couché barre')).toBeDefined();
      expect(screen.getByText('Squat barre nuque')).toBeDefined();

      const searchInput = screen.getByPlaceholderText('Rechercher un exercice...');
      fireEvent.change(searchInput, { target: { value: 'squat' } });

      expect(screen.queryByText('Développé couché barre')).toBeNull();
      expect(screen.getByText('Squat barre nuque')).toBeDefined();
    });

    it('permet de déplier le guide d exécution et appelle onEdit / onArchive', async () => {
      const onEdit = vi.fn();
      const onArchive = vi.fn().mockResolvedValue(undefined);

      render(
        <ExerciseList
          exercises={[mockExerciseBench]}
          selectedMuscle={null}
          onSelectMuscle={vi.fn()}
          onEditExercise={onEdit}
          onArchiveExercise={onArchive}
          onCreateExercise={vi.fn()}
        />
      );

      const guideToggle = screen.getByText("Consignes d'exécution");
      fireEvent.click(guideToggle);
      expect(screen.getByText(mockExerciseBench.setup_guide!)).toBeDefined();

      fireEvent.click(screen.getByLabelText(`Modifier ${mockExerciseBench.name}`));
      expect(onEdit).toHaveBeenCalledWith(mockExerciseBench);

      fireEvent.click(screen.getByLabelText(`Archiver ${mockExerciseBench.name}`));
      await waitFor(() => {
        expect(onArchive).toHaveBeenCalledWith(mockExerciseBench.id);
      });
    });
  });

  describe('ExerciseFormDrawer', () => {
    it('valide le nom obligatoire et refuse la soumission vide', async () => {
      render(<ExerciseFormDrawer open={true} onOpenChange={vi.fn()} onSaved={vi.fn()} />);

      const submitBtn = screen.getByRole('button', { name: 'Enregistrer' });
      fireEvent.click(submitBtn);

      expect(toast.error).toHaveBeenCalledWith("Veuillez renseigner le nom de l'exercice");
      expect(createOrUpdateExercise).not.toHaveBeenCalled();
    });

    it('limite les muscles secondaires à 3 et soumet avec succès', async () => {
      const onSaved = vi.fn();
      const onOpenChange = vi.fn();
      const savedRow: ExerciseRow = { ...mockExerciseBench, id: 'ex-new' };
      vi.mocked(createOrUpdateExercise).mockResolvedValueOnce(savedRow);

      render(
        <ExerciseFormDrawer
          open={true}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      );

      fireEvent.change(screen.getByPlaceholderText(/Développé couché/i), {
        target: { value: 'Dips lestés' },
      });

      fireEvent.click(screen.getByRole('button', { name: 'Triceps' }));
      fireEvent.click(screen.getByRole('button', { name: 'Épaules' }));
      fireEvent.click(screen.getByRole('button', { name: 'Dos' }));
      expect(screen.getByText('3/3')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Biceps' }));
      expect(toast.info).toHaveBeenCalledWith('Maximum 3 muscles secondaires');

      fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

      await waitFor(() => {
        expect(createOrUpdateExercise).toHaveBeenCalledWith({
          id: undefined,
          name: 'Dips lestés',
          primary_muscle: 'Pecs',
          secondary_muscles: ['Triceps', 'Épaules', 'Dos'],
          setup_guide: null,
          is_archived: false,
        });
        expect(toast.success).toHaveBeenCalledWith('Exercice créé');
        expect(onSaved).toHaveBeenCalledWith(savedRow);
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });
});
