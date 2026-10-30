'use client';

import { useState, useEffect } from 'react';
import { Timer, Plus, CheckCircle, AlertTriangle } from 'lucide-react';
import { useActiveWorkoutStore } from '../store/active-workout.store';
import { ExerciseCard } from './ExerciseCard';
import { ExercisePickerDrawer } from './ExercisePickerDrawer';
import { FinishSessionDrawer } from './FinishSessionDrawer';
import { RestTimerBar } from './RestTimerBar';

export interface ActiveSessionProps {
  onSessionFinished?: () => void;
}

export function ActiveSession({ onSessionFinished }: ActiveSessionProps) {
  const { sessionName, startedAtIso, exercises, clearActiveSession, addExerciseToSession } =
    useActiveWorkoutStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [restTotal, setRestTotal] = useState(0);
  const [restRemaining, setRestRemaining] = useState(0);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isFinishOpen, setIsFinishOpen] = useState(false);

  // Chrono live séance
  useEffect(() => {
    if (!startedAtIso) return;
    const updateElapsed = () => {
      const start = new Date(startedAtIso).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [startedAtIso]);

  // Décompte minuteur de repos
  useEffect(() => {
    if (restRemaining <= 0) return;
    const interval = setInterval(() => {
      setRestRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [restRemaining]);

  const handleTimerStart = (seconds: number) => {
    setRestTotal(seconds);
    setRestRemaining(seconds);
  };

  const handleAbandon = () => {
    if (window.confirm('Abandonner la séance en cours ? Les données non enregistrées seront perdues.')) {
      clearActiveSession();
    }
  };

  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  const formattedChrono = hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  return (
    <div className="flex flex-col space-y-4 pb-28">
      {/* En-tête de séance active */}
      <div className="ios-card flex items-center justify-between p-4">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-bold text-white">
            {sessionName || 'Séance active'}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-[#0A84FF] font-medium">
            <Timer className="h-3.5 w-3.5" />
            <span className="tabular-nums">{formattedChrono}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleAbandon}
            className="flex min-h-[44px] items-center gap-1 rounded-xl bg-red-950/40 px-3 text-xs font-semibold text-red-400 hover:bg-red-950/60"
          >
            <AlertTriangle className="h-3.5 w-3.5" /> Abandonner
          </button>
          <button
            type="button"
            onClick={() => setIsFinishOpen(true)}
            className="flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[#30D158] px-4 text-xs font-bold text-black active:scale-95"
          >
            <CheckCircle className="h-4 w-4" /> Terminer
          </button>
        </div>
      </div>

      {/* Liste des exercices */}
      {exercises.length === 0 ? (
        <div className="ios-card flex flex-col items-center justify-center p-8 text-center space-y-3">
          <p className="text-sm font-medium text-white">Aucun exercice dans cette séance</p>
          <p className="text-xs text-[#8E8E93]">
            Ajoutez votre premier exercice pour commencer à enregistrer vos séries.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.local_id}
              exercise={exercise}
              onTimerStart={handleTimerStart}
            />
          ))}
        </div>
      )}

      {/* Bouton Ajouter un exercice */}
      <button
        type="button"
        onClick={() => setIsPickerOpen(true)}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-[#38383A] bg-[#1C1C1E]/50 text-sm font-semibold text-[#0A84FF] hover:bg-[#1C1C1E] active:scale-[0.99]"
      >
        <Plus className="h-4 w-4" /> Ajouter un exercice
      </button>

      {/* Minuteur de repos flottant */}
      {restRemaining > 0 && (
        <div className="fixed bottom-20 left-4 right-4 z-40 max-w-md mx-auto">
          <RestTimerBar
            remainingSeconds={restRemaining}
            totalSeconds={restTotal}
            onAddSeconds={(sec) => {
              setRestRemaining((prev) => Math.max(0, prev + sec));
              setRestTotal((prev) => Math.max(prev, restRemaining + sec));
            }}
            onSkip={() => setRestRemaining(0)}
          />
        </div>
      )}

      <ExercisePickerDrawer
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onSelectExercise={(exercise) => {
          addExerciseToSession(exercise);
          setIsPickerOpen(false);
        }}
      />

      <FinishSessionDrawer
        open={isFinishOpen}
        onOpenChange={setIsFinishOpen}
        onFinished={() => {
          setIsFinishOpen(false);
          onSessionFinished?.();
        }}
      />
    </div>
  );
}
