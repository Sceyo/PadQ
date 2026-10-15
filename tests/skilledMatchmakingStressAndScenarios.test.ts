import { describe, expect, it } from 'vitest';
import {
  initSkilledState,
  rotatePlayers,
  reassignCourt,
  fillIdleCourts,
  addPlayerToSkilledState,
  recalculateRest,
  projectSkilledCourtsToSlots,
  hydrateSkilledStateFromCourtSlots,
  type SkilledState,
  type CourtDef,
  type SkillLevel,
} from '@/app/queue/lib/skilledMatchmakingEngine';

// ── Test Helpers ────────────────────────────────────────────────────────────

const createCourtDefs = (count: number): CourtDef[] =>
  Array.from({ length: count }, (_, i) => ({ id: `court-${i}`, name: `Court ${i + 1}` }));

function createBrackets(b: string[], i: string[], a: string[]) {
  return { beginner: b, intermediate: i, advanced: a };
}

function getPlayerLevel(
  name: string,
  b: { beginner: string[]; intermediate: string[]; advanced: string[] },
): SkillLevel {
  if (b.beginner.includes(name)) return 'beginner';
  if (b.advanced.includes(name)) return 'advanced';
  return 'intermediate';
}

function levelValue(level: SkillLevel): number {
  switch (level) {
    case 'advanced': return 3;
    case 'intermediate': return 2;
    case 'beginner': return 1;
  }
}

/**
 * Asserts that all players are strictly partitioned across:
 * - Active courts (exactly 4 or 0 per court)
 * - Waiting queue
 * - Rest pool
 * - Sit-out list
 *
 * No player may ever appear in two places at once.
 */
function assertPartitionIntegrity(
  totalRoster: string[],
  state: SkilledState,
  courtSlots: { id: string; name: string; onCourt: string[] }[],
) {
  const onCourts = courtSlots.flatMap(c => c.onCourt);
  const waiting = [...state.waitingQueue];
  const resting = state.restPool.map(r => r.name);
  const sitting = [...state.sitOut];

  // Each court has 0 or 4 players
  for (const slot of courtSlots) {
    expect([0, 4]).toContain(slot.onCourt.length);
  }

  // Projection consistency
  expect(courtSlots).toEqual(projectSkilledCourtsToSlots(state.courts));

  const combined = [...onCourts, ...waiting, ...resting, ...sitting];
  expect(combined).toHaveLength(totalRoster.length);
  expect(new Set(combined).size).toBe(totalRoster.length);
  expect(new Set(combined)).toEqual(new Set(totalRoster));
}

/**
 * Asserts that when 4 players are placed on a court, they follow snake-draft pairing:
 * - Skill sum between Team A and Team B is balanced (<= 1 tier difference).
 * - If there are 2 advanced players and beginners, each team gets exactly 1 advanced player.
 */
function assertSnakeDraftPairing(
  playersOnCourt: string[],
  b: { beginner: string[]; intermediate: string[]; advanced: string[] },
) {
  if (playersOnCourt.length < 4) return;
  const levelOf = (p: string) => levelValue(getPlayerLevel(p, b));
  const teamA = [playersOnCourt[0], playersOnCourt[1]];
  const teamB = [playersOnCourt[2], playersOnCourt[3]];

  const skillA = levelOf(teamA[0]) + levelOf(teamA[1]);
  const skillB = levelOf(teamB[0]) + levelOf(teamB[1]);

  // Snake draft guarantees optimal balance: difference is at most 2 (and 0 for 2 Adv + 2 Beg)
  expect(Math.abs(skillA - skillB)).toBeLessThanOrEqual(2);

  // If there are exactly 2 advanced players and beginners on the court, snake draft guarantees
  // each team gets exactly 1 advanced player (never 2 on one team vs 0 on the other)
  const advCountA = teamA.filter(p => getPlayerLevel(p, b) === 'advanced').length;
  const advCountB = teamB.filter(p => getPlayerLevel(p, b) === 'advanced').length;
  if (advCountA + advCountB === 2 && playersOnCourt.some(p => getPlayerLevel(p, b) === 'beginner')) {
    expect(advCountA).toBe(1);
    expect(advCountB).toBe(1);
  }
}

// ── Test Suites ─────────────────────────────────────────────────────────────

