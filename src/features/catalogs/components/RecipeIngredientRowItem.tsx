'use client';

import { Trash2 } from 'lucide-react';
import type { FoodRow } from '@/features/catalogs/services/nutrition.service';
import type { LoggedUnit } from '@/lib/math/nutrition.math';

export interface IngredientRowState {
  food_id: string;
  raw_quantity: string;
  logged_unit: LoggedUnit;
}

export interface RecipeIngredientRowItemProps {
  ingredient: IngredientRowState;
  index: number;
  availableFoods: FoodRow[];
  foodsMap: Map<string, FoodRow>;
  onUpdateFood: (idx: number, foodId: string) => void;
  onUpdateValue: (idx: number, patch: Partial<IngredientRowState>) => void;
  onRemove: (idx: number) => void;
}

export function RecipeIngredientRowItem({
  ingredient,
  index,
  availableFoods,
  foodsMap,
  onUpdateFood,
  onUpdateValue,
  onRemove,
}: RecipeIngredientRowItemProps) {
  const food = foodsMap.get(ingredient.food_id);
  const isBoth = food?.serving_type === 'both';

  return (
    <div className="flex items-center gap-2 rounded-xl bg-[#2C2C2E]/50 p-2">
      <select
        value={ingredient.food_id}
        onChange={(e) => onUpdateFood(index, e.target.value)}
        className="ios-input flex-1 min-h-[44px] text-base"
      >
        {availableFoods.map((f) => (
          <option key={f.id} value={f.id} className="bg-[#1C1C1E] text-white">
            {f.name}
          </option>
        ))}
      </select>

      <input
        type="text"
        inputMode="decimal"
        value={ingredient.raw_quantity}
        onChange={(e) => onUpdateValue(index, { raw_quantity: e.target.value })}
        placeholder="Qté"
        className="ios-input w-20 min-h-[44px] text-center text-base tabular-nums"
      />

      {isBoth ? (
        <div className="flex rounded-lg bg-[#1C1C1E] p-0.5 border border-white/[0.08]">
          <button
            type="button"
            onClick={() => onUpdateValue(index, { logged_unit: 'g' })}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              ingredient.logged_unit === 'g'
                ? 'bg-[#0A84FF] text-white font-bold'
                : 'text-[#8E8E93]'
            }`}
          >
            g
          </button>
          <button
            type="button"
            onClick={() => onUpdateValue(index, { logged_unit: 'unit' })}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              ingredient.logged_unit === 'unit'
                ? 'bg-[#0A84FF] text-white font-bold'
                : 'text-[#8E8E93]'
            }`}
          >
            u
          </button>
        </div>
      ) : (
        <span className="w-8 text-center text-xs font-medium text-[#8E8E93]">
          {ingredient.logged_unit}
        </span>
      )}

      <button
        type="button"
        onClick={() => onRemove(index)}
        aria-label="Supprimer ingrédient"
        className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#8E8E93] hover:text-[#FF453A]"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

