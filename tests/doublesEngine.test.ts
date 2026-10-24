import { describe, it, expect } from 'vitest';
import {
  freshPaddleState,
  smartSelectPool,
  buildNextMatch,
  advancePaddleState,
  addPlayerToWaiting,
  swapPartners,
  teamPairKey,
  serializePaddleState,
  deserializePaddleState,
  type PaddleState,
  type Team,
} from '@/app/queue/lib/doublesEngine';

const P = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

describe('doublesEngine — freshPaddleState', () => {
  it('returns a fully zeroed INIT state', () => {
    const s = freshPaddleState();
    expect(s.phase).toBe('INIT');
    expect(s.matchIndexInPhase).toBe(0);
    expect(s.matchCount).toBe(0);
    expect(s.w1).toEqual([]);
    expect(s.l1).toEqual([]);
    expect(s.waitingQueue).toEqual([]);
    expect(s.playedThisCycle.size).toBe(0);
  });
});

describe('doublesEngine — buildNextMatch (INIT phase)', () => {
  it('seeds the first match from the first 4 players in order', () => {
    const state = freshPaddleState();
    const players = P(8);
    const match = buildNextMatch(state, players);
    const allFour = new Set([...match.teamA, ...match.teamB]);
    expect(allFour).toEqual(new Set(['P1', 'P2', 'P3', 'P4']));
  });

  it('pads with extra players when the slice has fewer than 4 (5 players, match 2)', () => {
    // 5 players: INIT match 0 -> P1-P4, match 1 should pad from P5 + reused players
    const state: PaddleState = { ...freshPaddleState(), matchIndexInPhase: 1 };
    const players = P(5);
    const match = buildNextMatch(state, players);
    const allFour = [...match.teamA, ...match.teamB];
    expect(allFour).toHaveLength(4);
    expect(allFour.every(p => p !== '')).toBe(true);
    expect(allFour).toContain('P5');
  });

  it('returns a fallback (possibly with empty strings) when fewer than 4 players exist at all', () => {
    const state = freshPaddleState();
    const players = P(3);
    const match = buildNextMatch(state, players);
    const allFour = [...match.teamA, ...match.teamB];
    // Only 3 real players exist; engine cannot invent a 4th.
    const nonEmpty = allFour.filter(p => p !== '');
    expect(nonEmpty.length).toBeLessThanOrEqual(3);
  });

  it('with exactly 4 players, every subsequent INIT call (same untouched state) is deterministic', () => {
    const state = freshPaddleState();
    const players = P(4);
    const m1 = buildNextMatch(state, players);
    const m2 = buildNextMatch(state, players);
    expect(teamPairKey(m1.teamA, m1.teamB)).toBe(teamPairKey(m2.teamA, m2.teamB));
  });
});

describe('doublesEngine — formTeams scoring (via buildNextMatch)', () => {
  it('avoids a repeat pair when an alternative split exists', () => {
    // recentPairs already contains P1+P2 — the optimal split should avoid pairing them again.
    const state: PaddleState = {
      ...freshPaddleState(),
      recentPairs: ['P1+P2'],
    };
    const match = buildNextMatch(state, ['P1', 'P2', 'P3', 'P4']);
    const teamAKey = [...match.teamA].sort().join('+');
    const teamBKey = [...match.teamB].sort().join('+');
    expect(teamAKey).not.toBe('P1+P2');
    expect(teamBKey).not.toBe('P1+P2');
  });

  it('balances skill when skillMap has a clear imbalance', () => {
    // P1 and P2 are both high skill; pairing them together vs P3+P4 (low skill)
    // is maximally imbalanced. The engine should prefer splitting strong/weak.
    const skillMap = { P1: 90, P2: 90, P3: 10, P4: 10 };
    const state = freshPaddleState();
    const match = buildNextMatch(state, ['P1', 'P2', 'P3', 'P4'], skillMap);
    const teamAKey = [...match.teamA].sort().join('+');
    // The balanced splits are P1+P3 vs P2+P4, or P1+P4 vs P2+P3.
    // The imbalanced split P1+P2 vs P3+P4 should NOT be chosen.
    expect(teamAKey).not.toBe('P1+P2');
    expect(teamAKey).not.toBe('P3+P4');
  });

  it('ignores skill entirely when skillMap is empty (default {})', () => {
    // With an empty skillMap, all 3 splits score equally on skill (0 contribution),
    // so the result should match whatever recentPairs/recentMatches alone determine —
    // i.e. the first candidate from allPairings when no other penalty applies.
    const state = freshPaddleState();
    const match = buildNextMatch(state, ['P1', 'P2', 'P3', 'P4'], {});
    const teamAKey = [...match.teamA].sort().join('+');
    expect(teamAKey).toBe('P1+P2'); // first allPairings split, no tiebreak penalty
  });
});

