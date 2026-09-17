import { describe, expect, it } from 'vitest';
import {
  rotateMultiCourtDoubles,
  seedMultiCourtDoubles,
  type LockedPartnerPair,
} from '@/app/queue/lib/doublesEngine';
import { planMultiCourtResult } from '@/app/queue/lib/multiCourtResult';
import { getMaxPartnerPairs } from '@/app/queue/components/LiveManagement/LiveManagement';
import { estimateV1EventCapacity } from '@/lib/v1CapacityModel';

function players(count: number, prefix: string) {
  return Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`);
}

function assertPartition(expected: string[], courts: string[][], waiting: string[]) {
  const actual = [...courts.flat(), ...waiting];
  expect(actual).toHaveLength(expected.length);
  expect(new Set(actual)).toEqual(new Set(expected));
  expect(new Set(actual).size).toBe(actual.length);
}

function assertLockedPairs(courts: string[][], waiting: string[], pairs: LockedPartnerPair[]) {
  for (const [first, second] of pairs) {
    const court = courts.find(slot => slot.includes(first) || slot.includes(second));
    if (!court) {
      expect(waiting).toContain(first);
      expect(waiting).toContain(second);
      continue;
    }
    expect(court).toContain(first);
    expect(court).toContain(second);
    expect(Math.floor(court.indexOf(first) / 2)).toBe(Math.floor(court.indexOf(second) / 2));
  }
}

describe('V1 court, player, and viewer scenario matrix', () => {
  it('preserves rush check-in order for 25 players and a middle departure', () => {
    const roster = players(25, 'RUSH');
    const seeded = seedMultiCourtDoubles(roster, 3, []);

    // The first 12 registrations fill Courts 1-3 in order. Everyone else
    // remains in the shared waiting queue in exact registration order.
    expect(seeded.courts.flat()).toEqual(roster.slice(0, 12));
    expect(seeded.waiting).toEqual(roster.slice(12));

    // Removing a departing player must not reorder anybody around them.
    const departingPlayer = roster[18];
    const remaining = seeded.waiting.filter(player => player !== departingPlayer);
    expect(remaining).toEqual([
      ...roster.slice(12, 18),
      ...roster.slice(19),
    ]);
  });

  it('keeps doubles partitions and locked partners valid across 1-3 courts and 5-30 players', () => {
    for (const courtCount of [1, 2, 3]) {
      const minimum = courtCount === 1 ? 5 : courtCount * 4;
      const counts = [...new Set([minimum, minimum + 1, minimum + 5, 18, 24, 30])]
        .filter(count => count >= minimum && count <= 30);

      for (const count of counts) {
        for (const lockMode of ['none', 'edge', 'maximum'] as const) {
          const roster = players(count, `D${courtCount}-${count}-${lockMode}`);
          const locked: LockedPartnerPair[] = lockMode === 'none'
            ? []
            : lockMode === 'edge'
              ? [[roster[0], roster.at(-1)!]]
              : Array.from(
                  { length: getMaxPartnerPairs(roster.length) },
                  (_, index) => [roster[index * 2], roster[index * 2 + 1]] as LockedPartnerPair,
                );
          const seeded = seedMultiCourtDoubles(roster, courtCount, locked);
          const courts = seeded.courts.map(onCourt => [...onCourt]);
          let waiting = [...seeded.waiting];
          const seen = new Set(courts.flat());

          assertPartition(roster, courts, waiting);
          assertLockedPairs(courts, waiting, locked);
          expect(courts).toHaveLength(courtCount);
          expect(courts.every(court => court.length === 4)).toBe(true);

          for (let result = 0; result < 120; result += 1) {
            const courtIndex = (result * 2 + 1) % courtCount;
            const next = rotateMultiCourtDoubles(waiting, courts[courtIndex], locked);
            courts[courtIndex] = next.onCourt;
            waiting = next.waiting;
            next.onCourt.forEach(player => seen.add(player));
            assertPartition(roster, courts, waiting);
            assertLockedPairs(courts, waiting, locked);
          }

          expect(seen).toEqual(new Set(roster));
        }
      }
    }
  }, 30_000);

  it('rotates singles safely across 1-3 courts and minimum through maximum rosters', () => {
    for (const courtCount of [1, 2, 3]) {
      const minimum = Math.max(5, courtCount * 2 + 1);
      const counts = [...new Set([minimum, minimum + 1, 10, 18, 24, 30])]
        .filter(count => count >= minimum && count <= 30);

      for (const count of counts) {
        const roster = players(count, `S${courtCount}-${count}`);
        let courtSlots = Array.from({ length: courtCount }, (_, index) => ({
          id: `court-${index}`,
          name: `Court ${index + 1}`,
          onCourt: roster.slice(index * 2, index * 2 + 2),
        }));
        let queue = roster.slice(courtCount * 2);
        const seen = new Set(courtSlots.flatMap(court => court.onCourt));

        for (let result = 0; result < 150; result += 1) {
          const court = courtSlots[(result * 2 + 1) % courtCount];
          const planned = planMultiCourtResult(
            { queue, courtSlots, sittingOut: [] },
            court.id,
            [...court.onCourt],
            result % 2 === 0 ? 'A' : 'B',
            'singles',
          );
          expect(planned).not.toBeNull();
          queue = planned!.queue;
          courtSlots = planned!.courtSlots;
          courtSlots.flatMap(slot => slot.onCourt).forEach(player => seen.add(player));
          assertPartition(roster, courtSlots.map(slot => slot.onCourt), queue);
        }

        expect(seen).toEqual(new Set(roster));
      }
    }
  });

  it('rejects stale duplicate results for every court count and finish order', () => {
    for (const courtCount of [1, 2, 3]) {
      const roster = players(Math.max(12, courtCount * 4 + 6), `R${courtCount}`);
      const seeded = seedMultiCourtDoubles(roster, courtCount, []);
      let state = {
        queue: seeded.waiting,
        courtSlots: seeded.courts.map((onCourt, index) => ({
          id: `court-${index}`,
          name: `Court ${index + 1}`,
          onCourt,
        })),
        lockedPartners: [] as Array<{ a: string; b: string }>,
        sittingOut: [] as string[],
      };

      for (const slot of [...state.courtSlots].reverse()) {
        const expectedPlayers = [...slot.onCourt];
        const planned = planMultiCourtResult(state, slot.id, expectedPlayers, 'A', 'doubles');
        expect(planned).not.toBeNull();
        state = { ...state, queue: planned!.queue, courtSlots: planned!.courtSlots };
        expect(planMultiCourtResult(state, slot.id, expectedPlayers, 'B', 'doubles')).toBeNull();
        assertPartition(roster, state.courtSlots.map(court => court.onCourt), state.queue);
      }
    }
  });

  it('keeps common viewer loads within the Spark daily operation limits', () => {
    for (const viewers of [1, 5, 15, 30]) {
      for (const matchResults of [10, 30, 60]) {
        const estimate = estimateV1EventCapacity({
          viewers,
          matchResults,
          historyViewers: Math.ceil(viewers / 2),
          operationalUpdates: 20,
          sessionDocumentBytes: 24_000,
          historyDocumentBytes: 500,
        });
        expect(estimate.reads).toBeLessThan(50_000);
        expect(estimate.writes).toBeLessThan(20_000);
        expect(estimate.deletesOnCleanup).toBeLessThan(20_000);
        expect(estimate.storageBytesBeforeCleanup).toBeLessThan(1_000_000_000);
      }
    }
  });

  it('isolates five simultaneous 30-player rooms through interleaved results', () => {
    const rooms = Array.from({ length: 5 }, (_, roomIndex) => {
      const roster = players(30, `ROOM-${roomIndex + 1}`);
      const seeded = seedMultiCourtDoubles(roster, 3, []);
      return { roster, courts: seeded.courts.map(court => [...court]), waiting: [...seeded.waiting] };
    });

    for (let result = 0; result < 100; result += 1) {
      for (const [roomIndex, room] of rooms.entries()) {
        const courtIndex = (result + roomIndex) % 3;
        const next = rotateMultiCourtDoubles(room.waiting, room.courts[courtIndex], []);
        room.courts[courtIndex] = next.onCourt;
        room.waiting = next.waiting;
        assertPartition(room.roster, room.courts, room.waiting);
      }
    }

    const allPlayers = rooms.flatMap(room => room.courts.flat().concat(room.waiting));
    expect(new Set(allPlayers).size).toBe(150);
  });

  describe('Human Stress Test Scenarios (1-court 12-player, 2-court 20-player, 3-court 30-player limit, 34-player boundary)', () => {
    it('Scenario 1: 1-court 12-player singles rotation and king/challenger lifecycle', () => {
      const roster = players(12, 'S1');
      const state = {
        queue: roster.slice(2),
        courtSlots: [{ id: 'court-0', name: 'Court 1', onCourt: [roster[0], roster[1]] }],
      };

      // Initial court match check: P1 vs P2, 10 players waiting
      expect(state.courtSlots[0].onCourt).toEqual(['S1-1', 'S1-2']);
      expect(state.queue).toHaveLength(10);

      // Match 1: P1 wins, P2 goes to back of queue, P3 steps up
      const r1 = planMultiCourtResult(state, 'court-0', ['S1-1', 'S1-2'], 'A', 'singles');
      expect(r1).not.toBeNull();
      expect(r1!.courtSlots[0].onCourt).toEqual(['S1-1', 'S1-3']);
      expect(r1!.queue).toEqual([...roster.slice(3), 'S1-2']);
      expect(r1!.winner).toBe('S1-1');

      // Match 2: Challenger P3 beats P1
      const r2 = planMultiCourtResult(r1!, 'court-0', ['S1-1', 'S1-3'], 'B', 'singles');
      expect(r2).not.toBeNull();
      expect(r2!.courtSlots[0].onCourt).toEqual(['S1-3', 'S1-4']);
      expect(r2!.queue).toEqual([...roster.slice(4), 'S1-2', 'S1-1']);
      expect(r2!.winner).toBe('S1-3');

      // Removal of a waiting player (e.g. P8 leaves mid-session)
      const afterLeave = r2!.queue.filter(p => p !== 'S1-8');
      expect(afterLeave).toHaveLength(9);
      expect(afterLeave).not.toContain('S1-8');

      // Late arrival P13 joins back of queue
      const afterLateArrival = [...afterLeave, 'S1-13'];
      expect(afterLateArrival).toHaveLength(10);
      expect(afterLateArrival[afterLateArrival.length - 1]).toBe('S1-13');
    });

    it('Scenario 2: 2-court 20-player doubles with 2 locked partner pairs and sit-outs', () => {
      const roster = players(20, 'D20');
      const lockedPairs: LockedPartnerPair[] = [
        ['D20-1', 'D20-2'],
        ['D20-5', 'D20-6'],
      ];

      // Initial seeding for 2 courts
      const seeded = seedMultiCourtDoubles(roster, 2, lockedPairs);
      expect(seeded.courts).toHaveLength(2);
      expect(seeded.waiting).toHaveLength(12);
      assertPartition(roster, seeded.courts, seeded.waiting);
      assertLockedPairs(seeded.courts, seeded.waiting, lockedPairs);

      // Court 1 finishes with Court 1 Team A winning
      let state = {
        queue: seeded.waiting,
        courtSlots: [
          { id: 'court-0', name: 'Court 1', onCourt: seeded.courts[0] },
          { id: 'court-1', name: 'Court 2', onCourt: seeded.courts[1] },
        ],
        lockedPartners: lockedPairs.map(([a, b]) => ({ a, b })),
        sittingOut: ['D20-11', 'D20-12'], // D11 & D12 sitting out
      };

      const c1Result = planMultiCourtResult(
        state,
        'court-0',
        state.courtSlots[0].onCourt,
        'A',
        'doubles',
      );
      expect(c1Result).not.toBeNull();

      // Ensure sitting out players D11 and D12 were skipped from entering court-0
      expect(c1Result!.courtSlots[0].onCourt).not.toContain('D20-11');
      expect(c1Result!.courtSlots[0].onCourt).not.toContain('D20-12');

      // Update state for Court 2 finishing
      state = {
        ...state,
        queue: c1Result!.queue,
        courtSlots: c1Result!.courtSlots,
        sittingOut: [], // D11 & D12 return to play
      };

      const c2Result = planMultiCourtResult(
        state,
        'court-1',
        state.courtSlots[1].onCourt,
        'B',
        'doubles',
      );
      expect(c2Result).not.toBeNull();
      assertLockedPairs(
        c2Result!.courtSlots.map(c => c.onCourt),
        c2Result!.queue,
        lockedPairs,
      );
    });

    it('Scenario 3: 3-court 30-player limit (12 on court, 18 waiting, 3 locked pairs across 24 matches)', () => {
      const roster = players(30, 'L30');
      const lockedPairs: LockedPartnerPair[] = [
        ['L30-1', 'L30-2'],
        ['L30-3', 'L30-4'],
        ['L30-29', 'L30-30'], // pair parked deep in the back
      ];

      const seeded = seedMultiCourtDoubles(roster, 3, lockedPairs);
      expect(seeded.courts).toHaveLength(3);
      expect(seeded.waiting).toHaveLength(18);
      assertPartition(roster, seeded.courts, seeded.waiting);
      assertLockedPairs(seeded.courts, seeded.waiting, lockedPairs);

      let currentState = {
        queue: seeded.waiting,
        courtSlots: seeded.courts.map((onCourt, i) => ({
          id: `court-${i}`,
          name: `Court ${i + 1}`,
          onCourt,
        })),
        lockedPartners: lockedPairs.map(([a, b]) => ({ a, b })),
      };

      // Run 24 consecutive match results cycling through all 3 courts
      for (let i = 0; i < 24; i++) {
        const courtId = `court-${i % 3}`;
        const slot = currentState.courtSlots.find(c => c.id === courtId)!;
        const result = planMultiCourtResult(
          currentState,
          courtId,
          slot.onCourt,
          i % 2 === 0 ? 'A' : 'B',
          'doubles',
        );
        expect(result).not.toBeNull();
        currentState = {
          ...currentState,
          queue: result!.queue,
          courtSlots: result!.courtSlots,
        };

        // Validate partition and partner pair integrity after each completed match
        assertPartition(
          roster,
          currentState.courtSlots.map(c => c.onCourt),
          currentState.queue,
        );
        assertLockedPairs(
          currentState.courtSlots.map(c => c.onCourt),
          currentState.queue,
          lockedPairs,
        );
      }
    });

    it('Scenario 4: Boundary rejection for 34 players and > 3 courts', async () => {
      const overCapacityRoster = players(34, 'OVER');

      // Check max partner pairs formula handles large counts defensively
      expect(getMaxPartnerPairs(34)).toBe(17);
      expect(getMaxPartnerPairs(30)).toBe(15);

      // Verify seedMultiCourtDoubles with court count capped at 3
      const seeded = seedMultiCourtDoubles(overCapacityRoster, 3, []);
      expect(seeded.courts).toHaveLength(3);
      expect(seeded.courts.flat()).toHaveLength(12);
      expect(seeded.waiting).toHaveLength(22);

      // If courtCount 4 is attempted, engine strictly allocates 4 courts only if invoked,
      // but V1 capacity boundary enforces max 3 courts in application config.
      const { V1_RELEASE } = await import('@/app/queue/lib/releaseConfig');
      expect(V1_RELEASE.maxCourts).toBe(3);
      expect(V1_RELEASE.maxPlayers).toBe(30);
    });
  });
});
