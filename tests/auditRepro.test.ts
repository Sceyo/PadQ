import { describe, expect, it } from 'vitest';
import {
  toggleSitOutTransition,
  replaceCalledPlayerTransition,
  consumePriority,
  checkPaddleStateConsistency,
  type QueueTransitionSnapshot,
} from '@/app/queue/lib/queueTransitions';
import {
  freshPaddleState,
  advancePaddleState,
} from '@/app/queue/lib/doublesEngine';
import {
  freshSinglesState,
  buildSinglesMatch,
} from '@/app/queue/lib/singleEngine';
import {
  freshPoolSinglesState,
} from '@/app/queue/lib/singlesPoolEngine';

describe('Phase 5b Audit Repro: Gaps in Priority Return and Replace Called Player', () => {
  // F1: Priority is honored in single-court doubles
  it('F1: single-court doubles advancePaddleState honors returning priority player on next match', () => {
    const allPlayers = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10', 'P11', 'P12'];

    // Play through INIT phase matches to enter WINNERS phase
    let paddleState = freshPaddleState();

    // INIT Match 1: P1, P2 vs P3, P4
    const res1 = advancePaddleState(paddleState, ['P1', 'P2'], ['P3', 'P4'], allPlayers);
    paddleState = res1.nextState;

    // INIT Match 2: P5, P6 vs P7, P8
    const res2 = advancePaddleState(paddleState, ['P5', 'P6'], ['P7', 'P8'], allPlayers);
    paddleState = res2.nextState;

    // INIT Match 3: P9, P10 vs P11, P12 -> completes INIT, moves to WINNERS phase
    const res3 = advancePaddleState(paddleState, ['P9', 'P10'], ['P11', 'P12'], allPlayers);
    paddleState = res3.nextState;
    expect(paddleState.phase).toBe('WINNERS');

    // P12 went on break
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players: allPlayers,
      queue: res3.newQueue,
      sittingOut: ['P12'],
      priorityPlayers: [],
      paddleState,
    };

    // P12 returns from break -> gains priority
    const returnRes = toggleSitOutTransition(snapshot, 'P12');
    expect(returnRes.priorityPlayers).toEqual(['P12']);

    // Advance to the next match
    // Winner team: P1, P2; Loser team: P9, P10 from the current court
    const nextMatchRes = advancePaddleState(
      returnRes.paddleState!,
      ['P1', 'P2'],
      ['P9', 'P10'],
      allPlayers.filter(p => !returnRes.sittingOut.includes(p)),
      {},
      returnRes.priorityPlayers,
    );

    // F1 Assertion: The priority player P12 MUST be called for the very next match on court!
    const onCourtNext = nextMatchRes.newQueue.slice(0, 4);
    expect(onCourtNext).toContain('P12');
    expect(nextMatchRes.consumedPriority).toEqual(['P12']);
  });

  // F4/F3: replaceCalledPlayer maintains pairwise disjoint engine pools and picks pool-consistent replacement
  it('F4: replaceCalledPlayerTransition maintains pairwise disjoint engine pools (no duplicate player in w1 and l1)', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players,
      queue: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
      courtSlots: [],
      sittingOut: [],
      paddleState: {
        ...freshPaddleState(),
        phase: 'LOSERS',
        w1: ['P5', 'P6'],
        l1: ['P1', 'P2'],
        waitingQueue: ['P3', 'P4'],
      },
    };

    // Target P1 in l1 declines. Suppose replacement is chosen or explicitly P5 (who is in w1)
    const result = replaceCalledPlayerTransition(snapshot, 'P1', 'P5');
    expect(result).not.toBeNull();
    const state = result!.paddleState!;

    // F4 Assertion: P5 cannot be in both w1 and l1!
    const consistency = checkPaddleStateConsistency(state, players, result!.sittingOut);
    expect(consistency.valid).toBe(true);
    expect(consistency.overlappingPools).toHaveLength(0);
    expect(state.l1).toEqual(['P5', 'P2']);
    expect(state.w1).toEqual(['P6']);
  });

  // F2: Priority is consumed in single-court
  it('F2: single-court match completion consumes priority for players who played', () => {
    // When priority player P12 plays in a match, they must be removed from priorityPlayers
    const priorityPlayers = ['P12', 'P5'];
    const matchPlayers = ['P1', 'P2', 'P9', 'P12'];

    const nextPriority = consumePriority(priorityPlayers, matchPlayers);
    expect(nextPriority).toEqual(['P5']);
  });

  // F7: Pool singles return places returning player at front of waitingQueue
  it('F7: pool singles return places returning player at front of waitingQueue', () => {
    let poolState = freshPoolSinglesState();
    poolState = {
      ...poolState,
      w1: ['P1'],
      l1: ['P2'],
      waitingQueue: ['P3', 'P4', 'P5'],
    };

    // P_return returns from break via toggleSitOutTransition
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'singles',
      singlesFormat: 'pool',
      players: ['P1', 'P2', 'P3', 'P4', 'P5', 'P_return'],
      queue: ['P1', 'P2', 'P3', 'P4', 'P5'],
      sittingOut: ['P_return'],
      poolSinglesState: poolState,
    };
    const res = toggleSitOutTransition(snapshot, 'P_return');
    const updated = res.poolSinglesState!;

    // F7 Assertion: Priority returner should be at front of waitingQueue, not appended to back
    expect(updated.waitingQueue[0]).toBe('P_return');
    expect(res.priorityPlayers).toContain('P_return');
  });

  // F8: King singles honors priority returner (expected to pass as normal it)
  it('F8: King singles selectChallenger picks returning priority player at head of queue', () => {
    const players = ['King', 'P1', 'P2', 'P3'];
    let state = freshSinglesState(players);
    // King is 'King', queue has P1, P2, P3
    state = {
      ...state,
      king: 'King',
      queue: ['P1', 'P2', 'P3'],
      lastPlayedMap: { King: 0, P0: 0 },
      matchIndex: 1,
    };

    // Returner P_ret is prepended to queue via toggleSitOutTransition
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'singles',
      singlesFormat: 'king',
      players: ['King', 'P1', 'P2', 'P3', 'P_ret'],
      queue: ['P1', 'P2', 'P3'],
      sittingOut: ['P_ret'],
      singlesState: state,
    };

    const res = toggleSitOutTransition(snapshot, 'P_ret');
    const match = buildSinglesMatch(res.singlesState!);

    // King plays P_ret!
    expect(match.playerA).toBe('King');
    expect(match.playerB).toBe('P_ret');
  });
});
