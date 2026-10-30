import { describe, it, expect } from 'vitest';
import {
  getLocalTodayIso,
  shiftDateIso,
  getWeekDatesIso,
  formatShortFrenchDate,
} from '@/lib/date.utils';

describe('date.utils', () => {
  describe('getLocalTodayIso', () => {
    it('should return a string in "YYYY-MM-DD" format', () => {
      const todayIso = getLocalTodayIso();
      expect(todayIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('should preserve the local date across boundary hours without UTC offset drift', () => {
      // Midnight minus 1 second (23:59:59)
      const lateEvening = new Date(2026, 9, 30, 23, 59, 59); // month index 9 = October
      expect(getLocalTodayIso(lateEvening)).toBe('2026-10-30');

      // Right after midnight (00:00:01)
      const earlyMorning = new Date(2026, 9, 30, 0, 0, 1);
      expect(getLocalTodayIso(earlyMorning)).toBe('2026-10-30');

      // Noon
      const noon = new Date(2026, 9, 30, 12, 0, 0);
      expect(getLocalTodayIso(noon)).toBe('2026-10-30');
    });
  });

  describe('shiftDateIso', () => {
    it('should add days correctly within the same month', () => {
      expect(shiftDateIso('2026-10-10', 5)).toBe('2026-10-15');
      expect(shiftDateIso('2026-10-10', 0)).toBe('2026-10-10');
    });

    it('should subtract days correctly within the same month', () => {
      expect(shiftDateIso('2026-10-15', -5)).toBe('2026-10-10');
      expect(shiftDateIso('2026-10-05', -4)).toBe('2026-10-01');
    });

    it('should handle month boundaries forward and backward', () => {
      // Forward: Jan 31 -> Feb 01
      expect(shiftDateIso('2026-01-31', 1)).toBe('2026-02-01');
      // Backward: Mar 01 -> Feb 28 (non-leap year)
      expect(shiftDateIso('2026-03-01', -1)).toBe('2026-02-28');
    });

    it('should handle leap years correctly (e.g. 2024)', () => {
      // 2024 is a leap year (February has 29 days)
      expect(shiftDateIso('2024-02-28', 1)).toBe('2024-02-29');
      expect(shiftDateIso('2024-02-29', 1)).toBe('2024-03-01');
      expect(shiftDateIso('2024-03-01', -1)).toBe('2024-02-29');
    });

    it('should handle year transitions forward and backward', () => {
      // Dec 31 -> Jan 01
      expect(shiftDateIso('2025-12-31', 1)).toBe('2026-01-01');
      // Jan 01 -> Dec 31
      expect(shiftDateIso('2026-01-01', -1)).toBe('2025-12-31');
    });
  });

  describe('getWeekDatesIso', () => {
    it('should return exactly 7 consecutive dates', () => {
      const week = getWeekDatesIso('2026-10-28');
      expect(week).toHaveLength(7);
      expect(new Set(week).size).toBe(7);
    });

    it('should always start on Monday and end on Sunday', () => {
      // 2026-10-28 is a Wednesday
      // Week Monday: 2026-10-26
      // Week Sunday: 2026-11-01
      const weekFromWed = getWeekDatesIso('2026-10-28');

      expect(weekFromWed[0]).toBe('2026-10-26'); // Lundi
      expect(weekFromWed[1]).toBe('2026-10-27'); // Mardi
      expect(weekFromWed[2]).toBe('2026-10-28'); // Mercredi
      expect(weekFromWed[3]).toBe('2026-10-29'); // Jeudi
      expect(weekFromWed[4]).toBe('2026-10-30'); // Vendredi
      expect(weekFromWed[5]).toBe('2026-10-31'); // Samedi
      expect(weekFromWed[6]).toBe('2026-11-01'); // Dimanche
    });

    it('should return the same week whether reference is Monday or Sunday', () => {
      const weekFromMonday = getWeekDatesIso('2026-10-26');
      const weekFromSunday = getWeekDatesIso('2026-11-01');

      expect(weekFromMonday).toEqual(weekFromSunday);
      expect(weekFromMonday[0]).toBe('2026-10-26');
      expect(weekFromMonday[6]).toBe('2026-11-01');
    });

    it('should handle year boundary transitions cleanly', () => {
      // 2025-12-31 is Wednesday
      // Monday is 2025-12-29, Sunday is 2026-01-04
      const week = getWeekDatesIso('2025-12-31');

      expect(week[0]).toBe('2025-12-29');
      expect(week[2]).toBe('2025-12-31');
      expect(week[3]).toBe('2026-01-01');
      expect(week[6]).toBe('2026-01-04');
    });

    it('should default to the current week when called without arguments', () => {
      const week = getWeekDatesIso();
      expect(week).toHaveLength(7);
      const today = getLocalTodayIso();
      expect(week).toContain(today);
    });
  });

  describe('formatShortFrenchDate', () => {
    it('should format dates nicely in French for mobile displays', () => {
      // 2026-10-28 is Wednesday Oct 28
      expect(formatShortFrenchDate('2026-10-28')).toBe('mer. 28 oct.');

      // 2026-10-30 is Friday Oct 30
      expect(formatShortFrenchDate('2026-10-30')).toBe('ven. 30 oct.');

      // 2026-01-01 is Thursday Jan 01
      expect(formatShortFrenchDate('2026-01-01')).toBe('jeu. 1 janv.');

      // 2026-07-14 is Tuesday Jul 14
      expect(formatShortFrenchDate('2026-07-14')).toBe('mar. 14 juil.');

      // 2026-05-03 is Sunday May 03
      expect(formatShortFrenchDate('2026-05-03')).toBe('dim. 3 mai');
    });
  });
});