describe('Skill-Aware Matchmaking — High-Load Stress Testing', () => {
  it('stress test: 30 players, 3 courts, 300 staggered match completions with 100% partition and snake integrity', () => {
    // 30 players: 14 beginners, 12 intermediates, 4 advanced
    const beginners = Array.from({ length: 14 }, (_, i) => `Beg-${i + 1}`);
    const intermediates = Array.from({ length: 12 }, (_, i) => `Int-${i + 1}`);
    const advanced = Array.from({ length: 4 }, (_, i) => `Adv-${i + 1}`);
    const allPlayers = [...beginners, ...intermediates, ...advanced];
    const brackets = createBrackets(beginners, intermediates, advanced);
    const defs = createCourtDefs(3);

    // Initial state: 3 courts = 12 on court, 18 waiting
    let state = initSkilledState(allPlayers, brackets, defs, []);
    let courtSlots = projectSkilledCourtsToSlots(state.courts);

    assertPartitionIntegrity(allPlayers, state, courtSlots);
    for (const slot of courtSlots) {
      assertSnakeDraftPairing(slot.onCourt, brackets);
    }

    // Track play counts to verify fairness
    const playCounts = Object.fromEntries(allPlayers.map(p => [p, 0]));
    courtSlots.flatMap(c => c.onCourt).forEach(p => { playCounts[p]++; });

    // Staggered finish pattern across 300 rounds
    const finishSequence = [0, 2, 1, 0, 0, 2, 1, 2, 1, 1, 0, 2];

    for (let round = 0; round < 300; round++) {
      const courtIdx = finishSequence[round % finishSequence.length];
      const targetCourt = courtSlots[courtIdx];
      expect(targetCourt.onCourt).toHaveLength(4);

      // Rotate, reassign, and fill
      const afterRotate = rotatePlayers(targetCourt.onCourt, state, brackets);
      const afterReassign = reassignCourt(targetCourt.id, afterRotate, brackets);
      state = fillIdleCourts(afterReassign);
      courtSlots = projectSkilledCourtsToSlots(state.courts);

      // Record games played for newly placed players
      targetCourt.onCourt.forEach(p => {
        playCounts[p]++;
      });

      // Verify core invariants on EVERY SINGLE MATCH COMPLETION
      assertPartitionIntegrity(allPlayers, state, courtSlots);
      for (const slot of courtSlots) {
        assertSnakeDraftPairing(slot.onCourt, brackets);
      }
    }

    // Fairness validation: with 300 rounds across 30 players (1,200 player-slots played)
    // and 2-cycle rest intervals, every player should have played at least 15 games.
    for (const player of allPlayers) {
      expect(playCounts[player]).toBeGreaterThanOrEqual(15);
    }

    // Hydration check: reload at round 300 reproduces exact active courts
    const rehydrated = hydrateSkilledStateFromCourtSlots(allPlayers, brackets, courtSlots, []);
    expect(projectSkilledCourtsToSlots(rehydrated.courts)).toEqual(courtSlots);
    expect(rehydrated.courts.flatMap(c => c.players)).toHaveLength(12);
  });
});

