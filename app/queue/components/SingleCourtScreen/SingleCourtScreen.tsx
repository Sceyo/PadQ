'use client';

import React, { useState } from 'react';
import { RotateCcw, Check, X } from 'lucide-react';
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

const PRESET_LIMITS = [11, 15, 21] as const;

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
  const [isCustomLimitOpen, setIsCustomLimitOpen] = useState(false);
  const [customLimitInput, setCustomLimitInput] = useState('');

  const teamA = court.teams[0];
  const teamB = court.teams[1];

  const baseLimit = court.score.baseLimit ?? court.score.limit ?? 11;
  const scoreA = court.score.scoreA;
  const scoreB = court.score.scoreB;
  const isWonA = scoreA >= baseLimit && scoreA - scoreB >= 2;
  const isWonB = scoreB >= baseLimit && scoreB - scoreA >= 2;
  const isGameWon = isWonA || isWonB;
  const isDeuce = !isGameWon && scoreA >= baseLimit - 1 && scoreB >= baseLimit - 1;
  const currentTarget = isDeuce
    ? Math.max(baseLimit, Math.min(scoreA, scoreB) + 2)
    : baseLimit;

  const isCustomActive = !PRESET_LIMITS.includes(baseLimit as (typeof PRESET_LIMITS)[number]);

  // Score Capping: when game is won, no team can increment further!
  const canAddA = isHost && !isGameWon;
  const canAddB = isHost && !isGameWon;
  const canSubtractA = isHost && scoreA > 0;
  const canSubtractB = isHost && scoreB > 0;

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
              flexWrap: 'wrap',
              gap: '8px',
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              {isHost && onScoreLimitChange ? (
                <>
                  {PRESET_LIMITS.map((preset) => {
                    const isActive = baseLimit === preset && !isCustomLimitOpen;
                    return (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setIsCustomLimitOpen(false);
                          onScoreLimitChange(preset);
                        }}
                        style={{
                          fontSize: 'var(--fs-xs, 0.8125rem)',
                          color: isActive ? '#ffffff' : 'var(--text-secondary, #cbd5e1)',
                          background: isActive ? 'var(--accent-primary, #5457e0)' : 'var(--surface-elevated, #1a2035)',
                          border: `1px solid ${isActive ? 'transparent' : 'var(--line-subtle, #252d47)'}`,
                          borderRadius: 'var(--r-pill, 9999px)',
                          padding: '3px 10px',
                          cursor: 'pointer',
                          fontWeight: isActive ? 700 : 600,
                          transition: 'all 0.15s ease',
                        }}
                        title={`Play to ${preset}`}
                      >
                        {preset}
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomLimitOpen((prev) => !prev);
                      setCustomLimitInput(isCustomActive ? String(baseLimit) : '');
                    }}
                    style={{
                      fontSize: 'var(--fs-xs, 0.8125rem)',
                      color: isCustomActive || isCustomLimitOpen ? '#ffffff' : 'var(--text-secondary, #cbd5e1)',
                      background: isCustomActive || isCustomLimitOpen ? 'var(--accent-primary, #5457e0)' : 'var(--surface-elevated, #1a2035)',
                      border: `1px solid ${isCustomActive || isCustomLimitOpen ? 'transparent' : 'var(--line-subtle, #252d47)'}`,
                      borderRadius: 'var(--r-pill, 9999px)',
                      padding: '3px 10px',
                      cursor: 'pointer',
                      fontWeight: (isCustomActive || isCustomLimitOpen) ? 700 : 600,
                      transition: 'all 0.15s ease',
                    }}
                    title="Set a special score limit"
                  >
                    {isCustomActive ? `Special (${baseLimit})` : 'Special'}
                  </button>
                </>
              ) : (
                <span
                  style={{
                    fontSize: 'var(--fs-xs, 0.8125rem)',
                    color: 'var(--text-muted, #94a3b8)',
                    background: 'var(--surface-elevated, #1a2035)',
                    border: '1px solid var(--line-subtle, #252d47)',
                    borderRadius: 'var(--r-pill, 9999px)',
                    padding: '3px 10px',
                    fontWeight: 600,
                  }}
                >
                  to {currentTarget}
                </span>
              )}

              {isHost && onResetScore && (
                <button
                  type="button"
                  onClick={onResetScore}
                  style={{
                    fontSize: 'var(--fs-xs, 0.8125rem)',
                    color: 'var(--text-muted, #94a3b8)',
                    background: 'var(--surface-elevated, #1a2035)',
                    border: '1px solid var(--line-subtle, #252d47)',
                    borderRadius: 'var(--r-pill, 9999px)',
                    padding: '3px 9px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                  title="Reset score to 0–0"
                >
                  <RotateCcw size={12} />
                  Reset
                </button>
              )}
            </div>
          </div>

          {/* Special limit inline form */}
          {isCustomLimitOpen && isHost && onScoreLimitChange && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const val = parseInt(customLimitInput, 10);
                if (!isNaN(val) && val >= 2 && val <= 99) {
                  onScoreLimitChange(val);
                  setIsCustomLimitOpen(false);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                background: 'var(--surface-elevated, #1a2035)',
                border: '1px solid var(--line-subtle, #252d47)',
                borderRadius: 'var(--r-md, 14px)',
              }}
            >
              <span style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-secondary, #cbd5e1)', fontWeight: 600 }}>
                Special limit:
              </span>
              <input
                type="number"
                min={2}
                max={99}
                value={customLimitInput}
                onChange={(e) => setCustomLimitInput(e.target.value)}
                placeholder="e.g. 7"
                autoFocus
                style={{
                  width: '64px',
                  padding: '4px 8px',
                  fontSize: '16px', // Prevents iOS Safari auto-zoom
                  background: 'var(--surface-bg, #0b0d17)',
                  border: '1px solid var(--line-subtle, #252d47)',
                  borderRadius: '6px',
                  color: 'var(--text-primary, #f8fafc)',
                  textAlign: 'center',
                  fontWeight: 700,
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '5px 12px',
                  background: 'var(--accent-primary, #5457e0)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: 'var(--fs-xs, 0.8125rem)',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Check size={12} />
                Set
              </button>
              <button
                type="button"
                onClick={() => setIsCustomLimitOpen(false)}
                style={{
                  padding: '5px 8px',
                  background: 'transparent',
                  color: 'var(--text-muted, #94a3b8)',
                  border: 'none',
                  fontSize: 'var(--fs-xs, 0.8125rem)',
                  cursor: 'pointer',
                }}
              >
                <X size={14} />
              </button>
            </form>
          )}

          {/* Deuce Badge */}
          {isDeuce && (
            <div
              style={{
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                borderRadius: 'var(--r-sm, 10px)',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: 'var(--fs-xs, 0.8125rem)',
                color: '#fde047',
                fontWeight: 600,
              }}
            >
              <span>⚡ Deuce! Must win by 2 points (playing to {currentTarget})</span>
            </div>
          )}

          {/* Game Over Banner */}
          {isGameWon && (
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                borderRadius: 'var(--r-sm, 10px)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                fontSize: 'var(--fs-xs, 0.8125rem)',
                color: '#86efac',
                fontWeight: 600,
              }}
            >
              <span>🎉 Game Over · {isWonA ? teamA.players.join(' & ') : teamB.players.join(' & ')} reached limit ({scoreA}–{scoreB})!</span>
              {isHost && matchFlow.stage === 'idle' && (
                <button
                  type="button"
                  onClick={() => matchFlow.chooseWinner(isWonA ? 'A' : 'B')}
                  style={{
                    background: 'var(--status-success, #22c55e)',
                    color: '#090a12',
                    border: 'none',
                    borderRadius: 'var(--r-pill, 9999px)',
                    padding: '4px 12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    fontSize: 'var(--fs-xs, 0.8125rem)',
                    flexShrink: 0,
                  }}
                >
                  Select Winner
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2_5, 10px)' }}>
            <ScoreRow
              side="A"
              players={teamA.players}
              score={court.score.scoreA}
              isWinner={matchFlow.winner === 'A' || isWonA}
              onAdjustScore={handleScoreAdjust}
              disabled={!isHost}
              canAdd={canAddA}
              canSubtract={canSubtractA}
            />
            <ScoreRow
              side="B"
              players={teamB.players}
              score={court.score.scoreB}
              isWinner={matchFlow.winner === 'B' || isWonB}
              onAdjustScore={handleScoreAdjust}
              disabled={!isHost}
              canAdd={canAddB}
              canSubtract={canSubtractB}
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
