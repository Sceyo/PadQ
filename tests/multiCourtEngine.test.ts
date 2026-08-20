import { describe, expect, it } from 'vitest';
import {
  rotateMultiCourtDoubles,
  seedMultiCourtDoubles,
  selectPartnerAwareMatch,
  type LockedPartnerPair,
} from '@/app/queue/lib/doublesEngine';
import { planMultiCourtResult } from '@/app/queue/lib/multiCourtResult';

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

  it('splits ordinary teammates before their next match in a 10-player, two-court rotation', () => {
    const players = Array.from({ length: 10 }, (_, index) => String(index + 1));
    const seeded = seedMultiCourtDoubles(players, 2, []);
    const courts = seeded.courts.map(onCourt => [...onCourt]);
    let waiting = [...seeded.waiting];
    const lastPartner = new Map<string, string>();

    const rememberTeams = (onCourt: string[]) => {
      for (const [first, second] of [[onCourt[0], onCourt[1]], [onCourt[2], onCourt[3]]]) {
        lastPartner.set(first, second);
        lastPartner.set(second, first);
      }
    };

    for (let result = 0; result < 40; result += 1) {
      const courtIndex = result % 2;
      rememberTeams(courts[courtIndex]);

      const next = rotateMultiCourtDoubles(waiting, courts[courtIndex], []);
      for (const [first, second] of [[next.onCourt[0], next.onCourt[1]], [next.onCourt[2], next.onCourt[3]]]) {
        expect(lastPartner.get(first)).not.toBe(second);
        expect(lastPartner.get(second)).not.toBe(first);
      }

      courts[courtIndex] = next.onCourt;
      waiting = next.waiting;
      expectValidPartition(players, courts, waiting, []);
    }
  });

  it('serializes different court results from the latest shared queue and rejects a duplicate tap', () => {
    const players = Array.from({ length: 30 }, (_, i) => `P${i + 1}`);
    const seeded = seedMultiCourtDoubles(players, 3, []);
    const initial = {
      queue: seeded.waiting,
      courtSlots: seeded.courts.map((onCourt, index) => ({
        id: `court-${index}`,
        name: `Court ${index + 1}`,
        onCourt,
      })),
      lockedPartners: [],
      sittingOut: [],
    };
    const courtOnePlayers = [...initial.courtSlots[0].onCourt];
    const courtTwoPlayers = [...initial.courtSlots[1].onCourt];
    const first = planMultiCourtResult(initial, 'court-0', courtOnePlayers, 'A');
    expect(first).not.toBeNull();
    const second = planMultiCourtResult(
      { ...initial, queue: first!.queue, courtSlots: first!.courtSlots },
      'court-1',
      courtTwoPlayers,
      'B',
    );
    expect(second).not.toBeNull();
    expectValidPartition(players, second!.courtSlots.map(court => court.onCourt), second!.queue, []);
    expect(planMultiCourtResult(
      { ...initial, queue: second!.queue, courtSlots: second!.courtSlots },
      'court-0',
      courtOnePlayers,
      'A',
    )).toBeNull();
  });

  it('rotates 30 singles players across three courts without losing or duplicating anyone', () => {
    const players = Array.from({ length: 30 }, (_, index) => `S${index + 1}`);
    let courtSlots = [0, 1, 2].map(index => ({
      id: `court-${index}`,
      name: `Court ${index + 1}`,
      onCourt: players.slice(index * 2, index * 2 + 2),
    }));
    let queue = players.slice(6);
    const seen = new Set(courtSlots.flatMap(court => court.onCourt));

    for (let round = 0; round < 150; round += 1) {
      const court = courtSlots[round % 3];
      const result = planMultiCourtResult(
        { queue, courtSlots, sittingOut: [] },
        court.id,
        [...court.onCourt],
        round % 2 === 0 ? 'A' : 'B',
        'singles',
      );
      expect(result).not.toBeNull();
      queue = result!.queue;
      courtSlots = result!.courtSlots;
      courtSlots.flatMap(slot => slot.onCourt).forEach(player => seen.add(player));
      expectValidPartition(players, courtSlots.map(slot => slot.onCourt), queue, []);
      expect(courtSlots.every(slot => slot.onCourt.length === 2)).toBe(true);
    }

    expect(seen).toEqual(new Set(players));
  });

  it('keeps a valid singles rematch when no challenger is waiting', () => {
    const result = planMultiCourtResult(
      {
        queue: [],
        courtSlots: [{ id: 'court-0', name: 'Court 1', onCourt: ['A', 'B'] }],
      },
      'court-0',
      ['A', 'B'],
      'B',
      'singles',
    );
    expect(result).toMatchObject({
      queue: [],
      courtSlots: [{ onCourt: ['B', 'A'] }],
      winner: 'B',
    });
  });

  it('handles late arrivals, a sit-out, a substitution, and one unavailable court', () => {
    const originalPlayers = Array.from({ length: 28 }, (_, i) => `P${i + 1}`);
    const seeded = seedMultiCourtDoubles(originalPlayers, 3, []);
    let queue = [...seeded.waiting, 'Late 29', 'Late 30'];
    let courts = seeded.courts.map((onCourt, index) => ({
      id: `court-${index}`,
      name: `Court ${index + 1}`,
      onCourt,
    }));
    const allPlayers = [...originalPlayers, 'Late 29', 'Late 30'];

    const sittingOut = queue.shift()!;
    const substitute = queue.at(-1)!;
    const absent = queue[2];
    queue = queue.filter(player => player !== substitute && player !== absent);
    queue.splice(2, 0, substitute);
    const inactiveCourt = [...courts[2].onCourt];
    const activePlayers = allPlayers.filter(player => player !== sittingOut && player !== absent);

    for (let round = 0; round < 100; round += 1) {
      const courtIndex = round % 2;
      const expectedPlayers = [...courts[courtIndex].onCourt];
      const next = planMultiCourtResult(
        { queue, courtSlots: courts, lockedPartners: [], sittingOut: [sittingOut, absent] },
        `court-${courtIndex}`,
        expectedPlayers,
        round % 2 === 0 ? 'A' : 'B',
      );
      expect(next).not.toBeNull();
      queue = next!.queue;
      courts = next!.courtSlots;
      expect(courts[2].onCourt).toEqual(inactiveCourt);
      expectValidPartition(activePlayers, courts.map(court => court.onCourt), queue, []);
    }

    queue.push(sittingOut, absent);
    expectValidPartition(allPlayers, courts.map(court => court.onCourt), queue, []);
    expect(new Set([...courts.flatMap(court => court.onCourt), ...queue]).size).toBe(30);
  });

  it('runs two independent 30-player rooms through 150 interleaved results each', () => {
    const rooms = ['A', 'B'].map(prefix => {
      const players = Array.from({ length: 30 }, (_, index) => `${prefix}${index + 1}`);
      const seeded = seedMultiCourtDoubles(players, 3, []);
      return { players, courts: seeded.courts.map(onCourt => [...onCourt]), waiting: [...seeded.waiting] };
    });

    for (let round = 0; round < 150; round += 1) {
      for (const room of rooms) {
        const courtIndex = round % 3;
        const next = rotateMultiCourtDoubles(room.waiting, room.courts[courtIndex], []);
        room.courts[courtIndex] = next.onCourt;
        room.waiting = next.waiting;
        expectValidPartition(room.players, room.courts, room.waiting, []);
      }
    }
  });

});
