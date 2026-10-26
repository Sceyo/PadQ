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
import type { PlayerStat } from '../../lib/types';

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
  onMoveWaitingPlayer?: (name: string, direction: -1 | 1) => void;
  onScoreLimitChange?: (limit: number) => void;
  onResetScore?: () => void;
  isHost?: boolean;
  statsMap?: Record<string, PlayerStat>;
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
  onMoveWaitingPlayer,
  onScoreLimitChange,
  onResetScore,
  isHost = true,
  statsMap,
}: Props) {
  const matchFlow = useMatchFlow({ onSave: onMatchComplete });

  // Dialog & Modal state: track player and their zone
  const [selectedPlayerForMenu, setSelectedPlayerForMenu] = useState<{
    name: string;
    zone: 'playing' | 'waiting' | 'break';
  } | null>(null);
  const [replacingPlayer, setReplacingPlayer] = useState<string | null>(null);
  const [isEditTeamsOpen, setIsEditTeamsOpen] = useState(false);

  const teamA = court.teams[0];
  const teamB = court.teams[1];

  const handleScoreAdjust = (side: 'A' | 'B', delta: number) => {
    onScoreAdjust(side, delta);
  };

  const handlePlayerTap = (name: string, zone: 'playing' | 'waiting' | 'break' = 'playing') => {
    if (!isHost) return;
    setSelectedPlayerForMenu({ name, zone });
  };

  const onCourtPlayers = [...teamA.players, ...teamB.players];
  const waitingCandidateNames = queue.waiting.map(w => w.name);
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

  // Compute move up / move down eligibility
  const waitingQueueNames = [
    ...queue.nextUp.map(n => n.name),
    ...queue.waiting.map(w => w.name),
  ];
  const selectedIndex = selectedPlayerForMenu && selectedPlayerForMenu.zone === 'waiting'
    ? waitingQueueNames.indexOf(selectedPlayerForMenu.name)
    : -1;
  const canMoveUp = selectedIndex > 0;
  const canMoveDown = selectedIndex >= 0 && selectedIndex < waitingQueueNames.length - 1;

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
        onSelectPlayer={(name) => handlePlayerTap(name, 'playing')}
        disabled={!isHost}
        statsMap={statsMap}
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {isHost && onScoreLimitChange ? (
                <button
                  type="button"
                  onClick={() => onScoreLimitChange(court.score.limit === 11 ? 21 : 11)}
                  style={{
                    fontSize: 'var(--fs-xs, 0.8125rem)',
                    color: 'var(--text-secondary, #cbd5e1)',
                    background: 'var(--surface-elevated, #1a2035)',
                    border: '1px solid var(--line-subtle, #252d47)',
                    borderRadius: 'var(--r-pill, 9999px)',
                    padding: '3px 10px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                  title="Switch score limit (11 / 21)"
                >
                  to {court.score.limit}
                </button>
              ) : (
                <span
                  style={{
                    fontSize: 'var(--fs-xs, 0.8125rem)',
                    color: 'var(--text-muted, #94a3b8)',
                    background: 'var(--surface-elevated, #1a2035)',
                    border: '1px solid var(--line-subtle, #252d47)',
                    borderRadius: 'var(--r-pill, 9999px)',
                    padding: '3px 10px',
                  }}
                >
                  to {court.score.limit}
                </span>
              )}
              {isHost && onResetScore && (court.score.scoreA > 0 || court.score.scoreB > 0) && (
                <button
                  type="button"
                  onClick={onResetScore}
                  style={{
                    fontSize: 'var(--fs-xs, 0.8125rem)',
                    color: 'var(--text-muted, #94a3b8)',
                    background: 'var(--surface-elevated, #1a2035)',
                    border: '1px solid var(--line-subtle, #252d47)',
                    borderRadius: 'var(--r-pill, 9999px)',
                    padding: '3px 8px',
                    cursor: 'pointer',
                  }}
                  title="Reset score to 0–0"
                >
                  Reset
                </button>
              )}
            </div>
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
        onSelectPlayer={(name, zone) => handlePlayerTap(name, zone ?? 'waiting')}
        onReturnFromBreak={onReturnFromBreak}
        statsMap={statsMap}
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
          playerName={selectedPlayerForMenu.name}
          zone={selectedPlayerForMenu.zone}
          canMoveUp={canMoveUp}
          canMoveDown={canMoveDown}
          onMoveUp={onMoveWaitingPlayer ? (name) => onMoveWaitingPlayer(name, -1) : undefined}
          onMoveDown={onMoveWaitingPlayer ? (name) => onMoveWaitingPlayer(name, 1) : undefined}
          onReplace={(name) => {
            setSelectedPlayerForMenu(null);
            setReplacingPlayer(name);
          }}
          onTakeBreak={(name) => {
            setSelectedPlayerForMenu(null);
            onPlayerTakeBreak(name);
          }}
          onBackIn={(name) => {
            setSelectedPlayerForMenu(null);
            onReturnFromBreak(name);
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