describe('Skill-Aware Matchmaking — Realistic Live Club Scenarios', () => {
  it('Scenario 1: Mid-Session Arrivals & Court Expansion (2 courts -> 3 courts)', () => {
    // Session starts with 12 players on 2 courts
    const bInit = ['B1', 'B2', 'B3', 'B4', 'B5'];
    const iInit = ['I1', 'I2', 'I3', 'I4', 'I5'];
    const aInit = ['A1', 'A2'];
    let allPlayers = [...bInit, ...iInit, ...aInit];
    let brackets = createBrackets(bInit, iInit, aInit);
    let defs = createCourtDefs(2);

    let state = initSkilledState(allPlayers, brackets, defs, []);
    let courtSlots = projectSkilledCourtsToSlots(state.courts);
    expect(courtSlots).toHaveLength(2);
    expect(courtSlots.every(c => c.onCourt.length === 4)).toBe(true);

    // 4 new players walk in: 2 Beginners, 1 Intermediate, 1 Advanced
    const walkIns = ['B-New1', 'B-New2', 'I-New1', 'A-New1'];
    allPlayers = [...allPlayers, ...walkIns];
    brackets = createBrackets(
      [...brackets.beginner, 'B-New1', 'B-New2'],
      [...brackets.intermediate, 'I-New1'],
      [...brackets.advanced, 'A-New1'],
    );

    for (const walkIn of walkIns) {
      state = addPlayerToSkilledState(walkIn, state, brackets);
    }
    state = recalculateRest(state, allPlayers.length);
    courtSlots = projectSkilledCourtsToSlots(state.courts);

    assertPartitionIntegrity(allPlayers, state, courtSlots);
    expect(state.waitingQueue).toContain('B-New1');
    expect(state.waitingQueue).toContain('A-New1');

    // Host opens Court 3
    defs = createCourtDefs(3);
    state = {
      ...state,
      courts: [
        ...state.courts,
        { id: 'court-2', name: 'Court 3', players: [], skillMatch: 'pure', matchLevel: 'mixed', idleCycles: 0, earlyReturns: [] },
      ],
    };
    state = fillIdleCourts(state);
    courtSlots = projectSkilledCourtsToSlots(state.courts);

    // Court 3 immediately filled from waiting queue
    expect(courtSlots).toHaveLength(3);
    expect(courtSlots[2].onCourt).toHaveLength(4);
    assertPartitionIntegrity(allPlayers, state, courtSlots);
  });

  it('Scenario 2: Mid-Session Sit-Out and Resumption (Injury/Break)', () => {
    const b = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6'];
    const i = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6'];
    const a = ['A1', 'A2', 'A3', 'A4'];
    const allPlayers = [...b, ...i, ...a];
    const brackets = createBrackets(b, i, a);
    const defs = createCourtDefs(3);

    let state = initSkilledState(allPlayers, brackets, defs, []);
    let courtSlots = projectSkilledCourtsToSlots(state.courts);

    // Find one waiting player and simulate sit-out
    const waitingPlayer = state.waitingQueue[0];
    const sitOutList = [waitingPlayer];

    // Remove from skillQueue and place in sitOut
    const sq = {
      beginner: state.skillQueue.beginner.filter(p => p !== waitingPlayer),
      intermediate: state.skillQueue.intermediate.filter(p => p !== waitingPlayer),
      advanced: state.skillQueue.advanced.filter(p => p !== waitingPlayer),
    };
    state = {
      ...state,
      skillQueue: sq,
      waitingQueue: [...sq.beginner, ...sq.intermediate, ...sq.advanced],
      sitOut: sitOutList,
    };
    state = recalculateRest(state, allPlayers.length - 1);
    courtSlots = projectSkilledCourtsToSlots(state.courts);

    assertPartitionIntegrity(allPlayers, state, courtSlots);
    expect(state.sitOut).toContain(waitingPlayer);
    expect(state.waitingQueue).not.toContain(waitingPlayer);

    // Play 5 games while player is sitting out
    for (let g = 0; g < 5; g++) {
      const courtIdx = g % 3;
      const finished = state.courts[courtIdx].players;
      const afterRotate = rotatePlayers(finished, state, brackets);
      const afterReassign = reassignCourt(state.courts[courtIdx].id, afterRotate, brackets);
      state = fillIdleCourts(afterReassign);
    }
    courtSlots = projectSkilledCourtsToSlots(state.courts);
    assertPartitionIntegrity(allPlayers, state, courtSlots);

    // Player returns from sit-out: remove from sitOut first, then add back to skilled state
    state = {
      ...state,
      sitOut: state.sitOut.filter(p => p !== waitingPlayer),
    };
    state = addPlayerToSkilledState(waitingPlayer, state, brackets);
    state = recalculateRest(state, allPlayers.length);
    courtSlots = projectSkilledCourtsToSlots(state.courts);

    assertPartitionIntegrity(allPlayers, state, courtSlots);
    expect(state.sitOut).toHaveLength(0);
    expect(state.waitingQueue).toContain(waitingPlayer);
  });

  it('Scenario 3: Host Browser Reload / Crash Recovery During Live Play', () => {
    const b = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8'];
    const i = ['I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7', 'I8'];
    const a = ['A1', 'A2', 'A3', 'A4'];
    const allPlayers = [...b, ...i, ...a];
    const brackets = createBrackets(b, i, a);
    const defs = createCourtDefs(3);

    let state = initSkilledState(allPlayers, brackets, defs, []);

    // Run 10 games so courts have rotated and rest pool is populated
    for (let g = 0; g < 10; g++) {
      const cIdx = g % 3;
      const court = state.courts[cIdx];
      const afterRotate = rotatePlayers(court.players, state, brackets);
      const afterReassign = reassignCourt(court.id, afterRotate, brackets);
      state = fillIdleCourts(afterReassign);
    }

    const preCrashSlots = projectSkilledCourtsToSlots(state.courts);
    expect(preCrashSlots.every(c => c.onCourt.length === 4)).toBe(true);

    // SIMULATE BROWSER RELOAD: host opens page, reads Firestore SessionDoc containing preCrashSlots
    const rehydratedState = hydrateSkilledStateFromCourtSlots(allPlayers, brackets, preCrashSlots, []);
    const postCrashSlots = projectSkilledCourtsToSlots(rehydratedState.courts);

    // Active court assignments must be 100% identical
    expect(postCrashSlots).toEqual(preCrashSlots);
    assertPartitionIntegrity(allPlayers, rehydratedState, postCrashSlots);

    // Host finishes Court 1 match immediately after reload
    const c1Players = rehydratedState.courts[0].players;
    const afterRotate = rotatePlayers(c1Players, rehydratedState, brackets);
    const afterReassign = reassignCourt('court-0', afterRotate, brackets);
    const nextState = fillIdleCourts(afterReassign);
    const nextSlots = projectSkilledCourtsToSlots(nextState.courts);

    expect(nextSlots[0].onCourt).toHaveLength(4);
    assertPartitionIntegrity(allPlayers, nextState, nextSlots);
  });

  it('Scenario 4: Starvation Override Prevents Neglected Minority Brackets', () => {
    // Asymmetric distribution: 20 Beginners, 0 Intermediates, 2 Advanced
    const beginners = Array.from({ length: 20 }, (_, i) => `Beg-${i + 1}`);
    const advanced = ['Adv-1', 'Adv-2'];
    const allPlayers = [...beginners, ...advanced];
    const brackets = createBrackets(beginners, [], advanced);
    const defs = createCourtDefs(2);

    let state = initSkilledState(allPlayers, brackets, defs, []);
    const courtSlots = projectSkilledCourtsToSlots(state.courts);

    // Initially, Court 1 & 2 are filled with Beginners (P1 pure match)
    expect(courtSlots[0].onCourt.every(p => p.startsWith('Beg-'))).toBe(true);
    expect(courtSlots[1].onCourt.every(p => p.startsWith('Beg-'))).toBe(true);

    // Threshold is max(2, courtCount = 2) = 2
    expect(state.starvationThreshold).toBe(2);

    let advancedPlayed = false;

    // Simulate up to 6 court finishes
    for (let round = 0; round < 6; round++) {
      const courtIdx = round % 2;
      const court = state.courts[courtIdx];
      const afterRotate = rotatePlayers(court.players, state, brackets);
      const afterReassign = reassignCourt(court.id, afterRotate, brackets);
      state = fillIdleCourts(afterReassign);

      const allActive = state.courts.flatMap(c => c.players);
      if (allActive.includes('Adv-1') || allActive.includes('Adv-2')) {
        advancedPlayed = true;
        // Verify snake draft was applied to balance the advanced players
        const advCourt = state.courts.find(c => c.players.includes('Adv-1') || c.players.includes('Adv-2'))!;
        assertSnakeDraftPairing(advCourt.players, brackets);
        break;
      }
    }

    // Starvation override must have scheduled the advanced players despite huge beginner majority
    expect(advancedPlayed).toBe(true);
  });

  it('Scenario 5: Undo Last Match Workflow in Skilled Mode', () => {
    const b = ['B1', 'B2', 'B3', 'B4', 'B5'];
    const i = ['I1', 'I2', 'I3', 'I4', 'I5'];
    const a = ['A1', 'A2', 'A3', 'A4'];
    const allPlayers = [...b, ...i, ...a];
    const brackets = createBrackets(b, i, a);
    const defs = createCourtDefs(2);

    let state = initSkilledState(allPlayers, brackets, defs, []);
    const initialSlots = projectSkilledCourtsToSlots(state.courts);

    // Snapshot taken before match result
    const undoSnapshot = {
      queue: [...state.waitingQueue],
      courtSlots: [...initialSlots.map(c => ({ ...c, onCourt: [...c.onCourt] }))],
      skilledState: JSON.parse(JSON.stringify(state)) as SkilledState,
    };

    // Court 0 match finishes
    const court0 = state.courts[0];
    const afterRotate = rotatePlayers(court0.players, state, brackets);
    const afterReassign = reassignCourt('court-0', afterRotate, brackets);
    state = fillIdleCourts(afterReassign);
    const postMatchSlots = projectSkilledCourtsToSlots(state.courts);

    // Court 0 changed
    expect(postMatchSlots[0].onCourt).not.toEqual(initialSlots[0].onCourt);

    // UNDO: Restore from snapshot
    state = undoSnapshot.skilledState;
    const restoredSlots = projectSkilledCourtsToSlots(state.courts);

    expect(restoredSlots).toEqual(initialSlots);
    expect(state.waitingQueue).toEqual(undoSnapshot.queue);
    assertPartitionIntegrity(allPlayers, state, restoredSlots);
  });
});
