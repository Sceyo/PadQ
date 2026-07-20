import { describe, it, expect } from 'vitest';
import {
  rotatePlayers,
  reassignCourt,
  initSkilledState,
  fillIdleCourts,
  type SkilledState,
  type CourtDef,
} from '@/app/queue/lib/skilledMatchmakingEngine';
import {
  freshPaddleState,
  buildNextMatch,
  advancePaddleState,
  type PaddleState,
  type Team,
} from '@/app/queue/lib/doublesEngine';

/**
 * Realistic club-night scenarios: 3–5 courts, 30–50 players, mixed skill
 * brackets. These mirror what an actual open-play session looks like —
 * not synthetic minimal cases, but the full messy distribution.
 */

const courts = (n: number): CourtDef[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, name: `Court ${i + 1}` }));

const namedPlayers = (prefix: string, n: number, startAt = 1) =>
  Array.from({ length: n }, (_, i) => `${prefix}${i + startAt}`);

/** Build a skill-bracket split roughly matching a typical open-play crowd:
 *  more beginners/intermediates than advanced players. */
function buildRealisticBrackets(total: number) {
  const beginnerCount = Math.round(total * 0.4);
  const advancedCount = Math.round(total * 0.15);
  const intermediateCount = total - beginnerCount - advancedCount;

  const beginner = namedPlayers('B', beginnerCount);
  const intermediate = namedPlayers('I', intermediateCount);
  const advanced = namedPlayers('A', advancedCount);

  return {
    players: [...beginner, ...intermediate, ...advanced],
    brackets: { beginner, intermediate, advanced },
  };
}

/** Simulate N full game cycles on a skilled-mode session: every court that
 *  has players "finishes" its game, gets rotated, and reassigned. */
function simulateSkilledCycles(state: SkilledState, brackets: ReturnType<typeof buildRealisticBrackets>['brackets'], cycles: number) {
  for (let cycle = 0; cycle < cycles; cycle++) {
    for (const court of state.courts) {
      if (court.players.length === 0) continue;
      const finished = court.players;
      state = rotatePlayers(finished, state, brackets);
      state = reassignCourt(court.id, state, brackets);
    }
    state = fillIdleCourts(state);
  }
  return state;
}

