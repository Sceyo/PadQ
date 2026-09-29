// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { DoublesMatch } from '@/app/queue/components/DoublesMatch/DoublesMatch';
import { ScoreBoard, SCORING_ENABLED_STORAGE_KEY } from '@/app/queue/components/ScoreBoard/ScoreBoard';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('DoublesMatch — winner lockout when score determines winner', () => {
  const defaultProps = {
    firstFour: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
    statsMap: {},
    isHost: true,
    onMatch: vi.fn().mockResolvedValue(true),
  };

  it('disables Team B winner button when Team A reaches the winning limit (11-0)', () => {
    const { container } = render(<DoublesMatch {...defaultProps} />);

    const teamABtn = container.querySelector<HTMLButtonElement>('.winning-team button:first-of-type')!;
    const teamBBtn = container.querySelector<HTMLButtonElement>('.winning-team button:last-of-type')!;

    // Initially at 0-0, both teams are valid for manual selection
    expect(teamABtn.disabled).toBe(false);
    expect(teamBBtn.disabled).toBe(false);

    // Score 11 points for Team A
    const plusA = container.querySelector<HTMLButtonElement>('.score-side--a .score-btn--plus')!;
    for (let i = 0; i < 11; i++) {
      fireEvent.click(plusA);
    }

    // Now Team A reached 11 (game over)
    expect(teamABtn.classList.contains('selected-winner')).toBe(true);
    expect(teamABtn.disabled).toBe(false);

    // Team B MUST be disabled and cannot be pressed
    expect(teamBBtn.disabled).toBe(true);

    // Attempting to click Team B does not change winner to Team B
    fireEvent.click(teamBBtn);
    expect(teamABtn.classList.contains('selected-winner')).toBe(true);
    expect(teamBBtn.classList.contains('selected-winner')).toBe(false);
  });

  it('disables Team A winner button when Team B reaches the winning limit (0-11)', () => {
    const { container } = render(<DoublesMatch {...defaultProps} />);

    const teamABtn = container.querySelector<HTMLButtonElement>('.winning-team button:first-of-type')!;
    const teamBBtn = container.querySelector<HTMLButtonElement>('.winning-team button:last-of-type')!;

    // Score 11 points for Team B
    const plusB = container.querySelector<HTMLButtonElement>('.score-side--b .score-btn--plus')!;
    for (let i = 0; i < 11; i++) {
      fireEvent.click(plusB);
    }

    // Team B reached 11
    expect(teamBBtn.classList.contains('selected-winner')).toBe(true);
    expect(teamBBtn.disabled).toBe(false);

    // Team A MUST be disabled
    expect(teamABtn.disabled).toBe(true);

    // Clicking Team A does not select it
    fireEvent.click(teamABtn);
    expect(teamBBtn.classList.contains('selected-winner')).toBe(true);
    expect(teamABtn.classList.contains('selected-winner')).toBe(false);
  });

  it('re-enables both buttons when host decrements score below limit using minus', () => {
    const { container } = render(<DoublesMatch {...defaultProps} />);

    const teamABtn = container.querySelector<HTMLButtonElement>('.winning-team button:first-of-type')!;
    const teamBBtn = container.querySelector<HTMLButtonElement>('.winning-team button:last-of-type')!;
    const plusA = container.querySelector<HTMLButtonElement>('.score-side--a .score-btn--plus')!;
    const minusA = container.querySelector<HTMLButtonElement>('.score-side--a .score-btn--minus')!;

    // Reach 11-0
    for (let i = 0; i < 11; i++) fireEvent.click(plusA);
    expect(teamBBtn.disabled).toBe(true);

    // Decrement back to 10
    fireEvent.click(minusA);
    expect(teamBBtn.disabled).toBe(false);
    expect(teamABtn.disabled).toBe(false);
  });
});

describe('ScoreBoard — persistent scoring state', () => {
  it('persists scoring OFF in localStorage across unmount/remount', () => {
    // 1. Initial mount — scoring is ON by default
    const { getByText, unmount } = render(
      <ScoreBoard labelA="Pair 1" labelB="Pair 2" onWin={vi.fn()} />
    );

    const toggleBtn = getByText('Scoring ON');
    expect(toggleBtn).toBeTruthy();

    // Turn scoring OFF
    fireEvent.click(toggleBtn);
    expect(getByText('Enable Scoring')).toBeTruthy();
    expect(localStorage.getItem(SCORING_ENABLED_STORAGE_KEY)).toBe('false');

    unmount();

    // 2. Remount for a new match session (e.g. next pairing)
    const nextMatch = render(
      <ScoreBoard labelA="Pair 3" labelB="Pair 4" onWin={vi.fn()} />
    );

    // Scoring MUST persist as OFF, not automatically turn back on
    expect(nextMatch.getByText('Enable Scoring')).toBeTruthy();
    expect(nextMatch.queryByText('Scoring ON')).toBeNull();

    // 3. User decides to turn scoring back on
    fireEvent.click(nextMatch.getByText('Enable Scoring'));
    expect(nextMatch.getByText('Scoring ON')).toBeTruthy();
    expect(localStorage.getItem(SCORING_ENABLED_STORAGE_KEY)).toBe('true');

    nextMatch.unmount();

    // 4. Remount again for subsequent match
    const subsequentMatch = render(
      <ScoreBoard labelA="Pair 5" labelB="Pair 6" onWin={vi.fn()} />
    );
    // Now it persists as ON
    expect(subsequentMatch.getByText('Scoring ON')).toBeTruthy();
  });
});
