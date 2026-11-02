'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import NumberFlow from '@number-flow/react';
import { Dumbbell, Moon, Play, RotateCw, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { useActiveWorkoutStore } from '../store/active-workout.store';
import {
  buildStartPayloadFromPlannedSession,
  getTodayWorkoutOverview,
  type TodayWorkoutOverview,
} from '../services/today-session.service';

export interface TodayWorkoutCardProps {
  todayIso: string;
  className?: string;
}

type LoadResult = { iso: string; overview: TodayWorkoutOverview | null; error: boolean };

const TITLE_CLASS = 'text-xs font-semibold uppercase tracking-wider text-[#8E8E93]';
const STAT_CLASS = 'text-base font-bold tabular-nums text-white';
const PR_CLASS =
  'inline-flex items-center gap-1 rounded-full bg-[#FFD60A]/15 px-2 text-base font-bold tabular-nums text-[#FFD60A]';

function StatTile({ label, accent = false, children }: { label: string; accent?: boolean; children: ReactNode }) {
  return (
    <div className="rounded-xl bg-[#2C2C2E] p-2">
      <p className="text-[11px] text-[#8E8E93]">{label}</p>
      <p className={accent ? PR_CLASS : STAT_CLASS}>{children}</p>
    </div>
  );
}

export function TodayWorkoutCard({ todayIso, className = '' }: TodayWorkoutCardProps) {
  const router = useRouter();
  const isActive = useActiveWorkoutStore((s) => s.isActive);
  const activeName = useActiveWorkoutStore((s) => s.sessionName);
  const startSession = useActiveWorkoutStore((s) => s.startSession);

  const [result, setResult] = useState<LoadResult | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [isLaunching, setIsLaunching] = useState(false);
  const launchLockRef = useRef(false);

  // Garde anti-réponse périmée : seule la requête de l'effet courant peut écrire.
  useEffect(() => {
    if (isActive) return;
    let cancelled = false;
    getTodayWorkoutOverview(todayIso).then(
      (data) => { if (!cancelled) setResult({ iso: todayIso, overview: data, error: false }); },
      () => { if (!cancelled) setResult({ iso: todayIso, overview: null, error: true }); }
    );
    return () => { cancelled = true; };
  }, [isActive, todayIso, reloadKey]);

  // Un résultat obtenu pour une autre date est ignoré (état de chargement).
  const current = result?.iso === todayIso ? result : null;
  const overview = current?.overview ?? null;
  const hasError = current?.error ?? false;

  const handleRetry = () => {
    setResult(null);
    setReloadKey((k) => k + 1);
  };

  const handleLaunch = async () => {
    if (launchLockRef.current || overview?.kind !== 'planned') return;
    launchLockRef.current = true;
    setIsLaunching(true);
    try {
      const payload = await buildStartPayloadFromPlannedSession(overview.session);
      startSession(payload);
      router.push('/workout');
    } catch {
      toast.error('Erreur lors du lancement de la séance planifiée');
      launchLockRef.current = false;
      setIsLaunching(false);
    }
  };

  const cardClass = `ios-card p-4 space-y-3 ${className}`;

  if (isActive) {
    return (
      <div className={`${cardClass} border border-[#30D158]/40`}>
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-[#30D158]" aria-hidden />
          <span className="text-sm font-semibold text-[#30D158]">Séance en cours</span>
        </div>
        {activeName && <p className="truncate text-base font-bold text-white">{activeName}</p>}
        <button
          type="button"
          onClick={() => router.push('/workout')}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#30D158] text-base font-bold text-black active:scale-[0.99]"
        >
          <Play className="h-4 w-4 fill-black" /> Séance en cours — Reprendre
        </button>
      </div>
    );
  }

  return (
    <div className={cardClass} aria-busy={!overview && !hasError ? true : undefined}>
      <div className="flex items-center gap-2">
        <Dumbbell className="h-4 w-4 text-[#0A84FF]" />
        <span className={TITLE_CLASS}>Séance du jour</span>
      </div>
      {hasError && (
        <>
          <p className="text-sm text-[#FF453A]">Impossible de charger la séance du jour.</p>
          <button
            type="button"
            onClick={handleRetry}
            className="flex min-h-[44px] items-center gap-2 rounded-xl bg-[#2C2C2E] px-4 text-sm font-semibold text-white active:scale-95"
          >
            <RotateCw className="h-4 w-4" /> Réessayer
          </button>
        </>
      )}
      {!overview && !hasError && <div className="h-11 w-full animate-pulse rounded-xl bg-[#2C2C2E]" />}
      {overview?.kind === 'planned' && (
        <button
          type="button"
          onClick={() => void handleLaunch()}
          disabled={isLaunching}
          className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-[#0A84FF] px-3 text-base font-bold text-white active:scale-[0.99] disabled:opacity-60"
        >
          <Play className="h-4 w-4 shrink-0 fill-white" />
          <span className="truncate">
            {isLaunching ? 'Préparation…' : `Lancer ${overview.session.name}`}
          </span>
        </button>
      )}
      {overview?.kind === 'completed' && (
        <>
          <p className="truncate text-base font-bold text-white">{overview.session.name}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <StatTile label="Durée">{Math.round(overview.durationSeconds / 60)} min</StatTile>
            <StatTile label="Tonnage">
              <NumberFlow value={overview.tonnageKg} locales="fr-FR" /> kg
            </StatTile>
            <StatTile label="PR" accent={overview.prCount > 0}>
              {overview.prCount > 0 && <Trophy className="h-3.5 w-3.5" />}
              {overview.prCount}
            </StatTile>
          </div>
        </>
      )}
      {overview?.kind === 'rest_day' && (
        <p className="flex items-center gap-2 text-base font-semibold text-white">
          <Moon className="h-4 w-4 text-[#BF5AF2]" /> Jour de repos
        </p>
      )}
      {overview?.kind === 'none' && (
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-[#8E8E93]">Aucune séance prévue</p>
          <Link
            href="/workout"
            className="flex min-h-[44px] items-center rounded-xl px-3 text-sm font-semibold text-[#0A84FF] active:scale-95"
          >
            Ouvrir l&apos;agenda
          </Link>
        </div>
      )}
    </div>
  );
}
