/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMatchFlow } from '@/app/queue/hooks/useMatchFlow';

describe('useMatchFlow hook', () => {
  it('starts in idle stage without a winner', () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useMatchFlow({ onSave }));

    expect(result.current.winner).toBeNull();
    expect(result.current.stage).toBe('idle');
    expect(result.current.isSubmitting).toBe(false);
  });

  it('sets winner and enters ready stage on chooseWinner', () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useMatchFlow({ onSave }));

    act(() => {
      result.current.chooseWinner('A', '11 – 8');
    });

    expect(result.current.winner).toBe('A');
    expect(result.current.pendingScore).toBe('11 – 8');
    expect(result.current.stage).toBe('ready');
  });

  it('clears winner on clearWinner', () => {
    const onSave = vi.fn().mockResolvedValue(true);
    const { result } = renderHook(() => useMatchFlow({ onSave }));

    act(() => {
      result.current.chooseWinner('B');
    });
    expect(result.current.winner).toBe('B');

    act(() => {
      result.current.clearWinner();
    });
    expect(result.current.winner).toBeNull();
    expect(result.current.stage).toBe('idle');
  });

  it('confirms result and prevents double-submission', async () => {
    let resolveSave: (ok: boolean) => void = () => {};
    const onSave = vi.fn().mockImplementation(() => new Promise((res) => {
      resolveSave = res;
    }));

    const { result } = renderHook(() => useMatchFlow({ onSave }));

    act(() => {
      result.current.chooseWinner('A', '11 – 5');
    });

    let confirmPromise: Promise<boolean>;
    act(() => {
      confirmPromise = result.current.confirmResult();
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith('A', '11 – 5');
    expect(result.current.isSubmitting).toBe(true);

    // Second immediate call must be ignored
    act(() => {
      result.current.confirmResult();
    });
    expect(onSave).toHaveBeenCalledTimes(1);

    // Resolve save
    await act(async () => {
      resolveSave(true);
      await confirmPromise;
    });

    expect(result.current.stage).toBe('success');
    expect(result.current.winner).toBeNull();
  });

  it('transitions to failed state if onSave returns false', async () => {
    const onSave = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() => useMatchFlow({ onSave }));

    act(() => {
      result.current.chooseWinner('B');
    });

    await act(async () => {
      const ok = await result.current.confirmResult();
      expect(ok).toBe(false);
    });

    expect(result.current.stage).toBe('failed');
    expect(result.current.winner).toBe('B'); // Winner preserved so user can retry
  });
});
