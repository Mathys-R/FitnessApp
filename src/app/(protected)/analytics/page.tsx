// src/app/(protected)/analytics/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { getCurrentProfile, type ProfileRow } from '@/features/daily-log/services/profile.service';
import { ProfileTargetsDrawer } from '@/features/daily-log/components/ProfileTargetsDrawer';
import { TdeeBanner } from '@/features/analytics/components/TdeeBanner';
import { WeightEmaChart } from '@/features/analytics/components/WeightEmaChart';
import { OneRmChart } from '@/features/analytics/components/OneRmChart';
import { MuscleRadar } from '@/features/analytics/components/MuscleRadar';
import { ExportDataCard } from '@/features/analytics/components/ExportDataCard';

export default function AnalyticsPage() {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isTargetsOpen, setIsTargetsOpen] = useState(false);
  const [tdeeKey, setTdeeKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCurrentProfile().then(
      (row) => { if (!cancelled) setProfile(row); },
      () => { if (!cancelled) setProfile(null); } // Erreur tolérée : le tiroir reste utilisable
    );
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col pb-24">
      <PageHeader
        title="Statistiques"
        subtitle="Analyses & Tendances"
        action={
          <button
            type="button"
            onClick={() => setIsTargetsOpen(true)}
            className="flex min-h-[44px] min-w-[44px] items-center justify-end text-[#0A84FF] active:opacity-70 transition-opacity"
            aria-label="Modifier mes objectifs nutritionnels"
          >
            <SlidersHorizontal size={20} />
          </button>
        }
      />

      <div className="space-y-4 px-4 py-4">
        <TdeeBanner variant="full" refreshKey={tdeeKey} />
        <WeightEmaChart />
        <OneRmChart />
        <MuscleRadar />
        <ExportDataCard />
      </div>

      <ProfileTargetsDrawer
        open={isTargetsOpen}
        onOpenChange={setIsTargetsOpen}
        initialProfile={profile}
        onTargetsUpdated={(updated) => {
          setProfile(updated);
          setTdeeKey((k) => k + 1);
        }}
      />
    </div>
  );
}
