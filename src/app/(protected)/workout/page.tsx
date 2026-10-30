'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Play, Calendar, Dumbbell } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useActiveWorkoutStore } from '@/features/workout/store/active-workout.store';
import { loadSessionForEditing } from '@/features/workout/services/calendar.service';
import {
  buildActiveExercisesFromPreset,
  getWorkoutPresets,
  type WorkoutPresetWithExercises,
} from '@/features/workout/services/presets.service';
import type { WorkoutSessionRow } from '@/features/workout/services/sessions.service';
import type { ActiveWorkoutExercise } from '@/features/workout/types/workout-store.types';
import { ActiveSession } from '@/features/workout/components/ActiveSession';
import { WeeklyCalendar } from '@/features/workout/components/WeeklyCalendar';
import { WorkoutPresetList } from '@/features/workout/components/WorkoutPresetList';

type WorkoutTab = 'agenda' | 'presets';

export default function WorkoutPage() {
  const { isActive, startSession } = useActiveWorkoutStore();
  const [activeTab, setActiveTab] = useState<WorkoutTab>('agenda');

  // Si une séance est en cours, afficher immédiatement l'écran de séance active
  if (isActive) {
    return (
      <div className="p-4">
        <ActiveSession />
      </div>
    );
  }

  const handleStartFreeSession = () => {
    startSession({ sessionName: 'Séance libre' });
  };

  const handleEditSession = async (sessionId: string) => {
    try {
      const { session, exercises } = await loadSessionForEditing(sessionId);
      startSession({
        sessionName: session.name,
        sessionDate: session.session_date,
        editingSessionId: session.id,
        sourcePresetId: session.preset_id,
        exercises,
      });
    } catch {
      toast.error('Erreur lors du chargement de la séance');
    }
  };

  const handleStartPlannedSession = async (session: WorkoutSessionRow) => {
    try {
      let exercises: ActiveWorkoutExercise[] = [];
      if (session.preset_id) {
        const presets = await getWorkoutPresets();
        const found = presets.find((p) => p.id === session.preset_id);
        if (found) {
          exercises = await buildActiveExercisesFromPreset(found);
        }
      }
      startSession({
        sessionName: session.name,
        sessionDate: session.session_date,
        plannedSessionId: session.id,
        sourcePresetId: session.preset_id,
        exercises,
      });
    } catch {
      toast.error('Erreur lors du lancement de la séance planifiée');
    }
  };

  const handleStartPreset = async (preset: WorkoutPresetWithExercises) => {
    try {
      const exercises = await buildActiveExercisesFromPreset(preset);
      startSession({
        sessionName: preset.name,
        sourcePresetId: preset.id,
        exercises,
      });
    } catch {
      toast.error('Erreur lors du chargement du preset');
    }
  };

  return (
    <div className="flex flex-col space-y-4 pb-20">
      <PageHeader title="Musculation" subtitle="Séances & Progression" />

      <div className="space-y-4 px-4">
        {/* CTA Proéminent : Séance libre */}
        <button
          type="button"
          onClick={handleStartFreeSession}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0A84FF] text-base font-bold text-white shadow-lg shadow-[#0A84FF]/20 active:scale-[0.99]"
        >
          <Play className="h-4 w-4 fill-white" /> Démarrer une séance libre
        </button>

        {/* Segmented Control iOS */}
        <div className="flex rounded-xl bg-[#2C2C2E] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('agenda')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeTab === 'agenda'
                ? 'bg-[#1C1C1E] text-white shadow-sm'
                : 'text-[#8E8E93] hover:text-white'
            }`}
          >
            <Calendar className="h-3.5 w-3.5" /> Agenda
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('presets')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              activeTab === 'presets'
                ? 'bg-[#1C1C1E] text-white shadow-sm'
                : 'text-[#8E8E93] hover:text-white'
            }`}
          >
            <Dumbbell className="h-3.5 w-3.5" /> Mes Presets
          </button>
        </div>

        {/* Contenu de l'onglet actif */}
        {activeTab === 'agenda' ? (
          <WeeklyCalendar
            onEditSession={handleEditSession}
            onStartPlannedSession={handleStartPlannedSession}
          />
        ) : (
          <WorkoutPresetList onStartSessionFromPreset={handleStartPreset} />
        )}
      </div>
    </div>
  );
}
