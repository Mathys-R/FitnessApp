'use client';

import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Play, Calendar, Dumbbell } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { useIsClient } from '@/lib/hooks/useIsClient';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useActiveWorkoutStore } from '@/features/workout/store/active-workout.store';
import { loadSessionForEditing } from '@/features/workout/services/calendar.service';
import {
  buildActiveExercisesFromPreset,
  type WorkoutPresetWithExercises,
} from '@/features/workout/services/presets.service';
import { buildStartPayloadFromPlannedSession } from '@/features/workout/services/today-session.service';
import type { WorkoutSessionRow } from '@/features/workout/services/sessions.service';
import { ActiveSession } from '@/features/workout/components/ActiveSession';
import { WeeklyCalendar } from '@/features/workout/components/WeeklyCalendar';
import { WorkoutPresetList } from '@/features/workout/components/WorkoutPresetList';

type WorkoutTab = 'agenda' | 'presets';

const TAB_OPTIONS: { value: WorkoutTab; label: ReactNode }[] = [
  { value: 'agenda', label: <><Calendar className="h-3.5 w-3.5" /> Agenda</> },
  { value: 'presets', label: <><Dumbbell className="h-3.5 w-3.5" /> Mes Presets</> },
];

export default function WorkoutPage() {
  const isActive = useActiveWorkoutStore((s) => s.isActive);
  const startSession = useActiveWorkoutStore((s) => s.startSession);
  const isClient = useIsClient();
  const [activeTab, setActiveTab] = useState<WorkoutTab>('agenda');
  const plannedLaunchLockRef = useRef(false);

  // Store persisté (localStorage) + agenda daté : aucun rendu avant l'hydratation.
  if (!isClient) {
    return (
      <div className="flex flex-col space-y-4 pb-20" aria-busy="true">
        <PageHeader title="Musculation" subtitle="Séances & Progression" />
        <div className="space-y-4 px-4">
          <div className="h-12 animate-pulse rounded-2xl bg-[#1C1C1E]" />
          <div className="h-[320px] animate-pulse rounded-2xl bg-[#1C1C1E]" />
        </div>
      </div>
    );
  }

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
    if (plannedLaunchLockRef.current) return; // anti double-tap
    plannedLaunchLockRef.current = true;
    try {
      startSession(await buildStartPayloadFromPlannedSession(session));
    } catch {
      toast.error('Erreur lors du lancement de la séance planifiée');
    } finally {
      plannedLaunchLockRef.current = false;
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
        <SegmentedControl
          ariaLabel="Vue musculation"
          options={TAB_OPTIONS}
          value={activeTab}
          onChange={setActiveTab}
        />

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
