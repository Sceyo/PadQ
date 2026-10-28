import { describe, expect, it } from 'vitest';
import { estimateMatchesAhead, formatEtaLabel } from '@/app/queue/lib/etaEngine';

describe('Deterministic Queue ETA (ADR-0002)', () => {
  describe('estimateMatchesAhead', () => {
    it('returns 0 for non-positive queue index or match size', () => {
      expect(estimateMatchesAhead(0, 4)).toBe(0);
      expect(estimateMatchesAhead(-1, 4)).toBe(0);
      expect(estimateMatchesAhead(1, 0)).toBe(0);
      expect(estimateMatchesAhead(1, -2)).toBe(0);
    });

    it('calculates doubles match estimates (s = 4)', () => {
      expect(estimateMatchesAhead(1, 4)).toBe(1);
      expect(estimateMatchesAhead(2, 4)).toBe(1);
      expect(estimateMatchesAhead(3, 4)).toBe(1);
      expect(estimateMatchesAhead(4, 4)).toBe(1);

      expect(estimateMatchesAhead(5, 4)).toBe(2);
      expect(estimateMatchesAhead(8, 4)).toBe(2);

      expect(estimateMatchesAhead(9, 4)).toBe(3);
      expect(estimateMatchesAhead(12, 4)).toBe(3);

      expect(estimateMatchesAhead(13, 4)).toBe(4);
      expect(estimateMatchesAhead(20, 4)).toBe(5);
    });

    it('calculates singles match estimates (s = 2)', () => {
      expect(estimateMatchesAhead(1, 2)).toBe(1);
      expect(estimateMatchesAhead(2, 2)).toBe(1);

      expect(estimateMatchesAhead(3, 2)).toBe(2);
      expect(estimateMatchesAhead(4, 2)).toBe(2);

      expect(estimateMatchesAhead(5, 2)).toBe(3);
      expect(estimateMatchesAhead(6, 2)).toBe(3);
    });
  });

  describe('formatEtaLabel', () => {
    it('single-court displays "On deck" only for first group (m = 1)', () => {
      expect(formatEtaLabel(1, 4, false)).toBe('On deck');
      expect(formatEtaLabel(4, 4, false)).toBe('On deck');
      expect(formatEtaLabel(5, 4, false)).toBeNull();
      expect(formatEtaLabel(8, 4, false)).toBeNull();
    });

    it('multi-court displays "Up next" for m = 1 and "Wait: m matches" for m > 1', () => {
      expect(formatEtaLabel(1, 4, true)).toBe('Up next');
      expect(formatEtaLabel(4, 4, true)).toBe('Up next');
      expect(formatEtaLabel(5, 4, true)).toBe('Wait: 2 matches');
      expect(formatEtaLabel(8, 4, true)).toBe('Wait: 2 matches');
      expect(formatEtaLabel(9, 4, true)).toBe('Wait: 3 matches');
      expect(formatEtaLabel(20, 4, true)).toBe('Wait: 5 matches');
    });

    it('returns null for invalid inputs', () => {
      expect(formatEtaLabel(0, 4, true)).toBeNull();
      expect(formatEtaLabel(-3, 4, true)).toBeNull();
      expect(formatEtaLabel(1, 0, true)).toBeNull();
    });
  });
});
