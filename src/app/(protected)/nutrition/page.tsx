// src/app/(protected)/nutrition/page.tsx
import { PageHeader } from '@/components/layout/PageHeader';

export default function NutritionPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Nutrition" subtitle="Journal & Macro-nutriments" />
      <div className="p-4">
        <div className="ios-card space-y-2 p-6 text-center">
          <p className="text-sm font-medium text-white">Module Nutrition</p>
          <p className="text-xs text-[#8E8E93]">
            Journal alimentaire, calcul des calories et suivi des portions en cours de déploiement.
          </p>
        </div>
      </div>
    </div>
  );
}

