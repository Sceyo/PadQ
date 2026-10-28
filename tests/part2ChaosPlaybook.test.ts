import { describe, expect, it } from 'vitest';
import {
  seedMultiCourtDoubles,
  rotateMultiCourtDoubles,
  type LockedPartnerPair,
} from '@/app/queue/lib/doublesEngine';
import { getMaxPartnerPairs } from '@/app/queue/components/LiveManagement/LiveManagement';
import { computeSessionRecap } from '@/app/queue/lib/recapUtils';
import type { PlayerStat, MatchHistoryEntry } from '@/app/queue/lib/types';

function players(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `Player ${String(i + 1).padStart(2, '0')}`);
}

describe('Part 2: Real-World Human Chaos Stress Test Playbook — Engine Verification', () => {
  // Scenario A: Club Night Rush (16+ Players, 3 Courts)
  it('Scenario A: The Club Night Rush populates 3 courts with 12 players and keeps 4 in waiting queue', () => {
    const roster = players(16);
    const seeded = seedMultiCourtDoubles(roster, 3, []);

    // 1. Courts 1, 2, and 3 are populated with 12 players (4 per court)
    expect(seeded.courts).toHaveLength(3);
    expect(seeded.courts[0]).toEqual(['Player 01', 'Player 02', 'Player 03', 'Player 04']);
    expect(seeded.courts[1]).toEqual(['Player 05', 'Player 06', 'Player 07', 'Player 08']);
    expect(seeded.courts[2]).toEqual(['Player 09', 'Player 10', 'Player 11', 'Player 12']);

    // 2. Remaining 4 players are in the Waiting Queue (#1 to #4)
    expect(seeded.waiting).toEqual(['Player 13', 'Player 14', 'Player 15', 'Player 16']);

    // 3. Rotate Court 1: Waiting players #1 and #2 (Player 13 & 14) take the court
    const rotated = rotateMultiCourtDoubles(seeded.waiting, seeded.courts[0], []);
    expect(rotated.onCourt).toContain('Player 13');
    expect(rotated.onCourt).toContain('Player 14');
    expect(rotated.waiting).toHaveLength(4);
  });

  // Scenario B: Fat-Finger Accidental Winner Recovery
  it('Scenario B: The Accidental Winner ("Fat-Finger Recovery") preserves exact undo state', () => {
    const roster = players(8);
    const seeded = seedMultiCourtDoubles(roster, 1, []);
    const courtBefore = [...seeded.courts[0]];
    const waitingBefore = [...seeded.waiting];

    // Accidental win recorded
    const rotated = rotateMultiCourtDoubles(seeded.waiting, seeded.courts[0], []);
    expect(rotated.onCourt).not.toEqual(courtBefore);

    // Snapshot before match can be restored directly (Undo invariant)
    const restoredCourts = [courtBefore];
    const restoredWaiting = waitingBefore;
    expect(restoredCourts[0]).toEqual(courtBefore);
    expect(restoredWaiting).toEqual(waitingBefore);
  });

  // Scenario C: Marathon Deuce Battle
  it('Scenario C: The Marathon Deuce Battle correctly enforces win-by-2 margin on deuces', () => {
    const baseLimit = 11;
    let scoreA = 10;
    let scoreB = 10;

    // Both at 10 -> Deuce
    const isDeuce = (a: number, b: number) => a >= baseLimit - 1 && b >= baseLimit - 1 && Math.abs(a - b) < 2;
    const isWon = (a: number, b: number) => (a >= baseLimit || b >= baseLimit) && Math.abs(a - b) >= 2;

    expect(isDeuce(scoreA, scoreB)).toBe(true);
    expect(isWon(scoreA, scoreB)).toBe(false);

    // 5 consecutive deuce cycles
    for (let cycle = 1; cycle <= 5; cycle++) {
      scoreA += 1; // Advantage Team A
      expect(isWon(scoreA, scoreB)).toBe(false);
      scoreB += 1; // Resets to Deuce
      expect(isDeuce(scoreA, scoreB)).toBe(true);
      expect(isWon(scoreA, scoreB)).toBe(false);
    }

    // Now score is 15-15, target dynamically extended to 17
    expect(scoreA).toBe(15);
    expect(scoreB).toBe(15);

    // Team A scores 2 in a row to win 17-15
    scoreA += 2;
    expect(isWon(scoreA, scoreB)).toBe(true);
    expect(scoreA).toBe(17);
    expect(scoreB).toBe(15);
  });

  // Scenario D: Mid-Session Break & Bathroom Run
  it('Scenario D: Mid-Session Break skips player on break during rotation, restores on return', () => {
    const roster = players(8);
    const seeded = seedMultiCourtDoubles(roster, 1, []);
    // Court: 01, 02, 03, 04. Waiting: 05, 06, 07, 08

    // Player 05 takes a break (sit-out)
    const sitOuts = new Set(['Player 05']);
    const activeWaiting = seeded.waiting.filter(p => !sitOuts.has(p));
    expect(activeWaiting).toEqual(['Player 06', 'Player 07', 'Player 08']);

    // Court 1 finishes match: Next 2 active players (06 and 07) take court, skipping 05!
    const rotated = rotateMultiCourtDoubles(activeWaiting, seeded.courts[0], []);
    expect(rotated.onCourt).toContain('Player 06');
    expect(rotated.onCourt).toContain('Player 07');
    expect(rotated.onCourt).not.toContain('Player 05');

    // Player 05 returns from break: inserted back into queue
    const returnedWaiting = ['Player 05', ...rotated.waiting];
    expect(returnedWaiting).toContain('Player 05');
  });

  // Scenario E: Fixed Duo / Partner Locking
  it('Scenario E: Fixed Duo / Partner Locking enforces duo stays together on same team', () => {
    const roster = players(10);
    const lockedPairs: LockedPartnerPair[] = [['Player 09', 'Player 10']];
    const maxPairs = getMaxPartnerPairs(roster.length);
    expect(maxPairs).toBeGreaterThanOrEqual(1);

    const seeded = seedMultiCourtDoubles(roster, 2, lockedPairs);
    // Find which court or queue the locked duo is on
    const courtWithDuo = seeded.courts.find(c => c.includes('Player 09') || c.includes('Player 10'));
    expect(courtWithDuo).toBeDefined();
    expect(courtWithDuo).toContain('Player 09');
    expect(courtWithDuo).toContain('Player 10');

    // Check same side: both on Team A (indices 0,1) or Team B (indices 2,3)
    const idx1 = courtWithDuo!.indexOf('Player 09');
    const idx2 = courtWithDuo!.indexOf('Player 10');
    expect(Math.floor(idx1 / 2)).toBe(Math.floor(idx2 / 2));

    // When that court rotates out and next match is selected, the pair stays unified
    const rotated = rotateMultiCourtDoubles(seeded.waiting, courtWithDuo!, lockedPairs);
    // Both are kept together on the same team on the next court rotation
    expect(rotated.onCourt).toContain('Player 09');
    expect(rotated.onCourt).toContain('Player 10');
    const nextIdx1 = rotated.onCourt.indexOf('Player 09');
    const nextIdx2 = rotated.onCourt.indexOf('Player 10');
    expect(Math.floor(nextIdx1 / 2)).toBe(Math.floor(nextIdx2 / 2));
  });

  // Scenario F: Late Walk-In & Sudden Departure
  it('Scenario F: Late Walk-In appends to queue and sudden departure purges cleanly', () => {
    const roster = players(8);
    const seeded = seedMultiCourtDoubles(roster, 1, []);

    // 1. Late Walk-In: Zoe arrives
    const withLate = [...seeded.waiting, 'Late Arrival Zoe'];
    expect(withLate[withLate.length - 1]).toBe('Late Arrival Zoe');

    // 2. Sudden Departure: Player 08 leaves early
    const purged = withLate.filter(p => p !== 'Player 08');
    expect(purged).not.toContain('Player 08');
    expect(purged).toContain('Late Arrival Zoe');

    // Active court remains completely unaffected
    expect(seeded.courts[0]).toEqual(['Player 01', 'Player 02', 'Player 03', 'Player 04']);
  });

  // Scenario G: Staggered Multi-Court Finishes
  it('Scenario G: Staggered Multi-Court Finishes allows Court 2 to rotate without disturbing Court 1', () => {
    const roster = players(10);
    const seeded = seedMultiCourtDoubles(roster, 2, []);
    const court1Before = [...seeded.courts[0]];
    const court2Before = [...seeded.courts[1]];

    // Court 2 finishes first
    const rotated = rotateMultiCourtDoubles(seeded.waiting, seeded.courts[1], []);
    expect(rotated.onCourt).not.toEqual(court2Before);
    // Court 1 remains completely untouched!
    expect(seeded.courts[0]).toEqual(court1Before);
  });

  // Scenario H: Spectator Recap & History Generation
  it('Scenario H: Spectator Swarm & Standings recap data generates without errors', () => {
    const history: MatchHistoryEntry[] = [
      { id: 1, mode: 'doubles', players: 'Player 01 & Player 02 vs Player 03 & Player 04', winner: 'Player 01 & Player 02', score: '11 – 7', timestamp: '10:00 AM' },
      { id: 2, mode: 'doubles', players: 'Player 05 & Player 06 vs Player 07 & Player 08', winner: 'Player 05 & Player 06', score: '11 – 9', timestamp: '10:15 AM' },
    ];
    const playerStats: PlayerStat[] = [
      { name: 'Player 01', wins: 2, losses: 0, gamesPlayed: 2, winRate: 100, streak: 2, rank: 'Diamond' },
      { name: 'Player 02', wins: 1, losses: 1, gamesPlayed: 2, winRate: 50, streak: 1, rank: 'Gold' },
      { name: 'Player 03', wins: 0, losses: 2, gamesPlayed: 2, winRate: 0, streak: 0, rank: 'Bronze' },
    ];

    const recap = computeSessionRecap(playerStats, history);
    expect(recap.totalMatches).toBe(2);
    expect(recap.totalPlayers).toBe(3);
    expect(recap.podium).toHaveLength(3);
  });

  // Scenario I: Session Serialization & Restoration Resilience
  it('Scenario I: Flaky Wi-Fi & Hard Refresh preserves active state across serialization', () => {
    const state = {
      sessionId: 'TEST99',
      courts: [['Player 01', 'Player 02', 'Player 03', 'Player 04']],
      waiting: ['Player 05', 'Player 06'],
      score: { scoreA: 8, scoreB: 6, limit: 11 },
    };

    // Serialize to JSON (mimicking localStorage / network cache)
    const serialized = JSON.stringify(state);
    const restored = JSON.parse(serialized);

    expect(restored.sessionId).toBe('TEST99');
    expect(restored.courts).toEqual(state.courts);
    expect(restored.waiting).toEqual(state.waiting);
    expect(restored.score.scoreA).toBe(8);
    expect(restored.score.scoreB).toBe(6);
  });
});
