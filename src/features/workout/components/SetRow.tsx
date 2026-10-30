'use client';

import { Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveWorkoutStore } from '../store/active-workout.store';
import type { ActiveWorkoutSet } from '../types/workout-store.types';

export interface SetRowProps {
  exerciseLocalId: string;
  set: ActiveWorkoutSet;
  onTimerStart?: (seconds: number) => void;
}

export function SetRow({ exerciseLocalId, set, onTimerStart }: SetRowProps) {
  const updateSetField = useActiveWorkoutStore((s) => s.updateSetField);
  const toggleCompleteSetWithGhostFallback = useActiveWorkoutStore(
    (s) => s.toggleCompleteSetWithGhostFallback
  );
  const removeSetFromExercise = useActiveWorkoutStore((s) => s.removeSetFromExercise);

  const handleToggleComplete = () => {
    if (!set.is_completed) {
      const effectiveWeight =
        set.weight_input.trim() ||
        (set.ghost_weight_kg !== null ? String(set.ghost_weight_kg) : '');
      const effectiveReps =
        set.reps_input.trim() ||
        (set.ghost_reps !== null ? String(set.ghost_reps) : '');

      if (!effectiveWeight || !effectiveReps) {
        toast.error('Renseignez charge et répétitions');
        return;
      }

      const { becamePr } = toggleCompleteSetWithGhostFallback(exerciseLocalId, set.local_id);
      if (becamePr) {
        toast.success('🎉 Nouveau Record Personnel !');
      }
      onTimerStart?.(set.rest_seconds || 120);
    } else {
      toggleCompleteSetWithGhostFallback(exerciseLocalId, set.local_id);
    }
  };

  const ghostText =
    set.ghost_weight_kg !== null && set.ghost_reps !== null
      ? `${set.ghost_weight_kg}kg × ${set.ghost_reps}`
      : '—';

  return (
    <div className="grid grid-cols-[38px_1fr_64px_56px_44px_32px] items-center gap-1.5 py-1">
      <button
        type="button"
        onClick={() =>
          updateSetField(exerciseLocalId, set.local_id, 'is_warmup', !set.is_warmup)
        }
        aria-label={
          set.is_warmup
            ? `Série ${set.set_number} (Échauffement)`
            : `Série ${set.set_number}`
        }
        className={`flex min-h-[44px] min-w-[36px] items-center justify-center rounded-lg text-xs font-bold transition-colors ${
          set.is_warmup
            ? 'border border-[#FF9F0A]/40 bg-[#FF9F0A]/20 text-[#FF9F0A]'
            : 'text-[#8E8E93] hover:text-white'
        }`}
      >
        {set.is_warmup ? 'W' : set.set_number}
      </button>

      <div className="overflow-hidden text-ellipsis whitespace-nowrap text-center text-xs text-[#8E8E93] tabular-nums">
        {ghostText}
      </div>

      <input
        type="text"
        inputMode="decimal"
        value={set.weight_input}
        onChange={(e) =>
          updateSetField(exerciseLocalId, set.local_id, 'weight_input', e.target.value)
        }
        placeholder={set.ghost_weight_kg !== null ? String(set.ghost_weight_kg) : '—'}
        aria-label={`Poids série ${set.set_number}`}
        className="ios-input min-h-[44px] w-full px-1 text-center text-base font-medium tabular-nums"
      />

      <input
        type="text"
        inputMode="numeric"
        value={set.reps_input}
        onChange={(e) =>
          updateSetField(exerciseLocalId, set.local_id, 'reps_input', e.target.value)
        }
        placeholder={set.ghost_reps !== null ? String(set.ghost_reps) : '—'}
        aria-label={`Répétitions série ${set.set_number}`}
        className="ios-input min-h-[44px] w-full px-1 text-center text-base font-medium tabular-nums"
      />

      <button
        type="button"
        onClick={handleToggleComplete}
        aria-label={`Valider série ${set.set_number}`}
        className={`relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl transition-all active:scale-95 ${
          set.is_completed
            ? 'bg-[#30D158] font-semibold text-black'
            : 'bg-[#2C2C2E] text-[#8E8E93] hover:text-white'
        }`}
      >
        <Check className="h-5 w-5 stroke-[2.5]" />
        {set.is_completed && set.is_pr && (
          <span
            title="Record Personnel"
            className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#FFD60A] text-[9px] font-black text-black shadow"
          >
            ★
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => removeSetFromExercise(exerciseLocalId, set.local_id)}
        aria-label={`Supprimer série ${set.set_number}`}
        className="flex min-h-[44px] min-w-[32px] items-center justify-center text-[#8E8E93] transition-colors hover:text-[#FF453A]"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}