describe('Club-night scenario — Skilled mode, 3 courts / 40 players', () => {
  const total = 40;
  const { players, brackets } = buildRealisticBrackets(total);

  it('sanity check: bracket split matches the intended ~40/15/45 distribution', () => {
    expect(brackets.beginner.length).toBe(16); // 40% of 40
    expect(brackets.advanced.length).toBe(6);  // 15% of 40
    expect(brackets.intermediate.length).toBe(18); // remainder
    expect(brackets.beginner.length + brackets.intermediate.length + brackets.advanced.length).toBe(total);
  });

  it('init fills all 3 courts immediately (40 players >> 3*4=12 needed)', () => {
    const state = initSkilledState(players, brackets, courts(3));
    const filledCourts = state.courts.filter(c => c.players.length === 4);
    expect(filledCourts).toHaveLength(3);
  });

  it('rest is enabled and uses the 2-cycle rest length (40 >= 3*4 + 3*2 = 18)', () => {
    const state = initSkilledState(players, brackets, courts(3));
    expect(state.restEnabled).toBe(true);
    expect(state.restCycleLength).toBe(2);
  });

  it('no player is ever assigned to two courts at once across init', () => {
    const state = initSkilledState(players, brackets, courts(3));
    const allOnCourts = state.courts.flatMap(c => c.players);
    expect(new Set(allOnCourts).size).toBe(allOnCourts.length);
  });

  it('every player on court + in queue + sitting out + resting accounts for all 40 (no one vanishes at init)', () => {
    const state = initSkilledState(players, brackets, courts(3));
    const onCourt = state.courts.flatMap(c => c.players);
    const waiting = state.waitingQueue;
    const resting = state.restPool.map(e => e.name);
    const everyone = new Set([...onCourt, ...waiting, ...resting]);
    expect(everyone.size).toBe(total);
    expect(everyone).toEqual(new Set(players));
  });

  it('survives 30 full rotation cycles without ever double-booking a player across courts', () => {
    let state = initSkilledState(players, brackets, courts(3));
    let worstViolation: string[] | null = null;

    for (let i = 0; i < 30; i++) {
      state = simulateSkilledCycles(state, brackets, 1);
      const onCourt = state.courts.flatMap(c => c.players);
      if (new Set(onCourt).size !== onCourt.length) {
        worstViolation = onCourt;
        break;
      }
    }
    expect(worstViolation).toBeNull();
  });

  it('survives 30 full rotation cycles without ever losing a player (everyone always accounted for)', () => {
    let state = initSkilledState(players, brackets, courts(3));
    let missingAt = -1;

    for (let i = 0; i < 30; i++) {
      state = simulateSkilledCycles(state, brackets, 1);
      const onCourt = state.courts.flatMap(c => c.players);
      const waiting = state.waitingQueue;
      const resting = state.restPool.map(e => e.name);
      const everyone = new Set([...onCourt, ...waiting, ...resting]);
      if (everyone.size !== total) {
        missingAt = i;
        break;
      }
    }
    expect(missingAt).toBe(-1);
  });

  it('every player gets at least one game within a reasonable number of cycles (no permanent bench-warmers)', () => {
    // FIXED: pickBestGroup() now tracks bracketWaitCycles and force-includes
    // a starved bracket once it's been skipped STARVATION_THRESHOLD (3) times
    // in a row, even if P1/P2 would otherwise succeed without it. Verified
    // directly: with this distribution, the 6 advanced players now cycle
    // through roughly every 5-6 picks instead of never.
    let state = initSkilledState(players, brackets, courts(3));
    const everPlayed = new Set(state.courts.flatMap(c => c.players));

    for (let i = 0; i < 25; i++) {
      state.courts.forEach(c => c.players.forEach(p => everPlayed.add(p)));
      state = simulateSkilledCycles(state, brackets, 1);
    }
    state.courts.forEach(c => c.players.forEach(p => everPlayed.add(p)));

    const neverPlayed = players.filter(p => !everPlayed.has(p));
    expect(neverPlayed).toEqual([]);
  });

  it('no court remains idle for more than a couple cycles once enough players exist (idleCycles bounded)', () => {
    let state = initSkilledState(players, brackets, courts(3));
    let maxIdleSeen = 0;

    for (let i = 0; i < 20; i++) {
      state = simulateSkilledCycles(state, brackets, 1);
      const maxIdleThisRound = Math.max(...state.courts.map(c => c.idleCycles));
      maxIdleSeen = Math.max(maxIdleSeen, maxIdleThisRound);
    }
    // With 40 players and only 12 court slots, a court should basically never
    // sit idle for long — fillIdleCourts should catch it within 1 cycle.
    expect(maxIdleSeen).toBeLessThanOrEqual(1);
  });
});

describe('Club-night scenario — Skilled mode, 5 courts / 50 players', () => {
  const total = 50;
  const { players, brackets } = buildRealisticBrackets(total);

  it('init fills all 5 courts (50 players >> 5*4=20 needed)', () => {
    const state = initSkilledState(players, brackets, courts(5));
    const filledCourts = state.courts.filter(c => c.players.length === 4);
    expect(filledCourts).toHaveLength(5);
  });

  it('rest is enabled with the 2-cycle length (50 >= 5*4 + 5*2 = 30)', () => {
    const state = initSkilledState(players, brackets, courts(5));
    expect(state.restEnabled).toBe(true);
    expect(state.restCycleLength).toBe(2);
  });

  it('survives 30 cycles at max realistic scale with no double-booking and no missing players', () => {
    let state = initSkilledState(players, brackets, courts(5));
    let violation = false;

    for (let i = 0; i < 30; i++) {
      state = simulateSkilledCycles(state, brackets, 1);
      const onCourt = state.courts.flatMap(c => c.players);
      const waiting = state.waitingQueue;
      const resting = state.restPool.map(e => e.name);
      const everyone = new Set([...onCourt, ...waiting, ...resting]);

      if (new Set(onCourt).size !== onCourt.length || everyone.size !== total) {
        violation = true;
        break;
      }
    }
    expect(violation).toBe(false);
  });
});

