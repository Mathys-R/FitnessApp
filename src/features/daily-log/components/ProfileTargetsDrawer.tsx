'use client';

import { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { toast } from 'sonner';
import { getCurrentProfile, updateProfileTargets, type ProfileRow } from '@/features/daily-log/services/profile.service';
import { calculateKcalFromMacros } from '@/lib/math/nutrition.math';

export interface ProfileTargetsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProfile?: ProfileRow | null;
  onTargetsUpdated?: (updatedProfile: ProfileRow) => void;
}

const clampTarget = (val: number | '', max = 10000): number => {
  const n = typeof val === 'number' ? val : Number(val);
  return Number.isFinite(n) ? Math.max(0, Math.min(Math.round(n), max)) : 0;
};

export function ProfileTargetsDrawer({ open, onOpenChange, initialProfile, onTargetsUpdated }: ProfileTargetsDrawerProps) {
  const [kcal, setKcal] = useState<number | ''>('');
  const [p, setP] = useState<number | ''>('');
  const [g, setG] = useState<number | ''>('');
  const [l, setL] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const apply = (row: ProfileRow) => {
      setKcal(row.current_target_kcal ?? 2000);
      setP(row.current_target_p ?? 150);
      setG(row.current_target_g ?? 200);
      setL(row.current_target_l ?? 65);
    };
    if (initialProfile) apply(initialProfile);
    else getCurrentProfile().then(apply).catch(() => {});
  }, [open, initialProfile]);

  const handleAutoCalcKcal = () => {
    setKcal(calculateKcalFromMacros(clampTarget(p), clampTarget(g), clampTarget(l)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await updateProfileTargets({
        current_target_kcal: clampTarget(kcal),
        current_target_p: clampTarget(p),
        current_target_g: clampTarget(g),
        current_target_l: clampTarget(l),
      });
      toast.success('Objectifs mis à jour');
      onTargetsUpdated?.(updated);
      onOpenChange(false);
    } catch {
      toast.error("Impossible d'enregistrer vos objectifs. Veuillez réessayer.");
    } finally {
      setSaving(false);
    }
  };

  const macroFields = [
    { id: 'target-p', label: 'Protéines', unit: 'g', color: '#32ADE6', val: p, set: setP },
    { id: 'target-g', label: 'Glucides', unit: 'g', color: '#FF9F0A', val: g, set: setG },
    { id: 'target-l', label: 'Lipides', unit: 'g', color: '#BF5AF2', val: l, set: setL },
  ];

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
        <Drawer.Content className="fixed bottom-0 left-0 right-0 z-50 flex max-h-[85vh] flex-col rounded-t-[20px] bg-[#1C1C1E] border-t border-white/[0.08] focus:outline-none">
          <Drawer.Handle className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-white/20" />
          <div className="overflow-y-auto px-5 pt-3 pb-8">
            <Drawer.Title className="text-lg font-semibold text-white">Objectifs nutritionnels</Drawer.Title>
            <Drawer.Description className="text-xs text-[#8E8E93] mt-0.5 mb-4">
              Ajustez vos cibles quotidiennes en calories et macronutriments.
            </Drawer.Description>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label htmlFor="target-kcal" className="text-xs font-semibold text-[#FF375F] flex items-center gap-1.5 mb-1.5">
                  <span className="h-2 w-2 rounded-full bg-[#FF375F]" /> Calories (kcal)
                </label>
                <input
                  id="target-kcal"
                  type="number"
                  inputMode="numeric"
                  value={kcal}
                  onChange={(e) => setKcal(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="2000"
                  className="ios-input w-full text-base tabular-nums"
                  required
                  min={0}
                />
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {macroFields.map((field) => (
                  <div key={field.id}>
                    <label htmlFor={field.id} style={{ color: field.color }} className="text-xs font-semibold flex items-center gap-1 mb-1.5 truncate">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: field.color }} />
                      {field.label} ({field.unit})
                    </label>
                    <input
                      id={field.id}
                      type="number"
                      inputMode="numeric"
                      value={field.val}
                      onChange={(e) => field.set(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="0"
                      className="ios-input w-full text-base tabular-nums"
                      required
                      min={0}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={handleAutoCalcKcal}
                className="w-full min-h-[44px] rounded-xl bg-[#2C2C2E] text-xs font-medium text-[#0A84FF] active:bg-[#3A3A3C] transition-colors flex items-center justify-center"
              >
                Calculer Kcal depuis les macros
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full min-h-[44px] rounded-xl bg-[#0A84FF] text-sm font-semibold text-white active:opacity-80 transition-opacity disabled:opacity-50 flex items-center justify-center"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer les objectifs'}
              </button>
              <p className="text-center text-[11px] text-[#8E8E93] leading-relaxed">
                S&apos;applique à aujourd&apos;hui et aux prochains jours. L&apos;historique passé reste intact.
              </p>
            </form>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
