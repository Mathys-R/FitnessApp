'use client';

import { useState } from 'react';
import { Drawer } from 'vaul';
import type { MealCategory } from '@/types/database.types';
import type { FoodRow, RecipeWithIngredients } from '@/features/catalogs/services/nutrition.service';
import type { LoggedUnit, MacroValues } from '@/lib/math/nutrition.math';
import { AddFoodTab } from './AddFoodTab';
import { AddRecipeTab } from './AddRecipeTab';
import { AddQuickTab } from './AddQuickTab';

export interface AddNutritionItemDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mealType: MealCategory;
  mealLabel: string;
  foods: FoodRow[];
  recipes: RecipeWithIngredients[];
  onAddFood: (params: { food: FoodRow; quantity: number; unit: LoggedUnit }) => Promise<void>;
  onAddRecipe: (params: { recipeId: string; portions: number }) => Promise<void>;
  onAddQuick: (params: { label: string; macros: MacroValues }) => Promise<void>;
}

type Tab = 'foods' | 'recipes' | 'quick';

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'foods', label: 'Aliments' },
  { id: 'recipes', label: 'Mes Plats' },
  { id: 'quick', label: 'Quick Add' },
];

export function AddNutritionItemDrawer({
  open,
  onOpenChange,
  mealType,
  mealLabel,
  foods,
  recipes,
  onAddFood,
  onAddRecipe,
  onAddQuick,
}: AddNutritionItemDrawerProps) {
  const [tab, setTab] = useState<Tab>('foods');

  const handleFoodAdd = async (params: { food: FoodRow; quantity: number; unit: LoggedUnit }) => {
    await onAddFood(params);
    onOpenChange(false);
  };

  const handleRecipeAdd = async (params: { recipeId: string; portions: number }) => {
    await onAddRecipe(params);
    onOpenChange(false);
  };

  const handleQuickAdd = async (params: { label: string; macros: MacroValues }) => {
    await onAddQuick(params);
    onOpenChange(false);
  };

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content
          data-meal-type={mealType}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col rounded-t-[20px] border-t border-[#38383A] bg-[#1C1C1E] focus:outline-none"
        >
          <Drawer.Handle className="mx-auto my-3 bg-[#38383A]" />
          <Drawer.Title className="px-4 text-center text-lg font-semibold text-white">
            Ajouter au {mealLabel}
          </Drawer.Title>
          <Drawer.Description className="sr-only">
            Ajouter un aliment, un plat ou un ajout rapide au repas
          </Drawer.Description>

          <div className="px-4 pt-2">
            <div className="flex rounded-xl bg-[#2C2C2E] p-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`min-h-[36px] flex-1 rounded-lg text-sm font-medium transition-colors ${
                    tab === t.id
                      ? 'bg-[#636366] text-white shadow-sm'
                      : 'text-[#8E8E93] hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {tab === 'foods' && <AddFoodTab foods={foods} onAdd={handleFoodAdd} />}
            {tab === 'recipes' && <AddRecipeTab recipes={recipes} onAdd={handleRecipeAdd} />}
            {tab === 'quick' && <AddQuickTab onAdd={handleQuickAdd} />}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
