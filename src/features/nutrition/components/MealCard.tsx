'use client';

import { useState } from 'react';
import { Plus, MoreVertical, Copy, Users, Trash2, Check } from 'lucide-react';
import type { MealCategory } from '@/types/database.types';
import type { MealEntryWithItems, MealEntryItemRow, FoodRow } from '@/features/nutrition/services/entries.service';
import type { LoggedUnit, MacroValues } from '@/lib/math/nutrition.math';
import { RecipeSubmenuAccordion } from './RecipeSubmenuAccordion';

export interface MealCardProps {
  mealCategory: { key: MealCategory; label: string };
  entries: MealEntryWithItems[];
  partnerName?: string | null;
  onAddItemClick: (mealCategory: MealCategory) => void;
  onCopyYesterday?: (mealCategory: MealCategory) => Promise<void> | void;
  onCopyPartner?: (mealCategory: MealCategory) => Promise<void> | void;
  onDeleteEntry?: (entryId: string) => Promise<void> | void;
  onUpdateFoodQuantity?: (entryId: string, food: FoodRow, newQty: number, unit: LoggedUnit) => Promise<void> | void;
  onUpdateQuickAdd?: (entryId: string, label: string, macros: MacroValues) => Promise<void> | void;
  onUpdateClonedIngredient?: (item: MealEntryItemRow, newQuantity: number) => Promise<void> | void;
  onDeleteClonedIngredient?: (itemId: string) => Promise<void> | void;
  className?: string;
}

export function MealCard({
  mealCategory, entries, partnerName, onAddItemClick, onCopyYesterday,
  onCopyPartner, onDeleteEntry, onUpdateFoodQuantity, onUpdateClonedIngredient,
  onDeleteClonedIngredient, className = '',
}: MealCardProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editQty, setEditQty] = useState('');

  const totalKcal = Math.round(entries.reduce((sum, e) => sum + (e.total_kcal || 0), 0));

  const handleSaveQuantity = async (entry: MealEntryWithItems) => {
    const val = parseFloat(editQty.replace(',', '.'));
    if (!Number.isNaN(val) && val > 0 && onUpdateFoodQuantity && entry.food) {
      await onUpdateFoodQuantity(entry.id, entry.food, val, (entry.logged_unit as LoggedUnit) || 'g');
    }
    setEditingEntryId(null);
  };

  return (
    <div className={`ios-card rounded-2xl border border-[#38383A] bg-[#1C1C1E] p-4 ${className}`}>
      {/* En-tête de Repas */}
      <div className="flex items-center justify-between pb-3 border-b border-[#38383A]/60">
        <div className="flex items-baseline gap-2">
          <h3 className="text-base font-semibold text-white tracking-tight">{mealCategory.label}</h3>
          <span className="text-xs font-medium text-[#8E8E93] tabular-nums">{totalKcal} kcal</span>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => onAddItemClick(mealCategory.key)}
            aria-label="Ajouter un aliment"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[#0A84FF] active:bg-white/10"
          >
            <Plus className="h-5 w-5" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="Menu d'actions du repas"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-[#8E8E93] hover:text-white active:bg-white/10"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-20" onClick={() => setIsMenuOpen(false)} />
                <div className="absolute right-0 top-12 z-30 min-w-[230px] rounded-xl border border-[#38383A] bg-[#2C2C2E] p-1 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => { setIsMenuOpen(false); void onCopyYesterday?.(mealCategory.key); }}
                    className="flex w-full min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-left text-sm text-white active:bg-white/10"
                  >
                    <Copy className="h-4 w-4 text-[#8E8E93]" />
                    <span>Copier mon repas d&apos;hier</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsMenuOpen(false); void onCopyPartner?.(mealCategory.key); }}
                    className="flex w-full min-h-[44px] items-center gap-2.5 rounded-lg px-3 text-left text-sm text-white active:bg-white/10"
                  >
                    <Users className="h-4 w-4 text-[#8E8E93]" />
                    <span>{partnerName ? `Importer le repas de ${partnerName}` : 'Importer le repas du partenaire'}</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Corps de Repas */}
      {entries.length === 0 ? (
        <p className="py-4 text-center text-sm text-[#8E8E93]">Aucun aliment enregistré</p>
      ) : (
        <div className="divide-y divide-[#38383A]/40">
          {entries.map((entry) => {
            if (entry.entry_type === 'recipe') {
              return (
                <div key={entry.id} className="py-2">
                  <RecipeSubmenuAccordion
                    entry={entry}
                    onUpdateIngredientQuantity={onUpdateClonedIngredient}
                    onDeleteIngredient={onDeleteClonedIngredient}
                    onDeleteRecipeEntry={onDeleteEntry}
                  />
                </div>
              );
            }
            const isFood = entry.entry_type === 'food';
            const isEditing = editingEntryId === entry.id;

            return (
              <div key={entry.id} className="flex min-h-[44px] items-center justify-between py-2.5">
                <div className="flex-1 min-w-0 pr-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="truncate text-sm font-medium text-white">{entry.label}</span>
                    {isFood && (isEditing ? (
                      <form onSubmit={(e) => { e.preventDefault(); void handleSaveQuantity(entry); }} className="flex items-center gap-1">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={editQty}
                          onChange={(e) => setEditQty(e.target.value)}
                          className="ios-input h-8 w-16 px-1.5 text-center text-base tabular-nums"
                          autoFocus
                        />
                        <button type="submit" aria-label="Valider la quantité" className="flex h-8 w-8 items-center justify-center text-[#30D158]">
                          <Check className="h-4 w-4" />
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setEditingEntryId(entry.id); setEditQty(String(entry.quantity_value ?? '')); }}
                        className="rounded-md bg-[#2C2C2E] px-2 py-0.5 text-xs text-[#8E8E93] hover:text-white tabular-nums active:bg-white/10"
                        aria-label={`Modifier la quantité de ${entry.label}`}
                      >
                        {entry.quantity_value} {entry.logged_unit === 'unit' ? 'u' : 'g'}
                      </button>
                    ))}
                  </div>
                  <div className="text-xs text-[#8E8E93] tabular-nums mt-0.5">
                    {Math.round(entry.total_kcal || 0)} kcal • {Math.round(entry.total_p || 0)}P {Math.round(entry.total_g || 0)}G {Math.round(entry.total_l || 0)}L
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void onDeleteEntry?.(entry.id)}
                  aria-label={`Supprimer ${entry.label}`}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl text-[#8E8E93] hover:text-[#FF453A] active:bg-white/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
