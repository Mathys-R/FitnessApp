'use client';

import { MUSCLE_GROUPS, type MuscleGroup } from '@/types/domain.types';

export interface MuscleFilterChipsProps {
  selectedMuscle: MuscleGroup | null;
  onSelectMuscle: (muscle: MuscleGroup | null) => void;
}

export function MuscleFilterChips({
  selectedMuscle,
  onSelectMuscle,
}: MuscleFilterChipsProps) {
  return (
    <div
      role="group"
      aria-label="Filtre par groupe musculaire"
      className="flex items-center gap-2 overflow-x-auto px-4 py-1.5 no-scrollbar"
    >
      <button
        type="button"
        onClick={() => onSelectMuscle(null)}
        className={`min-h-[44px] whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
          selectedMuscle === null
            ? 'bg-[#0A84FF] text-white'
            : 'border border-white/[0.08] bg-[#1C1C1E] text-[#8E8E93] hover:text-white'
        }`}
      >
        Tous
      </button>
      {MUSCLE_GROUPS.map((muscle) => {
        const isSelected = selectedMuscle === muscle;
        return (
          <button
            key={muscle}
            type="button"
            onClick={() => onSelectMuscle(muscle)}
            className={`min-h-[44px] whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold transition-colors ${
              isSelected
                ? 'bg-[#0A84FF] text-white'
                : 'border border-white/[0.08] bg-[#1C1C1E] text-[#8E8E93] hover:text-white'
            }`}
          >
            {muscle}
          </button>
        );
      })}
    </div>
  );
}

