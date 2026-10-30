import { describe, it, expect } from 'vitest';
import {
  logWeightAndRecalculateEma,
  upsertWeightAndRecalculateEma,
  getOrCreateDailyLog,
  toggleExcludeFromTdee,
  getPreviousWeightEma,
  getWeightHistory,
} from '@/features/daily-log/services/log.service';

describe('log.service contract and exports', () => {
  it('exposes upsertWeightAndRecalculateEma as alias of logWeightAndRecalculateEma', () => {
    expect(upsertWeightAndRecalculateEma).toBeDefined();
    expect(typeof upsertWeightAndRecalculateEma).toBe('function');
    expect(upsertWeightAndRecalculateEma).toBe(logWeightAndRecalculateEma);
  });

  it('exposes all required Phase 2 Layer 2 daily-log services', () => {
    expect(typeof getOrCreateDailyLog).toBe('function');
    expect(typeof logWeightAndRecalculateEma).toBe('function');
    expect(typeof toggleExcludeFromTdee).toBe('function');
    expect(typeof getPreviousWeightEma).toBe('function');
    expect(typeof getWeightHistory).toBe('function');
  });
});

