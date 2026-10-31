'use client';

import { useState } from 'react';
import {
  calculateKcalFromMacros,
  roundMacro,
  type MacroValues,
} from '@/lib/math/nutrition.math';

export interface AddQuickTabProps {
  onAdd: (params: { label: string; macros: MacroValues }) => Promise<void>;
}

export function AddQuickTab({ onAdd }: AddQuickTabProps) {
  const [label, setLabel] = useState('Ajout rapide');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [g, setG] = useState('');
  const [l, setL] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleMacroChange = (nextP: string, nextG: string, nextL: string) => {
    setP(nextP);
    setG(nextG);
    setL(nextL);
    if (nextP || nextG || nextL) {
      const calcKcal = calculateKcalFromMacros(
        parseFloat(nextP) || 0,
        parseFloat(nextG) || 0,
        parseFloat(nextL) || 0
      );
      setKcal(String(calcKcal));
    }
  };

  const handleConfirm = async () => {
    const parsedKcal = parseFloat(kcal);
    if (isNaN(parsedKcal) || parsedKcal < 0) return;
    setSubmitting(true);
    try {
      await onAdd({
        label: label.trim() || 'Ajout rapide',
        macros: {
          kcal: roundMacro(parsedKcal),
          p: roundMacro(parseFloat(p) || 0),
          g: roundMacro(parseFloat(g) || 0),
          l: roundMacro(parseFloat(l) || 0),
        },
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-[#8E8E93]">Intitulé</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Ex: Collation"
          className="ios-input min-h-[44px] w-full text-base"
        />
      </div>

      <div>
        <label className="text-xs text-[#8E8E93]">Calories (obligatoire)</label>
        <input
          type="number"
          inputMode="decimal"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          placeholder="0"
          className="ios-input min-h-[44px] w-full text-base"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-xs text-[#8E8E93]">P (g)</label>
          <input
            type="number"
            inputMode="decimal"
            value={p}
            onChange={(e) => handleMacroChange(e.target.value, g, l)}
            placeholder="0"
            className="ios-input min-h-[44px] w-full text-base"
          />
        </div>
        <div>
          <label className="text-xs text-[#8E8E93]">G (g)</label>
          <input
            type="number"
            inputMode="decimal"
            value={g}
            onChange={(e) => handleMacroChange(p, e.target.value, l)}
            placeholder="0"
            className="ios-input min-h-[44px] w-full text-base"
          />
        </div>
        <div>
          <label className="text-xs text-[#8E8E93]">L (g)</label>
          <input
            type="number"
            inputMode="decimal"
            value={l}
            onChange={(e) => handleMacroChange(p, g, e.target.value)}
            placeholder="0"
            className="ios-input min-h-[44px] w-full text-base"
          />
        </div>
      </div>

      <button
        type="button"
        disabled={submitting || !kcal || isNaN(parseFloat(kcal))}
        onClick={handleConfirm}
        className="min-h-[44px] w-full rounded-xl bg-[#0A84FF] font-semibold text-white disabled:opacity-50"
      >
        {"Valider l'ajout rapide"}
      </button>
    </div>
  );
}
