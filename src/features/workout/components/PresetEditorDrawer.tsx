'use client';

import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import {
  createWorkoutPreset,
  updateWorkoutPreset,
  type WorkoutPresetWithExercises,
} from '../services/presets.service';
import { getActiveExercises, type ExerciseRow } from '@/features/catalogs/services/exercises.service';

export interface PresetEditorDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetToEdit?: WorkoutPresetWithExercises | null;
  onSaved: () => void;
}

interface PresetExerciseItem {
  exercise_id: string;
  exercise_name: string;
  target_sets: number;
  target_rest_seconds: number;
}

export function PresetEditorDrawer({ open, onOpenChange, presetToEdit, onSaved }: PresetEditorDrawerProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState<PresetExerciseItem[]>([]);
  const [catalog, setCatalog] = useState<ExerciseRow[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    getActiveExercises().then(setCatalog).catch(() => {});
    if (presetToEdit) {
      setName(presetToEdit.name);
      setDescription(presetToEdit.description || '');
      setExercises(presetToEdit.workout_preset_exercises.map((pEx) => ({
        exercise_id: pEx.exercise_id,
        exercise_name: pEx.exercise?.name || 'Exercice',
        target_sets: pEx.target_sets ?? 3,
        target_rest_seconds: pEx.target_rest_seconds ?? 120,
      })));
    } else {
      setName('');
      setDescription('');
      setExercises([]);
    }
  }, [open, presetToEdit]);

  const handleAddExercise = (exerciseId: string) => {
    if (!exerciseId) return;
    const found = catalog.find((e) => e.id === exerciseId);
    if (!found) return;
    setExercises((prev) => [...prev, {
      exercise_id: found.id,
      exercise_name: found.name,
      target_sets: 3,
      target_rest_seconds: 120,
    }]);
  };

  const handleUpdate = (idx: number, field: 'target_sets' | 'target_rest_seconds', val: number) => {
    setExercises((prev) => prev.map((ex, i) => (i === idx ? { ...ex, [field]: val } : ex)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error('Veuillez renseigner un nom pour le preset');
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = exercises.map((ex, idx) => ({
        exercise_id: ex.exercise_id,
        order_index: idx,
        target_sets: ex.target_sets,
        target_rest_seconds: ex.target_rest_seconds,
      }));
      if (presetToEdit) {
        await updateWorkoutPreset(presetToEdit.id, { name: trimmed, description: description.trim() || null, exercises: payload });
        toast.success('Preset mis à jour');
      } else {
        await createWorkoutPreset({ name: trimmed, description: description.trim() || null, exercises: payload });
        toast.success('Preset créé avec succès');
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-[20px] border-t border-[#38383A] bg-[#1C1C1E] p-6 pb-8 focus:outline-none">
          <Drawer.Handle className="mx-auto mb-4 bg-[#38383A]" />
          <Drawer.Title className="text-center text-lg font-semibold text-white">{presetToEdit ? 'Modifier le preset' : 'Nouveau preset'}</Drawer.Title>
          <Drawer.Description className="text-center text-xs text-[#8E8E93] mb-4">Configurez votre séance type et vos temps de repos</Drawer.Description>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="preset-name" className="block text-xs font-medium text-[#8E8E93] mb-1">Nom du preset *</label>
              <input id="preset-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Push Force, Dos / Bras..." className="ios-input w-full min-h-[44px] text-base" />
            </div>
            <div>
              <label htmlFor="preset-desc" className="block text-xs font-medium text-[#8E8E93] mb-1">Description (optionnelle)</label>
              <input id="preset-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Focus pecs et deltoïdes..." className="ios-input w-full min-h-[44px] text-base" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-[#8E8E93]">Exercices ({exercises.length})</span>
                <select onChange={(e) => { handleAddExercise(e.target.value); e.target.value = ''; }} defaultValue="" className="ios-input text-xs min-h-[36px] pl-2 pr-6">
                  <option value="" disabled>+ Ajouter un exercice</option>
                  {catalog.map((ex) => (<option key={ex.id} value={ex.id} className="bg-[#1C1C1E] text-white">{ex.name}</option>))}
                </select>
              </div>
              <div className="space-y-2">
                {exercises.map((ex, idx) => (
                  <div key={`${ex.exercise_id}-${idx}`} className="ios-card p-3 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{ex.exercise_name}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-[#8E8E93]">
                        <label className="flex items-center gap-1">Séries :<input type="number" min="1" max="20" value={ex.target_sets} onChange={(e) => handleUpdate(idx, 'target_sets', Math.max(1, Number.parseInt(e.target.value, 10) || 1))} className="ios-input w-12 text-center text-white text-base py-0.5 tabular-nums" /></label>
                        <label className="flex items-center gap-1">Repos :<input type="number" min="0" max="600" step="15" value={ex.target_rest_seconds} onChange={(e) => handleUpdate(idx, 'target_rest_seconds', Math.max(0, Number.parseInt(e.target.value, 10) || 0))} className="ios-input w-14 text-center text-white text-base py-0.5 tabular-nums" />s</label>
                      </div>
                    </div>
                    <button type="button" onClick={() => setExercises((prev) => prev.filter((_, i) => i !== idx))} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#FF453A] hover:opacity-80 active:scale-95"><Trash2 className="w-5 h-5" /></button>
                  </div>
                ))}
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full min-h-[44px] rounded-xl bg-[#0A84FF] font-semibold text-white hover:bg-[#0071E3] active:scale-[0.98] disabled:opacity-50 text-base">
              {isSubmitting ? 'Sauvegarde...' : 'Enregistrer le preset'}
            </button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
