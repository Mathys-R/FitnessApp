'use client';

import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { Calculator } from 'lucide-react';
import { createOrUpdateFood, type FoodRow } from '@/features/catalogs/services/nutrition.service';
import { calculateKcalFromMacros } from '@/lib/math/nutrition.math';
import type { Database } from '@/types/database.types';

type FoodServingType = Database['public']['Enums']['food_serving_type'];

const MACRO_FIELDS = [
  { id: 'f-kcal', key: 'kcal', label: 'Calories', unit: 'kcal', color: 'text-[#FF375F]' },
  { id: 'f-prot', key: 'proteins', label: 'Protéines', unit: 'g', color: 'text-[#32ADE6]' },
  { id: 'f-carbs', key: 'carbs', label: 'Glucides', unit: 'g', color: 'text-[#FF9F0A]' },
  { id: 'f-fats', key: 'fats', label: 'Lipides', unit: 'g', color: 'text-[#BF5AF2]' },
] as const;

type MacroKey = (typeof MACRO_FIELDS)[number]['key'];

export interface FoodFormDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  foodToEdit?: FoodRow | null;
  onSaved: (saved: FoodRow) => void;
}

export function FoodFormDrawer({ open, onOpenChange, foodToEdit, onSaved }: FoodFormDrawerProps) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [servingType, setServingType] = useState<FoodServingType>('100g');
  const [unitWeightG, setUnitWeightG] = useState('100');
  const [macros, setMacros] = useState<Record<MacroKey, string>>({
    kcal: '', proteins: '', carbs: '', fats: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      if (foodToEdit) {
        setName(foodToEdit.name);
        setBrand(foodToEdit.brand || '');
        setServingType(foodToEdit.serving_type);
        setUnitWeightG(String(foodToEdit.unit_weight_g || 100));
        setMacros({
          kcal: String(foodToEdit.kcal_per_base),
          proteins: String(foodToEdit.proteins_per_base),
          carbs: String(foodToEdit.carbs_per_base),
          fats: String(foodToEdit.fats_per_base),
        });
      } else {
        setName('');
        setBrand('');
        setServingType('100g');
        setUnitWeightG('100');
        setMacros({ kcal: '', proteins: '', carbs: '', fats: '' });
      }
    }
  }, [open, foodToEdit]);

  const parseNum = (val: string) => {
    const n = parseFloat(val.replace(',', '.').trim());
    return isNaN(n) ? 0 : n;
  };

  const handleAutoKcal = () => {
    const calc = calculateKcalFromMacros(parseNum(macros.proteins), parseNum(macros.carbs), parseNum(macros.fats));
    setMacros((prev) => ({ ...prev, kcal: String(calc) }));
    toast.info(`Calories calculées : ${calc} kcal`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error("Nom de l'aliment obligatoire");
    const unitW = parseNum(unitWeightG);
    if (servingType === 'both' && unitW <= 0) return toast.error("Le poids d'une unité doit être > 0");

    setIsSubmitting(true);
    try {
      const saved = await createOrUpdateFood({
        id: foodToEdit?.id,
        name: name.trim(),
        brand: brand.trim() || null,
        serving_type: servingType,
        unit_weight_g: servingType === 'both' ? unitW : unitW || 100,
        kcal_per_base: parseNum(macros.kcal),
        proteins_per_base: parseNum(macros.proteins),
        carbs_per_base: parseNum(macros.carbs),
        fats_per_base: parseNum(macros.fats),
        is_archived: false,
      });
      toast.success(foodToEdit ? 'Aliment mis à jour' : 'Aliment créé');
      onSaved(saved);
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
            {foodToEdit ? "Modifier l'aliment" : 'Nouvel aliment'}
          </Drawer.Title>
          <Drawer.Description className="text-center text-xs text-[#8E8E93] mb-4">
            Catalogue nutritionnel partagé
          </Drawer.Description>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom de l'aliment *" className="ios-input w-full min-h-[44px] text-base" />
              <input type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Marque (optionnel)" className="ios-input w-full min-h-[44px] text-base" />
            </div>
            <div>
              <span className="block text-xs font-medium text-[#8E8E93] mb-1.5">Mode de mesure *</span>
              <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#2C2C2E] p-1">
                {(['100g', 'unit', 'both'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setServingType(m)} className={`min-h-[38px] rounded-lg text-xs font-medium transition-all ${servingType === m ? 'bg-[#0A84FF] text-white shadow-sm' : 'text-[#8E8E93] hover:text-white'}`}>
                    {m === '100g' ? 'Pour 100g' : m === 'unit' ? 'Par unité' : '100g & Unité'}
                  </button>
                ))}
              </div>
            </div>
            {servingType === 'both' && (
              <div>
                <label htmlFor="f-unit-w" className="block text-xs font-medium text-[#0A84FF] mb-1">Poids moyen d&apos;1 unité (g) *</label>
                <input id="f-unit-w" type="text" inputMode="decimal" value={unitWeightG} onChange={(e) => setUnitWeightG(e.target.value)} placeholder="120" className="ios-input w-full min-h-[44px] text-base tabular-nums" />
              </div>
            )}
            <div className="space-y-2 border-t border-white/[0.06] pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">Macros ({servingType === 'unit' ? 'par unité' : 'pour 100g'})</span>
                <button type="button" onClick={handleAutoKcal} className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0A84FF] hover:underline">
                  <Calculator className="h-3.5 w-3.5" /> Calculer kcal
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {MACRO_FIELDS.map(({ id, key, label, unit, color }) => (
                  <div key={key}>
                    <label htmlFor={id} className={`block text-[11px] font-medium ${color} mb-1`}>{label} ({unit})</label>
                    <input id={id} type="text" inputMode="decimal" value={macros[key]} onChange={(e) => setMacros((p) => ({ ...p, [key]: e.target.value }))} placeholder="0" className="ios-input w-full min-h-[44px] text-base tabular-nums" />
                  </div>
                ))}
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="w-full min-h-[44px] rounded-xl bg-[#0A84FF] font-semibold text-white hover:bg-[#0071E3] active:scale-[0.98] disabled:opacity-50 text-base">
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
