import { describe, expect, it } from 'vitest';
import {
  initSkilledState,
  rotatePlayers,
  reassignCourt,
  fillIdleCourts,
  addPlayerToSkilledState,
  retagPlayerInQueue,
  recalculateRest,
  projectSkilledCourtsToSlots,
  hydrateSkilledStateFromCourtSlots,
  extractRecentPartnerPairs,
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

  it('Scenario 6: Live 13-Player Simulation with Partner Variety & Snake Balance', () => {
    // Exact user test scenario: 13 players across 2 courts
    const b = ['1', '2', '7', '9', '11'];
    const i = ['3', '6', '8', '13'];
    const a = ['4', '5', '12', '0'];
    const allPlayers = [...b, ...i, ...a];
    const brackets = createBrackets(b, i, a);
    const defs = createCourtDefs(2);

    let state = initSkilledState(allPlayers, brackets, defs, []);
    let courtSlots = projectSkilledCourtsToSlots(state.courts);
    assertPartitionIntegrity(allPlayers, state, courtSlots);

    const matchHistory: { players: string }[] = [];
    const player12Partners: string[] = [];

    // Track initial partners for player 12 if on court
    for (const c of courtSlots) {
      if (c.onCourt.includes('12')) {
        const teamA = c.onCourt.slice(0, 2);
        const teamB = c.onCourt.slice(2, 4);
        const partner = teamA.includes('12')
          ? teamA.find(p => p !== '12')!
          : teamB.find(p => p !== '12')!;
        player12Partners.push(partner);
      }
    }

    // Simulate 20 consecutive match completions with staggered courts
    for (let round = 0; round < 20; round++) {
      const courtIdx = round % 2;
      const targetCourt = state.courts[courtIdx];
      if (targetCourt.players.length === 4) {
        const teamA = targetCourt.players.slice(0, 2);
        const teamB = targetCourt.players.slice(2, 4);
        const matchString = `${teamA.join(' & ')} vs ${teamB.join(' & ')}`;
        matchHistory.unshift({ players: matchString });

        // Check if player 12 is in this match
        if (targetCourt.players.includes('12')) {
          const partner = teamA.includes('12')
            ? teamA.find(p => p !== '12')!
            : teamB.find(p => p !== '12')!;
          player12Partners.push(partner);
        }

        const recentPartners = extractRecentPartnerPairs(matchHistory, 15);
        const afterRotate = rotatePlayers(targetCourt.players, state, brackets);
        const afterReassign = reassignCourt(targetCourt.id, afterRotate, brackets, recentPartners);
        state = fillIdleCourts(afterReassign, recentPartners);
        courtSlots = projectSkilledCourtsToSlots(state.courts);

        assertPartitionIntegrity(allPlayers, state, courtSlots);

        // Assert competitive balance on active courts
        for (const slot of courtSlots) {
          if (slot.onCourt.length === 4) {
            assertSnakeDraftPairing(slot.onCourt, brackets);
          }
        }
      }
    }

    // Verify player 12 partner variety: player 12 must not be paired with only one single player!
    if (player12Partners.length >= 3) {
      const uniquePartnersFor12 = new Set(player12Partners);
      // With partner penalty enabled, player 12 must have more than 1 distinct partner across multiple games
      expect(uniquePartnersFor12.size).toBeGreaterThan(1);

      // Verify no player was paired with 12 more than 2 consecutive times in a row
      for (let idx = 0; idx < player12Partners.length - 2; idx++) {
        const threeInARow =
          player12Partners[idx] === player12Partners[idx + 1] &&
          player12Partners[idx + 1] === player12Partners[idx + 2];
        expect(threeInARow).toBe(false);
      }
    }
  });

  it('Scenario 7: Live Retagging of Resting & Waiting Players + Sit-Out from Rest Pool', () => {
    // 10 players on 2 courts (2 waiting initially, restEnabled = true -> restCycleLength = 1)
    const bInit = ['B1', 'B2', 'B3', 'B4'];
    const iInit = ['I1', 'I2', 'I3', 'I4'];
    const aInit = ['A1', 'A2'];
    let allPlayers = [...bInit, ...iInit, ...aInit];
    let brackets = createBrackets(bInit, iInit, aInit);
    const defs = createCourtDefs(2);

    let state = initSkilledState(allPlayers, brackets, defs, []);
    let courtSlots = projectSkilledCourtsToSlots(state.courts);
    assertPartitionIntegrity(allPlayers, state, courtSlots);

    // Finish Court 0 so its 4 beginners move into restPool
    const finished = state.courts[0].players;
    state = rotatePlayers(finished, state, brackets);
    state = reassignCourt(state.courts[0].id, state, brackets);
    state = fillIdleCourts(state);
    courtSlots = projectSkilledCourtsToSlots(state.courts);
    assertPartitionIntegrity(allPlayers, state, courtSlots);

    // Confirm there is at least one resting player; retag one resting player to Advanced
    expect(state.restPool.length).toBeGreaterThan(0);
    const restingTarget = state.restPool[0].name;
    brackets = createBrackets(
      brackets.beginner.filter(n => n !== restingTarget),
      brackets.intermediate.filter(n => n !== restingTarget),
      [...brackets.advanced, restingTarget],
    );
    state = retagPlayerInQueue(restingTarget, 'advanced', state);
    assertPartitionIntegrity(allPlayers, state, projectSkilledCourtsToSlots(state.courts));
    expect(state.restPool.find(e => e.name === restingTarget)?.skillLevel).toBe('advanced');
    expect(state.waitingQueue).not.toContain(restingTarget);

    // Put another resting player (if present, else waiting player) onto Sit-Out and verify no duplication
    const secondTarget = state.restPool.find(e => e.name !== restingTarget)?.name ?? state.waitingQueue[0];
    state = {
      ...state,
      skillQueue: {
        beginner: state.skillQueue.beginner.filter(p => p !== secondTarget),
        intermediate: state.skillQueue.intermediate.filter(p => p !== secondTarget),
        advanced: state.skillQueue.advanced.filter(p => p !== secondTarget),
      },
      restPool: state.restPool.filter(e => e.name !== secondTarget),
      sitOut: [...state.sitOut, secondTarget],
    };
    state = {
      ...state,
      waitingQueue: [...state.skillQueue.beginner, ...state.skillQueue.intermediate, ...state.skillQueue.advanced],
    };
    state = recalculateRest(state, allPlayers.length - 1);
    assertPartitionIntegrity(allPlayers, state, projectSkilledCourtsToSlots(state.courts));

    // Attempt to retag a sitting-out player — must be a safe no-op
    state = retagPlayerInQueue(secondTarget, 'intermediate', state);
    assertPartitionIntegrity(allPlayers, state, projectSkilledCourtsToSlots(state.courts));

    // Open an idle 3rd court with 0 players, then check in 4 late arrivals so fillIdleCourts schedules a pure match
    state = {
      ...state,
      courts: [
        ...state.courts,
        { id: 'court-2', name: 'Court 3', players: [], skillMatch: 'pure', matchLevel: 'mixed', idleCycles: 0, earlyReturns: [] },
      ],
    };
    const lateArrivals = ['Late-A1', 'Late-A2', 'Late-A3', 'Late-A4'];
    allPlayers = [...allPlayers, ...lateArrivals];
    brackets = createBrackets(brackets.beginner, brackets.intermediate, [...brackets.advanced, ...lateArrivals]);
    for (const late of lateArrivals) {
      state = addPlayerToSkilledState(late, state, brackets);
    }
    state = recalculateRest(state, allPlayers.length - state.sitOut.length);
    state = fillIdleCourts(state);
    courtSlots = projectSkilledCourtsToSlots(state.courts);

    assertPartitionIntegrity(allPlayers, state, courtSlots);
    expect(state.courts[2].players).toHaveLength(4);
    for (const slot of courtSlots) {
      assertSnakeDraftPairing(slot.onCourt, brackets);
    }
  });

  interface MatchLogEntry {
    round: number;
    courtId: string;
    players: string[];
    skillMatch: 'pure' | 'mixed' | 'open';
    matchLevel: SkillLevel | 'mixed';
    iWaitingBeforePick: number;
  }

  function runClubNightSimulation(params: {
    brackets: { beginner: string[]; intermediate: string[]; advanced: string[] };
    courtCount: number;
    rounds: number;
    finishSequence?: number[];
  }): {
    state: SkilledState;
    playCounts: Record<string, number>;
    matchLog: MatchLogEntry[];
  } {
    const { brackets, courtCount, rounds } = params;
    const allPlayers = [...brackets.beginner, ...brackets.intermediate, ...brackets.advanced];
    const defs = createCourtDefs(courtCount);
    let state = initSkilledState(allPlayers, brackets, defs, []);
    let courtSlots = projectSkilledCourtsToSlots(state.courts);

    assertPartitionIntegrity(allPlayers, state, courtSlots);

    const playCounts = Object.fromEntries(allPlayers.map(p => [p, 0]));
    const matchLog: MatchLogEntry[] = [];
    const history: { players: string }[] = [];

    for (const court of state.courts) {
      if (court.players.length === 4) {
        assertSnakeDraftPairing(court.players, brackets);
        matchLog.push({
          round: 0,
          courtId: court.id,
          players: [...court.players],
          skillMatch: court.skillMatch,
          matchLevel: court.matchLevel,
          iWaitingBeforePick: 0,
        });
      }
    }

    const seq = params.finishSequence ?? Array.from({ length: courtCount }, (_, idx) => idx);
    for (let round = 1; round <= rounds; round++) {
      // Pick the requested active court (fallback to first populated court if idle)
      const preferredIdx = seq[(round - 1) % seq.length] % courtCount;
      const targetCourt = state.courts[preferredIdx].players.length === 4
        ? state.courts[preferredIdx]
        : state.courts.find(c => c.players.length === 4)!;
      expect(targetCourt.players).toHaveLength(4);

      targetCourt.players.forEach(p => { playCounts[p]++; });
      const teamA = targetCourt.players.slice(0, 2);
      const teamB = targetCourt.players.slice(2, 4);
      history.unshift({ players: `${teamA.join(' & ')} vs ${teamB.join(' & ')}` });

      const recentPartners = extractRecentPartnerPairs(history, 20);
      const afterRotate = rotatePlayers(targetCourt.players, state, brackets);
      const iWaitingBeforePick = afterRotate.skillQueue.intermediate.length;
      const afterReassign = reassignCourt(targetCourt.id, afterRotate, brackets, recentPartners);
      state = fillIdleCourts(afterReassign, recentPartners);
      courtSlots = projectSkilledCourtsToSlots(state.courts);

      assertPartitionIntegrity(allPlayers, state, courtSlots);
      for (const slot of courtSlots) {
        assertSnakeDraftPairing(slot.onCourt, brackets);
      }

      const assignedCourt = state.courts.find(c => c.id === targetCourt.id)!;
      if (assignedCourt.players.length === 4) {
        matchLog.push({
          round,
          courtId: assignedCourt.id,
          players: [...assignedCourt.players],
          skillMatch: assignedCourt.skillMatch,
          matchLevel: assignedCourt.matchLevel,
          iWaitingBeforePick,
        });
      }
    }

    return { state, playCounts, matchLog };
  }

  it('Scenario 8: Exact 30-Pro-Player Club Night (13 Beginner, 9 Intermediate, 8 Advanced on 3 Courts)', () => {
    const beginners = [
      'Callie Smith',
      'Jade Kawamoto',
      'Jackie Kawamoto',
      'Lucy Kovalova',
      'James Ignatowich',
      'Etta Wright',
      'Dekel Bar',
      'Hayden Patriquin',
      'Dylan Frazier',
      'Catherine Parenteau',
      'JW Johnson',
      'Jorja Johnson',
      'Gabriel Tardio',
    ];
    const intermediates = [
      'Lea Jansen',
      'Rachel Rohrabacher',
      'Anna Bright',
      'Quang Duong',
      'Connor Garnett',
      'Federico Staksrud',
      'Anna Leigh Waters',
      'Andrei Daescu',
      'Pablo Tellez',
    ];
    const advanced = [
      'Hurricane Tyra Black',
      'Thomas Wilson',
      'Collin Johns',
      'Tyson McGuffin',
      'Riley Newman',
      'Matt Wright',
      'Christian Alshon',
      'Ben Johns',
    ];
    const allPlayers = [...beginners, ...intermediates, ...advanced];
    const brackets = createBrackets(beginners, intermediates, advanced);

    // 1. Initial seeding spans all 3 brackets cleanly
    const initial = initSkilledState(allPlayers, brackets, createCourtDefs(3), []);
    expect(initial.courts.map(c => c.matchLevel)).toEqual(['beginner', 'intermediate', 'advanced']);
    expect(initial.courts.every(c => c.skillMatch === 'pure')).toBe(true);

    // 2. Simulate 30 staggered match completions across Courts 1, 2, 3
    const { playCounts, matchLog } = runClubNightSimulation({
      brackets,
      courtCount: 3,
      rounds: 30,
      finishSequence: [0, 1, 2, 0, 2, 1],
    });

    // All matches stay 100% pure within bracket (zero B+A or B+I+A leakage)
    expect(matchLog.every(m => m.skillMatch === 'pure')).toBe(true);

    // Track cumulative starts across the first 7 completions to confirm no bracket is starved
    const startedAtCompletion = new Set<string>();
    initial.courts.flatMap(c => c.players).forEach(p => startedAtCompletion.add(p));
    for (let r = 1; r <= 7; r++) {
      const entry = matchLog.find(m => m.round === r);
      entry?.players.forEach(p => startedAtCompletion.add(p));
      if (r === 3) {
        // All 8 Advanced players have stepped onto a court within 3 finishes
        expect(advanced.every(p => startedAtCompletion.has(p))).toBe(true);
      }
      if (r === 5) {
        // All 9 Intermediate players have stepped onto a court within 5 finishes
        expect(intermediates.every(p => startedAtCompletion.has(p))).toBe(true);
      }
    }
    // Every single one of the 30 players has played at least once within 7 finishes
    expect(startedAtCompletion.size).toBe(30);

    // Also test Court 1 finishing disproportionately fast (e.g. beginner games finish twice as fast)
    const fastC1 = runClubNightSimulation({
      brackets,
      courtCount: 3,
      rounds: 30,
      finishSequence: [0, 0, 1, 0, 2, 0, 1, 2],
    });
    expect(fastC1.matchLog.every(m => m.skillMatch === 'pure')).toBe(true);
    // Track running game counts: no Beginner reaches 3 completed games while an Advanced player is at 0
    const runningCounts = Object.fromEntries(allPlayers.map(p => [p, 0]));
    let replayState = initSkilledState(allPlayers, brackets, createCourtDefs(3), []);
    for (let r = 0; r < 30; r++) {
      const idx = [0, 0, 1, 0, 2, 0, 1, 2][r % 8];
      const c = replayState.courts[idx];
      c.players.forEach(p => { runningCounts[p]++; });
      replayState = fillIdleCourts(
        reassignCourt(c.id, rotatePlayers(c.players, replayState, brackets), brackets),
      );
      if (advanced.some(a => runningCounts[a] === 0)) {
        const maxBegGames = Math.max(...beginners.map(b => runningCounts[b]));
        expect(maxBegGames).toBeLessThan(3);
      }
    }

    // After 30 completed matches on staggered pattern, every player across all 30 played >= 3 games
    for (const player of allPlayers) {
      expect(playCounts[player]).toBeGreaterThanOrEqual(3);
    }
    for (const player of allPlayers) {
      expect(fastC1.playCounts[player]).toBeGreaterThanOrEqual(3);
    }
  });

  it('Scenario 9: Intensive Multi-Bracket Matrix (Asymmetric & Minority Brackets across 1, 2, and 3 Courts)', () => {
    const configs = [
      { label: '15B/10I/5A on 3 courts', bCount: 15, iCount: 10, aCount: 5, courts: 3, rounds: 100, minGames: 10 },
      { label: '18B/9I/3A on 3 courts', bCount: 18, iCount: 9, aCount: 3, courts: 3, rounds: 100, minGames: 10 },
      { label: '8B/6I/2A on 2 courts', bCount: 8, iCount: 6, aCount: 2, courts: 2, rounds: 80, minGames: 15 },
      { label: '6B/4I/2A on 1 court', bCount: 6, iCount: 4, aCount: 2, courts: 1, rounds: 60, minGames: 15 },
    ];

    for (const cfg of configs) {
      const b = Array.from({ length: cfg.bCount }, (_, i) => `B-${i + 1}`);
      const i = Array.from({ length: cfg.iCount }, (_, idx) => `I-${idx + 1}`);
      const a = Array.from({ length: cfg.aCount }, (_, idx) => `A-${idx + 1}`);
      const brackets = createBrackets(b, i, a);
      const { playCounts, matchLog } = runClubNightSimulation({
        brackets,
        courtCount: cfg.courts,
        rounds: cfg.rounds,
        finishSequence: cfg.courts === 3 ? [0, 2, 1, 0, 0, 2, 1] : cfg.courts === 2 ? [0, 1, 0, 0, 1] : [0],
      });

      // Every player in every bracket plays substantially without starvation
      for (const p of [...b, ...i, ...a]) {
        expect(playCounts[p], `${cfg.label}: player ${p} count`).toBeGreaterThanOrEqual(cfg.minGames);
      }

      // Whenever Intermediate players were waiting in skillQueue, B+A direct cross-bracket
      // skip without any Intermediate player must never occur
      for (const m of matchLog) {
        const hasB = m.players.some(p => p.startsWith('B-'));
        const hasA = m.players.some(p => p.startsWith('A-'));
        const hasI = m.players.some(p => p.startsWith('I-'));
        if (hasB && hasA && !hasI) {
          expect(m.iWaitingBeforePick, `${cfg.label} round ${m.round} skipped available I players`).toBe(0);
        }
      }
    }
  });

  it('Scenario 10: 10 Beginner / 12 Intermediate / 8 Advanced FIFO Return Order Integrity', () => {
    const beginners = [
      'Ben Johns', 'Tyson McGuffin', 'Jorja Johnson', 'Hayden Patriquin',
      'Quang Duong', 'Anna Bright', 'Rachel Rohrabacher', 'Gabriel Tardio',
      'Hurricane Tyra Black', 'Etta Wright',
    ];
    const intermediates = [
      'Federico Staksrud', 'Christian Alshon', 'Riley Newman', 'JW Johnson',
      'Dylan Frazier', 'Thomas Wilson', 'Collin Johns', 'James Ignatowich',
      'Andrei Daescu', 'Pablo Tellez', 'Jackie Kawamoto', 'Lucy Kovalova',
    ];
    const advanced = [
      'Matt Wright', 'Anna Leigh Waters', 'Catherine Parenteau', 'Connor Garnett',
      'Lea Jansen', 'Jade Kawamoto', 'Dekel Bar', 'Callie Smith',
    ];
    const allPlayers = [...beginners, ...intermediates, ...advanced];
    const brackets = createBrackets(beginners, intermediates, advanced);

    // Run both standard round-robin finishes and the exact 14-finish sequence from user session
    const sequences = [
      [2, 1, 0, 0, 1, 2, 1, 0, 2, 0, 1, 2, 1, 0],
      [0, 1, 2, 0, 2, 1, 0, 0, 1, 2],
    ];

    for (const seq of sequences) {
      let state = initSkilledState(allPlayers, brackets, createCourtDefs(3), []);
      const gp = Object.fromEntries(allPlayers.map(p => [p, 0]));
      const history: { players: string }[] = [];
      let begMatchesCompleted = 0;

      for (let round = 0; round < 30; round++) {
        const idx = seq[round % seq.length];
        const court = state.courts[idx];
        expect(court.players).toHaveLength(4);
        expect(court.skillMatch).toBe('pure');

        court.players.forEach(p => { gp[p]++; });
        if (court.players.every(p => beginners.includes(p))) {
          begMatchesCompleted += 1;
        }

        const teamA = court.players.slice(0, 2);
        const teamB = court.players.slice(2, 4);
        history.unshift({ players: `${teamA.join(' & ')} vs ${teamB.join(' & ')}` });

        const recentPartners = extractRecentPartnerPairs(history, 20);
        const afterRotate = rotatePlayers(court.players, state, brackets);
        const afterReassign = reassignCourt(court.id, afterRotate, brackets, recentPartners);
        state = fillIdleCourts(afterReassign, recentPartners);

        assertPartitionIntegrity(allPlayers, state, projectSkilledCourtsToSlots(state.courts));

        // Within each pure bracket, spread between most-played and least-played must never exceed 1
        for (const group of [beginners, intermediates, advanced]) {
          const counts = group.map(p => gp[p]);
          expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
        }

        // Right after 5 Beginner matches (20 player-slots for 10 Beginners), every Beginner has 2 GP
        if (begMatchesCompleted === 5 && court.players.every(p => beginners.includes(p))) {
          for (const b of beginners) {
            expect(gp[b]).toBe(2);
          }
        }
      }

      // Confirm 5th Beginner match was reached during the 30-round run
      expect(begMatchesCompleted).toBeGreaterThanOrEqual(5);
    }
  });

  it('Scenario 11: 5 Simultaneous 30-Player Rooms (1,000 Interleaved Matches) + Mid-Session Chaos Soak', () => {
    // ── Part A: 5 independent 30-player rooms × 200 interleaved rounds (1,000 matches) ──
    const roomSpecs = [
      { id: 'R1', bCount: 13, iCount: 9, aCount: 8 },
      { id: 'R2', bCount: 10, iCount: 12, aCount: 8 },
      { id: 'R3', bCount: 15, iCount: 10, aCount: 5 },
      { id: 'R4', bCount: 8, iCount: 14, aCount: 8 },
      { id: 'R5', bCount: 12, iCount: 10, aCount: 8 },
    ];

    const rooms = roomSpecs.map((spec) => {
      const b = Array.from({ length: spec.bCount }, (_, idx) => `${spec.id}-B${idx + 1}`);
      const i = Array.from({ length: spec.iCount }, (_, idx) => `${spec.id}-I${idx + 1}`);
      const a = Array.from({ length: spec.aCount }, (_, idx) => `${spec.id}-A${idx + 1}`);
      const roster = [...b, ...i, ...a];
      const br = createBrackets(b, i, a);
      const st = initSkilledState(roster, br, createCourtDefs(3), []);
      return {
        id: spec.id,
        roster,
        brackets: br,
        state: st,
        playCounts: Object.fromEntries(roster.map(p => [p, 0])),
        history: [] as { players: string }[],
      };
    });

    const courtOrder = [0, 2, 1, 0, 1, 2];
    for (let round = 0; round < 200; round++) {
      for (const room of rooms) {
        const idx = courtOrder[(round + room.id.charCodeAt(1)) % courtOrder.length];
        const targetCourt = room.state.courts[idx];
        expect(targetCourt.players).toHaveLength(4);

        targetCourt.players.forEach(p => { room.playCounts[p]++; });
        const teamA = targetCourt.players.slice(0, 2);
        const teamB = targetCourt.players.slice(2, 4);
        room.history.unshift({ players: `${teamA.join(' & ')} vs ${teamB.join(' & ')}` });

        const recentPartners = extractRecentPartnerPairs(room.history, 20);
        const afterRotate = rotatePlayers(targetCourt.players, room.state, room.brackets);
        const afterReassign = reassignCourt(targetCourt.id, afterRotate, room.brackets, recentPartners);
        room.state = fillIdleCourts(afterReassign, recentPartners);

        const slots = projectSkilledCourtsToSlots(room.state.courts);
        assertPartitionIntegrity(room.roster, room.state, slots);
        for (const slot of slots) {
          assertSnakeDraftPairing(slot.onCourt, room.brackets);
          // Cross-room isolation check: every player belongs strictly to this room
          for (const p of slot.onCourt) {
            expect(p.startsWith(`${room.id}-`)).toBe(true);
          }
        }
      }
    }

    // With ~1/3 of 200 matches per bracket, every player across all 5 rooms plays >= 16 games
    // with tight intra-bracket FIFO parity (spread <= 3).
    for (const room of rooms) {
      for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
        const pool = room.brackets[level];
        const counts = pool.map(p => room.playCounts[p]);
        expect(Math.min(...counts), `${room.id} ${level} min`).toBeGreaterThanOrEqual(16);
        expect(Math.max(...counts) - Math.min(...counts), `${room.id} ${level} spread`).toBeLessThanOrEqual(3);
      }
    }

    // ── Part B: Mid-session Chaos Soak (150 rounds with live mutations up to 30 players) ──
    const initB = Array.from({ length: 6 }, (_, i) => `Chaos-B${i + 1}`);
    const initI = Array.from({ length: 6 }, (_, i) => `Chaos-I${i + 1}`);
    const initA = Array.from({ length: 4 }, (_, i) => `Chaos-A${i + 1}`);
    const chaosRoster = [...initB, ...initI, ...initA];
    let chaosBrackets = createBrackets(initB, initI, initA);
    let chaosState = initSkilledState(chaosRoster, chaosBrackets, createCourtDefs(2), []);
    const chaosHistory: { players: string }[] = [];
    let walkInIdx = 0;

    for (let round = 1; round <= 150; round++) {
      // Periodic walk-in arrivals up to 30 total players
      if (round % 10 === 0 && chaosRoster.length < 30) {
        const tier: SkillLevel = (['beginner', 'intermediate', 'advanced'] as const)[walkInIdx % 3];
        walkInIdx += 1;
        const name = `Chaos-WalkIn-${walkInIdx}`;
        chaosRoster.push(name);
        chaosBrackets = createBrackets(
          tier === 'beginner' ? [...chaosBrackets.beginner, name] : chaosBrackets.beginner,
          tier === 'intermediate' ? [...chaosBrackets.intermediate, name] : chaosBrackets.intermediate,
          tier === 'advanced' ? [...chaosBrackets.advanced, name] : chaosBrackets.advanced,
        );
        chaosState = addPlayerToSkilledState(name, chaosState, chaosBrackets);
        chaosState = recalculateRest(chaosState, chaosRoster.length - chaosState.sitOut.length);
      }

      // Expand from 2 courts to 3 courts once enough active players exist
      if (round === 25 && chaosState.courts.length === 2) {
        chaosState = {
          ...chaosState,
          courts: [
            ...chaosState.courts,
            { id: 'court-2', name: 'Court 3', players: [], skillMatch: 'pure', matchLevel: 'mixed', idleCycles: 0, earlyReturns: [] },
          ],
        };
        chaosState = fillIdleCourts(chaosState);
      }

      // Toggle a waiting player onto break, or bring one back from break
      if (round % 15 === 5) {
        if (chaosState.sitOut.length < 2 && chaosState.waitingQueue.length > 0) {
          const target = chaosState.waitingQueue[0];
          const nextSq = {
            beginner: chaosState.skillQueue.beginner.filter(p => p !== target),
            intermediate: chaosState.skillQueue.intermediate.filter(p => p !== target),
            advanced: chaosState.skillQueue.advanced.filter(p => p !== target),
          };
          const nextSitOut = [...chaosState.sitOut, target];
          chaosState = {
            ...chaosState,
            skillQueue: nextSq,
            waitingQueue: [...nextSq.beginner, ...nextSq.intermediate, ...nextSq.advanced],
            sitOut: nextSitOut,
          };
          chaosState = recalculateRest(chaosState, chaosRoster.length - nextSitOut.length);
        } else if (chaosState.sitOut.length > 0) {
          const returning = chaosState.sitOut[0];
          chaosState = { ...chaosState, sitOut: chaosState.sitOut.slice(1) };
          chaosState = addPlayerToSkilledState(returning, chaosState, chaosBrackets);
          chaosState = recalculateRest(chaosState, chaosRoster.length - chaosState.sitOut.length);
        }
      }

      // Retag a non-court, non-sit-out waiting or resting player and keep brackets synced
      if (round % 14 === 7) {
        const retagCandidate = chaosState.waitingQueue[0] ?? chaosState.restPool[0]?.name;
        if (retagCandidate && !chaosState.sitOut.includes(retagCandidate)) {
          const curLevel = getPlayerLevel(retagCandidate, chaosBrackets);
          const nextLevel: SkillLevel = curLevel === 'beginner'
            ? 'intermediate'
            : curLevel === 'intermediate'
              ? 'advanced'
              : 'beginner';
          chaosBrackets = createBrackets(
            nextLevel === 'beginner'
              ? [...chaosBrackets.beginner.filter(p => p !== retagCandidate), retagCandidate]
              : chaosBrackets.beginner.filter(p => p !== retagCandidate),
            nextLevel === 'intermediate'
              ? [...chaosBrackets.intermediate.filter(p => p !== retagCandidate), retagCandidate]
              : chaosBrackets.intermediate.filter(p => p !== retagCandidate),
            nextLevel === 'advanced'
              ? [...chaosBrackets.advanced.filter(p => p !== retagCandidate), retagCandidate]
              : chaosBrackets.advanced.filter(p => p !== retagCandidate),
          );
          chaosState = retagPlayerInQueue(retagCandidate, nextLevel, chaosState);
        }
      }

      // Simulate browser reload / crash recovery mid-session every 40 rounds
      if (round % 40 === 0) {
        const preReloadSlots = projectSkilledCourtsToSlots(chaosState.courts);
        chaosState = hydrateSkilledStateFromCourtSlots(chaosRoster, chaosBrackets, preReloadSlots, chaosState.sitOut);
        expect(projectSkilledCourtsToSlots(chaosState.courts)).toEqual(preReloadSlots);
      }

      // Complete a live court match
      const liveCourt = chaosState.courts[(round - 1) % chaosState.courts.length];
      if (liveCourt.players.length === 4) {
        const teamA = liveCourt.players.slice(0, 2);
        const teamB = liveCourt.players.slice(2, 4);
        chaosHistory.unshift({ players: `${teamA.join(' & ')} vs ${teamB.join(' & ')}` });

        const recentPartners = extractRecentPartnerPairs(chaosHistory, 20);
        const afterRotate = rotatePlayers(liveCourt.players, chaosState, chaosBrackets);
        const afterReassign = reassignCourt(liveCourt.id, afterRotate, chaosBrackets, recentPartners);
        chaosState = fillIdleCourts(afterReassign, recentPartners);
      } else {
        chaosState = fillIdleCourts(chaosState);
      }

      const slots = projectSkilledCourtsToSlots(chaosState.courts);
      assertPartitionIntegrity(chaosRoster, chaosState, slots);
      for (const slot of slots) {
        if (slot.onCourt.length === 4) {
          assertSnakeDraftPairing(slot.onCourt, chaosBrackets);
        }
      }
    }

    expect(chaosRoster).toHaveLength(30);
    expect(chaosState.courts).toHaveLength(3);
  });
});
