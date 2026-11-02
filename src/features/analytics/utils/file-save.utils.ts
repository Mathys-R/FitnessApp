// src/features/analytics/utils/file-save.utils.ts
// API navigateur uniquement (aucune dépendance Supabase) : sauvegarde d'un fichier texte sur iOS PWA / desktop.

export type SaveFileOutcome = 'shared' | 'downloaded' | 'cancelled';

export type SaveFileMimeType = 'text/csv;charset=utf-8' | 'application/json';

export interface SaveTextFileParams {
  filename: string;
  content: string;
  mimeType: SaveFileMimeType;
}

const UTF8_BOM = '﻿';
const REVOKE_DELAY_MS = 1000;

/**
 * Préfixe le BOM UTF-8 (une seule fois) pour que Excel décode correctement les accents (E5)
 */
export function buildCsvBlobContent(csv: string): string {
  return csv.startsWith(UTF8_BOM) ? csv : `${UTF8_BOM}${csv}`;
}

function isAbortError(err: unknown): boolean {
  // DOMException n'hérite pas toujours d'Error selon le runtime → test structurel sur `name`
  return typeof err === 'object' && err !== null && 'name' in err && err.name === 'AbortError';
}

function downloadViaAnchor(file: File): SaveFileOutcome {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = file.name;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  return 'downloaded';
}

/**
 * Sauvegarde un fichier texte :
 * - Feuille de partage iOS (`navigator.share({ files })`) si `canShare` l'autorise → « Enregistrer dans Fichiers »
 * - Sinon fallback `<a download>` + `URL.createObjectURL` (révoqué après 1 s)
 * Doit être appelé directement dans un handler de geste utilisateur (aucun `await` préalable).
 */
export async function saveTextFile({ filename, content, mimeType }: SaveTextFileParams): Promise<SaveFileOutcome> {
  const file = new File([content], filename, { type: mimeType });
  const nav: Navigator | undefined = typeof navigator === 'undefined' ? undefined : navigator;

  if (nav && typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file] });
      return 'shared';
    } catch (err) {
      if (isAbortError(err)) return 'cancelled';
      throw err;
    }
  }

  return downloadViaAnchor(file);
}
