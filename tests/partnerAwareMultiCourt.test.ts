import { describe, it, expect } from 'vitest';
import { seedMultiCourtDoubles, type LockedPartnerPair } from '../app/queue/lib/doublesEngine';

describe('partnerAwareMultiCourt seeding', () => {
  it('places pre-locked partner pairs on the same court team during initial multi-court seed', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    const locked: LockedPartnerPair[] = [['P1', 'P6']];
    const seeded = seedMultiCourtDoubles(players, 2, locked);
    expect(seeded.courts[0].slice(0, 2)).toEqual(['P1', 'P6']);
    expect(seeded.courts[0]).toHaveLength(4);
    expect(seeded.courts[1]).toHaveLength(4);
    expect(seeded.waiting).toHaveLength(0);
  });

  it('filters active locked pairs against available players before seeding', () => {
    const players = ['P1', 'P2', 'P3', 'P4'];
    const lockedPairs: [string, string][] = [
      ['P1', 'P2'],
      ['P5', 'P6'], // P5 and P6 are not in players list
    ];
    const activeLocked = lockedPairs.filter(
      ([a, b]) => players.includes(a) && players.includes(b),
    );
    expect(activeLocked).toEqual([['P1', 'P2']]);
    const seeded = seedMultiCourtDoubles(players, 1, activeLocked);
    expect(seeded.courts[0].slice(0, 2)).toEqual(['P1', 'P2']);
  });
});
