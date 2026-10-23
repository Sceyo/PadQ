import { describe, expect, it } from 'vitest';
import {
  toggleSitOutTransition,
  replaceCalledPlayerTransition,
  removeFromQueueTransition,
  consumePriority,
  type QueueTransitionSnapshot,
} from '@/app/queue/lib/queueTransitions';
import { planMultiCourtResult } from '@/app/queue/lib/multiCourtResult';
import { freshPaddleState } from '@/app/queue/lib/doublesEngine';
import { freshSinglesState } from '@/app/queue/lib/singleEngine';

describe('Priority Return (ADR-0003)', () => {
  describe('toggleSitOutTransition with priorityPlayers', () => {
    it('appends returning player to priorityPlayers and removes from sittingOut', () => {
      const snapshot: QueueTransitionSnapshot = {
        gameMode: 'doubles',
        players: ['Alice', 'Bob', 'Charlie'],
        queue: ['Alice'],
        courtSlots: [],
        sittingOut: ['Bob', 'Charlie'],
        priorityPlayers: [],
      };

      // Bob returns from break
      const result = toggleSitOutTransition(snapshot, 'Bob');
      expect(result.sittingOut).toEqual(['Charlie']);
      expect(result.queue).toEqual(['Alice', 'Bob']);
      expect(result.priorityPlayers).toEqual(['Bob']);

      // Then Charlie returns from break
      const snapshot2: QueueTransitionSnapshot = {
        ...snapshot,
        queue: result.queue,
        sittingOut: result.sittingOut,
        priorityPlayers: result.priorityPlayers,
      };
      const result2 = toggleSitOutTransition(snapshot2, 'Charlie');
      expect(result2.sittingOut).toEqual([]);
      expect(result2.queue).toEqual(['Alice', 'Bob', 'Charlie']);
      expect(result2.priorityPlayers).toEqual(['Bob', 'Charlie']);
    });

    it('removes player from priorityPlayers when they go on break again', () => {
      const snapshot: QueueTransitionSnapshot = {
        gameMode: 'doubles',
        players: ['Alice', 'Bob'],
        queue: ['Alice', 'Bob'],
        courtSlots: [],
        sittingOut: [],
        priorityPlayers: ['Bob'],
      };

      const result = toggleSitOutTransition(snapshot, 'Bob');
      expect(result.sittingOut).toEqual(['Bob']);
      expect(result.queue).toEqual(['Alice']);
      expect(result.priorityPlayers).toEqual([]);
    });
  });

  describe('replaceCalledPlayerTransition with priorityPlayers', () => {
    it('removes target from priorityPlayers when declining and consumes replacement from priorityPlayers', () => {
      const snapshot: QueueTransitionSnapshot = {
        gameMode: 'doubles',
        players: ['C1', 'C2', 'C3', 'C4', 'W1', 'W2'],
        queue: ['W1', 'W2'],
        courtSlots: [
          { id: 'court-1', name: 'Court 1', onCourt: ['C1', 'C2', 'C3', 'C4'] },
        ],
        sittingOut: [],
        priorityPlayers: ['C1', 'W1'],
      };

      // C1 declines match; W1 is the priority replacement
      const result = replaceCalledPlayerTransition(snapshot, 'C1', 'W1');
      expect(result).not.toBeNull();
      expect(result!.sittingOut).toEqual(['C1']);
      expect(result!.courtSlots![0].onCourt).toEqual(['W1', 'C2', 'C3', 'C4']);
      // Both C1 (declined) and W1 (placed on court) are removed from priorityPlayers
      expect(result!.priorityPlayers).toEqual([]);
    });
  });

  describe('removeFromQueueTransition with priorityPlayers', () => {
    it('removes player from priorityPlayers when manually removed from queue to break', () => {
      const snapshot: QueueTransitionSnapshot = {
        gameMode: 'doubles',
        players: ['Alice', 'Bob'],
        queue: ['Alice', 'Bob'],
        courtSlots: [],
        sittingOut: [],
        priorityPlayers: ['Bob'],
      };

      const result = removeFromQueueTransition(snapshot, 1);
      expect(result.queue).toEqual(['Alice']);
      expect(result.sittingOut).toEqual(['Bob']);
      expect(result.priorityPlayers).toEqual([]);
    });
  });

  describe('Multi-court planMultiCourtResult with priorityPlayers', () => {
    it('doubles: prioritizes returning player over non-priority players ahead in queue and consumes priority', () => {
      // Waiting queue order: W1, W2, W3, W4, Ret1
      // Ret1 returned from break and has priority
      const state = {
        queue: ['W1', 'W2', 'W3', 'W4', 'Ret1'],
        courtSlots: [
          { id: 'c1', name: 'Court 1', onCourt: ['C1', 'C2', 'C3', 'C4'] },
        ],
        sittingOut: [],
        priorityPlayers: ['Ret1'],
      };

      const result = planMultiCourtResult(
        state,
        'c1',
        ['C1', 'C2', 'C3', 'C4'],
        'A',
        'doubles',
      );

      expect(result).not.toBeNull();
      // Ret1 must be selected for Court 1 because of priority!
      expect(result!.courtSlots[0].onCourt).toContain('Ret1');
      // Ret1 was placed on court -> consumed from priorityPlayers
      expect(result!.priorityPlayers).toEqual([]);
    });

    it('doubles: preserves priority for player held back due to locked partner playing elsewhere', () => {
      // Priority player Ret1 is locked with C5 who is still playing on Court 2
      const state = {
        queue: ['W1', 'W2', 'W3', 'W4', 'Ret1'],
        courtSlots: [
          { id: 'c1', name: 'Court 1', onCourt: ['C1', 'C2', 'C3', 'C4'] },
          { id: 'c2', name: 'Court 2', onCourt: ['C5', 'C6', 'C7', 'C8'] },
        ],
        lockedPartners: [{ a: 'Ret1', b: 'C5' }],
        sittingOut: [],
        priorityPlayers: ['Ret1'],
      };

      const result = planMultiCourtResult(
        state,
        'c1',
        ['C1', 'C2', 'C3', 'C4'],
        'A',
        'doubles',
      );

      expect(result).not.toBeNull();
      // Ret1 should NOT be put on Court 1 alone without C5
      expect(result!.courtSlots[0].onCourt).not.toContain('Ret1');
      // Ret1 remains in priorityPlayers for the next court!
      expect(result!.priorityPlayers).toEqual(['Ret1']);
    });

    it('singles: gives next challenger slot to priority player and consumes priority', () => {
      const state = {
        queue: ['W1', 'W2', 'Ret1'],
        courtSlots: [
          { id: 'c1', name: 'Court 1', onCourt: ['A', 'B'] },
        ],
        sittingOut: [],
        priorityPlayers: ['Ret1'],
      };

      // A wins against B. Ret1 has priority over W1.
      const result = planMultiCourtResult(
        state,
        'c1',
        ['A', 'B'],
        'A',
        'singles',
      );

      expect(result).not.toBeNull();
      // A stays on; challenger is Ret1 (priority), not W1!
      expect(result!.courtSlots[0].onCourt).toEqual(['A', 'Ret1']);
      expect(result!.priorityPlayers).toEqual([]);
      // W1 remains at the head of queue, loser B moves to back
      expect(result!.queue).toEqual(['W1', 'W2', 'B']);
    });
  });

  describe('consumePriority (Phase 5b-2)', () => {
    it('consumePriority filters out any player who played or entered the match', () => {
      expect(consumePriority(['P1', 'P2', 'P3'], ['P2', 'P4'])).toEqual(['P1', 'P3']);
      expect(consumePriority([], ['P1', 'P2'])).toEqual([]);
    });
  });
});
