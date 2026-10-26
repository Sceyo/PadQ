/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { SingleCourtScreen } from '@/app/queue/components/SingleCourtScreen/SingleCourtScreen';
import type { CourtViewModel, QueueViewModel } from '@/app/queue/lib/viewModels';

describe('SingleCourtScreen component suite', () => {
  beforeEach(() => {
    cleanup();
  });

  const mockCourt: CourtViewModel = {
    id: 'c1',
    name: 'Court 1',
    status: 'playing',
    teams: [
      { side: 'A', label: 'Team A', players: ['john', 'ben'] },
      { side: 'B', label: 'Team B', players: ['jerome', 'tyson'] },
    ],
    score: {
      enabled: true,
      limit: 11,
      scoreA: 0,
      scoreB: 0,
      hasStarted: false,
    },
    pendingWinner: null,
    canEdit: true,
  };

  const mockQueue: QueueViewModel = {
    nextUp: [
      { name: 'myson' },
      { name: 'jordan' },
      { name: 'haro' },
      { name: 'hiro' },
    ],
    waiting: [
      { name: 'game' },
      { name: 'liho' },
      { name: 'kai' },
      { name: 'ron' },
    ],
    onBreak: [
      { name: 'mika' },
    ],
  };

  it('renders CourtView with four 48px player cards and Edit teams button', () => {
    render(
      <SingleCourtScreen
        court={mockCourt}
        queue={mockQueue}
        onMatchComplete={vi.fn()}
        onScoreAdjust={vi.fn()}
        onReplacePlayer={vi.fn()}
        onSwapTeams={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    expect(screen.getByText('Court 1')).toBeDefined();
    expect(screen.getByText('Now playing')).toBeDefined();
    expect(screen.getByText('Edit teams')).toBeDefined();

    // Four players on court buttons
    expect(screen.getByLabelText('Player john, Team A')).toBeDefined();
    expect(screen.getByLabelText('Player ben, Team A')).toBeDefined();
    expect(screen.getByLabelText('Player jerome, Team B')).toBeDefined();
    expect(screen.getByLabelText('Player tyson, Team B')).toBeDefined();
  });

  it('renders ScoreRow with tabular nums and right-aligned + button', () => {
    const onScoreAdjust = vi.fn();
    render(
      <SingleCourtScreen
        court={mockCourt}
        queue={mockQueue}
        onMatchComplete={vi.fn()}
        onScoreAdjust={onScoreAdjust}
        onReplacePlayer={vi.fn()}
        onSwapTeams={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    expect(screen.getByText('Score')).toBeDefined();
    const plusButtons = screen.getAllByLabelText(/Increase Team/i);
    expect(plusButtons.length).toBe(2);

    fireEvent.click(plusButtons[0]);
    expect(onScoreAdjust).toHaveBeenCalledWith('A', 1);
  });

  it('transforms sticky bar from WHO WON? into Confirm result upon selecting a winner', () => {
    render(
      <SingleCourtScreen
        court={mockCourt}
        queue={mockQueue}
        onMatchComplete={vi.fn()}
        onScoreAdjust={vi.fn()}
        onReplacePlayer={vi.fn()}
        onSwapTeams={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    expect(screen.getByText('WHO WON?')).toBeDefined();
    const teamABtn = screen.getByText('Team A');
    fireEvent.click(teamABtn);

    // Morphs into single Confirm result
    expect(screen.queryByText('WHO WON?')).toBeNull();
    expect(screen.getByText(/john & ben won/)).toBeDefined();
    expect(screen.getByText('Confirm result')).toBeDefined();
  });

  it('opens ReplaceDialog when selecting replace on a player', () => {
    render(
      <SingleCourtScreen
        court={mockCourt}
        queue={mockQueue}
        onMatchComplete={vi.fn()}
        onScoreAdjust={vi.fn()}
        onReplacePlayer={vi.fn()}
        onSwapTeams={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    // Tap player john -> opens PlayerMenu
    fireEvent.click(screen.getByLabelText('Player john, Team A'));
    expect(screen.getByText('Replace player')).toBeDefined();

    // Tap Replace player -> opens ReplaceDialog
    fireEvent.click(screen.getByText('Replace player'));
    const replaceDialog = screen.getByRole('dialog');
    expect(within(replaceDialog).getByText('Replace john')).toBeDefined();
    expect(within(replaceDialog).getByText('Next up')).toBeDefined();
    expect(within(replaceDialog).getByText('Replace')).toBeDefined();
  });

  it('opens EditTeamsDialog when tapping Edit teams', () => {
    render(
      <SingleCourtScreen
        court={mockCourt}
        queue={mockQueue}
        onMatchComplete={vi.fn()}
        onScoreAdjust={vi.fn()}
        onReplacePlayer={vi.fn()}
        onSwapTeams={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('Edit teams'));
    expect(screen.getByText('Court 1 — Edit teams')).toBeDefined();
    expect(screen.getByText('Tap two players to swap their positions. Players on the same side are partners.')).toBeDefined();
  });

  it('supports 11-15-21 presets and custom special limit input', () => {
    const onScoreLimitChange = vi.fn();
    render(
      <SingleCourtScreen
        court={mockCourt}
        queue={mockQueue}
        onMatchComplete={vi.fn()}
        onScoreAdjust={vi.fn()}
        onReplacePlayer={vi.fn()}
        onSwapTeams={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
        onScoreLimitChange={onScoreLimitChange}
      />
    );

    // 11, 15, 21 presets are rendered
    expect(screen.getByRole('button', { name: '11' })).toBeDefined();
    expect(screen.getByRole('button', { name: '15' })).toBeDefined();
    expect(screen.getByRole('button', { name: '21' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Special' })).toBeDefined();

    // Click 15 preset
    fireEvent.click(screen.getByRole('button', { name: '15' }));
    expect(onScoreLimitChange).toHaveBeenCalledWith(15);

    // Click Special button -> opens special limit form
    fireEvent.click(screen.getByRole('button', { name: 'Special' }));
    const input = screen.getByPlaceholderText('e.g. 7') as HTMLInputElement;
    expect(input).toBeDefined();
    fireEvent.change(input, { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: /set/i }));
    expect(onScoreLimitChange).toHaveBeenCalledWith(9);
  });

  it('caps score and disables + button when target limit is reached without deuce', () => {
    const onScoreAdjust = vi.fn();
    const courtAtLimit: CourtViewModel = {
      ...mockCourt,
      score: {
        enabled: true,
        limit: 11,
        baseLimit: 11,
        scoreA: 0,
        scoreB: 11,
        hasStarted: true,
      },
    };

    render(
      <SingleCourtScreen
        court={courtAtLimit}
        queue={mockQueue}
        onMatchComplete={vi.fn()}
        onScoreAdjust={onScoreAdjust}
        onReplacePlayer={vi.fn()}
        onSwapTeams={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    // Banner indicates game over
    expect(screen.getByText(/Game Over · jerome & tyson reached limit \(0–11\)/)).toBeDefined();

    // The + buttons for both teams are disabled
    const plusButtons = screen.getAllByLabelText(/Increase Team/i);
    expect(plusButtons[0].hasAttribute('disabled')).toBe(true);
    expect(plusButtons[1].hasAttribute('disabled')).toBe(true);

    // Team B minus button is still enabled for correction
    const minusB = screen.getByLabelText('Decrease Team B score');
    expect(minusB.hasAttribute('disabled')).toBe(false);
  });

  it('slides target to 2 at deuce (10-10) and only caps when winning by 2', () => {
    const courtAtDeuce: CourtViewModel = {
      ...mockCourt,
      score: {
        enabled: true,
        limit: 12,
        baseLimit: 11,
        scoreA: 10,
        scoreB: 10,
        hasStarted: true,
      },
    };

    render(
      <SingleCourtScreen
        court={courtAtDeuce}
        queue={mockQueue}
        onMatchComplete={vi.fn()}
        onScoreAdjust={vi.fn()}
        onReplacePlayer={vi.fn()}
        onSwapTeams={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    // Shows Deuce banner
    expect(screen.getByText(/Deuce! Must win by 2 points \(playing to 12\)/)).toBeDefined();

    // Both + buttons remain enabled
    const plusButtons = screen.getAllByLabelText(/Increase Team/i);
    expect(plusButtons[0].hasAttribute('disabled')).toBe(false);
    expect(plusButtons[1].hasAttribute('disabled')).toBe(false);
  });
});
