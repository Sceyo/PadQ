import { describe, expect, it } from 'vitest';
import {
  accountPlayers,
  toggleSitOutTransition,
  removeFromQueueTransition,
  confirmSubTransition,
  replaceCalledPlayerTransition,
  consumePriority,
  checkPaddleStateConsistency,
  type QueueTransitionSnapshot,
} from '@/app/queue/lib/queueTransitions';
import { planMultiCourtResult } from '@/app/queue/lib/multiCourtResult';
import {
  seedMultiCourtDoubles,
  freshPaddleState,
  advancePaddleState,
  addPlayerToWaiting,
  assertPaddleStateConsistent,
  type Team,
} from '@/app/queue/lib/doublesEngine';
import {
  freshSinglesState,
  advanceSinglesState,
  addPlayerToSinglesWaiting,
} from '@/app/queue/lib/singleEngine';
import {
  freshPoolSinglesState,
  advancePoolSinglesState,
  addPlayerToPoolSinglesWaiting,
  assertPoolSinglesStateConsistent,
} from '@/app/queue/lib/singlesPoolEngine';

// Seeded PRNG (Mulberry32) for deterministic property testing
function createPrng(seed: number) {
  let s = seed >>> 0;
  return function next() {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Strict set-based partition check.
 * Asserts disjointness and completeness: every player in players must appear
 * in exactly one zone (onCourt, queued, or onBreak).
 * Cannot be fooled by cancellation (+1 missing and +1 duplicate).
 */
function assertSetPartition(
  accounting: ReturnType<typeof accountPlayers>,
  players: string[],
) {
  const queuedSet = new Set(accounting.queued);
  const breakSet = new Set(accounting.onBreak);

  // 1. Disjointness: no player in more than one zone
  for (const p of accounting.onCourt) {
    if (queuedSet.has(p)) throw new Error(`Disjoint violation: ${p} in onCourt AND queued`);
    if (breakSet.has(p)) throw new Error(`Disjoint violation: ${p} in onCourt AND onBreak`);
  }
  for (const p of accounting.queued) {
    if (breakSet.has(p)) throw new Error(`Disjoint violation: ${p} in queued AND onBreak`);
  }

  // 2. Completeness: all players in players are in exactly one zone
  const union = new Set([...accounting.onCourt, ...accounting.queued, ...accounting.onBreak]);
  const playerSet = new Set(players);
  expect(union).toEqual(playerSet);

  // 3. Accounting selector fields
  expect(accounting.missing).toEqual([]);
  expect(accounting.duplicates).toEqual([]);
}

describe('playerAccounting — fundamental partition invariant', () => {
  it('cleanly partitions a single-court doubles session into onCourt(4) + queued(N-4) + onBreak(0)', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8'];
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players,
      queue: [...players],
      sittingOut: [],
    };
    const accounting = accountPlayers(snapshot);
    expect(accounting.onCourt).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(accounting.queued).toEqual(['P5', 'P6', 'P7', 'P8']);
    expect(accounting.onBreak).toEqual([]);
    assertSetPartition(accounting, players);
  });

  it('cleanly partitions a multi-court doubles session into onCourt(4*C) + queued + onBreak', () => {
    const players = Array.from({ length: 16 }, (_, i) => `P${i + 1}`);
    const seeded = seedMultiCourtDoubles(players, 2, []);
    const courtSlots = seeded.courts.map((onCourt, i) => ({
      id: `court-${i}`,
      name: `Court ${i + 1}`,
      onCourt,
    }));

    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players,
      queue: seeded.waiting,
      courtSlots,
      sittingOut: [],
    };
    const accounting = accountPlayers(snapshot);
    expect(accounting.onCourt).toHaveLength(8);
    expect(accounting.queued).toHaveLength(8);
    expect(accounting.onBreak).toHaveLength(0);
    assertSetPartition(accounting, players);
  });

  it('detects a player who is on break', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players,
      queue: ['P1', 'P2', 'P3', 'P4', 'P6'],
      sittingOut: ['P5'],
    };
    const accounting = accountPlayers(snapshot);
    expect(accounting.onBreak).toEqual(['P5']);
    expect(accounting.queued).toEqual(['P6']);
    assertSetPartition(accounting, players);
  });

  it('ManualQueuePanel removal moves player to sittingOut (on break), preserving accounting (Row 11 fix)', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players,
      queue: [...players],
      sittingOut: [],
    };
    // Host removes index 5 (P6) via manual queue panel X
    const removed = removeFromQueueTransition(snapshot, 5);
    expect(removed.queue).not.toContain('P6');
    expect(removed.sittingOut).toContain('P6');

    const accounting = accountPlayers({
      ...snapshot,
      queue: removed.queue,
      sittingOut: removed.sittingOut,
    });
    expect(accounting.missing).toEqual([]);
    expect(accounting.onBreak).toContain('P6');
    assertSetPartition(accounting, players);
  });

  it('finisher in sittingOut is not duplicated into queue by planMultiCourtResult (Row 8 fix)', () => {
    const players = ['A1', 'A2', 'B1', 'B2', 'Q1', 'Q2', 'Q3', 'Q4'];
    const courtSlots = [
      { id: 'court-0', name: 'Court 1', onCourt: ['A1', 'A2', 'B1', 'B2'] },
    ];
    // A1 sits out while on court
    const sittingOut = ['A1'];
    const plan = planMultiCourtResult(
      { queue: ['Q1', 'Q2', 'Q3', 'Q4'], courtSlots, sittingOut },
      'court-0',
      ['A1', 'A2', 'B1', 'B2'],
      'A',
      'doubles',
    );
    expect(plan).not.toBeNull();

    // A1 is in sittingOut, so plan.queue must NOT contain A1
    expect(plan!.queue).not.toContain('A1');

    const accounting = accountPlayers({
      gameMode: 'doubles',
      players,
      queue: plan!.queue,
      courtSlots: plan!.courtSlots,
      sittingOut,
    });
    expect(accounting.duplicates).toEqual([]);
    expect(accounting.missing).toEqual([]);
    expect(accounting.onBreak).toContain('A1');
    assertSetPartition(accounting, players);
  });

  it('confirms player substitute transition and validates accounting', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const snapshot = {
      gameMode: 'doubles' as const,
      players,
      queue: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
      sittingOut: [],
    };
    // Substitute P2 with P5
    const res = confirmSubTransition(snapshot, 'P2', 'P5');
    expect(res).not.toBeNull();
    const accounting = accountPlayers({
      ...snapshot,
      queue: res!.queue,
      sittingOut: res!.sittingOut,
    });
    expect(accounting.onBreak).toContain('P2');
    assertSetPartition(accounting, players);
  });
});

