'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { getActiveExercises, archiveExercise, type ExerciseRow } from '@/features/catalogs/services/exercises.service';
import { getActiveFoods, getActiveRecipes, archiveFood, archiveRecipe, type FoodRow, type RecipeWithIngredients } from '@/features/catalogs/services/nutrition.service';
import type { MuscleGroup } from '@/types/domain.types';
import { ExerciseList } from '@/features/catalogs/components/ExerciseList';
import { ExerciseFormDrawer } from '@/features/catalogs/components/ExerciseFormDrawer';
import { FoodList } from '@/features/catalogs/components/FoodList';
import { FoodFormDrawer } from '@/features/catalogs/components/FoodFormDrawer';
import { RecipeList } from '@/features/catalogs/components/RecipeList';
import { RecipeBuilderDrawer } from '@/features/catalogs/components/RecipeBuilderDrawer';

type TabKey = 'exercises' | 'foods' | 'recipes';
const TABS: Array<{ key: TabKey; label: string }> = [
  { key: 'exercises', label: 'Exercices' },
  { key: 'foods', label: 'Aliments' },
  { key: 'recipes', label: 'Mes Plats' },
];

export default function CatalogsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('exercises');
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeWithIngredients[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);

  const [exDrawer, setExDrawer] = useState<{ open: boolean; item: ExerciseRow | null }>({ open: false, item: null });
  const [foodDrawer, setFoodDrawer] = useState<{ open: boolean; item: FoodRow | null }>({ open: false, item: null });
  const [recDrawer, setRecDrawer] = useState<{ open: boolean; item: RecipeWithIngredients | null }>({ open: false, item: null });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [exList, foodList, recList] = await Promise.all([
        getActiveExercises(), getActiveFoods(), getActiveRecipes(),
      ]);
      setExercises(exList);
      setFoods(foodList);
      setRecipes(recList);
    } catch {
      toast.error('Erreur lors du chargement des catalogues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleArchiveEx = async (id: string) => {
    try {
      await archiveExercise(id);
      setExercises((prev) => prev.filter((item) => item.id !== id));
      toast.success('Exercice archivé');
    } catch { toast.error("Impossible d'archiver l'exercice"); }
  };

  const handleArchiveFood = async (id: string) => {
    try {
      await archiveFood(id);
      setFoods((prev) => prev.filter((item) => item.id !== id));
      toast.success('Aliment archivé');
    } catch { toast.error("Impossible d'archiver l'aliment"); }
  };

  const handleArchiveRec = async (id: string) => {
    try {
      await archiveRecipe(id);
      setRecipes((prev) => prev.filter((item) => item.id !== id));
      toast.success('Plat archivé');
    } catch { toast.error("Impossible d'archiver le plat"); }
  };

  const handleSavedEx = (saved: ExerciseRow) => {
    setExercises((p) => {
      const idx = p.findIndex((e) => e.id === saved.id);
      return idx >= 0 ? p.map((e, i) => (i === idx ? saved : e)) : [saved, ...p];
    });
  };

  const handleSavedFood = (saved: FoodRow) => {
    setFoods((p) => {
      const idx = p.findIndex((f) => f.id === saved.id);
      return idx >= 0 ? p.map((f, i) => (i === idx ? saved : f)) : [saved, ...p];
    });
  };

  const handleSavedRec = async () => {
    try { setRecipes(await getActiveRecipes()); } catch { /* silencieux */ }
  };

  return (
    <div className="flex flex-col pb-28">
      <PageHeader title="Catalogues" subtitle="Exercices, Aliments & Plats" />
      <div className="p-4 space-y-4">
        <div className="flex rounded-xl bg-[#1C1C1E] p-1 border border-white/[0.08]">
          {TABS.map(({ key, label }) => (
            <button key={key} type="button" onClick={() => setActiveTab(key)} className={`flex-1 min-h-[40px] rounded-lg text-xs font-semibold transition-all ${activeTab === key ? 'bg-[#0A84FF] text-white shadow-sm' : 'text-[#8E8E93] hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'exercises' && (
          <ExerciseList
            exercises={exercises}
            selectedMuscle={selectedMuscle}
            onSelectMuscle={setSelectedMuscle}
            onEditExercise={(ex) => setExDrawer({ open: true, item: ex })}
            onArchiveExercise={handleArchiveEx}
            onCreateExercise={() => setExDrawer({ open: true, item: null })}
            loading={loading}
          />
        )}
        {activeTab === 'foods' && (
          <FoodList
            foods={foods}
            onEditFood={(food) => setFoodDrawer({ open: true, item: food })}
            onArchiveFood={handleArchiveFood}
            onCreateFood={() => setFoodDrawer({ open: true, item: null })}
            loading={loading}
          />
        )}
        {activeTab === 'recipes' && (
          <RecipeList
            recipes={recipes}
            onEditRecipe={(rec) => setRecDrawer({ open: true, item: rec })}
            onArchiveRecipe={handleArchiveRec}
            onCreateRecipe={() => setRecDrawer({ open: true, item: null })}
            loading={loading}
          />
        )}
      </div>

      <ExerciseFormDrawer
        open={exDrawer.open}
        onOpenChange={(open) => setExDrawer((p) => ({ ...p, open }))}
        exerciseToEdit={exDrawer.item}
        onSaved={handleSavedEx}
      />
      <FoodFormDrawer
        open={foodDrawer.open}
        onOpenChange={(open) => setFoodDrawer((p) => ({ ...p, open }))}
        foodToEdit={foodDrawer.item}
        onSaved={handleSavedFood}
      />
      <RecipeBuilderDrawer
        open={recDrawer.open}
        onOpenChange={(open) => setRecDrawer((p) => ({ ...p, open }))}
        recipeToEdit={recDrawer.item}
        availableFoods={foods}
        onSaved={handleSavedRec}
      />
    </div>
  );
}
