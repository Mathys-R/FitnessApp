// src/app/(protected)/workout/page.tsx
import { PageHeader } from '@/components/layout/PageHeader';

export default function WorkoutPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Musculation" subtitle="Séances & Progression" />
      <div className="p-4">
        <div className="ios-card space-y-2 p-6 text-center">
          <p className="text-sm font-medium text-white">Module Musculation</p>
          <p className="text-xs text-[#8E8E93]">
            Planification de séances, historique et suivi 1RM bientôt disponibles en Phase 2.
          </p>
        </div>
      </div>
    </div>
  );
}

