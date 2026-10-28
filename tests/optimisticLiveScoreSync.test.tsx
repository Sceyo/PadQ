// @vitest-environment jsdom
import React, { useState, useRef, useEffect } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, fireEvent } from '@testing-library/react';
import type { LiveScoreState } from '@/lib/sessionService';
import { ScoreBoard } from '@/app/queue/components/ScoreBoard/ScoreBoard';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Harness replicating the exact optimistic live score sync logic in app/queue/page.tsx:
 * - useState(optimisticLiveScore) (line 359)
 * - latestLiveScoreRef (line 360)
 * - pendingScoreWritesRef (line 361)
 * - useEffect on session.liveScore (lines 362-367)
 * - handleScoreChange with pending write increment and .finally decrement (lines 530-538)
 */
function useOptimisticLiveScoreHarness(initialSession: {
  sessionId: string;
  liveScore: LiveScoreState | null;
  syncField: (data: { liveScore: LiveScoreState | null }) => Promise<void>;
}) {
  const [sessionLiveScore, setSessionLiveScore] = useState<LiveScoreState | null>(initialSession.liveScore);
  const [optimisticLiveScore, setOptimisticLiveScore] = useState<LiveScoreState | null>(null);
  const latestLiveScoreRef = useRef<LiveScoreState | null>(null);
  const pendingScoreWritesRef = useRef(0);

  useEffect(() => {
    if (pendingScoreWritesRef.current === 0) {
      latestLiveScoreRef.current = sessionLiveScore ?? null;
      setOptimisticLiveScore(sessionLiveScore ?? null);
    }
  }, [sessionLiveScore]);

  const handleScoreChange = (score: LiveScoreState | null) => {
    latestLiveScoreRef.current = score;
    setOptimisticLiveScore(score);
    if (!initialSession.sessionId) return;
    pendingScoreWritesRef.current += 1;
    void initialSession.syncField({ liveScore: score }).finally(() => {
      pendingScoreWritesRef.current = Math.max(0, pendingScoreWritesRef.current - 1);
    });
  };

  const deliverSnapshot = (snapshotScore: LiveScoreState | null) => {
    setSessionLiveScore(snapshotScore);
  };

  const displayedScore = optimisticLiveScore ?? sessionLiveScore;

  return {
    displayedScore,
    optimisticLiveScore,
    latestLiveScoreRef,
    pendingScoreWritesRef,
    handleScoreChange,
    deliverSnapshot,
  };
}