describe('Club-night scenario — Skilled mode, uneven bracket distribution (heavy-beginner night)', () => {
  // Real clubs often skew heavily beginner — e.g. a "beginner-friendly open play"
  // with 30 beginners, 8 intermediate, 2 advanced across 4 courts.
  const beginner = namedPlayers('B', 30);
  const intermediate = namedPlayers('I', 8);
  const advanced = namedPlayers('A', 2);
  const players = [...beginner, ...intermediate, ...advanced];
  const brackets = { beginner, intermediate, advanced };

  it('still fills all 4 courts despite the heavy skew (P1 pure-beginner matches dominate)', () => {
    const state = initSkilledState(players, brackets, courts(4));
    const filledCourts = state.courts.filter(c => c.players.length === 4);
    expect(filledCourts).toHaveLength(4);
  });

  it('the 2 advanced players are not permanently stuck waiting — they eventually get matched (via starvation override)', () => {
    // FIXED: previously A1/A2 sat untouched in skillQueue.advanced for 15+
    // cycles because P1/P2 always succeeded using only the much larger
    // beginner/intermediate pools. pickBestGroup now force-includes a
    // starved bracket after STARVATION_THRESHOLD (3) consecutive misses.
    let state = initSkilledState(players, brackets, courts(4));
    const advancedPlayed = new Set<string>();

    for (let i = 0; i < 15; i++) {
      state.courts.forEach(c => c.players.forEach(p => { if (advanced.includes(p)) advancedPlayed.add(p); }));
      state = simulateSkilledCycles(state, brackets, 1);
    }
    state.courts.forEach(c => c.players.forEach(p => { if (advanced.includes(p)) advancedPlayed.add(p); }));

    expect(advancedPlayed.size).toBe(advanced.length);
  });

  it('survives 25 cycles with this skew without losing or duplicating any player', () => {
    let state = initSkilledState(players, brackets, courts(4));
    let violation = false;

    for (let i = 0; i < 25; i++) {
      state = simulateSkilledCycles(state, brackets, 1);
      const onCourt = state.courts.flatMap(c => c.players);
      const waiting = state.waitingQueue;
      const resting = state.restPool.map(e => e.name);
      const everyone = new Set([...onCourt, ...waiting, ...resting]);

      if (new Set(onCourt).size !== onCourt.length || everyone.size !== players.length) {
        violation = true;
        break;
      }
    }
    expect(violation).toBe(false);
  });
});

describe('Club-night scenario — Skilled mode, players join/leave mid-session at scale', () => {
  it('a player added mid-session (latecomer) eventually gets on court without breaking the invariants', () => {
    const total = 36;
    const { players, brackets } = buildRealisticBrackets(total);
    let state = initSkilledState(players, brackets, courts(3));

    // Run a few cycles before the latecomer arrives.
    state = simulateSkilledCycles(state, brackets, 5);

    // Late arrival: an intermediate player joins mid-session.
    const latecomer = 'Latecomer1';
    const sq = { ...state.skillQueue, intermediate: [...state.skillQueue.intermediate, latecomer] };
    state = { ...state, skillQueue: sq, waitingQueue: [...state.waitingQueue, latecomer], totalPlayers: state.totalPlayers + 1 };

    const extendedBrackets = { ...brackets, intermediate: [...brackets.intermediate, latecomer] };

    let latecomerPlayed = false;
    for (let i = 0; i < 15; i++) {
      state = simulateSkilledCycles(state, extendedBrackets, 1);
      if (state.courts.some(c => c.players.includes(latecomer))) {
        latecomerPlayed = true;
        break;
      }
    }
    expect(latecomerPlayed).toBe(true);
  });
});