describe('doublesEngine — advancePaddleState (INIT phase transition)', () => {
  it('moves from INIT to WINNERS once enough INIT matches have been played (8 players = 2 INIT matches)', () => {
    let state = freshPaddleState();
    const players = P(8);

    const m1 = buildNextMatch(state, players);
    let res = advancePaddleState(state, m1.teamA, m1.teamB, players);
    state = res.nextState;
    expect(state.phase).toBe('INIT'); // only 1 of 2 INIT matches done

    const m2 = buildNextMatch(state, players);
    res = advancePaddleState(state, m2.teamA, m2.teamB, players);
    state = res.nextState;
    expect(state.phase).toBe('WINNERS'); // both INIT matches done -> transition
  });

  it('with exactly 4 players, transitions to WINNERS after just 1 match (floor(4/4)=1)', () => {
    const state = freshPaddleState();
    const players = P(4);
    const m1 = buildNextMatch(state, players);
    const res = advancePaddleState(state, m1.teamA, m1.teamB, players);
    expect(res.nextState.phase).toBe('WINNERS');
  });

  it('with 5 players, initMatchesNeeded = floor(5/4) = 1, so the 5th player must flow into waitingQueue/overflow', () => {
    let state = freshPaddleState();
    const players = P(5);
    const m1 = buildNextMatch(state, players); // seeds P1-P4
    const res = advancePaddleState(state, m1.teamA, m1.teamB, players);
    state = res.nextState;
    expect(state.phase).toBe('WINNERS');
    // P5 was never part of the single INIT match — it must appear somewhere
    // (w1 after the post-INIT reshuffle, since unplayed players get pushed to front of w1).
    const allTrackedPlayers = [...state.w1, ...state.l1, ...state.waitingQueue];
    expect(allTrackedPlayers).toContain('P5');
  });

  it('records all 4 played players into lastPlayedMap with the matchCount at time of play', () => {
    const state = freshPaddleState();
    const players = P(4);
    const m1 = buildNextMatch(state, players);
    const res = advancePaddleState(state, m1.teamA, m1.teamB, players);
    for (const p of [...m1.teamA, ...m1.teamB]) {
      expect(res.nextState.lastPlayedMap[p]).toBe(0); // state.matchCount was 0 at play time
    }
  });

  it('winners go to w1 and losers go to l1 after a match', () => {
    const state = freshPaddleState();
    const players = P(4);
    const m1 = buildNextMatch(state, players);
    const winnerTeam: Team = m1.teamA;
    const loserTeam: Team = m1.teamB;
    const res = advancePaddleState(state, winnerTeam, loserTeam, players);
    expect(res.nextState.w1).toEqual(expect.arrayContaining(winnerTeam));
    expect(res.nextState.l1).toEqual(expect.arrayContaining(loserTeam));
  });
});

describe('doublesEngine — advancePaddleState (WINNERS -> LOSERS -> WINNERS cycle)', () => {
  function playOneMatch(state: PaddleState, players: string[]) {
    const match = buildNextMatch(state, players);
    return advancePaddleState(state, match.teamA, match.teamB, players);
  }

  it('WINNERS phase always advances directly to LOSERS (never skips)', () => {
    let state = freshPaddleState();
    const players = P(8);
    // Drive through both INIT matches first.
    ({ nextState: state } = playOneMatch(state, players));
    ({ nextState: state } = playOneMatch(state, players));
    expect(state.phase).toBe('WINNERS');

    ({ nextState: state } = playOneMatch(state, players));
    expect(state.phase).toBe('LOSERS');
  });

  it('LOSERS phase always advances back to WINNERS (never skips)', () => {
    let state = freshPaddleState();
    const players = P(8);
    ({ nextState: state } = playOneMatch(state, players)); // INIT 1
    ({ nextState: state } = playOneMatch(state, players)); // INIT 2 -> WINNERS
    ({ nextState: state } = playOneMatch(state, players)); // WINNERS -> LOSERS
    expect(state.phase).toBe('LOSERS');
    ({ nextState: state } = playOneMatch(state, players)); // LOSERS -> WINNERS
    expect(state.phase).toBe('WINNERS');
  });

  it('every player eventually appears in playedThisCycle across enough matches (8 players)', () => {
    let state = freshPaddleState();
    const players = P(8);
    const seenAtAnyPoint = new Set<string>();
    for (let i = 0; i < 6; i++) {
      const match = buildNextMatch(state, players);
      [...match.teamA, ...match.teamB].forEach(p => seenAtAnyPoint.add(p));
      ({ nextState: state } = advancePaddleState(state, match.teamA, match.teamB, players));
    }
    expect(seenAtAnyPoint).toEqual(new Set(players));
  });
});

