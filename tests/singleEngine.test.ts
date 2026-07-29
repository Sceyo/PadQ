import { describe, it, expect } from 'vitest';
import {
  freshSinglesState,
  buildSinglesMatch,
  advanceSinglesState,
  addPlayerToSinglesWaiting,
  serializeSinglesState,
  deserializeSinglesState,
  SINGLES_MAX_WIN_STREAK,
  type SinglesState,
} from '@/app/queue/lib/singleEngine';

const P = (n: number) => Array.from({ length: n }, (_, i) => `P${i + 1}`);

describe('singleEngine — freshSinglesState', () => {
  it('initializes with no king and the full player list as queue', () => {
    const players = P(5);
    const s = freshSinglesState(players);
    expect(s.king).toBeNull();
    expect(s.queue).toEqual(players);
    expect(s.matchIndex).toBe(0);
    expect(s.playedThisCycle.size).toBe(0);
  });

  it('does not mutate the input players array (defensive copy)', () => {
    const players = P(3);
    const s = freshSinglesState(players);
    s.queue.push('Intruder');
    expect(players).toEqual(P(3)); // original untouched
  });
});

describe('singleEngine — buildSinglesMatch (no king / init state)', () => {
  it('pits the first two players in queue against each other, not forced', () => {
    const s = freshSinglesState(P(4));
    const match = buildSinglesMatch(s);
    expect(match.playerA).toBe('P1');
    expect(match.playerB).toBe('P2');
    expect(match.isForced).toBe(false);
  });

  it('with fewer than 2 players in queue, returns empty-string placeholders rather than throwing', () => {
    const s = freshSinglesState(['P1']);
    expect(() => buildSinglesMatch(s)).not.toThrow();
    const match = buildSinglesMatch(s);
    expect(match.playerB).toBe('');
  });
});

describe('singleEngine — king mechanics', () => {
  it('after P1 beats P2 in the init match, P1 becomes king with streak 1', () => {
    const s = freshSinglesState(P(4));
    const { nextState } = advanceSinglesState(s, 'P1', P(4));
    expect(nextState.king).toBe('P1');
    expect(nextState.winStreak['P1']).toBe(1);
  });

  it('the loser of the init match goes to the back of the queue', () => {
    const s = freshSinglesState(P(4));
    const { nextState } = advanceSinglesState(s, 'P1', P(4));
    expect(nextState.queue[nextState.queue.length - 1]).toBe('P2');
  });

  it('king keeps winning -> streak increments each time, loser goes to back', () => {
    let s = freshSinglesState(P(4));
    ({ nextState: s } = advanceSinglesState(s, 'P1', P(4))); // P1 king, streak 1
    const match2 = buildSinglesMatch(s);
    expect(match2.playerA).toBe('P1'); // king defends
    ({ nextState: s } = advanceSinglesState(s, 'P1', P(4))); // P1 wins again
    expect(s.winStreak['P1']).toBe(2);
  });

  it('if the challenger beats the king, the challenger becomes the new king with streak reset to 1', () => {
    let s = freshSinglesState(P(4));
    ({ nextState: s } = advanceSinglesState(s, 'P1', P(4))); // P1 king
    const match2 = buildSinglesMatch(s);
    const challenger = match2.playerB;
    ({ nextState: s } = advanceSinglesState(s, challenger, P(4))); // challenger wins
    expect(s.king).toBe(challenger);
    expect(s.winStreak[challenger]).toBe(1);
  });

  it('the old king (when dethroned) goes to the back of the queue, not the front', () => {
    let s = freshSinglesState(P(4));
    ({ nextState: s } = advanceSinglesState(s, 'P1', P(4))); // P1 king
    const match2 = buildSinglesMatch(s);
    const challenger = match2.playerB;
    ({ nextState: s } = advanceSinglesState(s, challenger, P(4)));
    expect(s.queue[s.queue.length - 1]).toBe('P1');
  });

  it('dethroned king winStreak resets to 0', () => {
    let s = freshSinglesState(P(4));
    ({ nextState: s } = advanceSinglesState(s, 'P1', P(4)));
    const match2 = buildSinglesMatch(s);
    const challenger = match2.playerB;
    ({ nextState: s } = advanceSinglesState(s, challenger, P(4)));
    expect(s.winStreak['P1']).toBe(0);
  });
});

