import { describe, it, expect } from 'vitest';
import {
  freshPoolSinglesState,
  buildNextPoolSinglesMatch,
  advancePoolSinglesState,
  smartSelectPair,
  balancePools,
  addPlayerToPoolSinglesWaiting,
  removePlayerFromPoolSinglesState,
  serializePoolSinglesState,
  deserializePoolSinglesState,
  matchKey,
  type PoolSinglesState,
} from '@/app/queue/lib/singlesPoolEngine';

const P = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

describe('singlesPoolEngine — freshPoolSinglesState', () => {
  it('initializes with format "pool", phase "INIT", and empty collections', () => {
    const s = freshPoolSinglesState();
    expect(s.format).toBe('pool');
    expect(s.phase).toBe('INIT');
    expect(s.matchIndexInPhase).toBe(0);
    expect(s.matchCount).toBe(0);
    expect(s.w1).toEqual([]);
    expect(s.l1).toEqual([]);
    expect(s.waitingQueue).toEqual([]);
    expect(s.playedThisCycle.size).toBe(0);
    expect(s.recentMatches).toEqual([]);
    expect(s.lastPlayedMap).toEqual({});
  });
});

describe('singlesPoolEngine — matchKey', () => {
  it('returns canonical sorted string key regardless of order', () => {
    expect(matchKey('Alice', 'Bob')).toBe('Alice|Bob');
    expect(matchKey('Bob', 'Alice')).toBe('Alice|Bob');
    expect(matchKey('P2', 'P1')).toBe('P1|P2');
  });
});

describe('singlesPoolEngine — smartSelectPair', () => {
  it('picks first two if candidates length <= 2', () => {
    expect(smartSelectPair(['P1', 'P2'], [], new Set())).toEqual(['P1', 'P2']);
    expect(smartSelectPair(['P1'], [], new Set())).toEqual(['P1', '']);
  });

  it('avoids recently played pairs in favor of unplayed pairs', () => {
    const candidates = ['P1', 'P2', 'P3'];
    const recentMatches = [matchKey('P1', 'P2')];
    const lastMatchPlayers = new Set<string>();

    const [a, b] = smartSelectPair(candidates, recentMatches, lastMatchPlayers);
    // P1|P2 has repeat penalty (+5), P1|P3 or P2|P3 has 0
    expect(matchKey(a, b)).not.toBe(matchKey('P1', 'P2'));
  });

  it('avoids fatigued players if an alternative is available', () => {
    const candidates = ['P1', 'P2', 'P3', 'P4'];
    const recentMatches: string[] = [];
    const lastMatchPlayers = new Set(['P1']); // P1 just played

    const [a, b] = smartSelectPair(candidates, recentMatches, lastMatchPlayers);
    // Pair without P1 (e.g. P2 vs P3 or P2 vs P4) will have lower penalty than pair with P1
    expect([a, b]).not.toContain('P1');
  });

  it('factors in skill differences when skillMap is provided', () => {
    const candidates = ['P1', 'P2', 'P3'];
    const skillMap = { P1: 80, P2: 20, P3: 75 };
    // Diff P1 & P3 = 5, Diff P1 & P2 = 60, Diff P2 & P3 = 55
    const [a, b] = smartSelectPair(candidates, [], new Set(), skillMap);
    const chosen = [a, b].sort();
    expect(chosen).toEqual(['P1', 'P3']);
  });
});

describe('singlesPoolEngine — balancePools', () => {
  it('leaves pools unchanged when both sizes <= 8', () => {
    const w1 = ['A', 'B', 'C'];
    const l1 = ['D', 'E'];
    const res = balancePools(w1, l1);
    expect(res.w1).toEqual(w1);
    expect(res.l1).toEqual(l1);
    expect(res.waiting).toEqual([]);
  });

  it('cascades overflow from w1 to l1 when l1 has room', () => {
    const w1 = ['W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9'];
    const l1 = ['L1'];
    const res = balancePools(w1, l1);
    expect(res.w1.length).toBe(8);
    expect(res.w1).toEqual(w1.slice(0, 8));
    expect(res.l1).toEqual(['L1', 'W9']);
    expect(res.waiting).toEqual([]);
  });

  it('cascades overflow from l1 to w1 when w1 has room', () => {
    const w1 = ['W1'];
    const l1 = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10'];
    const res = balancePools(w1, l1);
    expect(res.l1.length).toBe(8);
    expect(res.l1).toEqual(l1.slice(0, 8));
    expect(res.w1).toEqual(['W1', 'L9', 'L10']);
    expect(res.waiting).toEqual([]);
  });

  it('cascades overflow to waiting when both pools reach MAX_POOL_SIZE (8)', () => {
    const w1 = Array.from({ length: 10 }, (_, i) => `W${i + 1}`);
    const l1 = Array.from({ length: 9 }, (_, i) => `L${i + 1}`);
    const res = balancePools(w1, l1);
    expect(res.w1.length).toBe(8);
    expect(res.l1.length).toBe(8);
    // Overflow beyond 8 from w1 is [W9, W10], and from l1 is [L9]
    expect(res.waiting).toEqual(['W9', 'W10', 'L9']);
  });
});

describe('singlesPoolEngine — buildNextPoolSinglesMatch', () => {
  it('never produces a self-match (playerA !== playerB) in any phase', () => {
    const players = P(4);
    let state = freshPoolSinglesState();

    // INIT phase
    const matchInit = buildNextPoolSinglesMatch(state, players);
    expect(matchInit.playerA).not.toBe(matchInit.playerB);
    expect(players).toContain(matchInit.playerA);
    expect(players).toContain(matchInit.playerB);

    // WINNERS phase with w1
    state = { ...state, phase: 'WINNERS', w1: ['P1', 'P2'] };
    const matchWinners = buildNextPoolSinglesMatch(state, players);
    expect(matchWinners.playerA).not.toBe(matchWinners.playerB);

    // LOSERS phase with l1
    state = { ...state, phase: 'LOSERS', l1: ['P3', 'P4'] };
    const matchLosers = buildNextPoolSinglesMatch(state, players);
    expect(matchLosers.playerA).not.toBe(matchLosers.playerB);
  });
});

