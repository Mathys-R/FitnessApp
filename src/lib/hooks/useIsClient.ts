// src/lib/hooks/useIsClient.ts
'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};

/**
 * `false` pendant le rendu serveur ET la passe d'hydratation, `true` ensuite.
 * Permet de différer l'affichage d'un état lu dans `localStorage`
 * (ex : store Zustand `persist`) sans mismatch SSR/client.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
