'use client';

import { useState } from 'react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { Play, Pencil, Trash2, Moon, CalendarPlus } from 'lucide-react';
import { formatShortFrenchDate } from '@/lib/date.utils';
import { deleteWorkoutSession, type WorkoutSessionRow } from '../services/sessions.service';
import { scheduleOrMoveWeekSession } from '../services/calendar.service';

export interface CalendarSessionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDateIso: string;
  session?: WorkoutSessionRow | null;
  onSessionUpdated: () => void;
  onEditSession: (sessionId: string) => void;
  onStartPlannedSession: (session: WorkoutSessionRow) => void;
}

export function CalendarSessionDrawer({
  open,
  onOpenChange,
  selectedDateIso,
  session,
  onSessionUpdated,
  onEditSession,
  onStartPlannedSession,
}: CalendarSessionDrawerProps) {
  const [loading, setLoading] = useState(false);

  const handleAction = async (action: () => Promise<void>, msg: string) => {
    setLoading(true);
    try {
      await action();
      toast.success(msg);
      onSessionUpdated();
      onOpenChange(false);
    } catch {
      toast.error('Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const isCompleted = session?.status === 'completed';
  const isPlanned = session?.status === 'planned';
  const isRest = session?.status === 'rest_day';

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] rounded-t-[20px] border-t border-[#38383A] bg-[#1C1C1E] p-6 pb-8 focus:outline-none">
          <Drawer.Handle className="mx-auto mb-4 bg-[#38383A]" />
          <Drawer.Title className="text-center text-lg font-semibold text-white">
            {formatShortFrenchDate(selectedDateIso)}
          </Drawer.Title>
          <Drawer.Description className="mb-5 text-center text-xs text-[#8E8E93]">
            {session ? session.name : 'Aucune séance programmée'}
          </Drawer.Description>

          <div className="space-y-3">
            {isCompleted && (
              <>
                <div className="ios-card flex items-center justify-between p-3 text-sm">
                  <span className="text-[#8E8E93]">Durée</span>
                  <span className="font-medium text-white tabular-nums">{Math.round((session.duration_seconds ?? 0) / 60)} min</span>
                </div>
                <button type="button" onClick={() => { onOpenChange(false); onEditSession(session.id); }} className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#2C2C2E] text-sm font-semibold text-white hover:bg-[#38383A]">
                  <Pencil className="h-4 w-4" /> Corriger / Modifier la séance
                </button>
                <button type="button" disabled={loading} onClick={() => handleAction(() => deleteWorkoutSession(session.id), 'Séance supprimée')} className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-950/40 text-sm font-semibold text-red-400">
                  <Trash2 className="h-4 w-4" /> Supprimer la séance
                </button>
              </>
            )}

            {isPlanned && (
              <>
                <button type="button" onClick={() => { onOpenChange(false); onStartPlannedSession(session); }} className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0A84FF] text-sm font-semibold text-white">
                  <Play className="h-4 w-4 fill-white" /> Lancer la séance maintenant
                </button>
                <button type="button" disabled={loading} onClick={() => handleAction(() => scheduleOrMoveWeekSession({ existingSessionId: session.id, targetDateIso: selectedDateIso, status: 'rest_day', name: 'Repos' }), 'Passé en jour de repos')} className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#2C2C2E] text-sm font-semibold text-[#8E8E93]">
                  <Moon className="h-4 w-4" /> Passer en jour de repos
                </button>
                <button type="button" disabled={loading} onClick={() => handleAction(() => deleteWorkoutSession(session.id), 'Séance annulée')} className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-950/40 text-sm font-semibold text-red-400">
                  <Trash2 className="h-4 w-4" /> Supprimer
                </button>
              </>
            )}

            {(!session || isRest) && (
              <>
                <button type="button" disabled={loading} onClick={() => handleAction(() => scheduleOrMoveWeekSession({ existingSessionId: session?.id, targetDateIso: selectedDateIso, status: 'planned', name: 'Séance planifiée' }), 'Séance planifiée')} className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#0A84FF] text-sm font-semibold text-white">
                  <CalendarPlus className="h-4 w-4" /> Planifier une séance
                </button>
                {!isRest ? (
                  <button type="button" disabled={loading} onClick={() => handleAction(() => scheduleOrMoveWeekSession({ targetDateIso: selectedDateIso, status: 'rest_day', name: 'Repos' }), 'Jour marqué comme repos')} className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#2C2C2E] text-sm font-semibold text-[#8E8E93]">
                    <Moon className="h-4 w-4" /> Marquer comme jour de repos
                  </button>
                ) : (
                  <button type="button" disabled={loading} onClick={() => handleAction(() => deleteWorkoutSession(session.id), 'Jour de repos retiré')} className="flex w-full min-h-[44px] items-center justify-center gap-2 rounded-xl bg-red-950/40 text-sm font-semibold text-red-400">
                    <Trash2 className="h-4 w-4" /> Retirer le jour de repos
                  </button>
                )}
              </>
            )}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
