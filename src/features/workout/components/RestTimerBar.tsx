'use client';

import { useEffect, useRef } from 'react';
import { Timer, X } from 'lucide-react';
import { toast } from 'sonner';

export interface RestTimerBarProps {
  remainingSeconds: number;
  totalSeconds: number;
  onAddSeconds: (seconds: number) => void;
  onSkip: () => void;
}

export function RestTimerBar({
  remainingSeconds,
  totalSeconds,
  onAddSeconds,
  onSkip,
}: RestTimerBarProps) {
  const prevSecondsRef = useRef(remainingSeconds);

  useEffect(() => {
    if (remainingSeconds === 0 && prevSecondsRef.current > 0) {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      toast.info('Repos terminé, à vous de jouer !');
    }
    prevSecondsRef.current = remainingSeconds;
  }, [remainingSeconds]);

  const mins = Math.floor(Math.max(0, remainingSeconds) / 60);
  const secs = Math.max(0, remainingSeconds) % 60;
  const formattedTime = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const progressPercent =
    totalSeconds > 0
      ? Math.min(100, Math.max(0, (1 - remainingSeconds / totalSeconds) * 100))
      : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#38383A] bg-[#1C1C1E] p-3 shadow-2xl backdrop-blur-md">
      {/* Barre de progression d'arrière-plan */}
      <div
        className="pointer-events-none absolute inset-0 bg-[#0A84FF]/10 transition-all duration-300 ease-linear"
        style={{ width: `${progressPercent}%` }}
      />

      <div className="relative flex items-center justify-between gap-3">
        {/* Minuteur & Icône */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0A84FF]/20 text-[#0A84FF]">
            <Timer className="h-5 w-5 animate-pulse" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-[#8E8E93]">Temps de repos</p>
            <p className="text-xl font-bold tracking-tight text-white tabular-nums">
              {formattedTime}
            </p>
          </div>
        </div>

        {/* Boutons d'ajustement rapide */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onAddSeconds(-30)}
            aria-label="Retirer 30 secondes de repos"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#2C2C2E] px-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#38383A] active:scale-95"
          >
            -30s
          </button>

          <button
            type="button"
            onClick={() => onAddSeconds(30)}
            aria-label="Ajouter 30 secondes de repos"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#2C2C2E] px-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#38383A] active:scale-95"
          >
            +30s
          </button>

          <button
            type="button"
            onClick={onSkip}
            aria-label="Passer le temps de repos"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#FF453A]/20 px-3 text-xs font-semibold text-[#FF453A] transition-colors hover:bg-[#FF453A]/30 active:scale-95"
          >
            <X className="mr-1 h-4 w-4" />
            Passer
          </button>
        </div>
      </div>
    </div>
  );
}