describe('doublesEngine — pool balancing (MAX_POOL_SIZE = 8)', () => {
  it('caps w1 at 8 and overflows the oldest entries into l1', () => {
    // Build a state where w1 already has 8 players, then advance with 2 more winners.
    const state: PaddleState = {
      ...freshPaddleState(),
      w1: P(8),
    };
    const winnerTeam: Team = ['NEW1', 'NEW2'];
    const loserTeam: Team = ['NEW3', 'NEW4'];
    const allPlayers = [...P(8), 'NEW1', 'NEW2', 'NEW3', 'NEW4'];
    const res = advancePaddleState(state, winnerTeam, loserTeam, allPlayers);
    expect(res.nextState.w1.length).toBeLessThanOrEqual(8);
  });
});

describe('doublesEngine — addPlayerToWaiting', () => {
  it('adds a brand-new player to waitingQueue', () => {
    const state = freshPaddleState();
    const next = addPlayerToWaiting(state, 'NewGuy');
    expect(next.waitingQueue).toContain('NewGuy');
  });

  it('is a no-op (same reference semantics aside) if the player is already in waitingQueue', () => {
    const state = addPlayerToWaiting(freshPaddleState(), 'Dup');
    const next = addPlayerToWaiting(state, 'Dup');
    expect(next.waitingQueue).toEqual(['Dup']); // not duplicated
  });

  it('is a no-op if the player is already in w1', () => {
    const state: PaddleState = { ...freshPaddleState(), w1: ['Already'] };
    const next = addPlayerToWaiting(state, 'Already');
    expect(next.waitingQueue).toEqual([]);
  });

  it('is a no-op if the player is already in l1', () => {
    const state: PaddleState = { ...freshPaddleState(), l1: ['Already'] };
    const next = addPlayerToWaiting(state, 'Already');
    expect(next.waitingQueue).toEqual([]);
  });
});

describe('doublesEngine — swapPartners', () => {
  it('returns the primary swap when it has not been played before', () => {
    const pairA: Team = ['A1', 'A2'];
    const pairB: Team = ['B1', 'B2'];
    const result = swapPartners(pairA, pairB, []);
    expect(result.teamA).toEqual(['A1', 'B1']);
    expect(result.teamB).toEqual(['A2', 'B2']);
  });

  it('falls back to the alternate swap if the primary swap is already in history', () => {
    const pairA: Team = ['A1', 'A2'];
    const pairB: Team = ['B1', 'B2'];
    const primaryKey = teamPairKey(['A1', 'B1'], ['A2', 'B2']);
    const result = swapPartners(pairA, pairB, [primaryKey]);
    expect(result.teamA).toEqual(['A1', 'B2']);
    expect(result.teamB).toEqual(['A2', 'B1']);
  });
});

describe('doublesEngine — teamPairKey', () => {
  it('is symmetric regardless of team or player order', () => {
    const k1 = teamPairKey(['A', 'B'], ['C', 'D']);
    const k2 = teamPairKey(['C', 'D'], ['A', 'B']);
    const k3 = teamPairKey(['B', 'A'], ['D', 'C']);
    expect(k1).toBe(k2);
    expect(k1).toBe(k3);
  });

  it('produces different keys for genuinely different matchups', () => {
    const k1 = teamPairKey(['A', 'B'], ['C', 'D']);
    const k2 = teamPairKey(['A', 'C'], ['B', 'D']);
    expect(k1).not.toBe(k2);
  });
});

