'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Play } from 'lucide-react';
import {
  getWorkoutPresets,
  deleteWorkoutPreset,
  type WorkoutPresetWithExercises,
} from '../services/presets.service';
import { PresetEditorDrawer } from './PresetEditorDrawer';

export interface WorkoutPresetListProps {
  onStartSessionFromPreset: (preset: WorkoutPresetWithExercises) => void;
}

export function WorkoutPresetList({ onStartSessionFromPreset }: WorkoutPresetListProps) {
  const [presets, setPresets] = useState<WorkoutPresetWithExercises[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPreset, setEditingPreset] = useState<WorkoutPresetWithExercises | null>(null);

  const loadPresets = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getWorkoutPresets();
      setPresets(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur de chargement des presets');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const handleDeletePreset = async (presetId: string, presetName: string) => {
    if (!window.confirm(`Supprimer le preset "${presetName}" ?`)) return;
    try {
      await deleteWorkoutPreset(presetId);
      toast.success('Preset supprimé');
      await loadPresets();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-white">Mes Presets ({presets.length})</h2>
        <button
          type="button"
          onClick={() => { setEditingPreset(null); setIsEditorOpen(true); }}
          className="min-h-[44px] px-3.5 rounded-xl bg-[#0A84FF] text-white font-medium text-xs flex items-center gap-1.5 hover:bg-[#0071E3] active:scale-95"
        >
          <Plus className="w-4 h-4" /> Nouveau Preset
        </button>
      </div>

      {isLoading ? (
        <div className="ios-card p-6 text-center text-xs text-[#8E8E93]">Chargement des presets...</div>
      ) : presets.length === 0 ? (
        <div className="ios-card p-6 text-center space-y-3">
          <p className="text-sm text-[#8E8E93]">Aucun preset enregistré pour le moment.</p>
          <button
            type="button"
            onClick={() => { setEditingPreset(null); setIsEditorOpen(true); }}
            className="min-h-[44px] px-4 rounded-xl bg-[#2C2C2E] text-white text-xs font-medium border border-white/10 hover:bg-[#38383A]"
          >
            Créer mon premier programme
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {presets.map((preset) => {
            const muscles = Array.from(
              new Set(
                preset.workout_preset_exercises
                  .map((pEx) => pEx.exercise?.primary_muscle)
                  .filter(Boolean)
              )
            ).join(', ');

            return (
              <div key={preset.id} className="ios-card p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-white truncate">{preset.name}</h3>
                    {preset.description && (
                      <p className="text-xs text-[#8E8E93] line-clamp-2 mt-0.5">{preset.description}</p>
                    )}
                    <p className="text-xs text-[#8E8E93] mt-1.5">
                      {preset.workout_preset_exercises.length} exercice{preset.workout_preset_exercises.length > 1 ? 's' : ''}
                      {muscles ? ` • ${muscles}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => onStartSessionFromPreset(preset)}
                    className="flex-1 min-h-[44px] rounded-xl bg-[#30D158] font-semibold text-black hover:bg-[#28cd41] active:scale-[0.98] flex items-center justify-center gap-1.5 text-sm"
                  >
                    <Play className="w-4 h-4 fill-black" /> Lancer la séance
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingPreset(preset); setIsEditorOpen(true); }}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2C2E] border border-white/10 flex items-center justify-center text-[#8E8E93] hover:text-white active:scale-95"
                    title="Modifier le preset"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(preset.id, preset.name)}
                    className="min-h-[44px] min-w-[44px] rounded-xl bg-[#2C2C2E] border border-white/10 flex items-center justify-center text-[#FF453A] hover:opacity-80 active:scale-95"
                    title="Supprimer le preset"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <PresetEditorDrawer
        open={isEditorOpen}
        onOpenChange={setIsEditorOpen}
        presetToEdit={editingPreset}
        onSaved={loadPresets}
      />
    </div>
  );
}