describe('playerAccounting — widened seeded PRNG random walk', () => {
  const SEEDS = [20261022, 424242, 987654321];
  const ITERATIONS = 300;
  const MAX_COURTS = 3;
  const MAX_PLAYERS = 30;

  for (const seed of SEEDS) {
    it(`maintains set partition invariant across ${ITERATIONS} actions with 3 courts & up to 30 players (seed: ${seed})`, () => {
      const rng = createPrng(seed);

      // Start with 18 players on 3 courts (12 on court, 6 waiting)
      let players = Array.from({ length: 18 }, (_, i) => `P${i + 1}`);
      const seeded = seedMultiCourtDoubles(players, MAX_COURTS, []);
      let courtSlots = seeded.courts.map((onCourt, i) => ({
        id: `court-${i}`,
        name: `Court ${i + 1}`,
        onCourt: [...onCourt],
      }));
      let queue = [...seeded.waiting];
      let sittingOut: string[] = [];
      let lateCounter = 19;

      for (let step = 0; step < ITERATIONS; step++) {
        const roll = rng();

        if (roll < 0.40) {
          // Action 1: Match completes on random court
          const courtIdx = Math.floor(rng() * MAX_COURTS);
          const court = courtSlots[courtIdx];
          const winnerSide = rng() < 0.5 ? 'A' : 'B';

          const plan = planMultiCourtResult(
            { queue, courtSlots, sittingOut },
            court.id,
            court.onCourt,
            winnerSide,
            'doubles',
          );

          if (plan) {
            queue = plan.queue;
            courtSlots = plan.courtSlots;
          }
        } else if (roll < 0.60) {
          // Action 2: Waiting player toggles sit-out
          const onCourtSet = new Set(courtSlots.flatMap(c => c.onCourt));
          const toggleable = players.filter(p => !onCourtSet.has(p));

          if (toggleable.length > 0) {
            const chosen = toggleable[Math.floor(rng() * toggleable.length)];
            const res = toggleSitOutTransition(
              { gameMode: 'doubles', players, queue, courtSlots, sittingOut },
              chosen,
            );
            queue = res.queue;
            sittingOut = res.sittingOut;
          }
        } else if (roll < 0.75) {
          // Action 3: Confirm substitute between two waiting players
          const onCourtSet = new Set(courtSlots.flatMap(c => c.onCourt));
          const waitingQueuePlayers = queue.filter(p => !onCourtSet.has(p) && !sittingOut.includes(p));

          if (waitingQueuePlayers.length >= 2) {
            const absentIdx = Math.floor(rng() * waitingQueuePlayers.length);
            const repIdx = (absentIdx + 1) % waitingQueuePlayers.length;
            const absent = waitingQueuePlayers[absentIdx];
            const replacement = waitingQueuePlayers[repIdx];

            const res = confirmSubTransition(
              { gameMode: 'doubles', players, queue, courtSlots, sittingOut },
              absent,
              replacement,
            );
            if (res) {
              queue = res.queue;
              sittingOut = res.sittingOut;
            }
          }
        } else if (roll < 0.88) {
          // Action 4: Host removes waiting player via ManualQueuePanel X (moves to break)
          const onCourtSet = new Set(courtSlots.flatMap(c => c.onCourt));
          const waitingQueueIndices = queue
            .map((p, idx) => ({ p, idx }))
            .filter(({ p }) => !onCourtSet.has(p) && !sittingOut.includes(p));

          if (waitingQueueIndices.length > 0) {
            const target = waitingQueueIndices[Math.floor(rng() * waitingQueueIndices.length)];
            const res = removeFromQueueTransition(
              { gameMode: 'doubles', players, queue, courtSlots, sittingOut },
              target.idx,
            );
            queue = res.queue;
            sittingOut = res.sittingOut;
          }
        } else {
          // Action 5: Late player check-in up to MAX_PLAYERS (30)
          if (players.length < MAX_PLAYERS) {
            const newPlayer = `P${lateCounter++}`;
            players = [...players, newPlayer];
            queue = [...queue, newPlayer];
          }
        }

        // Strict set partition verification at every single step
        const accounting = accountPlayers({
          gameMode: 'doubles',
          players,
          queue,
          courtSlots,
          sittingOut,
        });

        try {
          assertSetPartition(accounting, players);
        } catch (err) {
          console.error(`Invariant broken at step ${step} with seed ${seed}`);
          throw err;
        }
      }
    });
  }

  // Phase 1 verification tests (flipped from it.fails)
  it('random walk including removeFromQueueTransition preserves set partition (Row 11 fixed)', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players,
      queue: [...players],
      sittingOut: [],
    };
    // Host clicks X on player P3 (index 2) via ManualQueuePanel -> moves to sittingOut
    const res = removeFromQueueTransition(snapshot, 2);
    const accounting = accountPlayers({
      ...snapshot,
      queue: res.queue,
      sittingOut: res.sittingOut,
    });
    // Set partition preserved cleanly!
    assertSetPartition(accounting, players);
  });

  it('sitting-out finisher in planMultiCourtResult maintains set partition (Row 8 fixed)', () => {
    const players = ['A1', 'A2', 'B1', 'B2', 'Q1', 'Q2', 'Q3', 'Q4'];
    const courtSlots = [
      { id: 'court-0', name: 'Court 1', onCourt: ['A1', 'A2', 'B1', 'B2'] },
    ];
    // A1 sits out while on court
    const sittingOut = ['A1'];
    const plan = planMultiCourtResult(
      { queue: ['Q1', 'Q2', 'Q3', 'Q4'], courtSlots, sittingOut },
      'court-0',
      ['A1', 'A2', 'B1', 'B2'],
      'A',
      'doubles',
    );
    expect(plan).not.toBeNull();

    const accounting = accountPlayers({
      gameMode: 'doubles',
      players,
      queue: plan!.queue,
      courtSlots: plan!.courtSlots,
      sittingOut,
    });
    // Set partition preserved cleanly without duplication!
    assertSetPartition(accounting, players);
  });

  it('replaceCalledPlayerTransition preserves set partition when substituting on-court player (Phase 4)', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'W1', 'W2', 'W3'];
    const courtSlots = [
      { id: 'court-0', name: 'Court 1', onCourt: ['P1', 'P2', 'P3', 'P4'] },
    ];
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players,
      queue: ['W1', 'W2', 'W3'],
      courtSlots,
      sittingOut: [],
    };

    // Replace P2 on court with W2
    const res = replaceCalledPlayerTransition(snapshot, 'P2', 'W2');
    expect(res).not.toBeNull();

    const accounting = accountPlayers({
      gameMode: 'doubles',
      players,
      queue: res!.queue,
      courtSlots: res!.courtSlots,
      sittingOut: res!.sittingOut,
    });

    assertSetPartition(accounting, players);
    expect(accounting.onCourt).toContain('W2');
    expect(accounting.onBreak).toContain('P2');
    expect(accounting.queued).toEqual(['W1', 'W3']);
  });
});

