'use client';

import { useState, useEffect, useMemo } from 'react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import NumberFlow from '@number-flow/react';
import { Plus } from 'lucide-react';
import {
  saveRecipeSingleServing,
  type RecipeWithIngredients,
  type FoodRow,
} from '@/features/catalogs/services/nutrition.service';
import {
  normalizeQuantityPerSingleServing,
  calculateFoodMacros,
  sumMacroValues,
  type LoggedUnit,
} from '@/lib/math/nutrition.math';
import { RecipeIngredientRowItem, type IngredientRowState } from './RecipeIngredientRowItem';

export interface RecipeBuilderDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipeToEdit?: RecipeWithIngredients | null;
  availableFoods: FoodRow[];
  onSaved: (recipeId: string) => void;
}

export function RecipeBuilderDrawer({
  open,
  onOpenChange,
  recipeToEdit,
  availableFoods,
  onSaved,
}: RecipeBuilderDrawerProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [servingsPrepared, setServingsPrepared] = useState(1);
  const [ingredients, setIngredients] = useState<IngredientRowState[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (recipeToEdit) {
        setName(recipeToEdit.name);
        setDescription(recipeToEdit.description || '');
        setServingsPrepared(1);
        setIngredients(recipeToEdit.recipe_ingredients.map((ing) => ({
          food_id: ing.food_id,
          raw_quantity: String(ing.quantity_value),
          logged_unit: ing.logged_unit as LoggedUnit,
        })));
      } else {
        setName('');
        setDescription('');
        setServingsPrepared(1);
        setIngredients(availableFoods.length > 0
          ? [{ food_id: availableFoods[0].id, raw_quantity: '', logged_unit: availableFoods[0].serving_type === 'unit' ? 'unit' : 'g' }]
          : []);
      }
    }
  }, [open, recipeToEdit, availableFoods]);

  const foodsMap = useMemo(() => new Map(availableFoods.map((f) => [f.id, f])), [availableFoods]);

  const addIngredient = () => {
    if (!availableFoods.length) return toast.error('Aucun aliment disponible');
    const f0 = availableFoods[0];
    setIngredients((p) => [...p, { food_id: f0.id, raw_quantity: '', logged_unit: f0.serving_type === 'unit' ? 'unit' : 'g' }]);
  };

  const removeIngredient = (idx: number) => setIngredients((p) => p.filter((_, i) => i !== idx));
  const updateFood = (idx: number, foodId: string) => {
    const food = foodsMap.get(foodId);
    setIngredients((p) => p.map((ing, i) => i === idx ? { ...ing, food_id: foodId, logged_unit: food?.serving_type === 'unit' ? 'unit' : 'g' } : ing));
  };
  const updateValue = (idx: number, patch: Partial<IngredientRowState>) => {
    setIngredients((p) => p.map((ing, i) => (i === idx ? { ...ing, ...patch } : ing)));
  };

  const singleServingMacros = useMemo(() => {
    const divisor = servingsPrepared > 0 ? servingsPrepared : 1;
    const computed = ingredients.map((ing) => {
      const food = foodsMap.get(ing.food_id);
      if (!food) return { kcal: 0, p: 0, g: 0, l: 0 };
      const rawQty = parseFloat(ing.raw_quantity.replace(',', '.').trim()) || 0;
      return calculateFoodMacros(food, normalizeQuantityPerSingleServing(rawQty, divisor), ing.logged_unit);
    });
    return sumMacroValues(computed);
  }, [ingredients, servingsPrepared, foodsMap]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Nom du plat obligatoire');
    const drafts = ingredients
      .map((ing) => ({
        food_id: ing.food_id,
        raw_quantity: parseFloat(ing.raw_quantity.replace(',', '.').trim()) || 0,
        logged_unit: ing.logged_unit,
      }))
      .filter((d) => d.raw_quantity > 0 && d.food_id);

    if (!drafts.length) return toast.error('Ajoutez au moins 1 ingrédient avec une quantité > 0');

    setIsSubmitting(true);
    try {
      const id = await saveRecipeSingleServing({
        id: recipeToEdit?.id,
        name: name.trim(),
        description: description.trim() || undefined,
        servingsPrepared,
        ingredients: drafts,
      });
      toast.success(recipeToEdit ? 'Plat mis à jour' : 'Plat enregistré');
      onSaved(id);
      onOpenChange(false);
    } catch {
      toast.error("Erreur lors de l'enregistrement");
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
          <Drawer.Title className="text-center text-lg font-semibold text-white">
            {recipeToEdit ? 'Modifier le plat' : 'Composer un plat'}
          </Drawer.Title>
          <Drawer.Description className="text-center text-xs text-[#8E8E93] mb-4">
            Stocké automatiquement pour 1 portion unitaire
          </Drawer.Description>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du plat *" className="ios-input w-full min-h-[44px] text-base" />
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optionnel)" className="ios-input w-full min-h-[44px] text-base" />
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#2C2C2E]/60 p-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white">Meal Prep (Diviseur)</span>
                <p className="text-[11px] text-[#8E8E93]">Quantités pour combien de parts ?</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setServingsPrepared((p) => Math.max(1, p - 1))} className="min-h-[44px] min-w-[44px] rounded-lg bg-[#38383A] text-white font-bold active:scale-95">-</button>
                <span className="w-8 text-center text-base font-bold text-white tabular-nums">{servingsPrepared}</span>
                <button type="button" onClick={() => setServingsPrepared((p) => p + 1)} className="min-h-[44px] min-w-[44px] rounded-lg bg-[#38383A] text-white font-bold active:scale-95">+</button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Ingrédients ({ingredients.length})</span>
                <button type="button" onClick={addIngredient} className="inline-flex items-center gap-1 text-xs font-medium text-[#0A84FF]">
                  <Plus className="h-4 w-4" /> Ajouter
                </button>
              </div>
              {ingredients.map((ing, idx) => (
                <RecipeIngredientRowItem key={idx} ingredient={ing} index={idx} availableFoods={availableFoods} foodsMap={foodsMap} onUpdateFood={updateFood} onUpdateValue={updateValue} onRemove={removeIngredient} />
              ))}
            </div>

            <div className="rounded-xl bg-[#2C2C2E] p-3">
              <span className="text-[11px] uppercase tracking-wider text-[#8E8E93]">Pour 1 portion de référence :</span>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm tabular-nums">
                <span className="font-bold text-[#FF375F]"><NumberFlow value={singleServingMacros.kcal} /> kcal</span>
                <span className="text-[#32ADE6]">P: <NumberFlow value={singleServingMacros.p} />g</span>
                <span className="text-[#FF9F0A]">G: <NumberFlow value={singleServingMacros.g} />g</span>
                <span className="text-[#BF5AF2]">L: <NumberFlow value={singleServingMacros.l} />g</span>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="w-full min-h-[44px] rounded-xl bg-[#0A84FF] font-semibold text-white hover:bg-[#0071E3] active:scale-[0.98] disabled:opacity-50 text-base">
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer le plat'}
            </button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
