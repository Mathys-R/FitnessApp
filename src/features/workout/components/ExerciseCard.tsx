'use client';

import { Plus, Trash2 } from 'lucide-react';
import { PushPin, NotePencil } from '@phosphor-icons/react';
import { useActiveWorkoutStore } from '../store/active-workout.store';
import type { ActiveWorkoutExercise } from '../types/workout-store.types';
import { SetRow } from './SetRow';

export interface ExerciseCardProps {
  exercise: ActiveWorkoutExercise;
  onTimerStart?: (seconds: number) => void;
}

export function ExerciseCard({ exercise, onTimerStart }: ExerciseCardProps) {
  const updateExerciseNotes = useActiveWorkoutStore((s) => s.updateExerciseNotes);
  const removeExerciseFromSession = useActiveWorkoutStore(
    (s) => s.removeExerciseFromSession
  );
  const addSetToExercise = useActiveWorkoutStore((s) => s.addSetToExercise);

  return (
    <div className="ios-card space-y-3.5 rounded-2xl border border-[#38383A] bg-[#1C1C1E] p-4 shadow-sm">
      {/* 1. En-tête : Titre, Muscle, Supprimer */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-white">
              {exercise.exercise_name}
            </h3>
            <span className="shrink-0 rounded-md bg-[#2C2C2E] px-2 py-0.5 text-[11px] font-medium text-[#8E8E93]">
              {exercise.primary_muscle}
            </span>
          </div>
          {exercise.historical_max_weight_kg > 0 && (
            <p className="mt-0.5 text-xs text-[#8E8E93] tabular-nums">
              Record : {exercise.historical_max_weight_kg} kg
              {exercise.historical_max_1rm_kg > 0 &&
                ` • 1RM estimé : ${exercise.historical_max_1rm_kg} kg`}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => removeExerciseFromSession(exercise.local_id)}
          aria-label={`Supprimer l'exercice ${exercise.exercise_name}`}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#8E8E93] transition-colors hover:bg-[#2C2C2E] hover:text-[#FF453A]"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      {/* 2. Zone Double Note */}
      <div className="space-y-2">
        {/* Note permanente épinglée */}
        <div className="flex items-center gap-2 rounded-xl border border-[#FF9F0A]/20 bg-[#FF9F0A]/5 px-3 py-1.5 focus-within:border-[#FF9F0A]/50">
          <PushPin className="h-4 w-4 shrink-0 text-[#FF9F0A]" weight="fill" />
          <input
            type="text"
            value={exercise.pinned_note}
            onChange={(e) =>
              updateExerciseNotes(exercise.local_id, 'pinned_note', e.target.value)
            }
            placeholder="Réglage machine / note permanente — vider pour effacer"
            aria-label={`Note épinglée pour ${exercise.exercise_name}`}
            className="w-full bg-transparent text-base text-[#FF9F0A] placeholder-[#8E8E93]/60 focus:outline-none"
          />
        </div>

        {/* Note contextuelle de séance */}
        <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-[#2C2C2E]/50 px-3 py-1.5 focus-within:border-[#0A84FF]/50">
          <NotePencil className="h-4 w-4 shrink-0 text-[#8E8E93]" weight="bold" />
          <input
            type="text"
            value={exercise.session_note}
            onChange={(e) =>
              updateExerciseNotes(exercise.local_id, 'session_note', e.target.value)
            }
            placeholder="Ressenti du jour uniquement..."
            aria-label={`Note de séance pour ${exercise.exercise_name}`}
            className="w-full bg-transparent text-base text-white placeholder-[#8E8E93]/60 focus:outline-none"
          />
        </div>
      </div>

      {/* 3. Tableau des séries */}
      <div className="space-y-1">
        <div className="grid grid-cols-[38px_1fr_64px_56px_44px_32px] items-center gap-1.5 text-center text-[11px] font-semibold tracking-wider text-[#8E8E93] uppercase">
          <span>Série</span>
          <span>Précédent</span>
          <span>Kg</span>
          <span>Reps</span>
          <span>Valider</span>
          <span />
        </div>

        <div className="space-y-1">
          {exercise.sets.map((set) => (
            <SetRow
              key={set.local_id}
              exerciseLocalId={exercise.local_id}
              set={set}
              onTimerStart={onTimerStart}
            />
          ))}
        </div>
      </div>

      {/* 4. Bouton Ajouter une série */}
      <button
        type="button"
        onClick={() => addSetToExercise(exercise.local_id)}
        className="flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl bg-[#2C2C2E] text-sm font-semibold text-white transition-colors hover:bg-[#38383A] active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" />
        Ajouter une série
      </button>
    </div>
  );
}
