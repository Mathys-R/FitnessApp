'use client';

import { useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, Utensils } from 'lucide-react';
import type { RecipeWithIngredients } from '@/features/catalogs/services/nutrition.service';
import { calculateFoodMacros, sumMacroValues } from '@/lib/math/nutrition.math';

export interface RecipeListProps {
  recipes: RecipeWithIngredients[];
  onEditRecipe: (recipe: RecipeWithIngredients) => void;
  onArchiveRecipe: (recipeId: string) => Promise<void>;
  onCreateRecipe: () => void;
  loading?: boolean;
}

export function RecipeList({
  recipes,
  onEditRecipe,
  onArchiveRecipe,
  onCreateRecipe,
  loading = false,
}: RecipeListProps) {
  const [search, setSearch] = useState('');
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const recipesWithCalculatedMacros = useMemo(() => {
    return recipes.map((r) => {
      const macrosList = (r.recipe_ingredients || []).map((ing) =>
        calculateFoodMacros(ing.food, ing.quantity_value, ing.logged_unit)
      );
      const singleServingMacros = sumMacroValues(macrosList);
      return { recipe: r, macros: singleServingMacros };
    });
  }, [recipes]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return recipesWithCalculatedMacros;

    return recipesWithCalculatedMacros.filter(({ recipe: r }) => {
      const nameMatch = r.name.toLowerCase().includes(q);
      const descMatch = !!r.description && r.description.toLowerCase().includes(q);
      const ingMatch = (r.recipe_ingredients || []).some(
        (ing) => ing.food && ing.food.name.toLowerCase().includes(q)
      );
      return nameMatch || descMatch || ingMatch;
    });
  }, [recipesWithCalculatedMacros, search]);

  const handleArchive = async (id: string) => {
    setArchivingId(id);
    try {
      await onArchiveRecipe(id);
    } finally {
      setArchivingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un plat, un ingrédient..."
            className="ios-input w-full min-h-[44px] pl-9 text-base placeholder:text-[#8E8E93]"
          />
        </div>
        <button
          type="button"
          onClick={onCreateRecipe}
          aria-label="Créer un plat"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#0A84FF] text-white active:scale-95 transition-transform"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-2.5 px-4">
        {loading ? (
          <div className="ios-card p-8 text-center text-sm text-[#8E8E93]">
            Chargement des plats...
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="ios-card space-y-3 p-8 text-center">
            <Utensils className="mx-auto h-8 w-8 text-[#8E8E93]" />
            <p className="text-sm font-medium text-white">Aucun plat composé</p>
            <p className="text-xs text-[#8E8E93]">
              {search
                ? 'Aucun plat ne correspond à vos critères.'
                : 'Composez vos recettes et Meal Preps partagés avec votre partenaire.'}
            </p>
            <button
              type="button"
              onClick={onCreateRecipe}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0A84FF] px-4 text-xs font-semibold text-white active:scale-95 transition-transform"
            >
              <Plus className="h-4 w-4" /> Composer un plat
            </button>
          </div>
        ) : (
          filteredItems.map(({ recipe: r, macros }) => {
            const ingCount = r.recipe_ingredients?.length || 0;
            return (
              <div key={r.id} className="ios-card space-y-2.5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-white leading-tight break-words">
                        {r.name}
                      </h3>
                      <span className="rounded-full bg-[#2C2C2E] px-2 py-0.5 text-[10px] text-[#8E8E93]">
                        {ingCount} ingrédient{ingCount > 1 ? 's' : ''}
                      </span>
                    </div>
                    {r.description && (
                      <p className="text-xs text-[#8E8E93] line-clamp-1">{r.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditRecipe(r)}
                      aria-label={`Modifier ${r.name}`}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#8E8E93] hover:text-white active:scale-90 transition-transform"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      disabled={archivingId === r.id}
                      onClick={() => handleArchive(r.id)}
                      aria-label={`Archiver ${r.name}`}
                      className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#8E8E93] hover:text-[#FF453A] disabled:opacity-40 active:scale-90 transition-transform"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-2 text-xs tabular-nums">
                  <span className="font-semibold text-[#FF375F]">{macros.kcal} kcal <span className="text-[10px] font-normal text-[#8E8E93]">/ part</span></span>
                  <span className="text-[#32ADE6]">P: {macros.p}g</span>
                  <span className="text-[#FF9F0A]">G: {macros.g}g</span>
                  <span className="text-[#BF5AF2]">L: {macros.l}g</span>
                </div>

                {r.recipe_ingredients && r.recipe_ingredients.length > 0 && (
                  <p className="text-[11px] text-[#8E8E93] leading-relaxed line-clamp-2">
                    {r.recipe_ingredients
                      .map((ing) => `${ing.food?.name || 'Aliment'} (${ing.quantity_value}${ing.logged_unit === 'unit' ? 'u' : 'g'})`)
                      .join(', ')}
                  </p>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

