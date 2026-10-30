'use client';

import { useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, ChevronDown, ChevronUp, Dumbbell } from 'lucide-react';
import type { ExerciseRow } from '@/features/catalogs/services/exercises.service';
import type { MuscleGroup } from '@/types/domain.types';
import { MuscleFilterChips } from './MuscleFilterChips';

export interface ExerciseListProps {
  exercises: ExerciseRow[];
  selectedMuscle: MuscleGroup | null;
  onSelectMuscle: (muscle: MuscleGroup | null) => void;
  onEditExercise: (exercise: ExerciseRow) => void;
  onArchiveExercise: (exerciseId: string) => Promise<void>;
  onCreateExercise: () => void;
  loading?: boolean;
}

export function ExerciseList({
  exercises,
  selectedMuscle,
  onSelectMuscle,
  onEditExercise,
  onArchiveExercise,
  onCreateExercise,
  loading = false,
}: ExerciseListProps) {
  const [search, setSearch] = useState('');
  const [expandedGuideIds, setExpandedGuideIds] = useState<Record<string, boolean>>({});
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const toggleGuide = (id: string) => {
    setExpandedGuideIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredExercises = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exercises.filter((ex) => {
      const matchesSearch = !q || ex.name.toLowerCase().includes(q);
      const secondaryList = Array.isArray(ex.secondary_muscles)
        ? (ex.secondary_muscles as string[])
        : [];
      const matchesMuscle =
        !selectedMuscle ||
        ex.primary_muscle === selectedMuscle ||
        secondaryList.includes(selectedMuscle);
      return matchesSearch && matchesMuscle;
    });
  }, [exercises, search, selectedMuscle]);

  const handleArchive = async (id: string) => {
    setArchivingId(id);
    try {
      await onArchiveExercise(id);
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un exercice..."
            className="ios-input w-full min-h-[44px] pl-9 text-base placeholder:text-[#8E8E93]"
          />
        </div>
        <button
          type="button"
          onClick={onCreateExercise}
          aria-label="Ajouter un exercice"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#0A84FF] text-white active:scale-95 transition-transform"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <MuscleFilterChips
        selectedMuscle={selectedMuscle}
        onSelectMuscle={onSelectMuscle}
      />

      <div className="space-y-2.5 px-4">
        {loading ? (
          <div className="ios-card p-8 text-center text-sm text-[#8E8E93]">
            Chargement des exercices...
          </div>
        ) : filteredExercises.length === 0 ? (
          <div className="ios-card space-y-3 p-8 text-center">
            <Dumbbell className="mx-auto h-8 w-8 text-[#8E8E93]" />
            <p className="text-sm font-medium text-white">Aucun exercice trouvé</p>
            <p className="text-xs text-[#8E8E93]">
              {search || selectedMuscle
                ? 'Modifiez vos critères de recherche ou ajoutez un nouvel exercice.'
                : 'Commencez par ajouter votre premier exercice au catalogue.'}
            </p>
            <button
              type="button"
              onClick={onCreateExercise}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0A84FF] px-4 text-xs font-semibold text-white active:scale-95 transition-transform"
            >
              <Plus className="h-4 w-4" /> Nouvel exercice
            </button>
          </div>
        ) : (
          filteredExercises.map((exercise) => {
            const secondaries = Array.isArray(exercise.secondary_muscles)
              ? (exercise.secondary_muscles as string[])
              : [];
            const isGuideOpen = !!expandedGuideIds[exercise.id];

            return (
              <div key={exercise.id} className="ios-card space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white leading-tight break-words">
                      {exercise.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full border border-[#0A84FF]/30 bg-[#0A84FF]/15 px-2 py-0.5 text-[11px] font-medium text-[#0A84FF]">
                        {exercise.primary_muscle}
                      </span>
                      {secondaries.map((sec) => (
                        <span
                          key={sec}
                          className="rounded bg-[#2C2C2E] px-1.5 py-0.5 text-[10px] text-[#8E8E93]"
                        >
                          {sec}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => onEditExercise(exercise)} aria-label={`Modifier ${exercise.name}`} className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#8E8E93] hover:text-white active:scale-90 transition-transform">
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button type="button" disabled={archivingId === exercise.id} onClick={() => handleArchive(exercise.id)} aria-label={`Archiver ${exercise.name}`} className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#8E8E93] hover:text-[#FF453A] disabled:opacity-40 active:scale-90 transition-transform">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {exercise.setup_guide && (
                  <div className="border-t border-white/[0.06] pt-2">
                    <button type="button" onClick={() => toggleGuide(exercise.id)} className="flex min-h-[44px] w-full items-center justify-between text-xs text-[#8E8E93] hover:text-white">
                      <span>Consignes d&apos;exécution</span>
                      {isGuideOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </button>
                    {isGuideOpen && (
                      <p className="mt-1 whitespace-pre-line rounded-lg bg-[#2C2C2E]/60 p-2.5 text-xs text-[#E5E5EA] leading-relaxed">
                        {exercise.setup_guide}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
