import { describe, expect, it } from 'vitest';
import {
  rotateMultiCourtDoubles,
  seedMultiCourtDoubles,
  selectPartnerAwareMatch,
  type LockedPartnerPair,
} from '@/app/queue/lib/doublesEngine';

function expectValidPartition(
  players: string[],
  courts: string[][],
  waiting: string[],
  lockedPairs: LockedPartnerPair[],
) {
  const everyone = [...courts.flat(), ...waiting];
  expect(everyone).toHaveLength(players.length);
  expect(new Set(everyone)).toEqual(new Set(players));

  for (const [a, b] of lockedPairs) {
    const court = courts.find(onCourt => onCourt.includes(a) || onCourt.includes(b));
    if (!court) {
      expect(waiting).toContain(a);
      expect(waiting).toContain(b);
      continue;
    }
    expect(court).toContain(a);
    expect(court).toContain(b);
    const aIndex = court.indexOf(a);
    const bIndex = court.indexOf(b);
    expect(Math.floor(aIndex / 2)).toBe(Math.floor(bIndex / 2));
  }
}

describe('partner-aware multi-court doubles', () => {
  it('promotes a queued partner instead of splitting the pair', () => {
    const ranked = ['A', 'B', 'C', 'Partner 1', 'D', 'E', 'Partner 2', 'F'];
    const result = selectPartnerAwareMatch(ranked, [['Partner 1', 'Partner 2']]);

    expect(result.onCourt).toHaveLength(4);
    expect(result.onCourt).toContain('Partner 1');
    expect(result.onCourt).toContain('Partner 2');
    expect(result.onCourt.slice(0, 2)).toEqual(['Partner 1', 'Partner 2']);
    expect(result.waiting).toHaveLength(4);
  });

  it('seeds three courts without splitting any locked pair', () => {
    const players = Array.from({ length: 30 }, (_, i) => `P${i + 1}`);
    const locked: LockedPartnerPair[] = [['P2', 'P29'], ['P7', 'P8'], ['P17', 'P25']];
    const seeded = seedMultiCourtDoubles(players, 3, locked);

    expect(seeded.courts).toHaveLength(3);
    expect(seeded.courts.every(court => court.length === 4)).toBe(true);
    expect(seeded.waiting).toHaveLength(18);
    expectValidPartition(players, seeded.courts, seeded.waiting, locked);
  });

  it('stress test: 30 players, 3 courts, staggered finishes, and permanent partners', () => {
    const players = Array.from({ length: 30 }, (_, i) => `P${i + 1}`);
    const locked: LockedPartnerPair[] = [['P1', 'P2'], ['P13', 'P29'], ['P18', 'P19']];
    const seeded = seedMultiCourtDoubles(players, 3, locked);
    const courts = seeded.courts.map(onCourt => [...onCourt]);
    let waiting = [...seeded.waiting];
    const seen = new Set(courts.flat());
    const finishOrder = [0, 0, 1, 2, 0, 2, 1];

    for (let round = 0; round < 150; round += 1) {
      const courtIndex = finishOrder[round % finishOrder.length];
      const finished = courts[courtIndex];
      expect(finished).toHaveLength(4);

      const next = rotateMultiCourtDoubles(waiting, finished, locked);
      courts[courtIndex] = next.onCourt;
      waiting = next.waiting;
      next.onCourt.forEach(player => seen.add(player));

      expectValidPartition(players, courts, waiting, locked);
      expect(courts.every(court => court.length === 4)).toBe(true);
    }

    expect(seen).toEqual(new Set(players));
  });

  it('stress test: keeps all 15 possible pairs together across three courts', () => {
    const players = Array.from({ length: 30 }, (_, i) => `P${i + 1}`);
    const locked: LockedPartnerPair[] = Array.from(
      { length: 15 },
      (_, i) => [players[i * 2], players[i * 2 + 1]],
    );
    const seeded = seedMultiCourtDoubles(players, 3, locked);
    const courts = seeded.courts.map(onCourt => [...onCourt]);
    let waiting = [...seeded.waiting];
    const seen = new Set(courts.flat());

    for (let round = 0; round < 150; round += 1) {
      const courtIndex = round % 3;
      const next = rotateMultiCourtDoubles(waiting, courts[courtIndex], locked);
      courts[courtIndex] = next.onCourt;
      waiting = next.waiting;
      next.onCourt.forEach(player => seen.add(player));

      expectValidPartition(players, courts, waiting, locked);
      expect(courts.every(court => court.length === 4)).toBe(true);
    }

    expect(seen).toEqual(new Set(players));
  });

});
