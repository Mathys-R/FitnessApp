'use client';

import { useState, useEffect, useMemo } from 'react';
import { Drawer } from 'vaul';
import { Search, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getActiveExercises, type ExerciseRow } from '@/features/catalogs/services/exercises.service';
import { getExerciseGhostAndRecords } from '@/features/workout/services/ghost-records.service';
import { MuscleFilterChips } from '@/features/catalogs/components/MuscleFilterChips';
import type { MuscleGroup } from '@/types/domain.types';
import type { ActiveWorkoutExercise, ActiveWorkoutSet } from '../types/workout-store.types';

export interface ExercisePickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectExercise: (exercise: ActiveWorkoutExercise) => void;
}

export function ExercisePickerDrawer({ open, onOpenChange, onSelectExercise }: ExercisePickerDrawerProps) {
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [search, setSearch] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectingId, setSelectingId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getActiveExercises()
      .then((data) => setExercises(data))
      .catch(() => toast.error('Erreur chargement des exercices'))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter((ex) => {
      const matchSearch = !q || ex.name.toLowerCase().includes(q);
      const matchMuscle = !selectedMuscle || ex.primary_muscle === selectedMuscle;
      return matchSearch && matchMuscle;
    });
  }, [exercises, search, selectedMuscle]);

  const handleSelect = async (exercise: ExerciseRow) => {
    setSelectingId(exercise.id);
    try {
      const ghost = await getExerciseGhostAndRecords(exercise.id);
      const sets: ActiveWorkoutSet[] = Array.from({ length: 3 }, (_, idx) => {
        const s = ghost.last_session_sets[idx] ?? ghost.last_session_sets.at(-1);
        return {
          local_id: crypto.randomUUID(),
          set_number: idx + 1,
          weight_input: '',
          reps_input: '',
          ghost_weight_kg: s?.weight_kg ?? null,
          ghost_reps: s?.reps ?? null,
          rest_seconds: s?.rest_seconds ?? 120,
          is_warmup: false,
          is_completed: false,
          is_pr: false,
        };
      });

      onSelectExercise({
        local_id: crypto.randomUUID(),
        exercise_id: exercise.id,
        exercise_name: exercise.name,
        primary_muscle: exercise.primary_muscle,
        pinned_note: ghost.pinned_note,
        session_note: '',
        historical_max_weight_kg: ghost.historical_max_weight_kg,
        historical_max_1rm_kg: ghost.historical_max_1rm_kg,
        sets,
      });
      onOpenChange(false);
    } catch {
      toast.error("Erreur lors de l'ajout de l'exercice");
    } finally {
      setSelectingId(null);
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 flex max-h-[88vh] flex-col rounded-t-[20px] border-t border-[#38383A] bg-[#1C1C1E] focus:outline-none">
          <Drawer.Handle className="mx-auto my-3 bg-[#38383A]" />
          <Drawer.Title className="px-4 text-center text-lg font-semibold text-white">Ajouter un exercice</Drawer.Title>
          <Drawer.Description className="sr-only">Sélectionnez un exercice pour la séance en cours</Drawer.Description>
          <div className="space-y-2 p-4 pb-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un exercice..."
                className="ios-input min-h-[44px] w-full pl-9 text-base"
              />
            </div>
            <MuscleFilterChips selectedMuscle={selectedMuscle} onSelectMuscle={setSelectedMuscle} />
          </div>
          <div className="flex-1 overflow-y-auto px-4 pb-8">
            {loading ? (
              <div className="flex h-32 items-center justify-center text-[#8E8E93]">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-[#8E8E93]">Aucun exercice trouvé</p>
            ) : (
              <div className="divide-y divide-white/[0.06]">
                {filtered.map((ex) => (
                  <button
                    key={ex.id}
                    type="button"
                    disabled={selectingId === ex.id}
                    onClick={() => handleSelect(ex)}
                    className="flex min-h-[48px] w-full items-center justify-between py-3 text-left transition-colors active:bg-[#2C2C2E]"
                  >
                    <div>
                      <p className="text-base font-medium text-white">{ex.name}</p>
                      <p className="text-xs text-[#8E8E93]">{ex.primary_muscle}</p>
                    </div>
                    {selectingId === ex.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[#0A84FF]" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#8E8E93]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