describe('singleEngine — forced rotation at SINGLES_MAX_WIN_STREAK', () => {
  it('SINGLES_MAX_WIN_STREAK is exported as 3 (documented constant)', () => {
    expect(SINGLES_MAX_WIN_STREAK).toBe(3);
  });

  it('king is forced to step down after exactly 3 consecutive wins', () => {
    let s = freshSinglesState(P(6));
    // Win 1: init match, P1 becomes king (streak 1)
    ({ nextState: s } = advanceSinglesState(s, 'P1', P(6)));
    expect(s.winStreak['P1']).toBe(1);

    // Win 2: king defends successfully
    let match = buildSinglesMatch(s);
    expect(match.isForced).toBe(false);
    ({ nextState: s } = advanceSinglesState(s, 'P1', P(6)));
    expect(s.winStreak['P1']).toBe(2);

    // Win 3: king defends again, reaching the cap
    match = buildSinglesMatch(s);
    expect(match.isForced).toBe(false);
    ({ nextState: s } = advanceSinglesState(s, 'P1', P(6)));
    expect(s.winStreak['P1']).toBe(3);

    // Next match must now be forced (streak == MAX)
    match = buildSinglesMatch(s);
    expect(match.isForced).toBe(true);
  });

  it('a forced-rotation match pits the front two queue players against each other, not the king', () => {
    let s = freshSinglesState(P(6));
    for (let i = 0; i < 3; i++) {
      ({ nextState: s } = advanceSinglesState(s, 'P1', P(6)));
    }
    const match = buildSinglesMatch(s);
    expect(match.playerA).not.toBe('P1');
    expect(match.playerB).not.toBe('P1');
  });

  it('after the forced match resolves, the old (streak-capped) king is sent to the queue with streak reset to 0', () => {
    let s = freshSinglesState(P(6));
    for (let i = 0; i < 3; i++) {
      ({ nextState: s } = advanceSinglesState(s, 'P1', P(6)));
    }
    const forcedMatch = buildSinglesMatch(s);
    ({ nextState: s } = advanceSinglesState(s, forcedMatch.playerA, P(6)));
    expect(s.winStreak['P1']).toBe(0);
    expect(s.queue).toContain('P1');
    expect(s.king).not.toBe('P1'); // P1 dethroned
  });

  it('the new king after forced rotation is the winner of the forced match, with streak 1', () => {
    let s = freshSinglesState(P(6));
    for (let i = 0; i < 3; i++) {
      ({ nextState: s } = advanceSinglesState(s, 'P1', P(6)));
    }
    const forcedMatch = buildSinglesMatch(s);
    ({ nextState: s } = advanceSinglesState(s, forcedMatch.playerA, P(6)));
    expect(s.king).toBe(forcedMatch.playerA);
    expect(s.winStreak[forcedMatch.playerA]).toBe(1);
  });
});

describe('singleEngine — challenger selection (fatigue avoidance)', () => {
  it('does not immediately re-select the player who just played in the previous match index, if an alternative exists', () => {
    // P1 king, P2 just challenged and lost (now at back of queue at index lastMatchIdx).
    // The very next challenger pick should skip P2 if anyone else is available un-fatigued.
    let s = freshSinglesState(P(5));
    ({ nextState: s } = advanceSinglesState(s, 'P1', P(5))); // P1 king beats P2
    const match2 = buildSinglesMatch(s);
    // match2.playerB should not be P2, since P2 just played at matchIndex 0 (lastMatchIdx = 0)
    // and matchIndex is now 1, so lastMatchIdx for selection = 1 - 1 = 0, P2's lastPlayed = 0 -> fatigued, skip.
    expect(match2.playerB).not.toBe('P2');
  });

  it('falls back to the front of the queue if every candidate is "fatigued" (small player pool)', () => {
    // With only 2 players total, fatigue avoidance cannot find an alternative —
    // selectChallenger must fall back rather than returning an empty challenger.
    let s = freshSinglesState(P(2));
    const match1 = buildSinglesMatch(s);
    expect(match1.playerA).toBe('P1');
    expect(match1.playerB).toBe('P2');
    ({ nextState: s } = advanceSinglesState(s, 'P1', P(2)));
    // Only P2 exists as a possible challenger; must still be selected despite "fatigue".
    const match2 = buildSinglesMatch(s);
    expect(match2.playerB).toBe('P2');
  });
});

