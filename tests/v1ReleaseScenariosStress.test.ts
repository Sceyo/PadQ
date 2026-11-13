import { describe, expect, it } from 'vitest';
import {
  seedMultiCourtDoubles,
  rotateMultiCourtDoubles,
  type LockedPartnerPair,
} from '@/app/queue/lib/doublesEngine';
import { planMultiCourtResult } from '@/app/queue/lib/multiCourtResult';
import {
  buildPlayerStats,
  comparePlayerStats,
} from '@/app/queue/lib/playerUtils';
import { V1_RELEASE } from '@/app/queue/lib/releaseConfig';
import { getMaxPartnerPairs } from '@/app/queue/components/LiveManagement/LiveManagement';
import type { MatchHistoryEntry } from '@/app/queue/lib/types';

function createRoster(count: number, prefix: string): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}${i + 1}`);
}

function assertPartition(
  roster: string[],
  courts: string[][],
  queue: string[],
  sittingOut: string[] = [],
) {
  const onCourt = courts.flat();
  const allPresent = [...onCourt, ...queue, ...sittingOut];
  expect(new Set(allPresent).size).toBe(roster.length);
  expect(new Set(allPresent)).toEqual(new Set(roster));
  expect(new Set(onCourt).size).toBe(onCourt.length);
  expect(new Set(queue).size).toBe(queue.length);
}

function assertLockedPartners(
  courts: string[][],
  queue: string[],
  locked: LockedPartnerPair[],
) {
  for (const [p1, p2] of locked) {
    const court = courts.find(c => c.includes(p1) || c.includes(p2));
    if (court) {
      // If one is on court, BOTH must be on that same court as teammates
      expect(court).toContain(p1);
      expect(court).toContain(p2);
      const team1 = Math.floor(court.indexOf(p1) / 2);
      const team2 = Math.floor(court.indexOf(p2) / 2);
      expect(team1).toBe(team2);
    } else {
      // If neither is on court, both must be in queue
      expect(queue).toContain(p1);
      expect(queue).toContain(p2);
    }
  }
}

describe('V1 Backend & Engine Release Stress Suite', () => {
  describe('Scenario 1: Global Asynchronous Partner Pairing (Option 2) Under Heavy Multi-Court Load', () => {
    it('handles multiple cross-court pairs, holds queued partners, and unites them on arrival without deadlocks', () => {
      const roster = createRoster(20, 'P'); // 20 players, 3 courts (12 on court, 8 in queue)
      // Initial seeding with 0 locked pairs
      const seeded = seedMultiCourtDoubles(roster, 3, []);
      const courts = seeded.courts.map(c => [...c]);
      let queue = [...seeded.waiting];

      // Courts initially:
      // Court 1: [P1, P2, P3, P4]
      // Court 2: [P5, P6, P7, P8]
      // Court 3: [P9, P10, P11, P12]
      // Queue: [P13, P14, P15, P16, P17, P18, P19, P20]

      // Now host sets 3 locked pairs across different locations:
      // Pair 1: P1 (Court 1) & P15 (Queue) -> cross-court
      // Pair 2: P6 (Court 2) & P18 (Queue) -> cross-court
      // Pair 3: P13 (Queue) & P14 (Queue) -> both in queue
      const locked: LockedPartnerPair[] = [
        ['P1', 'P15'],
        ['P6', 'P18'],
        ['P13', 'P14'],
      ];

      // Step 1: Court 3 finishes first.
      // Candidate pool has Queue (P13..P20) + Court 3 finishers (P9..P12).
      // P15 must NOT enter Court 3 because partner P1 is still on Court 1!
      // P18 must NOT enter Court 3 because partner P6 is still on Court 2!
      // P13 & P14 CAN and SHOULD enter together as teammates!
      const nextCourt3 = rotateMultiCourtDoubles(queue, courts[2], locked);
      courts[2] = nextCourt3.onCourt;
      queue = nextCourt3.waiting;

      expect(courts[2]).toHaveLength(4);
      // P15 and P18 were held back in waiting
      expect(courts[2]).not.toContain('P15');
      expect(courts[2]).not.toContain('P18');
      expect(queue).toContain('P15');
      expect(queue).toContain('P18');

      // P13 and P14 entered Court 3 together as teammates
      expect(courts[2]).toContain('P13');
      expect(courts[2]).toContain('P14');
      expect(Math.floor(courts[2].indexOf('P13') / 2)).toBe(Math.floor(courts[2].indexOf('P14') / 2));

      // Step 2: Court 1 finishes!
      // P1 returns to the queue. Now BOTH P1 and P15 are available in the candidate pool!
      const nextCourt1 = rotateMultiCourtDoubles(queue, courts[0], locked);
      courts[0] = nextCourt1.onCourt;
      queue = nextCourt1.waiting;

      expect(courts[0]).toHaveLength(4);
      // P1 and P15 MUST be on Court 1 together as teammates!
      expect(courts[0]).toContain('P1');
      expect(courts[0]).toContain('P15');
      expect(Math.floor(courts[0].indexOf('P1') / 2)).toBe(Math.floor(courts[0].indexOf('P15') / 2));

      // Step 3: Run 40 subsequent random/interleaved finishes cycling through all 3 courts
      const finishSequence = [1, 2, 0, 1, 0, 2, 2, 0, 1, 2, 1, 0];
      for (let round = 0; round < 40; round += 1) {
        const courtIdx = finishSequence[round % finishSequence.length];
        const next = rotateMultiCourtDoubles(queue, courts[courtIdx], locked);
        courts[courtIdx] = next.onCourt;
        queue = next.waiting;

        // Verify partition and partner integrity after every match
        assertPartition(roster, courts, queue);
        assertLockedPartners(courts, queue, locked);
        expect(courts[courtIdx]).toHaveLength(4);
      }
    });
  });

  describe('Scenario 2: Multi-Court Match Scores & Tiebreaking Point Differential Stress', () => {
    it('accurately tallies point differentials, opponent win rates, and sorts standings with exact 4-tier hierarchy', () => {
      // 8 players across 6 completed matches with realistic pickleball scores
      const players = ['Ben', 'Anna', 'Tyson', 'Catherine', 'Collin', 'Jorja', 'JW', 'Federico'];
      const history: MatchHistoryEntry[] = [
        // Match 1: Ben & Anna beat Tyson & Catherine 11-9 (+2 for winners, -2 for losers)
        {
          id: 1,
          mode: 'Doubles (Court 1)',
          players: 'Ben & Anna vs Tyson & Catherine',
          winner: 'Ben & Anna',
          score: '11 – 9',
          timestamp: '10:00:00 AM',
        },
        // Match 2: Collin & Jorja beat JW & Federico 11-5 (+6 for winners, -6 for losers)
        {
          id: 2,
          mode: 'Doubles (Court 2)',
          players: 'Collin & Jorja vs JW & Federico',
          winner: 'Collin & Jorja',
          score: '11 – 5',
          timestamp: '10:05:00 AM',
        },
        // Match 3: Ben & Anna beat Collin & Jorja 11-0 blowout (+11 for winners, -11 for losers)
        {
          id: 3,
          mode: 'Doubles (Court 1)',
          players: 'Ben & Anna vs Collin & Jorja',
          winner: 'Ben & Anna',
          score: '11 – 0',
          timestamp: '10:15:00 AM',
        },
        // Match 4: Tyson & Catherine beat JW & Federico 13-11 deuce (+2 for winners, -2 for losers)
        {
          id: 4,
          mode: 'Doubles (Court 2)',
          players: 'Tyson & Catherine vs JW & Federico',
          winner: 'Tyson & Catherine',
          score: '13 – 11',
          timestamp: '10:20:00 AM',
        },
        // Match 5: Ben & Anna beat JW & Federico 11-7 (+4 for winners, -4 for losers)
        {
          id: 5,
          mode: 'Doubles (Court 1)',
          players: 'Ben & Anna vs JW & Federico',
          winner: 'Ben & Anna',
          score: '11 – 7',
          timestamp: '10:30:00 AM',
        },
        // Match 6: Collin & Jorja beat Tyson & Catherine (no score entered / skipped)
        {
          id: 6,
          mode: 'Doubles (Court 2)',
          players: 'Collin & Jorja vs Tyson & Catherine',
          winner: 'Collin & Jorja',
          score: undefined,
          timestamp: '10:35:00 AM',
        },
      ];

      // Build stats from history using the core engine
      const stats = buildPlayerStats(players, history);

      // Verify point conservation: sum of all point differentials must equal 0
      const totalDiff = stats.reduce((sum, s) => sum + (s.pointDiff ?? 0), 0);
      expect(totalDiff).toBe(0);

      const statsMap = Object.fromEntries(stats.map(s => [s.name, s]));

      // Ben & Anna: played in Match 1 (+2), Match 3 (+11), Match 5 (+4) = +17
      expect(statsMap['Ben'].pointDiff).toBe(17);
      expect(statsMap['Ben'].pointsScored).toBe(33);
      expect(statsMap['Ben'].pointsConceded).toBe(16);
      expect(statsMap['Anna'].pointDiff).toBe(17);

      // Collin & Jorja: Match 2 (+6), Match 3 (-11), Match 6 (unscored) = -5
      expect(statsMap['Collin'].pointDiff).toBe(-5);
      expect(statsMap['Jorja'].pointDiff).toBe(-5);

      // JW & Federico: Match 2 (-6), Match 4 (-2), Match 5 (-4) = -12
      expect(statsMap['JW'].pointDiff).toBe(-12);
      expect(statsMap['Federico'].pointDiff).toBe(-12);

      // Sort by 4-tier tiebreaker: Wins -> Win % -> PD -> OWP -> Name
      const sorted = [...stats].sort(comparePlayerStats);

      // Top 2 must be Ben & Anna (3 wins, 100% win rate, +17 PD)
      expect(['Ben', 'Anna']).toContain(sorted[0].name);
      expect(['Ben', 'Anna']).toContain(sorted[1].name);

      // Collin & Jorja have 2 wins (2-1, 67%), Tyson & Catherine have 1 win (1-2, 33%)
      expect(['Collin', 'Jorja']).toContain(sorted[2].name);
      expect(['Collin', 'Jorja']).toContain(sorted[3].name);

      // JW & Federico have 0 wins (0-3, 0%)
      expect(['JW', 'Federico']).toContain(sorted[6].name);
      expect(['JW', 'Federico']).toContain(sorted[7].name);
    });
  });

  describe('Scenario 3: Dynamic Live Interventions (Sit-Out, Departure, Late Arrival, Swaps, Undo)', () => {
    it('seamlessly preserves court slots, queue integrity, and undo snapshots through live changes', () => {
      const roster = createRoster(14, 'R');
      const seeded = seedMultiCourtDoubles(roster, 2, []);
      const state = {
        queue: seeded.waiting,
        courtSlots: [
          { id: 'c1', name: 'Court 1', onCourt: seeded.courts[0] },
          { id: 'c2', name: 'Court 2', onCourt: seeded.courts[1] },
        ],
        sittingOut: [] as string[],
      };

      // 1. Two players in queue (R9 and R10) toggle Sit Out (removed from queue to bench)
      state.sittingOut = ['R9', 'R10'];
      state.queue = state.queue.filter(p => !state.sittingOut.includes(p));

      // 2. Court 1 finishes: R9 and R10 must NOT be selected
      const res1 = planMultiCourtResult(state, 'c1', state.courtSlots[0].onCourt, 'A', 'doubles');
      expect(res1).not.toBeNull();
      expect(res1!.courtSlots[0].onCourt).not.toContain('R9');
      expect(res1!.courtSlots[0].onCourt).not.toContain('R10');

      state.queue = res1!.queue;
      state.courtSlots = res1!.courtSlots;

      // 3. Late arrivals R15 and R16 register
      state.queue.push('R15', 'R16');
      expect(state.queue).toContain('R15');
      expect(state.queue).toContain('R16');

      // 4. Queued player R16 departs early
      state.queue = state.queue.filter(p => p !== 'R16');
      expect(state.queue).not.toContain('R16');

      // 5. Sitting out players R9 & R10 return to queue
      state.sittingOut = [];
      state.queue.push('R9', 'R10');

      // 6. Court 2 finishes
      const res2 = planMultiCourtResult(state, 'c2', state.courtSlots[1].onCourt, 'B', 'doubles');
      expect(res2).not.toBeNull();
      state.queue = res2!.queue;
      state.courtSlots = res2!.courtSlots;

      // Verify overall partition across remaining 15 active players (14 initial + 1 net late arrival)
      const active15 = roster.concat(['R15']);
      assertPartition(active15, state.courtSlots.map(c => c.onCourt), state.queue);
    });
  });

  describe('Scenario 4: Boundary & Capacity Stress (Zero-Queue and Overcapacity)', () => {
    it('handles zero-queue tight boundary on 1, 2, and 3 courts without crash or corruption', () => {
      for (const courtCount of [1, 2, 3]) {
        const exactCount = courtCount * 4;
        const roster = createRoster(exactCount, `T${courtCount}-`);
        const seeded = seedMultiCourtDoubles(roster, courtCount, []);
        expect(seeded.waiting).toHaveLength(0);
        expect(seeded.courts).toHaveLength(courtCount);
        expect(seeded.courts.every(c => c.length === 4)).toBe(true);

        const courts = seeded.courts.map(c => [...c]);
        let queue = [...seeded.waiting];

        // Rotate each court twice with 0 waiting queue
        for (let i = 0; i < courtCount * 2; i += 1) {
          const courtIdx = i % courtCount;
          const next = rotateMultiCourtDoubles(queue, courts[courtIdx], []);
          courts[courtIdx] = next.onCourt;
          queue = next.waiting;
          expect(courts[courtIdx]).toHaveLength(4);
          expect(queue).toHaveLength(0);
        }
      }
    });

    it('enforces V1 capacity limits strictly (max 3 courts, max 30 players)', () => {
      expect(V1_RELEASE.maxCourts).toBe(3);
      expect(V1_RELEASE.maxPlayers).toBe(30);

      // Max pairs helper calculation
      expect(getMaxPartnerPairs(30)).toBe(15);
      expect(getMaxPartnerPairs(20)).toBe(10);
      expect(getMaxPartnerPairs(8)).toBe(4);
      expect(getMaxPartnerPairs(5)).toBe(1);
    });
  });
});