describe('Club-night scenario — Default doubles mode, 3 courts worth of players (12 active, large bench)', () => {
  // Default mode (doublesEngine.ts) doesn't have a court concept — it manages
  // one rotating queue. A "3-court club night" running Default mode just means
  // a much larger waitingQueue/w1/l1 pool feeding a single rotation. We stress
  // the MAX_POOL_SIZE=8 cap and overall stability at 40+ players.
  function playFullSession(playerCount: number, rounds: number) {
    const players = namedPlayers('P', playerCount);
    let state = freshPaddleState();
    const seenAcrossSession = new Set<string>();

    for (let i = 0; i < rounds; i++) {
      const match = buildNextMatch(state, players);
      const allFour = [...match.teamA, ...match.teamB].filter(p => p !== '');
      allFour.forEach(p => seenAcrossSession.add(p));
      if (allFour.length < 4) break; // not enough players to form a match — stop
      const winnerTeam = match.teamA;
      const loserTeam = match.teamB;
      const res = advancePaddleState(state, winnerTeam, loserTeam, players);
      state = res.nextState;
    }
    return { state, players, seenAcrossSession };
  }

  it('40 players, 60 rounds: w1 and l1 pools never exceed MAX_POOL_SIZE (8) — FIXED', () => {
    // balancePools() in doublesEngine.ts does a single corrective pass per pool,
    // not a fixed-point loop. When both w1 and l1 are simultaneously at/near the
    // cap (which happens reliably during a long INIT phase with 30+ players,
    // since every INIT round adds 2 players to EACH pool in lockstep), fixing
    // l1's overflow re-inflates w1 past the cap again, and that re-inflation is
    // never re-checked. w1 grows unbounded from that point on (12 -> 16 -> 20...).
    // Reproduced directly: with 50 players, w1 hits 24 by round 7 while l1 stays
    // frozen at 8. This test is expected to fail until balancePools is rewritten
    // as a loop (`while (w1.length > MAX_POOL_SIZE || l1.length > MAX_POOL_SIZE)`).
    const players = namedPlayers('P', 40);
    let state = freshPaddleState();

    for (let i = 0; i < 60; i++) {
      const match = buildNextMatch(state, players);
      const allFour = [...match.teamA, ...match.teamB].filter(p => p !== '');
      if (allFour.length < 4) break;
      const res = advancePaddleState(state, match.teamA, match.teamB, players);
      state = res.nextState;
      expect(state.w1.length).toBeLessThanOrEqual(8);
      expect(state.l1.length).toBeLessThanOrEqual(8);
    }
  });

  it('40 players, 60 rounds: no player is ever selected onto both teams of the same match', () => {
    const players = namedPlayers('P', 40);
    let state = freshPaddleState();

    for (let i = 0; i < 60; i++) {
      const match = buildNextMatch(state, players);
      const allFour = [...match.teamA, ...match.teamB].filter(p => p !== '');
      if (allFour.length < 4) break;
      expect(new Set(allFour).size).toBe(4); // no duplicate player in one match
      const res = advancePaddleState(state, match.teamA, match.teamB, players);
      state = res.nextState;
    }
  });

  it('40 players, 80 rounds: every player gets matched at least once (no one stuck forever in overflow)', () => {
    const { seenAcrossSession, players } = playFullSession(40, 80);
    const neverPlayed = players.filter(p => !seenAcrossSession.has(p));
    expect(neverPlayed).toEqual([]);
  });

  it('50 players, 100 rounds: engine completes without throwing and without pool overflow — FIXED', () => {
    // Same root cause as the test above — included at a larger scale (50
    // players / 5 courts' worth) to confirm the overflow is not a one-off at
    // 40 players but a systemic issue that gets worse with more players.
    const players = namedPlayers('P', 50);
    let state = freshPaddleState();

    expect(() => {
      for (let i = 0; i < 100; i++) {
        const match = buildNextMatch(state, players);
        const allFour = [...match.teamA, ...match.teamB].filter(p => p !== '');
        if (allFour.length < 4) break;
        const res = advancePaddleState(state, match.teamA, match.teamB, players);
        state = res.nextState;
        if (state.w1.length > 8 || state.l1.length > 8) {
          throw new Error(`Pool overflow at round ${i}: w1=${state.w1.length}, l1=${state.l1.length}`);
        }
      }
    }).not.toThrow();
  });
});

