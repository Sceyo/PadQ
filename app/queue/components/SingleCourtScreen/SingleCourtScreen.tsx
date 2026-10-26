'use client';

import React, { useState } from 'react';
import { CourtView } from '../CourtView/CourtView';
import { ScoreRow } from '../ScoreRow/ScoreRow';
import { QueuePanel } from '../QueuePanel/QueuePanel';
import { ConfirmBar } from '../ConfirmBar/ConfirmBar';
import { ReplaceDialog } from '../ReplaceDialog/ReplaceDialog';
import { EditTeamsDialog } from '../EditTeamsDialog/EditTeamsDialog';
import { PlayerMenu } from '../PlayerMenu/PlayerMenu';
import { useMatchFlow } from '../../hooks/useMatchFlow';
import type { CourtViewModel, QueueViewModel } from '../../lib/viewModels';

interface Props {
  court: CourtViewModel;
  queue: QueueViewModel;
  onMatchComplete: (winner: 'A' | 'B', score?: string) => Promise<boolean>;
  onScoreAdjust: (side: 'A' | 'B', delta: number) => void;
  onReplacePlayer: (target: string, replacement: string) => void;
  onSwapTeams: (newOnCourt: string[]) => void;
  onPlayerTakeBreak: (name: string) => void;
  onPlayerRemove: (name: string) => void;
  onReturnFromBreak: (name: string) => void;
  isHost?: boolean;
}

export function SingleCourtScreen({
  court,
  queue,
  onMatchComplete,
  onScoreAdjust,
  onReplacePlayer,
  onSwapTeams,
  onPlayerTakeBreak,
  onPlayerRemove,
  onReturnFromBreak,
  isHost = true,
}: Props) {
  const matchFlow = useMatchFlow({ onSave: onMatchComplete });

  // Dialog & Modal state
  const [selectedPlayerForMenu, setSelectedPlayerForMenu] = useState<string | null>(null);
  const [replacingPlayer, setReplacingPlayer] = useState<string | null>(null);
  const [isEditTeamsOpen, setIsEditTeamsOpen] = useState(false);

  const teamA = court.teams[0];
  const teamB = court.teams[1];

  const handleScoreAdjust = (side: 'A' | 'B', delta: number) => {
    onScoreAdjust(side, delta);
  };

  const handlePlayerTap = (name: string) => {
    if (!isHost) return;
    setSelectedPlayerForMenu(name);
  };

  const onCourtPlayers = [...teamA.players, ...teamB.players];
  const waitingCandidateNames = queue.waiting.map(w => w.name);
  // Include Next up players in waiting pool if not already in queue.waiting
  const allWaitingNames = [
    ...queue.nextUp.map(n => n.name),
    ...waitingCandidateNames.filter(name => !queue.nextUp.some(n => n.name === name)),
  ];

  const winnerLabel = matchFlow.winner === 'A'
    ? teamA.players.join(' & ')
    : matchFlow.winner === 'B'
    ? teamB.players.join(' & ')
    : '';

  const nextUpLabel = queue.nextUp.map(p => p.name).join(', ');

  const currentScoreLabel = court.score.enabled && (court.score.scoreA > 0 || court.score.scoreB > 0)
    ? `${court.score.scoreA}–${court.score.scoreB}`
    : undefined;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3_5, 14px)',
        width: '100%',
        maxWidth: '680px',
        margin: '0 auto',
      }}
    >
      {/* 1. Court Card */}
      <CourtView
        court={court}
        onEditTeams={() => setIsEditTeamsOpen(true)}
        onSelectPlayer={handlePlayerTap}
        disabled={!isHost}
      />

      {/* 2. Score Card */}
      {court.score.enabled && (
        <section
          style={{
            background: 'var(--surface-card, #131726)',
            border: '1px solid var(--line-subtle, #252d47)',
            borderRadius: 'var(--r-lg, 18px)',
            padding: 'var(--sp-3_5, 14px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-3, 12px)',
            boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.25))',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 'var(--fs-base, 1rem)',
                fontWeight: 700,
                color: 'var(--text-primary, #f8fafc)',
              }}
            >
              Score
            </h2>
            <span
              style={{
                fontSize: 'var(--fs-xs, 0.8125rem)',
                color: 'var(--text-muted, #94a3b8)',
                background: 'var(--surface-elevated, #1a2035)',
                border: '1px solid var(--line-subtle, #252d47)',
                borderRadius: 'var(--r-pill, 9999px)',
                padding: '2px 10px',
              }}
            >
              Scoring on · to {court.score.limit}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2_5, 10px)' }}>
            <ScoreRow
              side="A"
              players={teamA.players}
              score={court.score.scoreA}
              isWinner={matchFlow.winner === 'A'}
              onAdjustScore={handleScoreAdjust}
              disabled={!isHost}
            />
            <ScoreRow
              side="B"
              players={teamB.players}
              score={court.score.scoreB}
              isWinner={matchFlow.winner === 'B'}
              onAdjustScore={handleScoreAdjust}
              disabled={!isHost}
            />
          </div>
        </section>
      )}

      {/* 3. Queue Card */}
      <QueuePanel
        queue={queue}
        onSelectPlayer={handlePlayerTap}
        onReturnFromBreak={onReturnFromBreak}
      />

      {/* 4. Sticky Bottom Confirm Bar */}
      {isHost && (
        <ConfirmBar
          winner={matchFlow.winner}
          stage={matchFlow.stage}
          winnerLabel={winnerLabel}
          nextUpLabel={nextUpLabel}
          scoreLabel={currentScoreLabel}
          onChooseWinner={(side) => matchFlow.chooseWinner(side, currentScoreLabel)}
          onClearWinner={matchFlow.clearWinner}
          onConfirm={matchFlow.confirmResult}
        />
      )}

      {/* Overlays / Modals */}
      {selectedPlayerForMenu && (
        <PlayerMenu
          isOpen={true}
          onClose={() => setSelectedPlayerForMenu(null)}
          playerName={selectedPlayerForMenu}
          onReplace={(name) => {
            setSelectedPlayerForMenu(null);
            setReplacingPlayer(name);
          }}
          onTakeBreak={(name) => {
            setSelectedPlayerForMenu(null);
            onPlayerTakeBreak(name);
          }}
          onRemove={(name) => {
            setSelectedPlayerForMenu(null);
            onPlayerRemove(name);
          }}
        />
      )}

      {replacingPlayer && (
        <ReplaceDialog
          isOpen={true}
          onClose={() => setReplacingPlayer(null)}
          targetPlayer={replacingPlayer}
          waitingPlayers={allWaitingNames}
          onConfirmReplace={onReplacePlayer}
          matchHasStarted={court.score.hasStarted}
        />
      )}

      {isEditTeamsOpen && (
        <EditTeamsDialog
          isOpen={true}
          onClose={() => setIsEditTeamsOpen(false)}
          courtName={court.name}
          onCourt={onCourtPlayers}
          onConfirm={onSwapTeams}
        />
      )}
    </div>
  );
}
