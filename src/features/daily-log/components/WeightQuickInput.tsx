// src/features/daily-log/components/WeightQuickInput.tsx
'use client';

import { useState } from 'react';
import NumberFlow from '@number-flow/react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { logWeightAndRecalculateEma, type DailyLogRow } from '@/features/daily-log/services/log.service';
import { parseDecimalInput } from '@/lib/math/weight-ema.math';
import { getLocalTodayIso } from '@/lib/date.utils';

export interface WeightQuickInputProps {
  dailyLog: DailyLogRow;
  previousEmaKg?: number | null;
  onWeightUpdated?: (updatedLog: DailyLogRow) => void;
  className?: string;
}

export function WeightQuickInput({ dailyLog, previousEmaKg, onWeightUpdated, className }: WeightQuickInputProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [targetDate, setTargetDate] = useState(dailyLog.log_date || getLocalTodayIso());
  const [weight, setWeight] = useState(dailyLog.weight_kg != null ? String(dailyLog.weight_kg) : '');
  const [isSaving, setIsSaving] = useState(false);

  const handleOpen = (open: boolean) => {
    if (open) {
      setTargetDate(dailyLog.log_date || getLocalTodayIso());
      setWeight(dailyLog.weight_kg != null ? String(dailyLog.weight_kg) : '');
    }
    setIsOpen(open);
  };

  const adjustWeight = (delta: number) => {
    const cur = parseDecimalInput(weight) ?? dailyLog.weight_kg ?? 70;
    setWeight(String(Math.max(0, Math.round((cur + delta) * 10) / 10)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDate) {
      toast.error('Veuillez renseigner une date valide');
      return;
    }
    const parsed = parseDecimalInput(weight);
    if (parsed === null) {
      toast.error('Veuillez renseigner un poids valide (> 0 kg)');
      return;
    }
    setIsSaving(true);
    try {
      const updated = await logWeightAndRecalculateEma(targetDate, parsed);
      toast.success('Pesée enregistrée');
      onWeightUpdated?.(updated);
      setIsOpen(false);
    } catch {
      toast.error("Erreur lors de l'enregistrement de la pesée");
    } finally {
      setIsSaving(false);
    }
  };

  const emaVal = dailyLog.weight_ema_kg ?? previousEmaKg;

  return (
    <Drawer.Root open={isOpen} onOpenChange={handleOpen}>
      <Drawer.Trigger asChild>
        <button type="button" className={`ios-card p-4 text-left w-full flex items-center justify-between active:scale-[0.99] transition-transform ${className ?? ''}`}>
          <div>
            <div className="text-xs font-medium text-[#8E8E93] uppercase tracking-wider mb-1">Poids corporel</div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {dailyLog.weight_kg != null ? (
                <><NumberFlow value={dailyLog.weight_kg ?? 0} format={{ minimumFractionDigits: 1, maximumFractionDigits: 2 }} /> kg</>
              ) : (
                <span className="text-[#8E8E93]">— kg</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold text-[#0A84FF] bg-[#0A84FF]/10 px-2.5 py-1 rounded-full tabular-nums">
              EMA 7j : {emaVal != null ? <><NumberFlow value={emaVal} /> kg</> : '— kg'}
            </span>
          </div>
        </button>
      </Drawer.Trigger>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" />
        <Drawer.Content className="fixed bottom-0 inset-x-0 z-50 bg-[#1C1C1E] border-t border-[#38383A] rounded-t-[20px] p-6 pb-8 focus:outline-none">
          <Drawer.Handle className="mx-auto mb-4 bg-[#38383A]" />
          <Drawer.Title className="text-lg font-semibold text-center mb-6 text-white">Enregistrer une pesée</Drawer.Title>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="weight-date" className="block text-xs font-medium text-[#8E8E93] mb-1.5">Date</label>
              <input id="weight-date" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="ios-input w-full min-h-[44px] text-base" />
            </div>
            <div className="flex items-center justify-center gap-3">
              <button type="button" onClick={() => adjustWeight(-0.1)} className="min-h-[44px] min-w-[44px] px-3 bg-[#2C2C2E] hover:bg-[#38383A] active:scale-95 text-white rounded-xl text-base font-medium transition-transform">
                -0.1 kg
              </button>
              <input id="weight-value" type="text" inputMode="decimal" value={weight} placeholder="0.0" onChange={(e) => setWeight(e.target.value)} className="ios-input text-center text-xl font-bold w-32 min-h-[44px] tabular-nums" />
              <button type="button" onClick={() => adjustWeight(0.1)} className="min-h-[44px] min-w-[44px] px-3 bg-[#2C2C2E] hover:bg-[#38383A] active:scale-95 text-white rounded-xl text-base font-medium transition-transform">
                +0.1 kg
              </button>
            </div>
            <button type="submit" disabled={isSaving} className="w-full min-h-[44px] bg-[#0A84FF] hover:bg-[#0071E3] active:scale-[0.98] text-white font-semibold rounded-xl text-base transition-all disabled:opacity-50">
              {isSaving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </form>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