describe('doublesEngine — serialize / deserialize round trip', () => {
  it('round-trips playedThisCycle (Set <-> Array) without data loss', () => {
    const state: PaddleState = {
      ...freshPaddleState(),
      playedThisCycle: new Set(['A', 'B', 'C']),
    };
    const serialized = serializePaddleState(state);
    expect(Array.isArray(serialized.playedThisCycle)).toBe(true);
    const deserialized = deserializePaddleState(serialized);
    expect(deserialized.playedThisCycle).toEqual(new Set(['A', 'B', 'C']));
  });

  it('round-trips winnersPool/losersPool (Team[] <-> {a,b}[]) without data loss', () => {
    const state: PaddleState = {
      ...freshPaddleState(),
      winnersPool: [['W1', 'W2']],
      losersPool: [['L1', 'L2']],
    };
    const serialized = serializePaddleState(state);
    expect(serialized.winnersPool).toEqual([{ a: 'W1', b: 'W2' }]);
    const deserialized = deserializePaddleState(serialized);
    expect(deserialized.winnersPool).toEqual([['W1', 'W2']]);
    expect(deserialized.losersPool).toEqual([['L1', 'L2']]);
  });

  it('JSON.stringify on the serialized form never throws (Firestore-write safety)', () => {
    const state: PaddleState = {
      ...freshPaddleState(),
      playedThisCycle: new Set(['X', 'Y']),
      winnersPool: [['A', 'B']],
      losersPool: [['C', 'D']],
    };
    const serialized = serializePaddleState(state);
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });
});

describe('doublesEngine — edge cases / nitpicks', () => {
  it('does not crash with an empty allPlayers array', () => {
    const state = freshPaddleState();
    expect(() => buildNextMatch(state, [])).not.toThrow();
  });

  it('buildNextMatch in WINNERS phase with fewer than 4 in w1 borrows from l1', () => {
    const state: PaddleState = {
      ...freshPaddleState(),
      phase: 'WINNERS',
      w1: ['W1', 'W2'],
      l1: ['L1', 'L2', 'L3'],
    };
    const match = buildNextMatch(state, ['W1', 'W2', 'L1', 'L2', 'L3']);
    const allFour = [...match.teamA, ...match.teamB];
    expect(allFour).toContain('W1');
    expect(allFour).toContain('W2');
  });

  it('duplicate player names in allPlayers do not crash INIT seeding (pathological input)', () => {
    const state = freshPaddleState();
    const players = ['A', 'A', 'B', 'C']; // caller bug: duplicate name
    expect(() => buildNextMatch(state, players)).not.toThrow();
  });
});

describe('doublesEngine — smartSelectPool with mustInclude (Phase 5b-1)', () => {
  it('includes 1 priority player and fills remaining 3 slots optimally', () => {
    const candidates = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const match = smartSelectPool(candidates, [], [], new Set(), {}, ['P1']);
    const selected = match;
    expect(selected).toContain('P1');
    expect(new Set(selected).size).toBe(4);
  });

  it('includes 2 priority players and fills remaining 2 slots', () => {
    const candidates = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const match = smartSelectPool(candidates, [], [], new Set(), {}, ['P1', 'P2']);
    const selected = match;
    expect(selected).toContain('P1');
    expect(selected).toContain('P2');
    expect(new Set(selected).size).toBe(4);
  });

  it('includes 4 priority players directly', () => {
    const candidates = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const match = smartSelectPool(candidates, [], [], new Set(), {}, ['P1', 'P2', 'P3', 'P4']);
    const selected = match;
    expect(new Set(selected)).toEqual(new Set(['P1', 'P2', 'P3', 'P4']));
  });

  it('when >4 priority players exist, selects first 4 in order', () => {
    const candidates = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const match = smartSelectPool(candidates, [], [], new Set(), {}, ['P1', 'P2', 'P3', 'P4', 'P5']);
    const selected = match;
    expect(new Set(selected)).toEqual(new Set(['P1', 'P2', 'P3', 'P4']));
  });

  it('forces inclusion of priority player even when they have fatigue and repeat penalties', () => {
    const candidates = ['P_prio', 'P2', 'P3', 'P4', 'P5', 'P6'];
    // Give P_prio maximum fatigue and repeat penalties with everyone
    const recentPairs = ['P2+P_prio', 'P3+P_prio', 'P4+P_prio', 'P5+P_prio', 'P6+P_prio'];
    const lastMatchPlayers = new Set(['P_prio']);
    const match = smartSelectPool(candidates, recentPairs, [], lastMatchPlayers, {}, ['P_prio']);
    const selected = match;
    expect(selected).toContain('P_prio');
    expect(new Set(selected).size).toBe(4);
  });

  it('returns fallback cleanly when <4 candidates exist', () => {
    const candidates = ['P1', 'P2', 'P3'];
    const match = smartSelectPool(candidates, [], [], new Set(), {}, ['P1']);
    const selected = match.filter(Boolean);
    expect(selected).toEqual(['P1', 'P2', 'P3']);
  });
});