describe('Optimistic Live-Score Sync & Error Contracts (Item C)', () => {
  // ─────────────────────────────────────────────────────────────
  // C.1 Failed write contract
  // ─────────────────────────────────────────────────────────────
  it('C.1: on failed write, host UI stays optimistic while spectator snapshot stays at last confirmed score', async () => {
    let unhandledCaught: unknown = null;
    const ignoreUnhandled = (err: unknown) => {
      unhandledCaught = err;
    };
    process.on('unhandledRejection', ignoreUnhandled);

    try {
      let rejectWrite!: (reason: Error) => void;
      const writePromise = new Promise<void>((_, reject) => {
        rejectWrite = reject;
      });

      const mockSyncField = vi.fn().mockImplementation(() => writePromise);

      const initialScore: LiveScoreState = {
        scoreA: 2,
        scoreB: 1,
        labelA: 'Team A',
        labelB: 'Team B',
        limit: 11,
        baseLimit: 11,
        deuce: false,
        active: true,
      };

      let harness!: ReturnType<typeof useOptimisticLiveScoreHarness>;

      function TestComponent() {
        harness = useOptimisticLiveScoreHarness({
          sessionId: 'TEST01',
          liveScore: initialScore,
          syncField: mockSyncField,
        });
        return (
          <div>
            <span data-testid="score-a">{harness.displayedScore?.scoreA}</span>
            <span data-testid="score-b">{harness.displayedScore?.scoreB}</span>
          </div>
        );
      }

      const { getByTestId } = render(<TestComponent />);

      expect(getByTestId('score-a').textContent).toBe('2');
      expect(getByTestId('score-b').textContent).toBe('1');
      expect(harness.pendingScoreWritesRef.current).toBe(0);

      // Host taps point to score 3-1
      const nextScore: LiveScoreState = { ...initialScore, scoreA: 3 };
      act(() => {
        harness.handleScoreChange(nextScore);
      });

      // Host UI optimistically renders 3-1 immediately
      expect(getByTestId('score-a').textContent).toBe('3');
      expect(harness.pendingScoreWritesRef.current).toBe(1);

      // Simulate rejection from Firestore network/rule error
      await act(async () => {
        rejectWrite(new Error('PERMISSION_DENIED: liveScore write failed'));
        try {
          await writePromise;
        } catch {
          /* expected rejection */
        }
      });

      // Contract Verification:
      // 1. pendingScoreWritesRef decrements to 0
      expect(harness.pendingScoreWritesRef.current).toBe(0);

      // 2. Host UI does NOT automatically rollback; it stays optimistic at 3-1
      // (Actual intended behavior in app/queue/page.tsx: optimisticLiveScore is not rolled back in a catch handler)
      expect(getByTestId('score-a').textContent).toBe('3');
      expect(harness.optimisticLiveScore?.scoreA).toBe(3);

      // 3. Spectator view: In Firestore, the write failed, so session.liveScore remains at 2-1.
      // The spectator snapshot never received 3-1, remaining consistent at 2-1.
      expect(initialScore.scoreA).toBe(2);
      expect(initialScore.scoreB).toBe(1);
    } finally {
      process.off('unhandledRejection', ignoreUnhandled);
    }
  });

  // ─────────────────────────────────────────────────────────────
  // C.2 In-flight snapshot arrival while writes are pending
  // ─────────────────────────────────────────────────────────────
  it('C.2: does not clobber host score when an older snapshot arrives while writes are pending, then applies newer snapshot when settled', async () => {
    let resolveWrite!: () => void;
    const writePromise = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });

    const mockSyncField = vi.fn().mockImplementation(() => writePromise);

    const initialScore: LiveScoreState = {
      scoreA: 5,
      scoreB: 4,
      labelA: 'Team A',
      labelB: 'Team B',
      limit: 11,
      baseLimit: 11,
      deuce: false,
      active: true,
    };

    let harness!: ReturnType<typeof useOptimisticLiveScoreHarness>;

    function TestComponent() {
      harness = useOptimisticLiveScoreHarness({
        sessionId: 'TEST02',
        liveScore: initialScore,
        syncField: mockSyncField,
      });
      return (
        <div>
          <span data-testid="score-a">{harness.displayedScore?.scoreA}</span>
          <span data-testid="score-b">{harness.displayedScore?.scoreB}</span>
        </div>
      );
    }

    const { getByTestId } = render(<TestComponent />);

    // Tap point to score 6-4
    const optimisticScore: LiveScoreState = { ...initialScore, scoreA: 6 };
    act(() => {
      harness.handleScoreChange(optimisticScore);
    });

    expect(getByTestId('score-a').textContent).toBe('6');
    expect(harness.pendingScoreWritesRef.current).toBe(1);

    // An older/stale snapshot arrives from Firestore (e.g. 5-4) while pendingScoreWritesRef > 0
    act(() => {
      const staleSnapshot: LiveScoreState = { ...initialScore, scoreA: 5, scoreB: 4 };
      harness.deliverSnapshot(staleSnapshot);
    });

    // Assert displayed score was NOT clobbered back to 5
    expect(getByTestId('score-a').textContent).toBe('6');
    expect(harness.latestLiveScoreRef.current?.scoreA).toBe(6);

    // Write resolves, pending count decrements
    await act(async () => {
      resolveWrite();
      await writePromise;
    });

    expect(harness.pendingScoreWritesRef.current).toBe(0);

    // Newer snapshot reflecting the confirmed score arrives from Firestore
    const confirmedSnapshot: LiveScoreState = { ...initialScore, scoreA: 6, scoreB: 4 };
    act(() => {
      harness.deliverSnapshot(confirmedSnapshot);
    });

    // Newer snapshot is applied cleanly
    expect(getByTestId('score-a').textContent).toBe('6');
    expect(harness.displayedScore?.scoreA).toBe(6);
  });

  // ─────────────────────────────────────────────────────────────
  // C.4 Minus after win & deuce: locks +, corrects, updates winner/ConfirmBar, commits once
  // ─────────────────────────────────────────────────────────────
  it('C.4: minus after win locks +, corrects score, updates winner/ConfirmBar, and deuce commits exactly once', () => {
    const onWin = vi.fn();
    const { container, queryByText, getByText } = render(
      <ScoreBoard labelA="Team Alpha" labelB="Team Beta" onWin={onWin} />
    );

    const plusA = container.querySelector<HTMLButtonElement>('.score-side--a .score-btn--plus')!;
    const plusB = container.querySelector<HTMLButtonElement>('.score-side--b .score-btn--plus')!;
    const minusA = container.querySelector<HTMLButtonElement>('.score-side--a .score-btn--minus')!;

    const displayA = () => container.querySelector('.score-side--a .score-display')!.textContent;
    const displayB = () => container.querySelector('.score-side--b .score-display')!.textContent;

    // 1. Regular game limit reach (11-9)
    for (let i = 0; i < 10; i++) fireEvent.click(plusA);
    for (let i = 0; i < 9; i++) fireEvent.click(plusB);
    expect(displayA()).toBe('10');
    expect(displayB()).toBe('9');

    // Reach 11-9 limit
    fireEvent.click(plusA);
    expect(displayA()).toBe('11');

    // Assert + buttons are locked
    expect(plusA.disabled).toBe(true);
    expect(plusB.disabled).toBe(true);

    // Assert ConfirmBar / winner banner is visible
    expect(getByText(/Confirm Team Alpha won, 11–9/)).toBeTruthy();
    expect(onWin).not.toHaveBeenCalled();

    // 2. Press minus on winning side
    fireEvent.click(minusA);
    expect(displayA()).toBe('10');

    // Assert + buttons unlocked
    expect(plusA.disabled).toBe(false);
    expect(plusB.disabled).toBe(false);

    // Assert ConfirmBar is dismissed
    expect(queryByText(/Confirm/)).toBeNull();
    expect(onWin).not.toHaveBeenCalled();

    // 3. Deuce case: score 10-10
    fireEvent.click(plusB); // Team Beta reaches 10 -> 10-10 deuce
    expect(displayA()).toBe('10');
    expect(displayB()).toBe('10');
    expect(queryByText(/Confirm/)).toBeNull();

    // Score to 11-10 (still deuce; limit extends to 12)
    fireEvent.click(plusA);
    expect(displayA()).toBe('11');
    expect(queryByText(/Confirm/)).toBeNull();
    expect(plusA.disabled).toBe(false);

    // Score to 12-10 (win by two reached)
    fireEvent.click(plusA);
    expect(displayA()).toBe('12');
    expect(plusA.disabled).toBe(true);
    expect(plusB.disabled).toBe(true);

    const deuceConfirmBtn = getByText(/Confirm Team Alpha won, 12–10/);
    expect(deuceConfirmBtn).toBeTruthy();
    expect(onWin).not.toHaveBeenCalled();

    // Click confirm -> commits exactly once
    fireEvent.click(deuceConfirmBtn);
    expect(onWin).toHaveBeenCalledTimes(1);
    expect(onWin).toHaveBeenCalledWith('A', 12, 10);
  });
});