describe('singleEngine — playedThisCycle reset', () => {
  it('resets playedThisCycle to empty once every player has played at least once', () => {
    let s = freshSinglesState(P(3)); // small pool cycles fast
    let cycledEmpty = false;
    for (let i = 0; i < 10; i++) {
      const match = buildSinglesMatch(s);
      const winner = match.playerA || match.playerB;
      ({ nextState: s } = advanceSinglesState(s, winner, P(3)));
      if (s.playedThisCycle.size === 0) {
        cycledEmpty = true;
        break;
      }
    }
    expect(cycledEmpty).toBe(true);
  });
});

describe('singleEngine — addPlayerToSinglesWaiting', () => {
  it('adds a new player to waitingQueue', () => {
    const s = freshSinglesState(P(2));
    const next = addPlayerToSinglesWaiting(s, 'NewPlayer');
    expect(next.waitingQueue).toContain('NewPlayer');
  });

  it('is a no-op if player is already in queue', () => {
    const s = freshSinglesState(P(2));
    const next = addPlayerToSinglesWaiting(s, 'P1');
    expect(next.waitingQueue).toEqual([]);
  });

  it('is a no-op if player is already king', () => {
    const s: SinglesState = { ...freshSinglesState(P(2)), king: 'P1' };
    const next = addPlayerToSinglesWaiting(s, 'P1');
    expect(next.waitingQueue).toEqual([]);
  });

  it('is a no-op if player is already in waitingQueue (no duplicates)', () => {
    let s = addPlayerToSinglesWaiting(freshSinglesState(P(2)), 'Dup');
    s = addPlayerToSinglesWaiting(s, 'Dup');
    expect(s.waitingQueue).toEqual(['Dup']);
  });
});

describe('singleEngine — newQueue output shape', () => {
  it('newQueue puts the king first when a king exists', () => {
    const s = freshSinglesState(P(4));
    const { newQueue } = advanceSinglesState(s, 'P1', P(4));
    expect(newQueue[0]).toBe('P1');
  });

  it('newQueue has no king prefix on the very first (init) advance if king ends up null (defensive — should not happen, but verifying contract)', () => {
    // This test documents existing behavior: after the init match, king is always
    // set to the winner, so newQueue[0] should always be a real name post-init.
    const s = freshSinglesState(P(4));
    const { newQueue } = advanceSinglesState(s, 'P2', P(4));
    expect(newQueue[0]).toBe('P2');
  });
});

describe('singleEngine — serialize / deserialize round trip', () => {
  it('round-trips playedThisCycle through array form without data loss', () => {
    const s: SinglesState = { ...freshSinglesState(P(3)), playedThisCycle: new Set(['P1', 'P2']) };
    const serialized = serializeSinglesState(s);
    expect(Array.isArray(serialized.playedThisCycle)).toBe(true);
    const deserialized = deserializeSinglesState(serialized);
    expect(deserialized.playedThisCycle).toEqual(new Set(['P1', 'P2']));
  });

  it('JSON.stringify on the serialized form never throws', () => {
    const s: SinglesState = { ...freshSinglesState(P(3)), playedThisCycle: new Set(['P1']) };
    const serialized = serializeSinglesState(s);
    expect(() => JSON.stringify(serialized)).not.toThrow();
  });
});

describe('singleEngine — edge cases / nitpicks', () => {
  it('does not throw with an empty players array', () => {
    const s = freshSinglesState([]);
    expect(() => buildSinglesMatch(s)).not.toThrow();
  });

  it('a single-player pool produces a match with an empty playerB and does not throw on advance', () => {
    const s = freshSinglesState(['Solo']);
    const match = buildSinglesMatch(s);
    expect(match.playerA).toBe('Solo');
    expect(match.playerB).toBe('');
    // Calling advance with the "winner" being the only real player — verifying no throw.
    expect(() => advanceSinglesState(s, 'Solo', ['Solo'])).not.toThrow();
  });

  it('duplicate names in the player list do not crash buildSinglesMatch or advanceSinglesState', () => {
    const players = ['A', 'A', 'B'];
    const s = freshSinglesState(players);
    expect(() => {
      const match = buildSinglesMatch(s);
      advanceSinglesState(s, match.playerA, players);
    }).not.toThrow();
  });
});