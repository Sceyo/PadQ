// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { fireEvent } from '@testing-library/react';
import { ScoreBoard } from '@/app/queue/components/ScoreBoard/ScoreBoard';

afterEach(() => cleanup());

/**
 * Regression coverage for the reported scenario: an accidental point tap
 * pushes a side to the score limit (e.g. 11-9 when 10-10 was intended). The
 * host should be able to correct it with the minus button, and the match
 * must never conclude (onWin must never fire) until the host explicitly
 * presses the confirm button — even while the score currently sits at or
 * above the limit.
 */
describe('ScoreBoard — accidental score-limit correction', () => {
  it('walks the score back down after an overshoot and only calls onWin on explicit confirm', () => {
    const onWin = vi.fn();

    const { container, queryByText, getByText } = render(
      <ScoreBoard labelA="Team A" labelB="Team B" onWin={onWin} />,
    );

    const plusA = container.querySelector<HTMLButtonElement>('.score-side--a .score-btn--plus')!;
    const plusB = container.querySelector<HTMLButtonElement>('.score-side--b .score-btn--plus')!;
    const minusA = container.querySelector<HTMLButtonElement>('.score-side--a .score-btn--minus')!;

    const displayA = () => container.querySelector('.score-side--a .score-display')!.textContent;
    const displayB = () => container.querySelector('.score-side--b .score-display')!.textContent;

    // Drive the score to 10–9, matching a real rally sequence.
    for (let i = 0; i < 10; i++) fireEvent.click(plusA);
    for (let i = 0; i < 9; i++) fireEvent.click(plusB);
    expect(displayA()).toBe('10');
    expect(displayB()).toBe('9');
    expect(queryByText(/Confirm/)).toBeNull();
    expect(onWin).not.toHaveBeenCalled();

    // The accidental tap: host meant to give the point to Team B (to reach
    // 10–10) but hit Team A's plus button instead, overshooting the limit.
    fireEvent.click(plusA);
    expect(displayA()).toBe('11');
    expect(getByText(/Confirm Team A won, 11–9/)).toBeTruthy();
    // Reaching the limit alone must never conclude the match.
    expect(onWin).not.toHaveBeenCalled();
    // Plus buttons are disabled once "finished" — further scoring is blocked
    // until the host corrects the mistake.
    expect(plusA.disabled).toBe(true);
    expect(plusB.disabled).toBe(true);

    // Correction: minus button works even though the board is in the
    // "finished" state, and pressing it un-finishes the match.
    fireEvent.click(minusA);
    expect(displayA()).toBe('10');
    expect(queryByText(/Confirm/)).toBeNull();
    expect(plusA.disabled).toBe(false);
    expect(plusB.disabled).toBe(false);
    expect(onWin).not.toHaveBeenCalled();

    // Give Team B the point that was actually intended, reaching the true
    // 10–10 the host wanted — this should trigger deuce, not a finish.
    fireEvent.click(plusB);
    expect(displayA()).toBe('10');
    expect(displayB()).toBe('10');
    expect(queryByText(/Confirm/)).toBeNull();
    expect(onWin).not.toHaveBeenCalled();

    // Play out the deuce point Team A actually wins, then confirm.
    fireEvent.click(plusA); // 11–10, still deuce (limit bumped to 12)
    expect(queryByText(/Confirm/)).toBeNull();
    fireEvent.click(plusA); // 12–10, limit reached
    const confirmBtn = getByText(/Confirm Team A won, 12–10/);
    expect(onWin).not.toHaveBeenCalled();

    fireEvent.click(confirmBtn);
    expect(onWin).toHaveBeenCalledTimes(1);
    expect(onWin).toHaveBeenCalledWith('A', 12, 10);
  });

  it('never calls onWin from scoring alone, across many rapid corrections', () => {
    const onWin = vi.fn();
    const { container } = render(<ScoreBoard labelA="X" labelB="Y" onWin={onWin} />);
    const plusA = container.querySelector<HTMLButtonElement>('.score-side--a .score-btn--plus')!;
    const minusA = container.querySelector<HTMLButtonElement>('.score-side--a .score-btn--minus')!;

    // Hammer +/- in a way that repeatedly crosses the limit boundary.
    for (let i = 0; i < 25; i++) {
      fireEvent.click(plusA);
      if (i % 2 === 0) fireEvent.click(minusA);
    }

    expect(onWin).not.toHaveBeenCalled();
  });
});