describe('playerAccounting — widened random walks across modes (Phase 5c Part C4)', () => {
  const SEEDS = [20261023, 777777, 123456789];
  const ITERATIONS = 300;

  for (const seed of SEEDS) {
    it(`single-court doubles: maintains set partition, pool consistency, and priority invariants across ${ITERATIONS} actions (seed: ${seed})`, () => {
      const rng = createPrng(seed);
      let players = Array.from({ length: 10 }, (_, i) => `P${i + 1}`);
      let queue = [...players];
      let sittingOut: string[] = [];
      let priorityPlayers: string[] = [];
      let paddleState = freshPaddleState();
      let lateCounter = 11;

      for (let step = 0; step < ITERATIONS; step++) {
        const roll = rng();
        const activePlayers = players.filter(p => !sittingOut.includes(p));

        if (roll < 0.45 && activePlayers.length >= 4 && queue.length >= 4) {
          // Action 1: Match completes
          const onCourt = queue.slice(0, 4);
          const teamA: Team = [onCourt[0], onCourt[1]];
          const teamB: Team = [onCourt[2], onCourt[3]];
          const winnerA = rng() < 0.5;
          const winnerTeam = winnerA ? teamA : teamB;
          const loserTeam = winnerA ? teamB : teamA;

          const res = advancePaddleState(
            paddleState,
            winnerTeam,
            loserTeam,
            activePlayers,
            {},
            priorityPlayers,
          );
          paddleState = res.nextState;
          queue = res.newQueue;
          priorityPlayers = consumePriority(priorityPlayers, [...onCourt, ...queue.slice(0, 4)]);
        } else if (roll < 0.68) {
          // Action 2: Waiting or on-break player toggles sit-out
          const onCourtSet = new Set(queue.slice(0, 4));
          const toggleable = players.filter(p => !onCourtSet.has(p));
          if (toggleable.length > 0) {
            const chosen = toggleable[Math.floor(rng() * toggleable.length)];
            const res = toggleSitOutTransition(
              {
                gameMode: 'doubles',
                players,
                queue,
                sittingOut,
                priorityPlayers,
                paddleState,
              },
              chosen,
            );
            queue = res.queue;
            sittingOut = res.sittingOut;
            priorityPlayers = res.priorityPlayers ?? [];
            if (res.paddleState) paddleState = res.paddleState;
          }
        } else if (roll < 0.88 && queue.length >= 5) {
          // Action 3: Replace called player on court
          const onCourt = queue.slice(0, 4);
          const target = onCourt[Math.floor(rng() * onCourt.length)];
          const res = replaceCalledPlayerTransition(
            {
              gameMode: 'doubles',
              players,
              queue,
              sittingOut,
              priorityPlayers,
              paddleState,
            },
            target,
          );
          if (res) {
            queue = res.queue;
            sittingOut = res.sittingOut;
            priorityPlayers = res.priorityPlayers ?? [];
            if (res.paddleState) paddleState = res.paddleState;
          }
        } else if (players.length < 30) {
          // Action 4: Late player check-in with newcomer priority
          const newP = `P${lateCounter++}`;
          players = [...players, newP];
          queue = [...queue, newP];
          priorityPlayers = [...priorityPlayers, newP];
          paddleState = addPlayerToWaiting(paddleState, newP);
        }

        // Verify fundamental invariants at every step
        const accounting = accountPlayers({
          gameMode: 'doubles',
          players,
          queue,
          sittingOut,
        });
        assertSetPartition(accounting, players);

        const consistency = checkPaddleStateConsistency(paddleState, players, sittingOut);
        expect(consistency.valid).toBe(true);
        const currentActive = players.filter(p => !sittingOut.includes(p));
        expect(() => assertPaddleStateConsistent(paddleState, currentActive)).not.toThrow();

        // Priority invariant: priorityPlayers must be a subset of queued
        const queuedSet = new Set(accounting.queued);
        for (const prio of priorityPlayers) {
          expect(queuedSet.has(prio)).toBe(true);
        }
      }
    });

    it(`single-court King singles: maintains set partition and priority invariants across ${ITERATIONS} actions (seed: ${seed})`, () => {
      const rng = createPrng(seed);
      let players = Array.from({ length: 7 }, (_, i) => `S${i + 1}`);
      let singlesState = freshSinglesState(players);
      let queue = [...players];
      let sittingOut: string[] = [];
      let priorityPlayers: string[] = [];
      let lateCounter = 8;

      for (let step = 0; step < ITERATIONS; step++) {
        const roll = rng();
        const activePlayers = players.filter(p => !sittingOut.includes(p));

        if (roll < 0.45 && activePlayers.length >= 2 && queue.length >= 2) {
          const [p1, p2] = [queue[0], queue[1]];
          const winner = rng() < 0.5 ? p1 : p2;
          const res = advanceSinglesState(singlesState, winner, activePlayers, priorityPlayers);
          singlesState = res.nextState;
          queue = res.newQueue;
          priorityPlayers = consumePriority(priorityPlayers, [p1, p2, ...queue.slice(0, 2)]);
        } else if (roll < 0.70) {
          const onCourtSet = new Set(queue.slice(0, 2));
          const toggleable = players.filter(p => !onCourtSet.has(p));
          if (toggleable.length > 0) {
            const chosen = toggleable[Math.floor(rng() * toggleable.length)];
            const wasSittingOut = sittingOut.includes(chosen);
            const res = toggleSitOutTransition(
              {
                gameMode: 'singles',
                singlesFormat: 'king',
                players,
                queue,
                sittingOut,
                priorityPlayers,
                singlesState,
              },
              chosen,
            );
            queue = res.queue;
            sittingOut = res.sittingOut;
            priorityPlayers = res.priorityPlayers ?? [];
            if (res.singlesState) singlesState = res.singlesState;

            if (wasSittingOut && singlesState.queue.length > 0) {
              expect(singlesState.queue[0]).toBe(chosen);
            }
          }
        } else if (roll < 0.88 && queue.length >= 3) {
          const target = queue[rng() < 0.5 ? 0 : 1];
          const res = replaceCalledPlayerTransition(
            {
              gameMode: 'singles',
              singlesFormat: 'king',
              players,
              queue,
              sittingOut,
              priorityPlayers,
              singlesState,
            },
            target,
          );
          if (res) {
            queue = res.queue;
            sittingOut = res.sittingOut;
            priorityPlayers = res.priorityPlayers ?? [];
            if (res.singlesState) singlesState = res.singlesState;
          }
        } else if (players.length < 25) {
          const newP = `S${lateCounter++}`;
          players = [...players, newP];
          queue = [...queue, newP];
          priorityPlayers = [...priorityPlayers, newP];
          singlesState = addPlayerToSinglesWaiting(singlesState, newP, true);
        }

        const accounting = accountPlayers({
          gameMode: 'singles',
          singlesFormat: 'king',
          players,
          queue,
          sittingOut,
        });
        assertSetPartition(accounting, players);

        const queuedSet = new Set(accounting.queued);
        for (const prio of priorityPlayers) {
          expect(queuedSet.has(prio)).toBe(true);
        }
      }
    });

    it(`single-court pool singles: maintains set partition, pool consistency, and priority invariants across ${ITERATIONS} actions (seed: ${seed})`, () => {
      const rng = createPrng(seed);
      let players = Array.from({ length: 8 }, (_, i) => `PS${i + 1}`);
      let poolState = freshPoolSinglesState();
      let queue = [...players];
      let sittingOut: string[] = [];
      let priorityPlayers: string[] = [];
      let lateCounter = 9;

      for (let step = 0; step < ITERATIONS; step++) {
        const roll = rng();
        const activePlayers = players.filter(p => !sittingOut.includes(p));

        if (roll < 0.45 && activePlayers.length >= 2 && queue.length >= 2) {
          const [p1, p2] = [queue[0], queue[1]];
          const winner = rng() < 0.5 ? p1 : p2;
          const loser = winner === p1 ? p2 : p1;
          const res = advancePoolSinglesState(poolState, winner, loser, activePlayers, {}, priorityPlayers);
          poolState = res.nextState;
          queue = res.newQueue;
          priorityPlayers = consumePriority(priorityPlayers, [p1, p2, ...queue.slice(0, 2)]);
        } else if (roll < 0.70) {
          const onCourtSet = new Set(queue.slice(0, 2));
          const toggleable = players.filter(p => !onCourtSet.has(p));
          if (toggleable.length > 0) {
            const chosen = toggleable[Math.floor(rng() * toggleable.length)];
            const res = toggleSitOutTransition(
              {
                gameMode: 'singles',
                singlesFormat: 'pool',
                players,
                queue,
                sittingOut,
                priorityPlayers,
                poolSinglesState: poolState,
              },
              chosen,
            );
            queue = res.queue;
            sittingOut = res.sittingOut;
            priorityPlayers = res.priorityPlayers ?? [];
            if (res.poolSinglesState) poolState = res.poolSinglesState;
          }
        } else if (roll < 0.88 && queue.length >= 3) {
          const target = queue[rng() < 0.5 ? 0 : 1];
          const res = replaceCalledPlayerTransition(
            {
              gameMode: 'singles',
              singlesFormat: 'pool',
              players,
              queue,
              sittingOut,
              priorityPlayers,
              poolSinglesState: poolState,
            },
            target,
          );
          if (res) {
            queue = res.queue;
            sittingOut = res.sittingOut;
            priorityPlayers = res.priorityPlayers ?? [];
            if (res.poolSinglesState) poolState = res.poolSinglesState;
          }
        } else if (players.length < 25) {
          const newP = `PS${lateCounter++}`;
          players = [...players, newP];
          queue = [...queue, newP];
          priorityPlayers = [...priorityPlayers, newP];
          poolState = addPlayerToPoolSinglesWaiting(poolState, newP, true);
        }

        const accounting = accountPlayers({
          gameMode: 'singles',
          singlesFormat: 'pool',
          players,
          queue,
          sittingOut,
        });
        assertSetPartition(accounting, players);
        const currentActive = players.filter(p => !sittingOut.includes(p));
        expect(() => assertPoolSinglesStateConsistent(poolState, currentActive)).not.toThrow();

        const queuedSet = new Set(accounting.queued);
        for (const prio of priorityPlayers) {
          expect(queuedSet.has(prio)).toBe(true);
        }
      }
    });

    it(`multi-court doubles with locked pairs: maintains partition and priority invariants across ${ITERATIONS} actions (seed: ${seed})`, () => {
      const rng = createPrng(seed);
      let players = Array.from({ length: 16 }, (_, i) => `M${i + 1}`);
      const numCourts = 3;
      const lockedPartners: [string, string][] = [['M1', 'M2'], ['M3', 'M4']];
      const seeded = seedMultiCourtDoubles(players, numCourts, lockedPartners);
      let courtSlots = seeded.courts.map((onCourt, i) => ({
        id: `court-${i}`,
        name: `Court ${i + 1}`,
        onCourt,
      }));
      let queue = [...seeded.waiting];
      let sittingOut: string[] = [];
      let priorityPlayers: string[] = [];
      let lateCounter = 17;

      for (let step = 0; step < ITERATIONS; step++) {
        const roll = rng();

        if (roll < 0.50) {
          // Action 1: A court finishes a match
          const courtIdx = Math.floor(rng() * courtSlots.length);
          const court = courtSlots[courtIdx];
          const winningSide = rng() < 0.5 ? 'A' : 'B';
          const plan = planMultiCourtResult(
            {
              queue,
              courtSlots,
              sittingOut,
              priorityPlayers,
              lockedPartners: lockedPartners.map(([a, b]) => ({ a, b })),
            },
            court.id,
            [...court.onCourt],
            winningSide,
            'doubles',
          );
          if (plan) {
            queue = plan.queue;
            courtSlots = plan.courtSlots;
            priorityPlayers = plan.priorityPlayers ?? [];
          }
        } else if (roll < 0.75) {
          // Action 2: Waiting player or on-break player toggles sit-out
          const onCourtSet = new Set(courtSlots.flatMap(c => c.onCourt));
          const toggleable = players.filter(p => !onCourtSet.has(p));
          if (toggleable.length > 0) {
            const chosen = toggleable[Math.floor(rng() * toggleable.length)];
            const res = toggleSitOutTransition(
              {
                gameMode: 'doubles',
                players,
                queue,
                courtSlots,
                sittingOut,
                priorityPlayers,
              },
              chosen,
            );
            queue = res.queue;
            sittingOut = res.sittingOut;
            priorityPlayers = res.priorityPlayers ?? [];
          }
        } else if (roll < 0.90) {
          // Action 3: Replace called player on court
          const allOnCourt = courtSlots.flatMap(c => c.onCourt);
          if (allOnCourt.length > 0 && queue.length > 0) {
            const target = allOnCourt[Math.floor(rng() * allOnCourt.length)];
            const res = replaceCalledPlayerTransition(
              {
                gameMode: 'doubles',
                players,
                queue,
                courtSlots,
                sittingOut,
                priorityPlayers,
              },
              target,
            );
            if (res && res.courtSlots) {
              queue = res.queue;
              courtSlots = res.courtSlots;
              sittingOut = res.sittingOut;
              priorityPlayers = res.priorityPlayers ?? [];
            }
          }
        } else if (players.length < 30) {
          // Action 4: Late newcomer check-in
          const newP = `M${lateCounter++}`;
          players = [...players, newP];
          queue = [...queue, newP];
          priorityPlayers = [...priorityPlayers, newP];
        }

        const accounting = accountPlayers({
          gameMode: 'doubles',
          players,
          queue,
          courtSlots,
          sittingOut,
        });
        assertSetPartition(accounting, players);

        const queuedSet = new Set(accounting.queued);
        for (const prio of priorityPlayers) {
          expect(queuedSet.has(prio)).toBe(true);
        }
      }
    });
  }
});
