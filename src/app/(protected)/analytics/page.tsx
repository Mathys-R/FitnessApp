// src/app/(protected)/analytics/page.tsx
import { PageHeader } from '@/components/layout/PageHeader';

export default function AnalyticsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Statistiques" subtitle="Analyses & Tendances" />
      <div className="p-4">
        <div className="ios-card space-y-2 p-6 text-center">
          <p className="text-sm font-medium text-white">Module Statistiques</p>
          <p className="text-xs text-[#8E8E93]">
            Courbes de poids EMA, volume d&apos;entraînement et dépense énergétique TDEE.
          </p>
        </div>
      </div>
    </div>
  );
}

