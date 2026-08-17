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
});
