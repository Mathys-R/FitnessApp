'use client';

import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { createOrUpdateExercise, type ExerciseRow } from '@/features/catalogs/services/exercises.service';
import { MUSCLE_GROUPS, type MuscleGroup } from '@/types/domain.types';

export interface ExerciseFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseToEdit?: ExerciseRow | null;
  onSaved: (saved: ExerciseRow) => void;
}

export function ExerciseFormDrawer({
  open,
  onOpenChange,
  exerciseToEdit,
  onSaved,
}: ExerciseFormDrawerProps) {
  const [name, setName] = useState('');
  const [primaryMuscle, setPrimaryMuscle] = useState<MuscleGroup>('Pecs');
  const [secondaryMuscles, setSecondaryMuscles] = useState<MuscleGroup[]>([]);
  const [setupGuide, setSetupGuide] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (exerciseToEdit) {
        setName(exerciseToEdit.name);
        setPrimaryMuscle((exerciseToEdit.primary_muscle as MuscleGroup) || 'Pecs');
        const secs = Array.isArray(exerciseToEdit.secondary_muscles)
          ? (exerciseToEdit.secondary_muscles as MuscleGroup[])
          : [];
        setSecondaryMuscles(secs);
        setSetupGuide(exerciseToEdit.setup_guide || '');
      } else {
        setName('');
        setPrimaryMuscle('Pecs');
        setSecondaryMuscles([]);
        setSetupGuide('');
      }
    }
  }, [open, exerciseToEdit]);

  const toggleSecondary = (muscle: MuscleGroup) => {
    if (secondaryMuscles.includes(muscle)) {
      setSecondaryMuscles(secondaryMuscles.filter((m) => m !== muscle));
    } else {
      if (secondaryMuscles.length >= 3) {
        toast.info('Maximum 3 muscles secondaires');
        return;
      }
      setSecondaryMuscles([...secondaryMuscles, muscle]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Veuillez renseigner le nom de l'exercice");
      return;
    }

    setIsSubmitting(true);
    try {
      const saved = await createOrUpdateExercise({
        id: exerciseToEdit?.id,
        name: trimmed,
        primary_muscle: primaryMuscle,
        secondary_muscles: secondaryMuscles,
        setup_guide: setupGuide.trim() || null,
        is_archived: false,
      });

      toast.success(exerciseToEdit ? 'Exercice mis à jour' : 'Exercice créé');
      onSaved(saved);
      onOpenChange(false);
    } catch {
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableSecondaries = MUSCLE_GROUPS.filter((m) => m !== primaryMuscle);

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-[20px] border-t border-[#38383A] bg-[#1C1C1E] p-6 pb-8 focus:outline-none">
          <Drawer.Handle className="mx-auto mb-4 bg-[#38383A]" />
          <Drawer.Title className="text-center text-lg font-semibold text-white">
            {exerciseToEdit ? "Modifier l'exercice" : 'Nouvel exercice'}
          </Drawer.Title>
          <Drawer.Description className="text-center text-xs text-[#8E8E93] mb-4">
            Catalogue partagé avec votre partenaire
          </Drawer.Description>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="ex-name" className="block text-xs font-medium text-[#8E8E93] mb-1">Nom de l&apos;exercice *</label>
              <input id="ex-name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex: Développé couché barre" className="ios-input w-full min-h-[44px] text-base" />
            </div>

            <div>
              <label htmlFor="ex-primary" className="block text-xs font-medium text-[#8E8E93] mb-1">Muscle principal *</label>
              <select id="ex-primary" value={primaryMuscle} onChange={(e) => {
                const newP = e.target.value as MuscleGroup;
                setPrimaryMuscle(newP);
                setSecondaryMuscles((prev) => prev.filter((m) => m !== newP));
              }} className="ios-input w-full min-h-[44px] text-base">
                {MUSCLE_GROUPS.map((mg) => (<option key={mg} value={mg} className="bg-[#1C1C1E] text-white">{mg}</option>))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-[#8E8E93]">Muscles secondaires (max 3)</span>
                <span className="text-[11px] text-[#8E8E93] tabular-nums">{secondaryMuscles.length}/3</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableSecondaries.map((sec) => (
                  <button key={sec} type="button" onClick={() => toggleSecondary(sec)} className={`min-h-[36px] rounded-full px-3 py-1 text-xs font-medium transition-colors ${secondaryMuscles.includes(sec) ? 'bg-[#0A84FF] text-white' : 'border border-white/[0.08] bg-[#2C2C2E] text-[#8E8E93] hover:text-white'}`}>
                    {sec}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="ex-guide" className="block text-xs font-medium text-[#8E8E93] mb-1">Consignes d&apos;exécution / Placement (optionnel)</label>
              <textarea id="ex-guide" rows={3} value={setupGuide} onChange={(e) => setSetupGuide(e.target.value)} placeholder="Position des pieds, amplitude, trajectoire..." className="ios-input w-full min-h-[80px] text-base resize-none" />
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full min-h-[44px] rounded-xl bg-[#0A84FF] font-semibold text-white hover:bg-[#0071E3] active:scale-[0.98] disabled:opacity-50 text-base">
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
