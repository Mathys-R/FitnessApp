'use client';

import { useState } from 'react';
import { ChevronDown, Trash2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { MealEntryWithItems, MealEntryItemRow } from '@/features/nutrition/services/entries.service';

export interface RecipeSubmenuAccordionProps {
  entry: MealEntryWithItems;
  onUpdateIngredientQuantity?: (item: MealEntryItemRow, newQuantity: number) => Promise<void> | void;
  onDeleteIngredient?: (itemId: string) => Promise<void> | void;
  onDeleteRecipeEntry?: (entryId: string) => Promise<void> | void;
  className?: string;
}

export function RecipeSubmenuAccordion({
  entry,
  onUpdateIngredientQuantity,
  onDeleteIngredient,
  onDeleteRecipeEntry,
  className = '',
}: RecipeSubmenuAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const portionCount = entry.quantity_value ?? 1;

  const handleSaveQuantity = async (item: MealEntryItemRow) => {
    const parsed = parseFloat(editValue.replace(',', '.'));
    if (!Number.isNaN(parsed) && parsed > 0) {
      await onUpdateIngredientQuantity?.(item, parsed);
    }
    setEditingItemId(null);
  };

  return (
    <div className={`rounded-2xl bg-[#1C1C1E] border border-white/[0.06] overflow-hidden ${className}`}>
      {/* Ligne parente du Plat Composé */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen((prev) => !prev)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen((p) => !p); } }}
        className="flex min-h-[56px] w-full items-center justify-between p-3.5 text-left cursor-pointer transition-colors active:bg-white/[0.04]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ duration: 0.2 }} className="flex shrink-0">
            <ChevronDown className="h-5 w-5 text-[#8E8E93]" />
          </motion.div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white truncate text-base">{entry.label}</span>
              <span className="shrink-0 rounded-full bg-[#0A84FF]/15 px-2 py-0.5 text-xs font-semibold text-[#0A84FF] tabular-nums">
                {portionCount} part{portionCount > 1 ? 's' : ''}
              </span>
            </div>
            <p className="text-xs text-[#8E8E93] tabular-nums">{entry.total_p}P • {entry.total_g}G • {entry.total_l}L</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-semibold text-white text-sm tabular-nums">{entry.total_kcal} kcal</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDeleteRecipeEntry?.(entry.id); }}
            aria-label="Supprimer le plat"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#8E8E93] hover:text-[#FF453A]"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Dépliage Accordéon : Sous-ingrédients */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] bg-[#2C2C2E] rounded-xl m-2 p-3 space-y-2">
              <p className="text-[11px] text-[#8E8E93] leading-snug">
                Ajustements au gramme près pour aujourd&apos;hui (recette du catalogue inchangée)
              </p>
              <div className="space-y-1.5">
                {entry.meal_entry_items.map((item) => {
                  const isEditing = editingItemId === item.id;
                  return (
                    <div key={item.id} className="flex min-h-[44px] items-center justify-between rounded-xl bg-[#1C1C1E]/60 px-3 py-1.5">
                      <div className="min-w-0 pr-2">
                        <p className="text-sm font-medium text-white truncate">{item.ingredient_name}</p>
                        <p className="text-xs text-[#8E8E93] tabular-nums">{item.kcal} kcal | {item.p}P {item.g}G {item.l}L</p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="ios-input w-16 min-h-[44px] text-center text-base tabular-nums py-1"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveQuantity(item);
                                if (e.key === 'Escape') setEditingItemId(null);
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveQuantity(item)}
                              aria-label="Valider la quantité"
                              className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#30D158]"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setEditingItemId(item.id); setEditValue(String(item.quantity_value)); }}
                            className="flex min-h-[44px] items-center px-2 text-xs font-semibold text-[#0A84FF] tabular-nums hover:underline"
                          >
                            {item.quantity_value} {item.logged_unit === 'unit' ? 'u' : 'g'}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onDeleteIngredient?.(item.id)}
                          aria-label="Supprimer l'ingrédient"
                          className="flex min-h-[44px] min-w-[44px] items-center justify-center text-[#8E8E93] hover:text-[#FF453A]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
