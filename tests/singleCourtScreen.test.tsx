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

  it('auto-selects winner when target score is reached (11–9)', () => {
    render(
      <SingleCourtScreen
        court={{
          ...mockCourt,
          score: { ...mockCourt.score, scoreA: 11, scoreB: 9 },
        }}
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

    expect(screen.getByText(/john & ben won 11–9/i)).toBeDefined();
    expect(screen.getByText('Confirm result')).toBeDefined();

    // Tapping Change returns to WHO WON?
    fireEvent.click(screen.getByText('Change'));
    expect(screen.getByText('WHO WON?')).toBeDefined();

    const footer = document.querySelector('footer')!;
    // The losing team (Team B, 9 pts) MUST NOT be pressable!
    const teamBBtn = within(footer).getByRole('button', { name: /Team B/i }) as HTMLButtonElement;
    expect(teamBBtn.disabled).toBe(true);

    // Only the winning team (Team A, 11 pts) is pressable
    const teamABtn = within(footer).getByRole('button', { name: /Team A/i }) as HTMLButtonElement;
    expect(teamABtn.disabled).toBe(false);
    fireEvent.click(teamABtn);
    expect(screen.getByText(/john & ben won 11–9/i)).toBeDefined();
  });

  it('disables winner selection while match is in progress and unlocks upon tapping End match early', () => {
    render(
      <SingleCourtScreen
        court={{
          ...mockCourt,
          score: { ...mockCourt.score, scoreA: 7, scoreB: 4 },
        }}
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

    // Buttons are locked during in-progress scoring
    expect(screen.getByText(/Playing to 11 · Winner selection unlocks at game point/i)).toBeDefined();
    const teamABtn = screen.getByRole('button', { name: 'Team A' }) as HTMLButtonElement;
    expect(teamABtn.disabled).toBe(true);

    // Tap "End match early" to unlock for injuries/time limits
    const endEarlyBtn = screen.getByRole('button', { name: /End match early/i });
    fireEvent.click(endEarlyBtn);

    expect(screen.getByText(/Ending early \(7–4\)/i)).toBeDefined();
    expect(teamABtn.disabled).toBe(false);

    // Selecting winner now works and marks ended early
    fireEvent.click(teamABtn);
    expect(screen.getByText('Ended early')).toBeDefined();
    expect(screen.getByText(/john & ben won 7–4/i)).toBeDefined();
    expect(screen.getByText('Confirm result')).toBeDefined();
  });

  it('disables confirming and selecting winner when score is enabled but 0 on both sides', () => {
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

    expect(screen.getByText(/Score is 0–0/i)).toBeDefined();
    const teamABtn = screen.getByRole('button', { name: 'Team A' }) as HTMLButtonElement;
    expect(teamABtn.disabled).toBe(true);

    fireEvent.click(teamABtn);
    // Should NOT transition into confirm result
    expect(screen.queryByText('Confirm result')).toBeNull();
    expect(screen.getByText('WHO WON?')).toBeDefined();
  });

  it('allows selecting winner with 0-0 score when scoring is switched OFF', () => {
    render(
      <SingleCourtScreen
        court={{
          ...mockCourt,
          score: { ...mockCourt.score, enabled: false },
        }}
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

    expect(screen.queryByText(/Score is 0–0/i)).toBeNull();
    const teamABtn = screen.getByRole('button', { name: 'Team A' }) as HTMLButtonElement;
    expect(teamABtn.disabled).toBe(false);

    fireEvent.click(teamABtn);
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

  it('locks EditTeamsDialog when scoring has started', () => {
    const onSwapTeams = vi.fn();
    const courtStarted: CourtViewModel = {
      ...mockCourt,
      score: {
        enabled: true,
        limit: 11,
        scoreA: 2,
        scoreB: 1,
        hasStarted: true,
      },
    };

    render(
      <SingleCourtScreen
        court={courtStarted}
        queue={mockQueue}
        onMatchComplete={vi.fn()}
        onScoreAdjust={vi.fn()}
        onReplacePlayer={vi.fn()}
        onSwapTeams={onSwapTeams}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    // Open Edit Teams
    fireEvent.click(screen.getByRole('button', { name: 'Edit teams' }));

    // Expect alert banner
    const dialog = screen.getByRole('dialog', { name: /Edit Teams/i });
    expect(within(dialog).getByText('Match scoring has started. Team rosters are locked.')).toBeDefined();

    // The Apply button is disabled
    const applyBtn = within(dialog).getByRole('button', { name: 'Apply' });
    expect(applyBtn.hasAttribute('disabled')).toBe(true);

    // Tapping a player in the dialog does not initiate a swap
    const playerBtn = within(dialog).getByRole('button', { name: /john/i });
    fireEvent.click(playerBtn);
    expect(applyBtn.hasAttribute('disabled')).toBe(true);
    expect(onSwapTeams).not.toHaveBeenCalled();
  });

  it('transitions ConfirmBar to failed stage with retry button when onMatchComplete resolves false', async () => {
    const onMatchComplete = vi.fn().mockResolvedValue(false);
    render(
      <SingleCourtScreen
        isHost={true}
        court={{
          ...mockCourt,
          score: { ...mockCourt.score, scoreA: 11, scoreB: 9 },
        }}
        queue={mockQueue}
        onMatchComplete={onMatchComplete}
        onScoreAdjust={vi.fn()}
        onReplacePlayer={vi.fn()}
        onSwapTeams={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    const confirmBtn = screen.getByText('Confirm result');
    fireEvent.click(confirmBtn);

    expect(onMatchComplete).toHaveBeenCalledWith('A', '11–9');
    expect(await screen.findByText('Save failed. Check your connection and try again.')).toBeDefined();
    expect(screen.getByText('Try Again')).toBeDefined();
  });
});
