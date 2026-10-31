'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { shiftDateIso, formatShortFrenchDate } from '@/lib/date.utils';

export interface NutritionDateNavProps {
  selectedDate: string;
  todayIso: string;
  onDateChange: (date: string) => void;
}

export function NutritionDateNav({
  selectedDate,
  todayIso,
  onDateChange,
}: NutritionDateNavProps) {
  return (
    <div className="flex items-center justify-between border-b border-[#38383A]/40 bg-[#1C1C1E]/40 px-4 py-2">
      <button
        type="button"
        onClick={() => onDateChange(shiftDateIso(selectedDate, -1))}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-[#0A84FF] active:bg-white/10"
        aria-label="Jour précédent"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold capitalize text-white">
          {formatShortFrenchDate(selectedDate)}
        </span>
        {selectedDate !== todayIso && (
          <button
            type="button"
            onClick={() => onDateChange(todayIso)}
            className="rounded-full bg-[#0A84FF]/20 px-2.5 py-1 text-xs font-medium text-[#0A84FF] active:bg-[#0A84FF]/30"
          >
            Aujourd&apos;hui
          </button>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDateChange(shiftDateIso(selectedDate, 1))}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-[#0A84FF] active:bg-white/10"
        aria-label="Jour suivant"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

