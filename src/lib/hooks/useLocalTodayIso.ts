'use client';

import { useSyncExternalStore } from 'react';
import { getLocalTodayIso } from '@/lib/date.utils';

/** Réévalue la date au retour au premier plan (PWA restée ouverte après minuit). */
const subscribe = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange);
  window.addEventListener('focus', onChange);
  return () => {
    document.removeEventListener('visibilitychange', onChange);
    window.removeEventListener('focus', onChange);
  };
};

const getServerSnapshot = (): string | null => null;

/**
 * Date locale du jour (`YYYY-MM-DD`) côté client.
 * `null` pendant le rendu serveur ET la passe d'hydratation (évite tout mismatch
 * entre la date figée au build/SSR et celle de l'appareil), puis la date locale.
 */
export function useLocalTodayIso(): string | null {
  return useSyncExternalStore<string | null>(subscribe, getLocalTodayIso, getServerSnapshot);
}
