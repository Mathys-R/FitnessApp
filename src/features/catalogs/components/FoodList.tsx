'use client';

import { useMemo, useState } from 'react';
import { Search, Plus, Pencil, Trash2, Apple } from 'lucide-react';
import type { FoodRow } from '@/features/catalogs/services/nutrition.service';

export interface FoodListProps {
  foods: FoodRow[];
  onEditFood: (food: FoodRow) => void;
  onArchiveFood: (foodId: string) => Promise<void>;
  onCreateFood: () => void;
  loading?: boolean;
}

export function FoodList({
  foods,
  onEditFood,
  onArchiveFood,
  onCreateFood,
  loading = false,
}: FoodListProps) {
  const [search, setSearch] = useState('');
  const [archivingId, setArchivingId] = useState<string | null>(null);

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return foods;
    return foods.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.brand && f.brand.toLowerCase().includes(q))
    );
  }, [foods, search]);

  const handleArchive = async (id: string) => {
    setArchivingId(id);
    try {
      await onArchiveFood(id);
    } finally {
      setArchivingId(null);
    }
  };

  const formatServingBadge = (food: FoodRow) => {
    if (food.serving_type === 'unit') return 'Par Unité';
    if (food.serving_type === 'both') {
      return `100g & Unité (${food.unit_weight_g}g)`;
    }
    return 'Pour 100g';
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
            placeholder="Rechercher un aliment, une marque..."
            className="ios-input w-full min-h-[44px] pl-9 text-base placeholder:text-[#8E8E93]"
          />
        </div>
        <button
          type="button"
          onClick={onCreateFood}
          aria-label="Ajouter un aliment"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-[#0A84FF] text-white active:scale-95 transition-transform"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-2.5 px-4">
        {loading ? (
          <div className="ios-card p-8 text-center text-sm text-[#8E8E93]">
            Chargement des aliments...
          </div>
        ) : filteredFoods.length === 0 ? (
          <div className="ios-card space-y-3 p-8 text-center">
            <Apple className="mx-auto h-8 w-8 text-[#8E8E93]" />
            <p className="text-sm font-medium text-white">Aucun aliment trouvé</p>
            <p className="text-xs text-[#8E8E93]">
              {search
                ? 'Aucun résultat pour cette recherche.'
                : 'Commencez par ajouter un aliment ou un ingrédient au catalogue.'}
            </p>
            <button
              type="button"
              onClick={onCreateFood}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-[#0A84FF] px-4 text-xs font-semibold text-white active:scale-95 transition-transform"
            >
              <Plus className="h-4 w-4" /> Nouvel aliment
            </button>
          </div>
        ) : (
          filteredFoods.map((food) => (
            <div key={food.id} className="ios-card space-y-2.5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-white leading-tight break-words">
                      {food.name}
                    </h3>
                    {food.brand && (
                      <span className="text-xs text-[#8E8E93] truncate">
                        • {food.brand}
                      </span>
                    )}
                  </div>
                  <span className="inline-block rounded-full bg-[#2C2C2E] px-2 py-0.5 text-[11px] font-medium text-[#8E8E93]">
                    {formatServingBadge(food)}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => onEditFood(food)}
                    aria-label={`Modifier ${food.name}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#8E8E93] hover:text-white active:scale-90 transition-transform"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={archivingId === food.id}
                    onClick={() => handleArchive(food.id)}
                    aria-label={`Archiver ${food.name}`}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#8E8E93] hover:text-[#FF453A] disabled:opacity-40 active:scale-90 transition-transform"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-2 text-xs tabular-nums">
                <span className="font-semibold text-[#FF375F]">
                  {food.kcal_per_base} kcal
                </span>
                <span className="text-[#32ADE6]">
                  P: {food.proteins_per_base}g
                </span>
                <span className="text-[#FF9F0A]">
                  G: {food.carbs_per_base}g
                </span>
                <span className="text-[#BF5AF2]">
                  L: {food.fats_per_base}g
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

