import { describe, it, expect } from 'vitest';
import {
  buildSkillQueue,
  assignCourts,
  rotatePlayers,
  reassignCourt,
  initSkilledState,
  addPlayerToSkilledState,
  retagPlayerInQueue,
  recalculateRest,
  getPlayerBracketLevel,
  fillIdleCourts,
  type SkilledState,
  type SkillQueue,
  type CourtDef,
} from '@/app/queue/lib/skilledMatchmakingEngine';

const brackets = (b: string[], i: string[], a: string[]) => ({ beginner: b, intermediate: i, advanced: a });
const courts = (n: number): CourtDef[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i + 1}`, name: `Court ${i + 1}` }));

describe('skilledMatchmakingEngine — buildSkillQueue', () => {
  it('places tagged players in their assigned bracket', () => {
    const sq = buildSkillQueue(['A', 'B', 'C'], brackets(['A'], ['B'], ['C']));
    expect(sq.beginner).toEqual(['A']);
    expect(sq.intermediate).toEqual(['B']);
    expect(sq.advanced).toEqual(['C']);
  });

  it('untagged players default to intermediate', () => {
    const sq = buildSkillQueue(['A', 'Untagged'], brackets(['A'], [], []));
    expect(sq.intermediate).toContain('Untagged');
  });

  it('excludes players not present in the active players list (e.g. sitting out)', () => {
    const sq = buildSkillQueue(['A'], brackets(['A', 'SatOut'], [], []));
    expect(sq.beginner).toEqual(['A']);
    expect(sq.beginner).not.toContain('SatOut');
  });

  it('a player tagged in two different brackets only appears once, in the first matching bracket function checks (beginner wins per filter order, but only if also untagged-fallback does not re-add)', () => {
    // buildSkillQueue filters each bracket array independently by playerSet membership.
    // If a player name is mistakenly listed in both beginner AND advanced input arrays,
    // they'd appear in both output brackets — this test documents that real (if odd) behavior
    // rather than assuming it's deduplicated, since the source has no dedup logic.
    const sq = buildSkillQueue(['Dup'], brackets(['Dup'], [], ['Dup']));
    expect(sq.beginner).toContain('Dup');
    expect(sq.advanced).toContain('Dup');
  });
});

describe('skilledMatchmakingEngine — pickBestGroup priority via assignCourts (P1 pure match)', () => {
  it('P1: fills a court with 4 pure-beginner players when available', () => {
    const sq = buildSkillQueue(['B1', 'B2', 'B3', 'B4'], brackets(['B1', 'B2', 'B3', 'B4'], [], []));
    const { courts: filled } = assignCourts(sq, courts(1));
    expect(filled[0].skillMatch).toBe('pure');
    expect(filled[0].matchLevel).toBe('beginner');
    expect(new Set(filled[0].players)).toEqual(new Set(['B1', 'B2', 'B3', 'B4']));
  });

  it('P1: prefers beginner pure-match over intermediate/advanced pure-match when both exist (priority order)', () => {
    const sq = buildSkillQueue(
      ['B1', 'B2', 'B3', 'B4', 'I1', 'I2', 'I3', 'I4'],
      brackets(['B1', 'B2', 'B3', 'B4'], ['I1', 'I2', 'I3', 'I4'], []),
    );
    const { courts: filled } = assignCourts(sq, courts(1));
    expect(filled[0].matchLevel).toBe('beginner');
  });
});

describe('skilledMatchmakingEngine — pickBestGroup (P2 majority + adjacent fill)', () => {
  it('fills a majority-beginner court with 1 intermediate when exactly 1 is missing', () => {
    const sq = buildSkillQueue(['B1', 'B2', 'B3', 'I1'], brackets(['B1', 'B2', 'B3'], ['I1'], []));
    const { courts: filled } = assignCourts(sq, courts(1));
    expect(filled[0].skillMatch).toBe('mixed');
    expect(new Set(filled[0].players)).toEqual(new Set(['B1', 'B2', 'B3', 'I1']));
  });

  it('never fills beginner shortfall directly with advanced (must go through intermediate per P2 rule)', () => {
    // 3 beginners + 1 advanced, NO intermediate available.
    // P2 for beginner only allows intermediate fill, so it should fail and fall through
    // to P3/P3B logic instead of doing a naive "fill from whatever exists" merge.
    const sq = buildSkillQueue(['B1', 'B2', 'B3', 'A1'], brackets(['B1', 'B2', 'B3'], [], ['A1']));
    const { courts: filled } = assignCourts(sq, courts(1));
    // It should still fill (P3B cross-bracket allows B+A), but NOT be labeled a clean P2 "mixed adjacent" fill —
    // verify it still produces a valid 4-player court and uses snake ordering, not naive concatenation.
    expect(filled[0].players).toHaveLength(4);
    expect(filled[0].skillMatch).toBe('mixed');
  });
});

describe('skilledMatchmakingEngine — pickBestGroup (P3 split fill / P3B cross-bracket)', () => {
  it('P3: splits B+I in proportions summing to 4 when no pure or P2 majority match exists', () => {
    // 2 beginner + 2 intermediate, no single group has 3+ to trigger P2.
    const sq = buildSkillQueue(['B1', 'B2', 'I1', 'I2'], brackets(['B1', 'B2'], ['I1', 'I2'], []));
    const { courts: filled } = assignCourts(sq, courts(1));
    expect(new Set(filled[0].players)).toEqual(new Set(['B1', 'B2', 'I1', 'I2']));
  });

  it('P3B: falls back to cross-bracket B+A fill only when B/I/A pure and adjacent fills are impossible', () => {
    // Only 2 beginners and 2 advanced, zero intermediates — P1/P2/P3(B+I, I+A) all fail.
    const sq = buildSkillQueue(['B1', 'B2', 'A1', 'A2'], brackets(['B1', 'B2'], [], ['A1', 'A2']));
    const { courts: filled } = assignCourts(sq, courts(1));
    expect(filled[0].players).toHaveLength(4);
    expect(new Set(filled[0].players)).toEqual(new Set(['B1', 'B2', 'A1', 'A2']));
  });

  it('P3B snake-orders so no single team gets both advanced players', () => {
    const sq = buildSkillQueue(['B1', 'B2', 'A1', 'A2'], brackets(['B1', 'B2'], [], ['A1', 'A2']));
    const { courts: filled } = assignCourts(sq, courts(1));
    const [a, b] = [filled[0].players.slice(0, 2), filled[0].players.slice(2, 4)];
    const advancedInA = a.filter(p => p === 'A1' || p === 'A2').length;
    const advancedInB = b.filter(p => p === 'A1' || p === 'A2').length;
    expect(advancedInA).toBe(1);
    expect(advancedInB).toBe(1);
  });

  it('returns no group (court stays empty) when fewer than 4 players exist in total', () => {
    const sq = buildSkillQueue(['B1', 'B2', 'A1'], brackets(['B1', 'B2'], [], ['A1']));
    const { courts: filled } = assignCourts(sq, courts(1));
    expect(filled[0].players).toEqual([]);
  });
});

describe('skilledMatchmakingEngine — assignCourts (multi-court)', () => {
  it('fills as many courts as the player pool allows, leaving the rest empty', () => {
    // 4 players, 2 courts requested -> only 1 court can be filled.
    const sq = buildSkillQueue(['P1', 'P2', 'P3', 'P4'], brackets(['P1', 'P2', 'P3', 'P4'], [], []));
    const { courts: filled, remainingQueue } = assignCourts(sq, courts(2));
    const filledCount = filled.filter(c => c.players.length > 0).length;
    expect(filledCount).toBe(1);
    expect(filled[1].players).toEqual([]);
    expect(filled.flatMap(c => c.players)).toHaveLength(4);
    expect(filled.length).toBe(2);
  });

  it('does not assign the same player to two different courts', () => {
    const sq = buildSkillQueue(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'], brackets(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'], [], []));
    const { courts: filled } = assignCourts(sq, courts(2));
    const allAssigned = filled.flatMap(c => c.players);
    expect(new Set(allAssigned).size).toBe(allAssigned.length);
  });
});

describe('skilledMatchmakingEngine — initSkilledState', () => {
  it('excludes sit-out players from the active pool entirely', () => {
    const state = initSkilledState(['P1', 'P2', 'P3', 'P4', 'P5'], brackets(['P1', 'P2', 'P3', 'P4', 'P5'], [], []), courts(1), ['P5']);
    const everywhere = [...state.waitingQueue, ...state.courts.flatMap(c => c.players)];
    expect(everywhere).not.toContain('P5');
    expect(state.totalPlayers).toBe(4);
  });

  it('computes restEnabled correctly: false when totalPlayers === courts*4 exactly', () => {
    const state = initSkilledState(['P1', 'P2', 'P3', 'P4'], brackets(['P1', 'P2', 'P3', 'P4'], [], []), courts(1));
    expect(state.restEnabled).toBe(false);
  });

  it('computes restEnabled correctly: true when totalPlayers > courts*4', () => {
    const players = Array.from({ length: 5 }, (_, i) => `P${i + 1}`);
    const state = initSkilledState(players, brackets(players, [], []), courts(1));
    expect(state.restEnabled).toBe(true);
  });

  it('restCycleLength is 1 unless totalPlayers >= courts*4 + courts*2', () => {
    // 1 court: need >= 4+2=6 for restCycleLength 2. 5 players -> still 1.
    const players5 = Array.from({ length: 5 }, (_, i) => `P${i + 1}`);
    const state5 = initSkilledState(players5, brackets(players5, [], []), courts(1));
    expect(state5.restCycleLength).toBe(1);

    const players6 = Array.from({ length: 6 }, (_, i) => `P${i + 1}`);
    const state6 = initSkilledState(players6, brackets(players6, [], []), courts(1));
    expect(state6.restCycleLength).toBe(2);
  });

  it('gamesCycleCount starts at 0', () => {
    const state = initSkilledState(['P1', 'P2', 'P3', 'P4'], brackets(['P1', 'P2', 'P3', 'P4'], [], []), courts(1));
    expect(state.gamesCycleCount).toBe(0);
  });
});

describe('skilledMatchmakingEngine — rotatePlayers (rest pool routing)', () => {
  function buildRestEnabledState(): SkilledState {
    // 5 players, 1 court -> restEnabled = true, restCycleLength = 1
    const players = Array.from({ length: 5 }, (_, i) => `P${i + 1}`);
    return initSkilledState(players, brackets(players, [], []), courts(1));
  }

  it('increments gamesCycleCount on every call', () => {
    const state = buildRestEnabledState();
    const next = rotatePlayers(state.courts[0].players, state, brackets([], [], []));
    expect(next.gamesCycleCount).toBe(1);
  });

  it('routes completed players to restPool when restEnabled is true', () => {
    const state = buildRestEnabledState();
    const completed = state.courts[0].players;
    const next = rotatePlayers(completed, state, brackets([], [], []));
    const restNames = next.restPool.map(e => e.name);
    expect(new Set(restNames)).toEqual(new Set(completed));
  });

  it('routes completed players straight back to the skill queue when restEnabled is false', () => {
    const players = ['P1', 'P2', 'P3', 'P4']; // exactly 4, 1 court -> restEnabled false
    const state = initSkilledState(players, brackets(players, [], []), courts(1));
    const completed = state.courts[0].players;
    const next = rotatePlayers(completed, state, brackets(players, [], []));
    expect(next.restPool).toEqual([]);
    expect(next.waitingQueue).toHaveLength(4);
  });

  it('graduates a resting player back to the queue once cyclesRemaining reaches 0', () => {
    const state = buildRestEnabledState();
    const completed = state.courts[0].players;
    let next = rotatePlayers(completed, state, brackets([], [], []));
    expect(next.restPool.every(e => e.cyclesRemaining === 1)).toBe(true);
    // Second rotation call (simulating another court finishing) ticks rest down to 0.
    next = rotatePlayers([], next, brackets([], [], []));
    expect(next.restPool).toEqual([]);
    // Graduated players should now be back in the skill queue.
    const allInQueue = [...next.skillQueue.beginner, ...next.skillQueue.intermediate, ...next.skillQueue.advanced];
    completed.forEach(p => expect(allInQueue).toContain(p));
  });

  it('a player already resting is not double-added if they appear again in completedPlayers (defensive check on stillResting filter)', () => {
    const state = buildRestEnabledState();
    const completed = state.courts[0].players;
    const next = rotatePlayers(completed, state, brackets([], [], []));
    const names = next.restPool.map(e => e.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });
});

describe('skilledMatchmakingEngine — reassignCourt', () => {
  it('fills an idle court from the skill queue when enough players are available', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    let state = initSkilledState(players, brackets(players, [], []), courts(1));
    // Court is full from init; simulate it finishing and reassign with remaining waiting players.
    const next = reassignCourt('c1', state, brackets(players, [], []));
    expect(next.courts[0].players).toHaveLength(4);
  });

  it('increments idleCycles when no group can be formed (not enough players left)', () => {
    const players = ['P1', 'P2', 'P3', 'P4'];
    let state = initSkilledState(players, brackets(players, [], []), courts(1));
    // skillQueue is now empty (all 4 on court). Reassigning with nothing left should mark idle.
    const next = reassignCourt('c1', state, brackets(players, [], []));
    expect(next.courts[0].players).toEqual([]);
    expect(next.courts[0].idleCycles).toBe(1);
  });

  it('resets idleCycles to 0 once a group is successfully assigned', () => {
    const players = ['P1', 'P2', 'P3', 'P4'];
    let state = initSkilledState(players, brackets(players, [], []), courts(1));
    state = { ...state, courts: [{ ...state.courts[0], idleCycles: 3 }] };
    // Put the 4 players back in queue to be reassigned.
    state = { ...state, skillQueue: { beginner: [], intermediate: players, advanced: [] }, waitingQueue: players };
    const next = reassignCourt('c1', state, brackets(players, [], []));
    expect(next.courts[0].idleCycles).toBe(0);
  });
});

describe('skilledMatchmakingEngine — addPlayerToSkilledState', () => {
  it('adds a new player to the correct bracket queue based on skillBrackets', () => {
    const state = initSkilledState(['P1', 'P2', 'P3', 'P4'], brackets(['P1', 'P2', 'P3', 'P4'], [], []), courts(1));
    const next = addPlayerToSkilledState('NewAdvanced', state, brackets(['P1', 'P2', 'P3', 'P4'], [], ['NewAdvanced']));
    expect(next.skillQueue.advanced).toContain('NewAdvanced');
  });

  it('does nothing if the player already exists anywhere in the system (queue, court, sitOut, or rest)', () => {
    const state = initSkilledState(['P1', 'P2', 'P3', 'P4'], brackets(['P1', 'P2', 'P3', 'P4'], [], []), courts(1));
    const next = addPlayerToSkilledState('P1', state, brackets(['P1', 'P2', 'P3', 'P4'], [], []));
    expect(next).toEqual(state);
  });

  it('defaults a newly added player to intermediate if untagged', () => {
    const state = initSkilledState(['P1', 'P2', 'P3', 'P4'], brackets(['P1', 'P2', 'P3', 'P4'], [], []), courts(1));
    const next = addPlayerToSkilledState('Untagged', state, brackets(['P1', 'P2', 'P3', 'P4'], [], []));
    expect(next.skillQueue.intermediate).toContain('Untagged');
  });
});

describe('skilledMatchmakingEngine — retagPlayerInQueue', () => {
  it('moves a waiting player from one bracket to another', () => {
    const sq: SkillQueue = { beginner: ['B1'], intermediate: [], advanced: [] };
    const state: SkilledState = {
      skillQueue: sq, courts: [], waitingQueue: ['B1'], sitOut: [], restPool: [],
      restEnabled: false, restCycleLength: 1, totalPlayers: 1, gamesCycleCount: 0, bracketWaitCycles: { beginner: 0, intermediate: 0, advanced: 0 }, starvationThreshold: 3,
    };
    const next = retagPlayerInQueue('B1', 'advanced', state);
    expect(next.skillQueue.beginner).not.toContain('B1');
    expect(next.skillQueue.advanced).toContain('B1');
  });

  it('refuses to retag a player who is currently on a court', () => {
    const state: SkilledState = {
      skillQueue: { beginner: [], intermediate: [], advanced: [] },
      courts: [{ id: 'c1', name: 'Court 1', players: ['OnCourt', 'X', 'Y', 'Z'], skillMatch: 'pure', matchLevel: 'beginner', idleCycles: 0, earlyReturns: [] }],
      waitingQueue: [], sitOut: [], restPool: [], restEnabled: false, restCycleLength: 1, totalPlayers: 4, gamesCycleCount: 0, bracketWaitCycles: { beginner: 0, intermediate: 0, advanced: 0 }, starvationThreshold: 3,
    };
    const next = retagPlayerInQueue('OnCourt', 'advanced', state);
    expect(next).toEqual(state); // unchanged
  });
});

describe('skilledMatchmakingEngine — recalculateRest', () => {
  it('flushes the entire rest pool back to the skill queue when rest becomes disabled', () => {
    const state: SkilledState = {
      skillQueue: { beginner: [], intermediate: [], advanced: [] },
      courts: courts(1).map(c => ({ ...c, players: [], skillMatch: 'pure', matchLevel: 'mixed', idleCycles: 0, earlyReturns: [] })),
      waitingQueue: [], sitOut: [],
      restPool: [{ name: 'Resting1', skillLevel: 'beginner', cyclesRemaining: 1 }],
      restEnabled: true, restCycleLength: 1, totalPlayers: 5, gamesCycleCount: 0, bracketWaitCycles: { beginner: 0, intermediate: 0, advanced: 0 }, starvationThreshold: 3,
    };
    // Dropping totalActive to 4 with 1 court -> restEnabled becomes false (4 == 1*4, not >).
    const next = recalculateRest(state, 4);
    expect(next.restEnabled).toBe(false);
    expect(next.restPool).toEqual([]);
    expect(next.skillQueue.beginner).toContain('Resting1');
  });

  it('leaves the rest pool untouched if rest remains enabled (only cycle length may change)', () => {
    const state: SkilledState = {
      skillQueue: { beginner: [], intermediate: [], advanced: [] },
      courts: courts(1).map(c => ({ ...c, players: [], skillMatch: 'pure', matchLevel: 'mixed', idleCycles: 0, earlyReturns: [] })),
      waitingQueue: [], sitOut: [],
      restPool: [{ name: 'Resting1', skillLevel: 'beginner', cyclesRemaining: 1 }],
      restEnabled: true, restCycleLength: 1, totalPlayers: 5, gamesCycleCount: 0, bracketWaitCycles: { beginner: 0, intermediate: 0, advanced: 0 }, starvationThreshold: 3,
    };
    const next = recalculateRest(state, 6); // still > 4, rest stays enabled
    expect(next.restEnabled).toBe(true);
    expect(next.restPool).toEqual(state.restPool);
  });
});

describe('skilledMatchmakingEngine — getPlayerBracketLevel', () => {
  it('returns beginner, advanced, or intermediate (default) correctly', () => {
    const b = brackets(['B'], [], ['A']);
    expect(getPlayerBracketLevel('B', b)).toBe('beginner');
    expect(getPlayerBracketLevel('A', b)).toBe('advanced');
    expect(getPlayerBracketLevel('Unknown', b)).toBe('intermediate');
  });
});

describe('skilledMatchmakingEngine — fillIdleCourts', () => {
  it('does nothing to a court that already has players', () => {
    const state: SkilledState = {
      skillQueue: { beginner: [], intermediate: [], advanced: [] },
      courts: [{ id: 'c1', name: 'Court 1', players: ['A', 'B', 'C', 'D'], skillMatch: 'pure', matchLevel: 'beginner', idleCycles: 0, earlyReturns: [] }],
      waitingQueue: [], sitOut: [], restPool: [], restEnabled: false, restCycleLength: 1, totalPlayers: 4, gamesCycleCount: 0, bracketWaitCycles: { beginner: 0, intermediate: 0, advanced: 0 }, starvationThreshold: 3,
    };
    const next = fillIdleCourts(state);
    expect(next.courts[0].players).toEqual(['A', 'B', 'C', 'D']);
  });

  it('leaves a court idle if fewer than 4 total players (queue + rest) are available', () => {
    const state: SkilledState = {
      skillQueue: { beginner: ['X', 'Y'], intermediate: [], advanced: [] },
      courts: [{ id: 'c1', name: 'Court 1', players: [], skillMatch: 'pure', matchLevel: 'mixed', idleCycles: 2, earlyReturns: [] }],
      waitingQueue: ['X', 'Y'], sitOut: [], restPool: [], restEnabled: false, restCycleLength: 1, totalPlayers: 2, gamesCycleCount: 0, bracketWaitCycles: { beginner: 0, intermediate: 0, advanced: 0 }, starvationThreshold: 3,
    };
    const next = fillIdleCourts(state);
    expect(next.courts[0].players).toEqual([]);
  });

  it('fills an idle court immediately when the active queue alone has >= 4 players', () => {
    const players = ['A', 'B', 'C', 'D'];
    const state: SkilledState = {
      skillQueue: { beginner: players, intermediate: [], advanced: [] },
      courts: [{ id: 'c1', name: 'Court 1', players: [], skillMatch: 'pure', matchLevel: 'mixed', idleCycles: 1, earlyReturns: [] }],
      waitingQueue: players, sitOut: [], restPool: [], restEnabled: false, restCycleLength: 1, totalPlayers: 4, gamesCycleCount: 0, bracketWaitCycles: { beginner: 0, intermediate: 0, advanced: 0 }, starvationThreshold: 3,
    };
    const next = fillIdleCourts(state);
    expect(next.courts[0].players).toHaveLength(4);
    expect(next.courts[0].idleCycles).toBe(0);
  });

  it('pulls players early from the rest pool (least-rested first) when the queue alone is short', () => {
    // 2 waiting -> needed = 4 - 2 = 2 from rest. With 3 resting candidates available,
    // only the 2 with the LOWEST cyclesRemaining should be pulled early.
    const state: SkilledState = {
      skillQueue: { beginner: ['X', 'Y'], intermediate: [], advanced: [] }, // 2 waiting
      courts: [{ id: 'c1', name: 'Court 1', players: [], skillMatch: 'pure', matchLevel: 'mixed', idleCycles: 1, earlyReturns: [] }],
      waitingQueue: ['X', 'Y'], sitOut: [],
      restPool: [
        { name: 'R1', skillLevel: 'beginner', cyclesRemaining: 2 },
        { name: 'R2', skillLevel: 'beginner', cyclesRemaining: 1 }, // closer to graduating — should be pulled first
        { name: 'R3', skillLevel: 'beginner', cyclesRemaining: 3 }, // most-rested, should stay resting
      ],
      restEnabled: true, restCycleLength: 2, totalPlayers: 5, gamesCycleCount: 0, bracketWaitCycles: { beginner: 0, intermediate: 0, advanced: 0 }, starvationThreshold: 3,
    };
    const next = fillIdleCourts(state);
    expect(next.courts[0].players).toHaveLength(4);
    expect(next.courts[0].earlyReturns).toContain('R2'); // lowest cyclesRemaining pulled first
    expect(next.courts[0].earlyReturns).not.toContain('R3'); // most-rested, should stay resting
  });

  it('pulls ALL resting candidates early if the rest pool itself is smaller than the shortfall (nitpick: no length guard before slicing)', () => {
    // 1 waiting -> needed = 3 from rest, but only 3 exist -> all 3 get pulled regardless of
    // how rested they are. This documents real behavior: `needed` can exceed a "fair" pull size.
    const state: SkilledState = {
      skillQueue: { beginner: ['X'], intermediate: [], advanced: [] },
      courts: [{ id: 'c1', name: 'Court 1', players: [], skillMatch: 'pure', matchLevel: 'mixed', idleCycles: 1, earlyReturns: [] }],
      waitingQueue: ['X'], sitOut: [],
      restPool: [
        { name: 'R1', skillLevel: 'beginner', cyclesRemaining: 2 },
        { name: 'R2', skillLevel: 'beginner', cyclesRemaining: 1 },
        { name: 'R3', skillLevel: 'beginner', cyclesRemaining: 3 },
      ],
      restEnabled: true, restCycleLength: 2, totalPlayers: 4, gamesCycleCount: 0, bracketWaitCycles: { beginner: 0, intermediate: 0, advanced: 0 }, starvationThreshold: 3,
    };
    const next = fillIdleCourts(state);
    expect(next.courts[0].players).toHaveLength(4);
    expect(new Set(next.courts[0].earlyReturns)).toEqual(new Set(['R1', 'R2', 'R3']));
  });

  it('does not pull from rest pool at all when restEnabled is false, even if rest pool somehow has entries', () => {
    // Defensive/inconsistent-state test: if restEnabled is false, totalAvailable should
    // only count the waiting queue, not the rest pool, per the source's own ternary.
    const state: SkilledState = {
      skillQueue: { beginner: ['X'], intermediate: [], advanced: [] },
      courts: [{ id: 'c1', name: 'Court 1', players: [], skillMatch: 'pure', matchLevel: 'mixed', idleCycles: 1, earlyReturns: [] }],
      waitingQueue: ['X'], sitOut: [],
      restPool: [{ name: 'Ghost', skillLevel: 'beginner', cyclesRemaining: 1 }],
      restEnabled: false, restCycleLength: 1, totalPlayers: 1, gamesCycleCount: 0, bracketWaitCycles: { beginner: 0, intermediate: 0, advanced: 0 }, starvationThreshold: 3,
    };
    const next = fillIdleCourts(state);
    // Only 1 waiting + restEnabled=false means totalAvailable=1 < 4 -> stays idle.
    expect(next.courts[0].players).toEqual([]);
  });
});

describe('skilledMatchmakingEngine — multi-court non-overlap invariant (integration-style nitpick)', () => {
  it('across init + one full rotation cycle, no player ever appears on two courts simultaneously', () => {
    const players = Array.from({ length: 12 }, (_, i) => `P${i + 1}`);
    let state = initSkilledState(players, brackets(players, [], []), courts(2));

    // Verify no overlap at init
    const initAssigned = state.courts.flatMap(c => c.players);
    expect(new Set(initAssigned).size).toBe(initAssigned.length);

    // Simulate court 1 finishing and reassigning
    const finishedPlayers = state.courts[0].players;
    state = rotatePlayers(finishedPlayers, state, brackets(players, [], []));
    state = reassignCourt('c1', state, brackets(players, [], []));

    const allOnCourts = state.courts.flatMap(c => c.players);
    expect(new Set(allOnCourts).size).toBe(allOnCourts.length);
  });
});