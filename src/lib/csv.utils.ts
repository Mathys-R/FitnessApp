// src/lib/csv.utils.ts
// Couche 1 pure : génération CSV compatible Excel / Numbers iOS (aucune dépendance React / Supabase).

export type CsvCell = string | number | boolean | null | undefined;

/**
 * Échappe proprement une valeur pour un fichier CSV compatible Excel / Numbers iOS
 * Neutralise les attaques par injection de formule (CWE-1236 / OWASP)
 */
export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // Neutralisation Formula Injection (CWE-1236) si début par =, +, -, @, \t, \r.
  // Seules les chaînes sont concernées : un nombre négatif (-0.5) reste une valeur numérique.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r') || str.includes("'")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Construit un CSV (en-tête + lignes) séparé par virgules et sauts de ligne `\n`
 */
export function buildCsvString(headers: string[], rows: CsvCell[][]): string {
  const headerLine = headers.map(escapeCsvCell).join(',');
  const bodyLines = rows.map((r) => r.map(escapeCsvCell).join(','));
  return [headerLine, ...bodyLines].join('\n');
}
