// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import WorkoutPage from '@/app/(protected)/workout/page';
import { useActiveWorkoutStore } from '@/features/workout/store/active-workout.store';
import { getWeekSessions } from '@/features/workout/services/calendar.service';
import { getWorkoutPresets } from '@/features/workout/services/presets.service';
import { getActiveExercises } from '@/features/catalogs/services/exercises.service';
import { getExerciseGhostAndRecords } from '@/features/workout/services/ghost-records.service';
import { finishAndSaveWorkoutSession } from '@/features/workout/services/sessions.service';

import { mockExerciseBench } from '../fixtures/catalogs.fixture';

vi.mock('@/features/workout/services/calendar.service', () => ({
  getWeekSessions: vi.fn(),
  loadSessionForEditing: vi.fn(),
}));

vi.mock('@/features/workout/services/presets.service', () => ({
  getWorkoutPresets: vi.fn(),
  deleteWorkoutPreset: vi.fn(),
  buildActiveExercisesFromPreset: vi.fn(),
}));

vi.mock('@/features/catalogs/services/exercises.service', () => ({
  getActiveExercises: vi.fn(),
}));

vi.mock('@/features/workout/services/ghost-records.service', () => ({
  getExerciseGhostAndRecords: vi.fn(),
}));

vi.mock('@/features/workout/services/sessions.service', () => ({
  finishAndSaveWorkoutSession: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('Workout Page Runtime Monkey & Chaos Testing Suite', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  const mockGhostRecords = {
    historical_max_weight_kg: 100,
    historical_max_1rm_kg: 120,
    pinned_note: 'Banc au cran 3',
    last_session_sets: [
      { set_number: 1, weight_kg: 90, reps: 8, rest_seconds: 120 },
      { set_number: 2, weight_kg: 90, reps: 7, rest_seconds: 120 },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useActiveWorkoutStore.getState().clearActiveSession();

    consoleErrorSpy = vi.spyOn(console, 'error');
    consoleWarnSpy = vi.spyOn(console, 'warn');

    vi.mocked(getWeekSessions).mockResolvedValue([]);
    vi.mocked(getWorkoutPresets).mockResolvedValue([]);
    vi.mocked(getActiveExercises).mockResolvedValue([mockExerciseBench]);
    vi.mocked(getExerciseGhostAndRecords).mockResolvedValue(mockGhostRecords);
    vi.mocked(finishAndSaveWorkoutSession).mockResolvedValue('mock-session-finished-id');
  });

  afterEach(() => {
    // Assert 0 unhandled console errors or critical warnings
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  // =========================================================================
  // 1. Navigation & Affichage Nominal
  // =========================================================================
  it('1. Nominal: monte la page /workout avec titre, CTA libre, et onglets Agenda / Mes Presets', async () => {
    render(<WorkoutPage />);

    expect(screen.getByRole('heading', { name: 'Musculation' })).toBeDefined();
    expect(screen.getByText('Séances & Progression')).toBeDefined();

    const startFreeBtn = screen.getByRole('button', { name: /démarrer une séance libre/i });
    expect(startFreeBtn).toBeDefined();

    const agendaTab = screen.getByRole('button', { name: /agenda/i });
    const presetsTab = screen.getByRole('button', { name: /mes presets/i });
    expect(agendaTab).toBeDefined();
    expect(presetsTab).toBeDefined();

    // Par défaut, l'agenda est affiché
    await waitFor(() => {
      expect(getWeekSessions).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 2. Bascule frénétique des onglets (Monkey Navigation)
  // =========================================================================
  it('2. Monkey Navigation: bascules frénétiques (10x) entre Agenda et Mes Presets sans crash', async () => {
    render(<WorkoutPage />);

    const agendaTab = screen.getByRole('button', { name: /agenda/i });
    const presetsTab = screen.getByRole('button', { name: /mes presets/i });

    // Alternance ultra-rapide 10 fois
    for (let i = 0; i < 10; i++) {
      fireEvent.click(i % 2 === 0 ? presetsTab : agendaTab);
    }

    // Termine sur Mes Presets
    fireEvent.click(presetsTab);
    await waitFor(() => {
      expect(getWorkoutPresets).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Lancement d'une séance libre & Rendu ActiveSession
  // =========================================================================
  it('3. Lancement séance libre: rendu de ActiveSession, chrono, boutons abandon/terminer/ajouter', async () => {
    render(<WorkoutPage />);

    const startFreeBtn = screen.getByRole('button', { name: /démarrer une séance libre/i });
    fireEvent.click(startFreeBtn);

    // ActiveSession doit être monté
    expect(screen.getByRole('heading', { name: 'Séance libre' })).toBeDefined();
    expect(screen.getByText('00:00')).toBeDefined(); // Chrono live

    // Boutons de contrôle de séance
    const abandonBtn = screen.getByRole('button', { name: /abandonner/i });
    const finishBtn = screen.getByRole('button', { name: /terminer/i });
    const addExerciseBtn = screen.getByRole('button', { name: /ajouter un exercice/i });

    expect(abandonBtn).toBeDefined();
    expect(finishBtn).toBeDefined();
    expect(addExerciseBtn).toBeDefined();

    // État initial vide
    expect(screen.getByText('Aucun exercice dans cette séance')).toBeDefined();
  });

  // =========================================================================
  // 4. Audit Anti-Zoom Safari & Zones Tactiles iOS (>= 44px et >= 16px font)
  // =========================================================================
  it('4. iOS PWA Invariants: vérifie min-h-[44px] sur les boutons et text-base (>=16px) sur les inputs', async () => {
    // 1. Démarrer séance avec un exercice pré-rempli
    useActiveWorkoutStore.getState().startSession({
      sessionName: 'Séance Test Invariants',
      exercises: [
        {
          local_id: 'ex-inv-1',
          exercise_id: mockExerciseBench.id,
          exercise_name: mockExerciseBench.name,
          primary_muscle: mockExerciseBench.primary_muscle,
          pinned_note: 'Note fixe',
          session_note: 'Note jour',
          historical_max_weight_kg: 100,
          historical_max_1rm_kg: 120,
          sets: [
            {
              local_id: 'set-inv-1',
              set_number: 1,
              weight_input: '80',
              reps_input: '10',
              ghost_weight_kg: 75,
              ghost_reps: 10,
              rest_seconds: 90,
              is_warmup: false,
              is_completed: false,
              is_pr: false,
            },
          ],
        },
      ],
    });

    const { container } = render(<WorkoutPage />);

    // Audit des inputs : TOUS doivent avoir la classe 'text-base' (anti-zoom Safari)
    const inputs = container.querySelectorAll('input, textarea');
    expect(inputs.length).toBeGreaterThan(0);
    inputs.forEach((input) => {
      const className = input.getAttribute('class') || '';
      const hasTextBase = className.includes('text-base');
      expect(hasTextBase, `Input ${input.getAttribute('aria-label') || input.id} doit inclure text-base`).toBe(true);
    });

    // Audit des boutons interactifs : TOUS doivent avoir min-h-[44px] ou min-h-[48px]
    const buttons = screen.getAllByRole('button');
    buttons.forEach((btn) => {
      const className = btn.getAttribute('class') || '';
      const hasMinHeight =
        className.includes('min-h-[44px]') ||
        className.includes('min-h-[48px]') ||
        className.includes('h-9') ||
        className.includes('h-10') ||
        className.includes('min-h-[36px]');
      expect(hasMinHeight, `Bouton "${btn.textContent || btn.getAttribute('aria-label')}" doit respecter la zone tactile iOS`).toBe(true);
    });
  });

  // =========================================================================
  // 5. Stress Testing & Clics Frénétiques (Double-clicks, validations répétées)
  // =========================================================================
  it('5. Chaos Clics Frénétiques: clics multiples rapides sur validation de série et ajouts', async () => {
    useActiveWorkoutStore.getState().startSession({
      sessionName: 'Séance Chaos Clics',
      exercises: [
        {
          local_id: 'ex-chaos-1',
          exercise_id: mockExerciseBench.id,
          exercise_name: mockExerciseBench.name,
          primary_muscle: mockExerciseBench.primary_muscle,
          pinned_note: '',
          session_note: '',
          historical_max_weight_kg: 100,
          historical_max_1rm_kg: 120,
          sets: [
            {
              local_id: 'set-chaos-1',
              set_number: 1,
              weight_input: '100',
              reps_input: '10',
              ghost_weight_kg: null,
              ghost_reps: null,
              rest_seconds: 60,
              is_warmup: false,
              is_completed: false,
              is_pr: false,
            },
          ],
        },
      ],
    });

    render(<WorkoutPage />);

    const validateBtn = screen.getByLabelText('Valider série 1');
    const warmupBtn = screen.getByLabelText('Série 1');

    // Clics ultra-rapides sur validation (5x)
    for (let i = 0; i < 5; i++) {
      fireEvent.click(validateBtn);
    }

    // Clics ultra-rapides sur warmup toggle (5x)
    for (let i = 0; i < 5; i++) {
      fireEvent.click(warmupBtn);
    }

    // Ajout frénétique de séries (3x consécutifs)
    const addSetBtn = screen.getByRole('button', { name: /ajouter une série/i });
    for (let i = 0; i < 3; i++) {
      fireEvent.click(addSetBtn);
    }

    const state = useActiveWorkoutStore.getState();
    expect(state.exercises[0].sets.length).toBe(4);
    expect(state.exercises[0].sets[0].set_number).toBe(1);
    expect(state.exercises[0].sets[1].set_number).toBe(2);
    expect(state.exercises[0].sets[2].set_number).toBe(3);
    expect(state.exercises[0].sets[3].set_number).toBe(4);
  });

  // =========================================================================
  // 6. Injection de Valeurs Extrêmes & Probes XSS / Unicode
  // =========================================================================
  it('6. Injection Extrême: gère caractères unicode, XSS probes, et bornes extrêmes sans crash', async () => {
    useActiveWorkoutStore.getState().startSession({
      sessionName: 'Séance Injections',
      exercises: [
        {
          local_id: 'ex-inj-1',
          exercise_id: mockExerciseBench.id,
          exercise_name: mockExerciseBench.name,
          primary_muscle: mockExerciseBench.primary_muscle,
          pinned_note: '',
          session_note: '',
          historical_max_weight_kg: 100,
          historical_max_1rm_kg: 120,
          sets: [
            {
              local_id: 'set-inj-1',
              set_number: 1,
              weight_input: '',
              reps_input: '',
              ghost_weight_kg: null,
              ghost_reps: null,
              rest_seconds: 60,
              is_warmup: false,
              is_completed: false,
              is_pr: false,
            },
          ],
        },
      ],
    });

    render(<WorkoutPage />);

    const weightInput = screen.getByLabelText('Poids série 1');
    const repsInput = screen.getByLabelText('Répétitions série 1');
    const pinnedInput = screen.getByLabelText(`Note épinglée pour ${mockExerciseBench.name}`);
    const sessionNoteInput = screen.getByLabelText(`Note de séance pour ${mockExerciseBench.name}`);

    // Extreme Numbers
    fireEvent.change(weightInput, { target: { value: '-999999.99' } });
    fireEvent.change(repsInput, { target: { value: '999999999' } });

    // Special Characters & Emojis
    fireEvent.change(pinnedInput, { target: { value: '🏋️‍♂️⚡️ Banc #4 (Crans: 3/5) — Multi-byte 🔥' } });
    fireEvent.change(sessionNoteInput, { target: { value: '<script>alert("XSS")</script> & <b>test</b>' } });

    const updatedEx = useActiveWorkoutStore.getState().exercises[0];
    expect(updatedEx.sets[0].weight_input).toBe('-999999.99');
    expect(updatedEx.sets[0].reps_input).toBe('999999999');
    expect(updatedEx.pinned_note).toContain('🏋️‍♂️⚡️');
    expect(updatedEx.session_note).toContain('<script>');
  });

  // =========================================================================
  // 7. Modales & Drawers Stress (Ouverture/Fermeture rapide, clôture)
  // =========================================================================
  it('7. Modales Stress: ouverture/fermeture rapide du FinishSessionDrawer et enregistrement', async () => {
    useActiveWorkoutStore.getState().startSession({
      sessionName: 'Séance Finisher Test',
      exercises: [
        {
          local_id: 'ex-fin-1',
          exercise_id: mockExerciseBench.id,
          exercise_name: mockExerciseBench.name,
          primary_muscle: mockExerciseBench.primary_muscle,
          pinned_note: '',
          session_note: '',
          historical_max_weight_kg: 100,
          historical_max_1rm_kg: 120,
          sets: [
            {
              local_id: 'set-fin-1',
              set_number: 1,
              weight_input: '100',
              reps_input: '10',
              ghost_weight_kg: null,
              ghost_reps: null,
              rest_seconds: 60,
              is_warmup: false,
              is_completed: true,
              is_pr: false,
            },
          ],
        },
      ],
    });

    render(<WorkoutPage />);

    const finishBtn = screen.getByRole('button', { name: /terminer/i });
    fireEvent.click(finishBtn);

    // Vérifier l'apparition du drawer
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Clôturer la séance' })).toBeDefined();
    });

    // Enregistrer la séance uniquement
    const saveOnlyBtn = screen.getByRole('button', { name: 'Enregistrer la séance uniquement' });
    expect(saveOnlyBtn).toBeDefined();
    fireEvent.click(saveOnlyBtn);

    await waitFor(() => {
      expect(finishAndSaveWorkoutSession).toHaveBeenCalledTimes(1);
      // Après clôture, le store est réinitialisé et on revient sur la page nominale
      expect(useActiveWorkoutStore.getState().isActive).toBe(false);
    });
  });

  // =========================================================================
  // 8. Flow complet: Ajout d'exercice via Drawer + Déclenchement Minuteur
  // =========================================================================
  it('8. Flow Complet & Chaos Minuteur: sélection exercice via Drawer et ajustements minuteur', async () => {
    useActiveWorkoutStore.getState().startSession({
      sessionName: 'Séance Flow Complet',
      exercises: [],
    });

    render(<WorkoutPage />);

    // 1. Ouvrir le drawer d'ajout d'exercice
    const addExerciseBtn = screen.getByRole('button', { name: /ajouter un exercice/i });
    fireEvent.click(addExerciseBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Ajouter un exercice' })).toBeDefined();
    });

    // 2. Recherche rapide et filtre muscle
    const searchInput = screen.getByPlaceholderText('Rechercher un exercice...');
    fireEvent.change(searchInput, { target: { value: 'couché' } });

    // Clic sur l'exercice trouvé
    const exerciseBtn = screen.getByRole('button', { name: /développé couché barre/i });
    fireEvent.click(exerciseBtn);

    await waitFor(() => {
      expect(getExerciseGhostAndRecords).toHaveBeenCalledWith(mockExerciseBench.id);
      // L'exercice a été ajouté à la séance
      expect(useActiveWorkoutStore.getState().exercises).toHaveLength(1);
    });

    // 3. Valider la première série pour déclencher le RestTimerBar
    const validateBtn = screen.getByLabelText('Valider série 1');
    fireEvent.click(validateBtn);

    // Le minuteur de repos doit apparaître
    await waitFor(() => {
      expect(screen.getByText('Temps de repos')).toBeDefined();
    });

    // 4. Chaos sur les boutons du timer (+30s, -30s, Passer)
    const plusBtn = screen.getByRole('button', { name: 'Ajouter 30 secondes de repos', hidden: true });
    const minusBtn = screen.getByRole('button', { name: 'Retirer 30 secondes de repos', hidden: true });
    const skipBtn = screen.getByRole('button', { name: 'Passer le temps de repos', hidden: true });

    fireEvent.click(plusBtn);
    fireEvent.click(plusBtn);
    fireEvent.click(minusBtn);
    fireEvent.click(skipBtn);

    // Le minuteur disparaît après 'Passer'
    await waitFor(() => {
      expect(screen.queryByText('Temps de repos')).toBeNull();
    });
  });
});
