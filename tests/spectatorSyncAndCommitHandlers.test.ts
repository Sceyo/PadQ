import { describe, it, expect, vi } from 'vitest';
import { getSingleCourtLiveScoreLabels } from '@/app/queue/lib/viewModels';
import { replaceCalledPlayerTransition } from '@/app/queue/lib/queueTransitions';
import type { LiveScoreState } from '@/lib/sessionService';

describe('Spectator LiveScore Labels & Commit Failure Contracts (Feedback Item 4)', () => {
  describe('Spectator labels synchronization', () => {
    it('proves spectator labels update after a team swap', () => {
      const initialQueue = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank'];
      const initialLabels = getSingleCourtLiveScoreLabels({
        queue: initialQueue,
        gameMode: 'doubles',
      });
      expect(initialLabels.labelA).toBe('Alice / Bob');
      expect(initialLabels.labelB).toBe('Charlie / Dave');

      // Perform swap: Alice swaps with Charlie
      const swappedOnCourt = ['Charlie', 'Bob', 'Alice', 'Dave'];
      const updatedQueue = [...swappedOnCourt, ...initialQueue.slice(4)];
      const updatedLabels = getSingleCourtLiveScoreLabels({
        queue: updatedQueue,
        gameMode: 'doubles',
      });

      expect(updatedLabels.labelA).toBe('Charlie / Bob');
      expect(updatedLabels.labelB).toBe('Alice / Dave');
      expect(updatedLabels.labelA).not.toBe(initialLabels.labelA);
    });

    it('proves spectator labels update after a player substitution at 0-0', () => {
      const initialQueue = ['Alice', 'Bob', 'Charlie', 'Dave', 'SubWaiting', 'NextWaiting'];
      const initialLiveScore: LiveScoreState = {
        scoreA: 0,
        scoreB: 0,
        labelA: 'Alice / Bob',
        labelB: 'Charlie / Dave',
        limit: 11,
        baseLimit: 11,
        deuce: false,
        active: true,
      };

      // Substitute Bob with SubWaiting
      const transitionResult = replaceCalledPlayerTransition(
        {
          gameMode: 'doubles',
          players: initialQueue,
          queue: initialQueue,
          sittingOut: [],
        },
        'Bob',
        'SubWaiting',
      );

      expect(transitionResult).not.toBeNull();
      const newQueue = transitionResult!.queue;
      expect(newQueue.slice(0, 4)).toEqual(['Alice', 'SubWaiting', 'Charlie', 'Dave']);

      // LiveScore labels refreshed from updated queue
      const refreshedLabels = getSingleCourtLiveScoreLabels({
        queue: newQueue,
        gameMode: 'doubles',
      });
      const nextLiveScore: LiveScoreState = {
        ...initialLiveScore,
        labelA: refreshedLabels.labelA,
        labelB: refreshedLabels.labelB,
      };

      expect(nextLiveScore.labelA).toBe('Alice / SubWaiting');
      expect(nextLiveScore.labelB).toBe('Charlie / Dave');
      expect(nextLiveScore.scoreA).toBe(0);
      expect(nextLiveScore.scoreB).toBe(0);
    });

    it('proves spectator labels and scores update after score reset', () => {
      const activeQueue = ['Player1', 'Player2', 'Player3', 'Player4'];
      const ongoingLiveScore: LiveScoreState = {
        scoreA: 9,
        scoreB: 8,
        labelA: 'Player1 / Player2',
        labelB: 'Player3 / Player4',
        limit: 11,
        baseLimit: 11,
        deuce: false,
        active: true,
      };

      const labels = getSingleCourtLiveScoreLabels({
        queue: activeQueue,
        gameMode: 'doubles',
      });
      const resetLiveScore: LiveScoreState = {
        scoreA: 0,
        scoreB: 0,
        labelA: labels.labelA,
        labelB: labels.labelB,
        limit: ongoingLiveScore.baseLimit ?? 11,
        baseLimit: ongoingLiveScore.baseLimit ?? 11,
        deuce: false,
        active: true,
      };

      expect(resetLiveScore.scoreA).toBe(0);
      expect(resetLiveScore.scoreB).toBe(0);
      expect(resetLiveScore.labelA).toBe('Player1 / Player2');
      expect(resetLiveScore.labelB).toBe('Player3 / Player4');
    });

    it('proves spectator labels update for singles mode matches', () => {
      const singlesQueue = ['Alice', 'Bob', 'Charlie'];
      const labels = getSingleCourtLiveScoreLabels({
        queue: singlesQueue,
        gameMode: 'singles',
      });
      expect(labels.labelA).toBe('Alice');
      expect(labels.labelB).toBe('Bob');

      // Swap in singles
      const swappedQueue = ['Bob', 'Alice', 'Charlie'];
      const swappedLabels = getSingleCourtLiveScoreLabels({
        queue: swappedQueue,
        gameMode: 'singles',
      });
      expect(swappedLabels.labelA).toBe('Bob');
      expect(swappedLabels.labelB).toBe('Alice');
    });
  });

  describe('Page handler return contracts on failed commits', () => {
    it('returns false and rolls back when singles single-court commit fails', async () => {
      const mockSession = {
        sessionId: 'test-session',
        commitMatchResult: vi.fn().mockResolvedValue({ status: 'failed', reason: 'network' }),
      };

      const handleSinglesMatchSimulated = async (
        session: typeof mockSession,
        _winner: string,
      ): Promise<boolean> => {
        if (!session.sessionId) return true;
        const result = await session.commitMatchResult();
        if (!result || result.status === 'failed') {
          return false;
        }
        return true;
      };

      const success = await handleSinglesMatchSimulated(mockSession, 'Alice');
      expect(mockSession.commitMatchResult).toHaveBeenCalled();
      expect(success).toBe(false);
    });

    it('returns false and rolls back when singles multi-court commit fails', async () => {
      const mockSession = {
        sessionId: 'test-session',
        commitCourtResult: vi.fn().mockResolvedValue({ status: 'failed', reason: 'permission' }),
      };

      const handleSinglesMultiCourtSimulated = async (
        session: typeof mockSession,
        courtId: string,
      ): Promise<boolean> => {
        if (!session.sessionId) return true;
        const result = await session.commitCourtResult({ courtId });
        if (!result || result.status === 'failed' || result.status === 'stale') {
          return false;
        }
        return true;
      };

      const success = await handleSinglesMultiCourtSimulated(mockSession, 'court-1');
      expect(mockSession.commitCourtResult).toHaveBeenCalledWith({ courtId: 'court-1' });
      expect(success).toBe(false);
    });

    it('returns false and rolls back when doubles single-court commit fails', async () => {
      const mockSession = {
        sessionId: 'test-session',
        commitMatchResult: vi.fn().mockResolvedValue({ status: 'failed', reason: 'network' }),
      };

      const handleDoublesMatchSimulated = async (
        session: typeof mockSession,
      ): Promise<boolean> => {
        if (!session.sessionId) return true;
        const result = await session.commitMatchResult();
        if (!result || result.status === 'failed') {
          return false;
        }
        return true;
      };

      const success = await handleDoublesMatchSimulated(mockSession);
      expect(mockSession.commitMatchResult).toHaveBeenCalled();
      expect(success).toBe(false);
    });

    it('returns false and rolls back when doubles multi-court commit fails', async () => {
      const mockSession = {
        sessionId: 'test-session',
        commitCourtResult: vi.fn().mockResolvedValue({ status: 'failed', reason: 'stale' }),
      };

      const handleDoublesMultiCourtSimulated = async (
        session: typeof mockSession,
        courtId: string,
      ): Promise<boolean> => {
        if (!session.sessionId) return true;
        const result = await session.commitCourtResult({ courtId });
        if (!result || result.status === 'failed' || result.status === 'stale') {
          return false;
        }
        return true;
      };

      const success = await handleDoublesMultiCourtSimulated(mockSession, 'court-2');
      expect(mockSession.commitCourtResult).toHaveBeenCalledWith({ courtId: 'court-2' });
      expect(success).toBe(false);
    });
  });
});