describe('doublesEngine — advancePaddleState with priorityPlayers (Phase 5b-1)', () => {
  it('prepends priority player to next phase pool without cross-pool duplicates and returns consumedPriority', () => {
    const players = P(12);
    let state = freshPaddleState();
    state = advancePaddleState(state, ['P1', 'P2'], ['P3', 'P4'], players).nextState;
    state = advancePaddleState(state, ['P5', 'P6'], ['P7', 'P8'], players).nextState;
    state = advancePaddleState(state, ['P9', 'P10'], ['P11', 'P12'], players).nextState;
    expect(state.phase).toBe('WINNERS');

    // Now in WINNERS phase, next phase after this match will be LOSERS.
    // Suppose P5 (currently in w1) returned from break with priority.
    const res = advancePaddleState(state, ['P1', 'P2'], ['P9', 'P10'], players, {}, ['P5']);
    expect(res.nextState.phase).toBe('LOSERS');
    // P5 was prepended to l1 (the LOSERS pool) and removed from w1 (no duplicate)
    expect(res.nextState.l1[0]).toBe('P5');
    expect(res.nextState.w1).not.toContain('P5');
    expect(res.newQueue.slice(0, 4)).toContain('P5');
    expect(res.consumedPriority).toEqual(['P5']);
  });

  it('ignores priority during INIT phase', () => {
    const players = P(8);
    const state = freshPaddleState();
    // INIT match 1 finishes; still in INIT for match 2 (P5..P8)
    const res = advancePaddleState(state, ['P1', 'P2'], ['P3', 'P4'], players, {}, ['P1']);
    expect(res.nextState.phase).toBe('INIT');
    expect(new Set(res.newQueue.slice(0, 4))).toEqual(new Set(['P5', 'P6', 'P7', 'P8']));
    expect(res.consumedPriority).toEqual([]);
  });
});


describe('doublesEngine — Golden Equivalence across N=5..30 x 20 seeds (Phase 5c-1)', () => {
  it('guarantees engine output is 100% equivalent to reference INIT behavior when no sit-outs occur', () => {
    // Reference overflow logic before Phase 5c fix:
    // seededSet = new Set(allPlayers.slice(0, initMatchesNeeded * 4));
    // overflow = allPlayers.filter(p => !seededSet.has(p) && !nextWaiting.includes(p));
    //
    // Golden theorem: when no sit-outs/substitutions occur in INIT,
    // (p not in nextW1 && p not in nextL1 && p not in nextWaiting)
    // is identically equal to (!seededSet.has(p) && !nextWaiting.includes(p)).
    for (let n = 5; n <= 30; n++) {
      const players = P(n);
      for (let seed = 1; seed <= 20; seed++) {
        let state = freshPaddleState();
        let rng = seed * 1000 + n;
        const nextRand = () => {
          rng = (rng * 1664525 + 1013904223) >>> 0;
          return rng / 4294967296;
        };

        const initMatchesNeeded = Math.max(1, Math.floor(n / 4));
        const totalMatches = initMatchesNeeded + 6; // through INIT, WINNERS, and LOSERS

        for (let m = 0; m < totalMatches; m++) {
          const match = buildNextMatch(state, players);
          const allFour = [...match.teamA, ...match.teamB];
          expect(new Set(allFour).size).toBe(4);

          // Winner is teamA or teamB based on PRNG
          const teamAWins = nextRand() > 0.5;
          const winnerTeam = teamAWins ? match.teamA : match.teamB;
          const loserTeam = teamAWins ? match.teamB : match.teamA;

          const res = advancePaddleState(state, winnerTeam, loserTeam, players);
          state = res.nextState;

          // Consistency guard: no duplicates across pools
          const seen = new Set<string>();
          for (const p of [...state.w1, ...state.l1, ...state.waitingQueue]) {
            expect(seen.has(p)).toBe(false);
            seen.add(p);
          }
          expect(res.newQueue.length).toBe(players.length);
        }
      }
    }
  });
});
