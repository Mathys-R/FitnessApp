// src/components/ui/SegmentedControl.tsx
'use client';

import type { ReactNode } from 'react';

export interface SegmentedOption<T extends string | number> {
  value: T;
  label: ReactNode;
}

export interface SegmentedControlProps<T extends string | number> {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** true (défaut) : occupe toute la largeur, segments égaux. false : largeur au contenu. */
  fullWidth?: boolean;
  className?: string;
}

/**
 * Contrôle segmenté iOS (OLED) générique : role="group" + aria-pressed,
 * cibles tactiles ≥ 44 px, segment actif #1C1C1E sur piste #2C2C2E.
 */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth = true,
  className = '',
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={`flex rounded-xl bg-[#2C2C2E] p-1 ${fullWidth ? 'w-full' : 'shrink-0'} ${className}`.trim()}
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onChange(option.value)}
            className={`flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold tabular-nums transition-all ${
              fullWidth ? 'flex-1' : ''
            } ${isSelected ? 'bg-[#1C1C1E] text-white shadow-sm' : 'text-[#8E8E93] hover:text-white'}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
