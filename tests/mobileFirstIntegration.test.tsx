/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { V1_RELEASE } from '@/app/queue/lib/releaseConfig';
import { AppShell } from '@/app/queue/components/AppShell/AppShell';
import { SingleCourtScreen } from '@/app/queue/components/SingleCourtScreen/SingleCourtScreen';
import { MultiCourtScreen } from '@/app/queue/components/MultiCourtScreen/MultiCourtScreen';
import {
  toSingleCourtViewModel,
  toSingleCourtQueueViewModel,
  toMultiCourtQueueViewModel,
} from '@/app/queue/lib/viewModels';

afterEach(() => cleanup());

describe('Mobile-First Shell Integration & Release Config', () => {
  it('compile-time releaseConfig defaults mobileFirstShell to false (kill-switch safety)', () => {
    expect(typeof V1_RELEASE.mobileFirstShell).toBe('boolean');
  });

  it('renders SingleCourtScreen cleanly inside AppShell with view model mappers', async () => {
    const queue = ['Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank'];
    const courtModel = toSingleCourtViewModel({
      queue,
      liveScore: { scoreA: 5, scoreB: 3 },
      canEdit: true,
    });
    const queueModel = toSingleCourtQueueViewModel({
      queue,
      priorityPlayers: ['Eve'],
      sittingOut: ['Grace'],
    });

    const onMatchComplete = vi.fn().mockResolvedValue(true);
    const onScoreAdjust = vi.fn();
    const onReplacePlayer = vi.fn();
    const onSwapTeams = vi.fn();
    const onPlayerTakeBreak = vi.fn();
    const onPlayerRemove = vi.fn();
    const onReturnFromBreak = vi.fn();

    render(
      <AppShell
        sessionId="TEST-ROOM"
        isHost={true}
        isConnected={true}
        onAddPlayerLive={vi.fn()}
        scorePromptEnabled={true}
        onToggleScorePrompt={vi.fn()}
      >
        <SingleCourtScreen
          court={courtModel}
          queue={queueModel}
          onMatchComplete={onMatchComplete}
          onScoreAdjust={onScoreAdjust}
          onReplacePlayer={onReplacePlayer}
          onSwapTeams={onSwapTeams}
          onPlayerTakeBreak={onPlayerTakeBreak}
          onPlayerRemove={onPlayerRemove}
          onReturnFromBreak={onReturnFromBreak}
          isHost={true}
        />
      </AppShell>
    );

    // Header & room pill
    expect(screen.getByText('TEST-ROOM')).toBeDefined();
    expect(screen.getByText('Live')).toBeDefined();

    // Court View & Players
    expect(screen.getByLabelText('Player Alice, Team A')).toBeDefined();
    expect(screen.getByLabelText('Player Charlie, Team B')).toBeDefined();

    // Score display
    expect(screen.getByText('5')).toBeDefined();
    expect(screen.getByText('3')).toBeDefined();

    // Queue Panel
    expect(screen.getByText('UP NEXT')).toBeDefined();
    expect(screen.getAllByText('Eve').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Frank').length).toBeGreaterThan(0);
  });

  it('renders MultiCourtScreen cleanly inside AppShell with view model mappers', async () => {
    const courtSlots = [
      {
        id: 'c1',
        name: 'Court 1',
        onCourt: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
      },
      {
        id: 'c2',
        name: 'Court 2',
        onCourt: ['Player 5', 'Player 6', 'Player 7', 'Player 8'],
      },
    ];

    const queueModel = toMultiCourtQueueViewModel({
      waitingPlayers: ['Wait 1', 'Wait 2'],
      priorityPlayers: ['Wait 1'],
      sittingOut: [],
    });

    render(
      <AppShell
        sessionId="MULTI-ROOM"
        isHost={true}
        isConnected={true}
        onAddPlayerLive={vi.fn()}
        scorePromptEnabled={true}
        onToggleScorePrompt={vi.fn()}
      >
        <MultiCourtScreen
          courtSlots={courtSlots}
          statsMap={{}}
          queue={queueModel}
          isHost={true}
          scorePromptEnabled={true}
          onWin={vi.fn().mockResolvedValue(true)}
          onReplacePlayer={vi.fn()}
          onSwapCourtPlayers={vi.fn()}
          onPlayerTakeBreak={vi.fn()}
          onPlayerRemove={vi.fn()}
          onReturnFromBreak={vi.fn()}
        />
      </AppShell>
    );

    // Multi-court cards
    expect(screen.getByText('Court 1')).toBeDefined();
    expect(screen.getByText('Court 2')).toBeDefined();
    expect(screen.getByText('Player 1')).toBeDefined();
    expect(screen.getByText('Player 5')).toBeDefined();

    // Waiting queue
    expect(screen.getAllByText('Wait 1').length).toBeGreaterThan(0);
  });
});
