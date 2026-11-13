/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import { MultiCourtScreen } from '@/app/queue/components/MultiCourtScreen/MultiCourtScreen';
import type { CourtSlot } from '@/lib/sessionService';
import type { QueueViewModel } from '@/app/queue/lib/viewModels';

describe('MultiCourtScreen component suite', () => {
  beforeEach(() => {
    cleanup();
  });

  const mockCourtSlots: CourtSlot[] = [
    {
      id: 'c1',
      name: 'Court 1',
      onCourt: ['john', 'ben', 'jerome', 'tyson'],
    },
    {
      id: 'c2',
      name: 'Court 2',
      onCourt: ['alex', 'sam', 'chris', 'pat'],
    },
  ];

  const mockQueue: QueueViewModel = {
    nextUp: [
      { name: 'myson' },
      { name: 'jordan' },
    ],
    waiting: [
      { name: 'game', etaLabel: '~8m wait' },
      { name: 'liho', etaLabel: '~16m wait' },
    ],
    onBreak: [
      { name: 'mika' },
    ],
  };

  it('renders multiple court cards with the existing CourtCard visual layout', () => {
    render(
      <MultiCourtScreen
        courtSlots={mockCourtSlots}
        statsMap={{}}
        queue={mockQueue}
        isHost={true}
        scorePromptEnabled={true}
        onWin={vi.fn()}
        onReplacePlayer={vi.fn()}
        onSwapCourtPlayers={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    expect(screen.getByText(/Live Court Status \(2 Courts\)/i)).toBeDefined();
    expect(screen.getByText('Court 1')).toBeDefined();
    expect(screen.getByText('Court 2')).toBeDefined();

    // Verify team buttons on each court
    const team1WinsBtns = screen.getAllByText('Team 1 Wins');
    const team2WinsBtns = screen.getAllByText('Team 2 Wins');
    expect(team1WinsBtns.length).toBe(2);
    expect(team2WinsBtns.length).toBe(2);
  });

  it('opens CourtScoreModal with quick presets when winning in scorePromptEnabled mode', () => {
    render(
      <MultiCourtScreen
        courtSlots={mockCourtSlots}
        statsMap={{}}
        queue={mockQueue}
        isHost={true}
        scorePromptEnabled={true}
        onWin={vi.fn()}
        onReplacePlayer={vi.fn()}
        onSwapCourtPlayers={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    const team1WinsBtns = screen.getAllByText('Team 1 Wins');
    fireEvent.click(team1WinsBtns[0]);

    // Opens CourtScoreModal
    expect(screen.getByText(/Record Final Score/i)).toBeDefined();
    expect(screen.getByText(/Quick Presets:/i)).toBeDefined();
    expect(screen.getByText('11 – 9')).toBeDefined();
  });

  it('opens ReplaceDialog when tapping on a player in multi-court', () => {
    render(
      <MultiCourtScreen
        courtSlots={mockCourtSlots}
        statsMap={{}}
        queue={mockQueue}
        isHost={true}
        scorePromptEnabled={true}
        onWin={vi.fn()}
        onReplacePlayer={vi.fn()}
        onSwapCourtPlayers={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    // Tap player john chip
    const johnChip = screen.getByText('john');
    fireEvent.click(johnChip);

    // PlayerMenu bottom sheet opens
    expect(screen.getByText('Replace player')).toBeDefined();
    fireEvent.click(screen.getByText('Replace player'));

    // ReplaceDialog opens
    const replaceDialog = screen.getByRole('dialog');
    expect(within(replaceDialog).getByText('Replace john')).toBeDefined();
    expect(within(replaceDialog).getByText('myson')).toBeDefined();
  });

  it('invokes onWin and handles failed commit in direct win mode without crashing', async () => {
    const onWin = vi.fn().mockResolvedValue(false);
    render(
      <MultiCourtScreen
        courtSlots={mockCourtSlots}
        statsMap={{}}
        queue={mockQueue}
        isHost={true}
        scorePromptEnabled={false}
        onWin={onWin}
        onReplacePlayer={vi.fn()}
        onSwapCourtPlayers={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    const team1WinsBtns = screen.getAllByText('Team 1 Wins');
    fireEvent.click(team1WinsBtns[0]);

    expect(onWin).toHaveBeenCalledWith('c1', 'A', undefined);
    const result = await onWin.mock.results[0].value;
    expect(result).toBe(false);
  });

  it('invokes onWin with score and handles failed commit from CourtScoreModal', async () => {
    const onWin = vi.fn().mockResolvedValue(false);
    render(
      <MultiCourtScreen
        courtSlots={mockCourtSlots}
        statsMap={{}}
        queue={mockQueue}
        isHost={true}
        scorePromptEnabled={true}
        onWin={onWin}
        onReplacePlayer={vi.fn()}
        onSwapCourtPlayers={vi.fn()}
        onPlayerTakeBreak={vi.fn()}
        onPlayerRemove={vi.fn()}
        onReturnFromBreak={vi.fn()}
      />
    );

    const team1WinsBtns = screen.getAllByText('Team 1 Wins');
    fireEvent.click(team1WinsBtns[0]);

    // CourtScoreModal opens
    const presetBtn = screen.getByText('11 – 9');
    fireEvent.click(presetBtn);

    const saveBtn = screen.getByText(/Save Score/i);
    fireEvent.click(saveBtn);

    expect(onWin).toHaveBeenCalledWith('c1', 'A', '11 – 9');
    const result = await onWin.mock.results[0].value;
    expect(result).toBe(false);
  });
});
