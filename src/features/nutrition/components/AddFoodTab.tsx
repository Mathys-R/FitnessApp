'use client';

import { useState, useMemo } from 'react';
import { Search, ArrowLeft } from 'lucide-react';
import type { FoodRow } from '@/features/catalogs/services/nutrition.service';
import { calculateFoodMacros, type LoggedUnit } from '@/lib/math/nutrition.math';

export interface AddFoodTabProps {
  foods: FoodRow[];
  onAdd: (params: { food: FoodRow; quantity: number; unit: LoggedUnit }) => Promise<void>;
}

export function AddFoodTab({ foods, onAdd }: AddFoodTabProps) {
  const [search, setSearch] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodRow | null>(null);
  const [foodQty, setFoodQty] = useState('100');
  const [foodUnit, setFoodUnit] = useState<LoggedUnit>('g');
  const [submitting, setSubmitting] = useState(false);

  const filteredFoods = useMemo(() => {
    const q = search.trim().toLowerCase();
    return foods.filter((f) => !q || f.name.toLowerCase().includes(q) || f.brand?.toLowerCase().includes(q));
  }, [foods, search]);

  const foodMacros = useMemo(() => {
    if (!selectedFood) return null;
    return calculateFoodMacros(selectedFood, parseFloat(foodQty) || 0, foodUnit);
  }, [selectedFood, foodQty, foodUnit]);

  const handleSelect = (food: FoodRow) => {
    setSelectedFood(food);
    const unit: LoggedUnit = food.serving_type === 'unit' ? 'unit' : 'g';
    setFoodUnit(unit);
    setFoodQty(food.serving_type === 'unit' ? '1' : '100');
  };

  const handleConfirm = async () => {
    if (!selectedFood) return;
    setSubmitting(true);
    try {
      await onAdd({ food: selectedFood, quantity: parseFloat(foodQty) || 0, unit: foodUnit });
    } finally {
      setSubmitting(false);
    }
  };

  if (!selectedFood) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8E8E93]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un aliment..."
            className="ios-input min-h-[44px] w-full pl-9 text-base"
          />
        </div>
        <div className="divide-y divide-[#2C2C2E]">
          {filteredFoods.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => handleSelect(f)}
              className="flex min-h-[44px] w-full items-center justify-between py-2 text-left active:opacity-70"
            >
              <div>
                <p className="font-medium text-white">{f.name}</p>
                {f.brand && <p className="text-xs text-[#8E8E93]">{f.brand}</p>}
              </div>
              <span className="text-xs text-[#8E8E93] tabular-nums">
                {f.kcal_per_base} kcal / {f.serving_type === 'unit' ? 'u' : '100g'}
              </span>
            </button>
          ))}
          {filteredFoods.length === 0 && (
            <p className="py-6 text-center text-sm text-[#8E8E93]">Aucun aliment trouvé</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setSelectedFood(null)}
        className="flex min-h-[44px] items-center gap-1 text-sm text-[#0A84FF]"
      >
        <ArrowLeft className="h-4 w-4" /> {"Changer d'aliment"}
      </button>

      <div>
        <h3 className="text-base font-semibold text-white">{selectedFood.name}</h3>
        {selectedFood.brand && <p className="text-xs text-[#8E8E93]">{selectedFood.brand}</p>}
      </div>

      {selectedFood.serving_type === 'both' && (
        <div className="flex gap-2">
          {(['g', 'unit'] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => {
                setFoodUnit(u);
                setFoodQty(u === 'unit' ? '1' : '100');
              }}
              className={`min-h-[44px] flex-1 rounded-xl border text-sm font-medium ${
                foodUnit === u
                  ? 'border-[#0A84FF] bg-[#0A84FF]/20 text-[#0A84FF]'
                  : 'border-[#38383A] bg-[#2C2C2E] text-[#8E8E93]'
              }`}
            >
              {u === 'g' ? 'Grammes (g)' : 'Unité'}
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="text-xs text-[#8E8E93]">
          Quantité ({foodUnit === 'unit' ? 'unités' : 'g'})
        </label>
        <input
          type="number"
          inputMode="decimal"
          value={foodQty}
          onChange={(e) => setFoodQty(e.target.value)}
          className="ios-input min-h-[44px] w-full text-base"
        />
      </div>

      {foodMacros && (
        <div className="rounded-xl bg-[#2C2C2E] p-3 text-center text-sm tabular-nums text-[#8E8E93]">
          <span className="font-semibold text-white">{foodMacros.kcal} kcal</span> • P: {foodMacros.p}g • G:{' '}
          {foodMacros.g}g • L: {foodMacros.l}g
        </div>
      )}

      <button
        type="button"
        disabled={submitting || (parseFloat(foodQty) || 0) <= 0}
        onClick={handleConfirm}
        className="min-h-[44px] w-full rounded-xl bg-[#0A84FF] font-semibold text-white disabled:opacity-50"
      >
        Ajouter
      </button>
    </div>
  );
}
