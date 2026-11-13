import { describe, expect, it } from 'vitest';
import {
  replaceCalledPlayerTransition,
  checkPaddleStateConsistency,
  accountPlayers,
} from '@/app/queue/lib/queueTransitions';
import type { QueueTransitionSnapshot } from '@/app/queue/lib/queueTransitions';
import { freshPaddleState } from '@/app/queue/lib/doublesEngine';
import { freshSinglesState } from '@/app/queue/lib/singleEngine';

describe('Phase 4: replaceCalledPlayerTransition (ADR-0003)', () => {
  it('multi-court: replaces an on-court player with explicit replacement, keeps partner, and updates accounting', () => {
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players: ['C1', 'C2', 'C3', 'C4', 'W1', 'W2'],
      queue: ['W1', 'W2'],
      courtSlots: [
        { id: 'court-1', name: 'Court 1', onCourt: ['C1', 'C2', 'C3', 'C4'] },
      ],
      sittingOut: [],
    };

    // Replace C1 (Team A partner of C2) with W1
    const result = replaceCalledPlayerTransition(snapshot, 'C1', 'W1');
    expect(result).not.toBeNull();

    // C1 is replaced by W1 in court-1, partner C2 remains in place
    expect(result!.courtSlots![0].onCourt).toEqual(['W1', 'C2', 'C3', 'C4']);

    // C1 moved to sittingOut
    expect(result!.sittingOut).toEqual(['C1']);

    // W1 removed from waiting queue, W2 remains
    expect(result!.queue).toEqual(['W2']);

    // Disjoint accounting verification
    const accounting = accountPlayers({
      gameMode: 'doubles',
      players: snapshot.players,
      queue: result!.queue,
      courtSlots: result!.courtSlots,
      sittingOut: result!.sittingOut,
    });
    expect(accounting.missing).toHaveLength(0);
    expect(accounting.duplicates).toHaveLength(0);
    expect(Array.from(accounting.onBreak)).toEqual(['C1']);
  });

  it('multi-court: auto-selects first eligible waiting player when replacement is omitted', () => {
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players: ['C1', 'C2', 'C3', 'C4', 'W1', 'W2', 'W3'],
      queue: ['W1', 'W2', 'W3'],
      courtSlots: [
        { id: 'court-1', name: 'Court 1', onCourt: ['C1', 'C2', 'C3', 'C4'] },
      ],
      sittingOut: ['W1'], // W1 is already on break, so W2 must be picked
    };

    // Replace C3 without explicit replacement
    const result = replaceCalledPlayerTransition(snapshot, 'C3');
    expect(result).not.toBeNull();

    // W2 was selected automatically (first eligible waiting)
    expect(result!.courtSlots![0].onCourt).toEqual(['C1', 'C2', 'W2', 'C4']);
    expect(result!.sittingOut).toContain('C3');
    expect(result!.sittingOut).toContain('W1');
    expect(result!.queue).toEqual(['W3']);

    const accounting = accountPlayers({
      gameMode: 'doubles',
      players: snapshot.players,
      queue: result!.queue,
      courtSlots: result!.courtSlots,
      sittingOut: result!.sittingOut,
    });
    expect(accounting.missing).toHaveLength(0);
    expect(accounting.duplicates).toHaveLength(0);
  });

  it('multi-court: returns null when no eligible waiting players exist', () => {
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players: ['C1', 'C2', 'C3', 'C4'],
      queue: [],
      courtSlots: [
        { id: 'court-1', name: 'Court 1', onCourt: ['C1', 'C2', 'C3', 'C4'] },
      ],
      sittingOut: [],
    };

    // No waiting players in queue to substitute
    const result = replaceCalledPlayerTransition(snapshot, 'C1');
    expect(result).toBeNull();
  });

  it('single-court doubles: replaces called player in queue[0..3] and updates paddleState', () => {
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
      queue: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'],
      courtSlots: [],
      sittingOut: [],
      paddleState: {
        ...freshPaddleState(),
        phase: 'INIT',
        w1: ['P1', 'P2'],
        l1: ['P3', 'P4'],
        waitingQueue: ['P5', 'P6'],
      },
    };

    // P2 declines match; P5 takes their spot
    const result = replaceCalledPlayerTransition(snapshot, 'P2', 'P5');
    expect(result).not.toBeNull();

    // P5 takes P2's slot in the active match at index 1
    expect(result!.queue[0]).toBe('P1');
    expect(result!.queue[1]).toBe('P5');
    expect(result!.queue[2]).toBe('P3');
    expect(result!.queue[3]).toBe('P4');
    expect(result!.queue).not.toContain('P2');
    expect(result!.sittingOut).toEqual(['P2']);

    // Engine paddleState pools updated: P2 replaced with P5 in w1
    expect(result!.paddleState?.w1).toEqual(['P1', 'P5']);
    expect(result!.paddleState?.waitingQueue).toEqual(['P6']);

    const accounting = accountPlayers({
      gameMode: 'doubles',
      players: snapshot.players,
      queue: result!.queue,
      courtSlots: [],
      sittingOut: result!.sittingOut,
    });
    expect(accounting.missing).toHaveLength(0);
    expect(accounting.duplicates).toHaveLength(0);
  });

  it('single-court doubles auto-selection tier 1: selects priority player first even if in another pool', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players,
      queue: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'],
      courtSlots: [],
      sittingOut: [],
      priorityPlayers: ['P7'],
      paddleState: {
        ...freshPaddleState(),
        phase: 'WINNERS',
        w1: ['P1', 'P2', 'P3', 'P4', 'P5'],
        l1: ['P6'],
        waitingQueue: ['P7'],
      },
    };

    const result = replaceCalledPlayerTransition(snapshot, 'P2');
    expect(result).not.toBeNull();
    // P7 (priority) must be selected over P5 (same pool)
    expect(result!.queue.slice(0, 4)).toEqual(['P1', 'P7', 'P3', 'P4']);
    expect(result!.priorityPlayers).toEqual([]);
    expect(checkPaddleStateConsistency(result!.paddleState!, players, result!.sittingOut).valid).toBe(true);
  });

  it('single-court doubles auto-selection tier 2: selects from same pool before waitingQueue or other pool', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'];
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players,
      // Note: queue[4] is P5 (in w1), but target P1 is in l1 along with P6!
      queue: ['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7'],
      courtSlots: [],
      sittingOut: [],
      paddleState: {
        ...freshPaddleState(),
        phase: 'LOSERS',
        w1: ['P5'],
        l1: ['P1', 'P2', 'P3', 'P4', 'P6'],
        waitingQueue: ['P7'],
      },
    };

    const result = replaceCalledPlayerTransition(snapshot, 'P1');
    expect(result).not.toBeNull();
    // P6 is in the same pool (l1) as target P1, so P6 must be chosen instead of queue[4] (P5)
    expect(result!.queue[0]).toBe('P6');
    // Partner P2 remains at index 1
    expect(result!.queue[1]).toBe('P2');
    expect(checkPaddleStateConsistency(result!.paddleState!, players, result!.sittingOut).valid).toBe(true);
  });

  it('single-court doubles auto-selection tier 3 & 4: falls back to waitingQueue then other pool', () => {
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
        w1: ['P5'],
        l1: ['P1', 'P2', 'P3', 'P4'],
        waitingQueue: ['P6'],
      },
    };

    // l1 has no waiting members outside the active 4, so tier 3 (waitingQueue: P6) is picked before tier 4 (w1: P5)
    const res1 = replaceCalledPlayerTransition(snapshot, 'P1');
    expect(res1!.queue[0]).toBe('P6');
    expect(checkPaddleStateConsistency(res1!.paddleState!, players, res1!.sittingOut).valid).toBe(true);

    // If waitingQueue is empty, tier 4 (other pool: P5) is picked
    const snapshotNoWaiting: QueueTransitionSnapshot = {
      ...snapshot,
      players: ['P1', 'P2', 'P3', 'P4', 'P5'],
      queue: ['P1', 'P2', 'P3', 'P4', 'P5'],
      paddleState: {
        ...snapshot.paddleState!,
        waitingQueue: [],
      },
    };
    const res2 = replaceCalledPlayerTransition(snapshotNoWaiting, 'P1');
    expect(res2!.queue[0]).toBe('P5');
    expect(checkPaddleStateConsistency(res2!.paddleState!, snapshotNoWaiting.players, res2!.sittingOut).valid).toBe(true);
  });

  it('single-court King singles: replaces King when King declines and promotes replacement to King', () => {
    const players = ['KingP', 'ChalP', 'W1', 'W2'];
    const state = {
      ...freshSinglesState(players),
      king: 'KingP',
      queue: ['ChalP', 'W1', 'W2'],
    };
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'singles',
      singlesFormat: 'king',
      players,
      queue: ['KingP', 'ChalP', 'W1', 'W2'],
      sittingOut: [],
      singlesState: state,
    };

    const res = replaceCalledPlayerTransition(snapshot, 'KingP');
    expect(res).not.toBeNull();
    expect(res!.singlesState!.king).toBe('W1');
    expect(res!.queue.slice(0, 2)).toEqual(['W1', 'ChalP']);
    expect(res!.sittingOut).toEqual(['KingP']);
  });

  it('returns null if target is already sitting out', () => {
    const players = ['P1', 'P2', 'P3', 'P4', 'P5'];
    const snapshot: QueueTransitionSnapshot = {
      gameMode: 'doubles',
      players,
      queue: ['P1', 'P2', 'P3', 'P4'],
      sittingOut: ['P5'],
    };
    expect(replaceCalledPlayerTransition(snapshot, 'P5')).toBeNull();
  });
});
