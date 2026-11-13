import { describe, expect, it } from 'vitest';
import {
  freshPaddleState,
  advancePaddleState,
  assertPaddleStateConsistent,
  type PaddleState,
} from '@/app/queue/lib/doublesEngine';
import {
  replaceCalledPlayerTransition,
  toggleSitOutTransition,
  checkPaddleStateConsistency,
  type QueueTransitionSnapshot,
} from '@/app/queue/lib/queueTransitions';

/**
 * Audit tests verifying the Phase 5c Part A pool inconsistency fix:
 * During INIT phase, if a sit-out, return, or replace occurs, overflow calculation
 * strictly excludes any player already placed in nextW1, nextL1, or nextWaiting.
 * This guarantees pools remain pairwise disjoint and no duplicate players exist.
 */
describe('Phase 5c Part A: Independent Audit (verified fix)', () => {
  it('maintains pool consistency when a player is replaced during INIT', () => {
    // 10 players: INIT requires floor((10-1)/4) = 2 matches.
    // When P3 sits out/is replaced, active roster is 9 players.
    // slice(0, 8) includes indices 0..7. P10 is at index 8.
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];
    let paddleState: PaddleState = freshPaddleState();

    // Match 1: P1, P2 vs P3, P4
    // Replace P3 with P10 (who is at index 8 of the 9-player active roster)
    const snapshot1: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players,
      queue: [...players],
      courtSlots: [],
      sittingOut: [],
      paddleState,
    };
    const repRes = replaceCalledPlayerTransition(snapshot1, 'P3', 'P10');
    expect(repRes).not.toBeNull();
    paddleState = repRes!.paddleState!;

    // Match 1 played: P1, P2 win against P10, P4
    const res1 = advancePaddleState(
      paddleState,
      ['P1', 'P2'],
      ['P10', 'P4'],
      players.filter(p => !repRes!.sittingOut.includes(p)),
    );
    paddleState = res1.nextState;

    // Match 2: P5, P6 win against P7, P8 (completing INIT phase)
    const res2 = advancePaddleState(
      paddleState,
      ['P5', 'P6'],
      ['P7', 'P8'],
      players.filter(p => !repRes!.sittingOut.includes(p)),
    );
    paddleState = res2.nextState;

    // Consistency check: P10 must NOT appear in both L1 and waitingQueue!
    const activePlayers = players.filter(p => !repRes!.sittingOut.includes(p));
    const consistency = checkPaddleStateConsistency(
      paddleState,
      players,
      repRes!.sittingOut,
    );

    expect(consistency.overlappingPools).toEqual([]);
    expect(consistency.valid).toBe(true);
    // Guard not mask
    expect(() => assertPaddleStateConsistent(paddleState, activePlayers)).not.toThrow();
  });

  it('maintains pool consistency when a player sits out during INIT', () => {
    // 10 players: INIT requires 2 matches.
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10'];
    let paddleState: PaddleState = freshPaddleState();

    // Match 1: P1, P2 win against P3, P4
    const res1 = advancePaddleState(
      paddleState,
      ['P1', 'P2'],
      ['P3', 'P4'],
      players,
    );
    paddleState = res1.nextState;

    // Before Match 2, P5 sits out. P10 takes the spot in Match 2.
    let snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players,
      queue: res1.newQueue,
      courtSlots: [],
      sittingOut: [],
      paddleState,
    };
    const sitRes = toggleSitOutTransition(snapshot, 'P5');
    snapshot = {
      ...snapshot,
      sittingOut: sitRes.sittingOut,
      paddleState: sitRes.paddleState,
      priorityPlayers: sitRes.priorityPlayers,
    };

    // Match 2: P10, P6 vs P7, P8 (completing INIT)
    const res2 = advancePaddleState(
      snapshot.paddleState!,
      ['P10', 'P6'],
      ['P7', 'P8'],
      players.filter(p => !snapshot.sittingOut.includes(p)),
    );
    paddleState = res2.nextState;

    // Consistency check: P10 must NOT appear in both W1 and waitingQueue!
    const activePlayers = players.filter(p => !snapshot.sittingOut.includes(p));
    const consistency = checkPaddleStateConsistency(
      paddleState,
      players,
      snapshot.sittingOut,
    );

    expect(consistency.overlappingPools).toEqual([]);
    expect(consistency.valid).toBe(true);
    // Guard not mask
    expect(() => assertPaddleStateConsistent(paddleState, activePlayers)).not.toThrow();
  });
});