describe('Club-night scenario — realistic mixed timing (some courts finish faster than others)', () => {
  it('handles staggered court completions (courts do not all finish at the same instant) without state corruption', () => {
    const total = 36;
    const { players, brackets } = buildRealisticBrackets(total);
    let state = initSkilledState(players, brackets, courts(3));

    // Simulate court 1 finishing twice before court 2 or 3 finish even once
    // (realistic — fast players, faster games on one court).
    for (let i = 0; i < 2; i++) {
      const c1 = state.courts.find(c => c.id === 'c1')!;
      if (c1.players.length === 4) {
        state = rotatePlayers(c1.players, state, brackets);
        state = reassignCourt('c1', state, brackets);
      }
    }
    // Now courts 2 and 3 finish once each.
    for (const id of ['c2', 'c3']) {
      const c = state.courts.find(cc => cc.id === id)!;
      if (c.players.length === 4) {
        state = rotatePlayers(c.players, state, brackets);
        state = reassignCourt(id, state, brackets);
      }
    }
    state = fillIdleCourts(state);

    const onCourt = state.courts.flatMap(c => c.players);
    const waiting = state.waitingQueue;
    const resting = state.restPool.map(e => e.name);
    const everyone = new Set([...onCourt, ...waiting, ...resting]);

    expect(new Set(onCourt).size).toBe(onCourt.length); // no double-booking
    expect(everyone.size).toBe(total); // no one lost
  });
});

describe('Club-night scenario — Starvation threshold scales with court count', () => {
  it('2-court session gets threshold=2, 3-court gets 3, 5-court gets 5 (max(2, courtCount))', () => {
    const players = Array.from({ length: 24 }, (_, i) => `P${i + 1}`);
    const brackets = { beginner: players, intermediate: [] as string[], advanced: [] as string[] };

    const state2 = initSkilledState(players, brackets, courts(2));
    const state3 = initSkilledState(players, brackets, courts(3));
    const state5 = initSkilledState(players, brackets, courts(5));

    expect(state2.starvationThreshold).toBe(2);
    expect(state3.starvationThreshold).toBe(3);
    expect(state5.starvationThreshold).toBe(5);
  });

  it('2 courts, 24 players, heavy-beginner skew: advanced players still get matched within threshold cycles', () => {
    // With only 2 courts, threshold=2 means the override fires after just
    // 2 consecutive skips. Advanced players should get on court faster
    // here than they would on a 3+ court session with threshold=3.
    const beginner     = Array.from({ length: 18 }, (_, i) => `B${i + 1}`);
    const intermediate = Array.from({ length: 4 },  (_, i) => `I${i + 1}`);
    const advanced     = ['A1', 'A2'];
    const players      = [...beginner, ...intermediate, ...advanced];
    const brackets     = { beginner, intermediate, advanced };

    let state = initSkilledState(players, brackets, courts(2));
    expect(state.starvationThreshold).toBe(2);

    const advancedPlayed = new Set<string>(
      state.courts.flatMap(c => c.players).filter(p => advanced.includes(p))
    );

    for (let i = 0; i < 15; i++) {
      for (const court of state.courts) {
        if (court.players.length === 0) continue;
        state = rotatePlayers(court.players, state, brackets);
        state = reassignCourt(court.id, state, brackets);
      }
      state = fillIdleCourts(state);
      state.courts.flatMap(c => c.players)
        .filter(p => advanced.includes(p))
        .forEach(p => advancedPlayed.add(p));
    }

    expect(advancedPlayed.size).toBe(advanced.length);
  });

  it('threshold is preserved unchanged through rotatePlayers and reassignCourt (not reset to default)', () => {
    // Defensive: verify that spreading state through rotatePlayers/reassignCourt
    // doesn't accidentally reset starvationThreshold to 0 or undefined.
    const players  = Array.from({ length: 12 }, (_, i) => `P${i + 1}`);
    const brackets = { beginner: players, intermediate: [] as string[], advanced: [] as string[] };
    let state = initSkilledState(players, brackets, courts(4));
    expect(state.starvationThreshold).toBe(4);

    const finished = state.courts[0].players;
    state = rotatePlayers(finished, state, brackets);
    state = reassignCourt('c1', state, brackets);

    expect(state.starvationThreshold).toBe(4); // must survive the spread
  });
});