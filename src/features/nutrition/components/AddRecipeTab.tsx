'use client';

import { useState, useMemo } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import type { RecipeWithIngredients } from '@/features/catalogs/services/nutrition.service';
import {
  calculateFoodMacros,
  sumMacroValues,
  roundMacro,
  type MacroValues,
} from '@/lib/math/nutrition.math';

export interface AddRecipeTabProps {
  recipes: RecipeWithIngredients[];
  onAdd: (params: { recipeId: string; portions: number }) => Promise<void>;
}

export function AddRecipeTab({ recipes, onAdd }: AddRecipeTabProps) {
  const [search, setSearch] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeWithIngredients | null>(null);
  const [portions, setPortions] = useState('1');
  const [submitting, setSubmitting] = useState(false);

  const filteredRecipes = useMemo(() => {
    const q = search.trim().toLowerCase();
    return recipes.filter((r) => !q || r.name.toLowerCase().includes(q));
  }, [recipes, search]);

  const recipeBaseMacros = (r: RecipeWithIngredients): MacroValues =>
    sumMacroValues(
      (r.recipe_ingredients ?? []).map((i) =>
        i.food
          ? calculateFoodMacros(i.food, i.quantity_value, i.logged_unit)
          : { kcal: 0, p: 0, g: 0, l: 0 }
      )
    );

  const recipeMacros = useMemo(() => {
    if (!selectedRecipe) return null;
    const base = recipeBaseMacros(selectedRecipe);
    const p = Math.max(0, parseFloat(portions) || 0);
    return {
      kcal: roundMacro(base.kcal * p),
      p: roundMacro(base.p * p),
      g: roundMacro(base.g * p),
      l: roundMacro(base.l * p),
    };
  }, [selectedRecipe, portions]);

  const handleConfirm = async () => {
    if (!selectedRecipe) return;
    const p = Math.max(0.1, parseFloat(portions) || 1);
    setSubmitting(true);
    try {
      await onAdd({ recipeId: selectedRecipe.id, portions: p });
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedRecipe) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une recette..."
            className="ios-input min-h-[44px] w-full pl-9 text-base"
          />
        </div>
        <div className="divide-y divide-[#2C2C2E]">
          {filteredRecipes.map((r) => {
            const m = recipeBaseMacros(r);
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setSelectedRecipe(r);
                  setPortions('1');
                }}
                className="flex min-h-[44px] w-full items-center justify-between py-2 text-left active:opacity-70"
              >
                <div>
                  <p className="font-medium text-white">{r.name}</p>
                  <p className="text-xs text-[#8E8E93]">
                    {r.recipe_ingredients?.length || 0} ingrédients
                  </p>
                </div>
                <span className="text-xs text-[#8E8E93] tabular-nums">{m.kcal} kcal</span>
              </button>
            );
          })}
          {filteredRecipes.length === 0 && (
            <p className="py-6 text-center text-sm text-[#8E8E93]">Aucune recette trouvée</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setSelectedRecipe(null)}
        className="flex min-h-[44px] items-center gap-1 text-sm text-[#0A84FF]"
      >
        <ArrowLeft className="h-4 w-4" /> Changer de plat
      </button>

      <h3 className="text-base font-semibold text-white">{selectedRecipe.name}</h3>

      <div>
        <label className="text-xs text-[#8E8E93]">Nombre de portions</label>
        <input
          type="number"
          step="0.1"
          inputMode="decimal"
          value={portions}
          onChange={(e) => setPortions(e.target.value)}
          className="ios-input min-h-[44px] w-full text-base"
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {['0.5', '1', '1.5', '2'].map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setPortions(p)}
            className={`min-h-[44px] rounded-xl border text-sm font-medium ${
              portions === p
                ? 'border-[#0A84FF] bg-[#0A84FF]/20 text-[#0A84FF]'
                : 'border-[#38383A] bg-[#2C2C2E] text-white'
            }`}
          >
            {p} part
          </button>
        ))}
      </div>

      {recipeMacros && (
        <div className="rounded-xl bg-[#2C2C2E] p-3 text-center text-sm tabular-nums text-[#8E8E93]">
          <span className="font-semibold text-white">{recipeMacros.kcal} kcal</span> • P:{' '}
          {recipeMacros.p}g • G: {recipeMacros.g}g • L: {recipeMacros.l}g
        </div>
      )}

      <button
        type="button"
        disabled={submitting || (parseFloat(portions) || 0) <= 0}
        onClick={handleConfirm}
        className="min-h-[44px] w-full rounded-xl bg-[#0A84FF] font-semibold text-white disabled:opacity-50"
      >
        Ajouter au repas
      </button>
    </div>
  );
}
