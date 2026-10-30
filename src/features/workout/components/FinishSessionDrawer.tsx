'use client';

import { useState, useMemo, useEffect } from 'react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { useActiveWorkoutStore } from '../store/active-workout.store';
import { finishAndSaveWorkoutSession, type PresetActionChoice } from '../services/sessions.service';
import { computeEffectiveTonnage } from '@/lib/math/workout-kpis.math';

export interface FinishSessionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinished: () => void;
}

export function FinishSessionDrawer({ open, onOpenChange, onFinished }: FinishSessionDrawerProps) {
  const {
    sessionName,
    sessionDate,
    startedAtIso,
    sourcePresetId,
    editingSessionId,
    plannedSessionId,
    exercises,
    clearActiveSession,
  } = useActiveWorkoutStore();

  const [comment, setComment] = useState('');
  const [newPresetName, setNewPresetName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setComment('');
      setNewPresetName(sessionName ? `${sessionName} (Preset)` : 'Mon Programme');
    }
  }, [open, sessionName]);

  const durationSeconds = useMemo(() => {
    if (!startedAtIso) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(startedAtIso).getTime()) / 1000));
  }, [startedAtIso]);

  const formattedDuration = useMemo(() => {
    const mins = Math.floor(durationSeconds / 60);
    const secs = durationSeconds % 60;
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${(mins % 60).toString().padStart(2, '0')}m`;
    return `${mins}m ${secs.toString().padStart(2, '0')}s`;
  }, [durationSeconds]);

  const allFlatSets = useMemo(
    () => exercises.flatMap((ex) => ex.sets.map((s) => ({
      weight_kg: Number.parseFloat(s.weight_input.replace(',', '.')) || 0,
      reps: Number.parseInt(s.reps_input, 10) || 0,
      is_warmup: s.is_warmup,
      is_completed: s.is_completed,
    }))),
    [exercises]
  );

  const effectiveTonnage = useMemo(() => computeEffectiveTonnage(allFlatSets), [allFlatSets]);
  const completedSets = useMemo(() => exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.is_completed).length, 0), [exercises]);
  const prCount = useMemo(() => exercises.reduce((acc, ex) => acc + ex.sets.filter((s) => s.is_completed && s.is_pr).length, 0), [exercises]);

  const handleSave = async (presetAction: PresetActionChoice) => {
    if (isSaving) return;
    if (presetAction === 'create_new_preset' && !newPresetName.trim()) {
      toast.error('Veuillez renseigner un nom pour le preset');
      return;
    }
    setIsSaving(true);
    try {
      await finishAndSaveWorkoutSession({
        editingSessionId,
        plannedSessionId,
        sourcePresetId,
        sessionDate,
        sessionName: sessionName.trim() || 'Séance Musculation',
        durationSeconds,
        sessionComment: comment.trim() || undefined,
        exercises,
        presetAction,
        newPresetName: presetAction === 'create_new_preset' ? newPresetName.trim() : undefined,
      });
      clearActiveSession();
      toast.success('Séance enregistrée avec succès !');
      onFinished();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l’enregistrement');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-[20px] border-t border-[#38383A] bg-[#1C1C1E] p-6 pb-8 focus:outline-none">
          <Drawer.Handle className="mx-auto mb-4 bg-[#38383A]" />
          <Drawer.Title className="text-center text-lg font-semibold text-white">Clôturer la séance</Drawer.Title>
          <Drawer.Description className="text-center text-xs text-[#8E8E93] mb-4">Récapitulatif de vos performances et options de preset</Drawer.Description>
          <div className="grid grid-cols-4 gap-2 mb-4">
            <div className="ios-card p-2 text-center"><div className="text-[10px] text-[#8E8E93]">Durée</div><div className="text-xs font-semibold text-white tabular-nums">{formattedDuration}</div></div>
            <div className="ios-card p-2 text-center"><div className="text-[10px] text-[#8E8E93]">Tonnage</div><div className="text-xs font-semibold text-white tabular-nums">{effectiveTonnage}kg</div></div>
            <div className="ios-card p-2 text-center"><div className="text-[10px] text-[#8E8E93]">Séries</div><div className="text-xs font-semibold text-white tabular-nums">{completedSets}</div></div>
            <div className="ios-card p-2 text-center"><div className="text-[10px] text-[#8E8E93]">Records</div><div className="text-xs font-semibold text-[#FFD60A] tabular-nums">{prCount} 🏆</div></div>
          </div>
          <div className="space-y-4">
            <div>
              <label htmlFor="session-comment" className="block text-xs font-medium text-[#8E8E93] mb-1">Commentaire de séance (ressenti, énergie...)</label>
              <textarea id="session-comment" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Bonne séance, belle congestion..." className="ios-input w-full min-h-[64px] text-base resize-none" />
            </div>
            <div className="space-y-2 pt-2 border-t border-[#38383A]">
              {sourcePresetId ? (
                <>
                  <button type="button" disabled={isSaving} onClick={() => handleSave('overwrite_source_preset')} className="w-full min-h-[44px] rounded-xl bg-[#2C2C2E] border border-white/10 font-medium text-white hover:bg-[#38383A] active:scale-[0.98] disabled:opacity-50 text-sm">Mettre à jour le preset source</button>
                  <button type="button" disabled={isSaving} onClick={() => handleSave('keep_unchanged')} className="w-full min-h-[44px] rounded-xl bg-[#0A84FF] font-semibold text-white hover:bg-[#0071E3] active:scale-[0.98] disabled:opacity-50 text-sm">Enregistrer uniquement la séance</button>
                  <div className="pt-2">
                    <input type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} placeholder="Nom du nouveau preset" className="ios-input w-full min-h-[44px] text-base mb-1.5" />
                    <button type="button" disabled={isSaving} onClick={() => handleSave('create_new_preset')} className="w-full min-h-[44px] rounded-xl bg-[#2C2C2E] border border-white/10 font-medium text-white hover:bg-[#38383A] active:scale-[0.98] disabled:opacity-50 text-sm">Créer un nouveau preset à partir de cette séance</button>
                  </div>
                </>
              ) : (
                <>
                  <button type="button" disabled={isSaving} onClick={() => handleSave('keep_unchanged')} className="w-full min-h-[44px] rounded-xl bg-[#0A84FF] font-semibold text-white hover:bg-[#0071E3] active:scale-[0.98] disabled:opacity-50 text-sm">Enregistrer la séance uniquement</button>
                  <div className="pt-2">
                    <input type="text" value={newPresetName} onChange={(e) => setNewPresetName(e.target.value)} placeholder="Nom du nouveau preset" className="ios-input w-full min-h-[44px] text-base mb-1.5" />
                    <button type="button" disabled={isSaving} onClick={() => handleSave('create_new_preset')} className="w-full min-h-[44px] rounded-xl bg-[#2C2C2E] border border-white/10 font-medium text-white hover:bg-[#38383A] active:scale-[0.98] disabled:opacity-50 text-sm">Enregistrer et créer un preset</button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
