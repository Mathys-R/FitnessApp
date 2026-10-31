'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/layout/PageHeader';
import { DailyMacroSummary } from '@/features/nutrition/components/DailyMacroSummary';
import { MealCard } from '@/features/nutrition/components/MealCard';
import { AddNutritionItemDrawer } from '@/features/nutrition/components/AddNutritionItemDrawer';
import { NutritionDateNav } from '@/features/nutrition/components/NutritionDateNav';
import {
  getDailyNutrition, addFoodMealEntry, updateFoodMealEntryQuantity,
  addQuickMealEntry, deleteMealEntry, getPartnerInfo, copyMealFromSource,
  type DailyNutritionData, type PartnerInfo,
} from '@/features/nutrition/services/entries.service';
import {
  addRecipeMealEntryWithClonedItems, updateClonedIngredientQuantity, deleteClonedIngredient,
} from '@/features/nutrition/services/recipes.service';
import {
  getActiveFoods, getActiveRecipes, type FoodRow, type RecipeWithIngredients,
} from '@/features/catalogs/services/nutrition.service';
import { toggleExcludeFromTdee } from '@/features/daily-log/services/log.service';
import { sumMacroValues } from '@/lib/math/nutrition.math';
import { getLocalTodayIso, shiftDateIso } from '@/lib/date.utils';
import { MEAL_CATEGORIES_ORDER } from '@/types/domain.types';
import type { MealCategory } from '@/types/database.types';

export default function NutritionPage() {
  const todayIso = getLocalTodayIso();
  const [selectedDate, setSelectedDate] = useState(todayIso);
  const [data, setData] = useState<DailyNutritionData | null>(null);
  const [partner, setPartner] = useState<PartnerInfo | null>(null);
  const [foods, setFoods] = useState<FoodRow[]>([]);
  const [recipes, setRecipes] = useState<RecipeWithIngredients[]>([]);
  const [activeMeal, setActiveMeal] = useState<{ key: MealCategory; label: string } | null>(null);

  const loadDay = useCallback(async (date: string) => {
    try {
      setData(await getDailyNutrition(date));
    } catch {
      toast.error('Erreur chargement du journal');
    }
  }, []);

  useEffect(() => {
    void Promise.all([getActiveFoods(), getActiveRecipes(), getPartnerInfo()]).then(
      ([f, r, p]) => { setFoods(f); setRecipes(r); setPartner(p); }
    );
  }, []);

  useEffect(() => { void loadDay(selectedDate); }, [selectedDate, loadDay]);
  const refresh = () => loadDay(selectedDate);

  const consumedMacros = useMemo(() => sumMacroValues(
    (data?.entries ?? []).map((e) => ({
      kcal: e.total_kcal ?? 0, p: e.total_p ?? 0, g: e.total_g ?? 0, l: e.total_l ?? 0,
    }))
  ), [data?.entries]);

  const copyMeal = async (srcUser: string, srcDate: string, meal: MealCategory, name: string) => {
    if (!data?.dailyLog) return;
    try {
      const count = await copyMealFromSource({
        sourceUserId: srcUser, sourceDate: srcDate, sourceMealType: meal,
        targetDailyLogId: data.dailyLog.id, targetMealType: meal,
      });
      if (count > 0) {
        toast.success(`Repas copié (${name})`);
        await refresh();
      } else {
        toast.error(`Aucun aliment trouvé (${name})`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur copie');
    }
  };

  return (
    <div className="flex flex-col pb-24">
      <PageHeader title="Nutrition" subtitle="Journal & Macro-nutriments" />
      <NutritionDateNav selectedDate={selectedDate} todayIso={todayIso} onDateChange={setSelectedDate} />

      <div className="space-y-4 p-4">
        {!data ? (
          <div className="space-y-4">
            <div className="h-44 animate-pulse rounded-2xl bg-[#1C1C1E]" />
            <div className="h-28 animate-pulse rounded-2xl bg-[#1C1C1E]" />
          </div>
        ) : (
          <>
            <DailyMacroSummary
              dailyLog={data.dailyLog}
              consumedMacros={consumedMacros}
              onToggleExcludeTdee={async (exclude) => {
                await toggleExcludeFromTdee(data.dailyLog.id, exclude);
                setData((p) => p && { ...p, dailyLog: { ...p.dailyLog, exclude_from_tdee: exclude } });
                toast.success(exclude ? 'Exclu du TDEE' : 'Inclus au TDEE');
              }}
            />

            <div className="space-y-3">
              {MEAL_CATEGORIES_ORDER.map((meal) => (
                <MealCard
                  key={meal.key}
                  mealCategory={meal}
                  partnerName={partner?.partner_name}
                  entries={data.entries.filter((e) => e.meal_type === meal.key)}
                  onAddItemClick={() => setActiveMeal(meal)}
                  onCopyYesterday={(cat) => copyMeal(data.dailyLog.user_id, shiftDateIso(selectedDate, -1), cat, 'hier')}
                  onCopyPartner={(cat) => {
                    if (partner) void copyMeal(partner.partner_id, selectedDate, cat, partner.partner_name);
                    else toast.error('Aucun partenaire');
                  }}
                  onDeleteEntry={async (id) => { await deleteMealEntry(id); toast.success('Supprimé'); await refresh(); }}
                  onUpdateFoodQuantity={async (id, food, q, u) => {
                    await updateFoodMealEntryQuantity({ entryId: id, food, newQuantityValue: q, newLoggedUnit: u });
                    await refresh();
                  }}
                  onUpdateClonedIngredient={async (item, q) => {
                    await updateClonedIngredientQuantity({ item, newQuantity: q });
                    await refresh();
                  }}
                  onDeleteClonedIngredient={async (id) => {
                    await deleteClonedIngredient(id);
                    toast.success('Retiré');
                    await refresh();
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {activeMeal && data && (
        <AddNutritionItemDrawer
          open={Boolean(activeMeal)}
          onOpenChange={(open) => !open && setActiveMeal(null)}
          mealType={activeMeal.key}
          mealLabel={activeMeal.label}
          foods={foods}
          recipes={recipes}
          onAddFood={async ({ food, quantity, unit }) => {
            await addFoodMealEntry({ dailyLogId: data.dailyLog.id, mealType: activeMeal.key, food, quantityValue: quantity, loggedUnit: unit });
            toast.success(`${food.name} ajouté`);
            await refresh();
          }}
          onAddRecipe={async ({ recipeId, portions }) => {
            await addRecipeMealEntryWithClonedItems({ dailyLogId: data.dailyLog.id, mealType: activeMeal.key, recipeId, portionsMultiplier: portions });
            toast.success('Plat ajouté');
            await refresh();
          }}
          onAddQuick={async ({ label, macros }) => {
            await addQuickMealEntry({ dailyLogId: data.dailyLog.id, mealType: activeMeal.key, label, macros });
            toast.success('Ajouté');
            await refresh();
          }}
        />
      )}
    </div>
  );
}