describe('singlesPoolEngine — session cycles simulation', () => {
  const runSession = (playerCount: number, rounds: number) => {
    const players = P(playerCount);
    let state = freshPoolSinglesState();
    const playCounts: Record<string, number> = Object.fromEntries(players.map(p => [p, 0]));

    for (let r = 0; r < rounds; r++) {
      const match = buildNextPoolSinglesMatch(state, players);
      expect(match.playerA).toBeTruthy();
      expect(match.playerB).toBeTruthy();
      expect(match.playerA).not.toBe(match.playerB);
      expect(players).toContain(match.playerA);
      expect(players).toContain(match.playerB);

      // Simulating a winner (alternate or deterministic)
      const winner = r % 2 === 0 ? match.playerA : match.playerB;
      const loser  = winner === match.playerA ? match.playerB : match.playerA;

      playCounts[winner]++;
      playCounts[loser]++;

      const { nextState, newQueue } = advancePoolSinglesState(state, winner, loser, players);
      expect(newQueue.length).toBe(players.length);
      expect(new Set(newQueue).size).toBe(players.length);

      state = nextState;
      expect(state.w1.length + state.l1.length + state.waitingQueue.length).toBeLessThanOrEqual(playerCount);
    }

    return { state, playCounts };
  };

  it('runs 2-player session across multiple cycles with no self-matches', () => {
    const { playCounts } = runSession(2, 6);
    expect(playCounts['P1']).toBe(6);
    expect(playCounts['P2']).toBe(6);
  });

  it('runs 3-player session across multiple cycles with starvation prevention', () => {
    const { playCounts } = runSession(3, 9);
    for (const p of P(3)) {
      expect(playCounts[p]).toBeGreaterThanOrEqual(4);
    }
  });

  it('runs 4-player session across at least 2 full cycles (INIT -> WINNERS -> LOSERS)', () => {
    const { playCounts, state } = runSession(4, 10);
    for (const p of P(4)) {
      expect(playCounts[p]).toBeGreaterThanOrEqual(3);
    }
    expect(state.matchCount).toBe(10);
  });

  it('runs 5-player session across multiple cycles fairly', () => {
    const { playCounts, state } = runSession(5, 15);
    for (const p of P(5)) {
      expect(playCounts[p]).toBeGreaterThanOrEqual(4);
    }
    expect(state.matchCount).toBe(15);
  });
});

describe('singlesPoolEngine — player add and remove', () => {
  it('adds player to waitingQueue only if not already in pools', () => {
    let s = freshPoolSinglesState();
    s.w1 = ['P1', 'P2'];
    s.l1 = ['P3'];

    // Adding existing P1 should be no-op
    s = addPlayerToPoolSinglesWaiting(s, 'P1');
    expect(s.waitingQueue).toEqual([]);

    // Adding new player P4
    s = addPlayerToPoolSinglesWaiting(s, 'P4');
    expect(s.waitingQueue).toEqual(['P4']);

    // Duplicate add should be no-op
    s = addPlayerToPoolSinglesWaiting(s, 'P4');
    expect(s.waitingQueue).toEqual(['P4']);
  });

  it('removes player cleanly across all pools, queues, and stats', () => {
    const s = freshPoolSinglesState();
    s.w1 = ['P1', 'P2'];
    s.winnersPool = ['P1', 'P2'];
    s.l1 = ['P3'];
    s.losersPool = ['P3'];
    s.waitingQueue = ['P4'];
    s.playedThisCycle = new Set(['P1', 'P3']);
    s.lastPlayedMap = { P1: 1, P3: 2 };

    const next = removePlayerFromPoolSinglesState(s, 'P1');
    expect(next.w1).toEqual(['P2']);
    expect(next.winnersPool).toEqual(['P2']);
    expect(next.playedThisCycle.has('P1')).toBe(false);
    expect(next.lastPlayedMap['P1']).toBeUndefined();
  });
});

describe('singlesPoolEngine — serialization and deserialization', () => {
  it('roundtrips pool singles state correctly', () => {
    const original: PoolSinglesState = {
      format: 'pool',
      phase: 'WINNERS',
      matchIndexInPhase: 1,
      matchCount: 4,
      w1: ['P1', 'P2'],
      l1: ['P3', 'P4'],
      waitingQueue: ['P5'],
      playedThisCycle: new Set(['P1', 'P3']),
      recentMatches: ['P1|P2', 'P3|P4'],
      lastPlayedMap: { P1: 3, P2: 3, P3: 4, P4: 4 },
      winnersPool: ['P1', 'P2'],
      losersPool: ['P3', 'P4'],
    };

    const serialized = serializePoolSinglesState(original);
    expect(Array.isArray(serialized.playedThisCycle)).toBe(true);

    const deserialized = deserializePoolSinglesState(serialized);
    expect(deserialized.format).toBe('pool');
    expect(deserialized.phase).toBe('WINNERS');
    expect(deserialized.playedThisCycle instanceof Set).toBe(true);
    expect(Array.from(deserialized.playedThisCycle)).toEqual(['P1', 'P3']);
    expect(deserialized.w1).toEqual(original.w1);
    expect(deserialized.recentMatches).toEqual(original.recentMatches);
  });
});
