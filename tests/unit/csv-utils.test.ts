// tests/unit/csv-utils.test.ts
import { describe, it, expect } from 'vitest';
import { escapeCsvCell, buildCsvString } from '@/lib/csv.utils';

describe('escapeCsvCell', () => {
  it('null / undefined → vide', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });
  it('nombres et booléens sérialisés tels quels', () => {
    expect(escapeCsvCell(82.5)).toBe('82.5');
    expect(escapeCsvCell(0)).toBe('0');
    expect(escapeCsvCell(true)).toBe('true');
  });
  it('texte simple non quoté (accents conservés)', () => {
    expect(escapeCsvCell('Développé couché')).toBe('Développé couché');
  });
  it('virgule → cellule quotée', () => {
    expect(escapeCsvCell('Riz, poulet')).toBe('"Riz, poulet"');
  });
  it('guillemets doublés et cellule quotée', () => {
    expect(escapeCsvCell('Le "meilleur"')).toBe('"Le ""meilleur"""');
  });
  it('retour ligne → cellule quotée', () => {
    expect(escapeCsvCell('ligne1\nligne2')).toBe('"ligne1\nligne2"');
  });
  it('retour chariot en milieu de cellule → cellule quotée', () => {
    expect(escapeCsvCell('ligne1\rligne2')).toBe('"ligne1\rligne2"');
    expect(escapeCsvCell('ligne1\r\nligne2')).toBe('"ligne1\r\nligne2"');
  });
  it.each(['=', '+', '@', '-'])('formule commençant par %s neutralisée (CWE-1236)', (c) => {
    const out = escapeCsvCell(`${c}SUM(A1)`);
    expect(out).toBe(`"'${c}SUM(A1)"`);
    expect(out.replace(/^"/, '').startsWith(c)).toBe(false);
  });
  it('tabulation / retour chariot en tête neutralisés', () => {
    expect(escapeCsvCell('\tcmd')).toBe(`"'\tcmd"`);
    expect(escapeCsvCell('\rcmd')).toBe(`"'\rcmd"`);
  });
  it('injection combinée virgule + guillemets', () => {
    expect(escapeCsvCell('=HYPERLINK("http://x","y")')).toBe(`"'=HYPERLINK(""http://x"",""y"")"`);
  });
  it('= au milieu non préfixé', () => {
    expect(escapeCsvCell('a=b')).toBe('a=b');
  });
  it('m8 : nombre négatif conservé tel quel (non neutralisé)', () => {
    expect(escapeCsvCell(-0.5)).toBe('-0.5');
    expect(escapeCsvCell(-12)).toBe('-12');
  });
  it('m8 : chaîne numérique négative toujours neutralisée', () => {
    expect(escapeCsvCell('-1')).toBe(`"'-1"`);
  });
});

describe('buildCsvString', () => {
  it('en-tête + lignes séparées par \\n et virgules', () => {
    expect(buildCsvString(['a', 'b'], [[1, 'x'], [null, 'y,z']])).toBe('a,b\n1,x\n,"y,z"');
  });
  it('aucune ligne → en-tête seul', () => {
    expect(buildCsvString(['a', 'b'], [])).toBe('a,b');
  });
});
