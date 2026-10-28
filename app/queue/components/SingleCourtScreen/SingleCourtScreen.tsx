'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import styles from './SingleCourtScreen.module.css';

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
    setUserUnselectedWinner(false);
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

  const isSingles = teamA.players.length === 1 && teamB.players.length === 1;
  const sideALabel = isSingles ? (teamA.players[0] ?? 'Player 1') : 'Team A';
  const sideBLabel = isSingles ? (teamB.players[0] ?? 'Player 2') : 'Team B';

  // Option 1: End match early state & auto-select winner when limit is reached
  const [isEndEarlyActive, setIsEndEarlyActive] = useState(false);
  const [userUnselectedWinner, setUserUnselectedWinner] = useState(false);

  // Auto-detect winner: if score reached limit, the winner is mathematically known
  const effectiveWinner = matchFlow.winner ?? (
    userUnselectedWinner ? null : (court.score.enabled && isGameWon ? (isWonA ? 'A' : 'B') : null)
  );

  const winnerLabel = effectiveWinner === 'A'
    ? (isSingles ? (teamA.players[0] ?? 'Player 1') : teamA.players.join(' & '))
    : effectiveWinner === 'B'
    ? (isSingles ? (teamB.players[0] ?? 'Player 2') : teamB.players.join(' & '))
    : '';

  const nextUpLabel = queue.nextUp.map(p => p.name).join(', ');

  const currentScoreLabel = court.score.enabled && (court.score.scoreA > 0 || court.score.scoreB > 0)
    ? `${court.score.scoreA}–${court.score.scoreB}`
    : undefined;

  // Block confirming results when scoring is enabled but both scores are 0
  const isScoreZeroAndEnabled = Boolean(
    court.score.enabled && court.score.scoreA === 0 && court.score.scoreB === 0
  );

  // Auto-select winner when game reaches target limit
  useEffect(() => {
    if (
      court.score.enabled &&
      isGameWon &&
      matchFlow.stage === 'idle' &&
      !matchFlow.winner &&
      !userUnselectedWinner
    ) {
      matchFlow.chooseWinner(isWonA ? 'A' : 'B', currentScoreLabel);
    }
  }, [court.score.enabled, isGameWon, isWonA, isWonB, matchFlow.stage, matchFlow.winner, userUnselectedWinner, currentScoreLabel]);

  // If score drops below winning threshold during live adjustment, clear auto-selected winner
  useEffect(() => {
    if (court.score.enabled && !isGameWon && !isEndEarlyActive && matchFlow.winner && matchFlow.stage === 'ready') {
      matchFlow.clearWinner();
    }
  }, [court.score.enabled, isGameWon, isEndEarlyActive, matchFlow]);

  // Reset user manual selection override when game is no longer won
  useEffect(() => {
    if (!isGameWon) {
      setUserUnselectedWinner(false);
    }
  }, [isGameWon]);

  // Reset early-ending state on new match or court change
  useEffect(() => {
    setIsEndEarlyActive(false);
    setUserUnselectedWinner(false);
  }, [court.id, teamA.players.join(','), teamB.players.join(',')]);

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
    <div className={styles.container}>
      <div className={styles.courtSection}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
              <button
                type="button"
                className="scoreboard-toggle scoreboard-toggle--on"
                style={{
                  fontSize: 'var(--fs-xs, 0.75rem)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  border: '1px solid var(--accent-primary, #6366f1)',
                  background: 'rgba(99, 102, 241, 0.15)',
                  color: 'var(--accent-primary, #6366f1)',
                  fontWeight: 600,
                  cursor: 'default',
                }}
              >
                Scoring ON
              </button>
            </div>
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
                  <span
                    className="score-limit-badge"
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
                </>
              ) : (
                <span
                  className="score-limit-badge"
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
                  minHeight: 'var(--tap-min, 44px)',
                  justifyContent: 'center',
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
                  minHeight: 'var(--tap-min, 44px)',
                  minWidth: 'var(--tap-min, 44px)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
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
                background: 'var(--status-warn-bg, rgba(245, 158, 11, 0.15))',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                borderRadius: 'var(--r-sm, 10px)',
                padding: '6px 12px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: 'var(--fs-xs, 0.8125rem)',
                color: 'var(--status-warn, #f59e0b)',
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
                background: 'var(--status-success-bg, rgba(34, 197, 94, 0.12))',
                border: '1px solid rgba(34, 197, 94, 0.35)',
                borderRadius: 'var(--r-sm, 10px)',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontSize: 'var(--fs-xs, 0.8125rem)',
                color: 'var(--status-success, #22c55e)',
                fontWeight: 600,
              }}
            >
              <span>Game Over!</span>
              <span>Game Over · {isWonA ? (isSingles ? teamA.players[0] : teamA.players.join(' & ')) : (isSingles ? teamB.players[0] : teamB.players.join(' & '))} reached limit ({scoreA}–{scoreB})!</span>
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
      </div>

      <div className={styles.queueSection}>
        {/* 3. Queue Card */}
        <QueuePanel
          queue={queue}
          onSelectPlayer={(name, zone) => handlePlayerTap(name, zone ?? 'waiting')}
          onReturnFromBreak={onReturnFromBreak}
          statsMap={statsMap}
        />
      </div>

      {/* 4. Sticky Bottom Confirm Bar */}
      {isHost && (
        <ConfirmBar
          winner={effectiveWinner}
          stage={matchFlow.stage}
          winnerLabel={winnerLabel}
          nextUpLabel={nextUpLabel}
          scoreLabel={currentScoreLabel}
          onChooseWinner={(side) => {
            if (isScoreZeroAndEnabled) return;
            if (court.score.enabled && !isGameWon && !isEndEarlyActive) return;
            if (court.score.enabled && isGameWon && !isEndEarlyActive) {
              if (side === 'A' && isWonB) return;
              if (side === 'B' && isWonA) return;
            }
            setUserUnselectedWinner(false);
            matchFlow.chooseWinner(side, currentScoreLabel);
          }}
          onClearWinner={() => {
            setUserUnselectedWinner(true);
            matchFlow.clearWinner();
          }}
          onConfirm={() => {
            if (isScoreZeroAndEnabled) return;
            if (court.score.enabled && !isGameWon && !isEndEarlyActive) return;
            if (court.score.enabled && isGameWon && !isEndEarlyActive) {
              if (effectiveWinner === 'A' && isWonB) return;
              if (effectiveWinner === 'B' && isWonA) return;
            }
            if (effectiveWinner && !matchFlow.winner) {
              matchFlow.chooseWinner(effectiveWinner, currentScoreLabel);
            }
            matchFlow.confirmResult();
          }}
          sideALabel={sideALabel}
          sideBLabel={sideBLabel}
          isScoreZeroAndEnabled={isScoreZeroAndEnabled}
          scoreEnabled={court.score.enabled}
          isGameWon={isGameWon}
          isWonA={isWonA}
          isWonB={isWonB}
          targetLimit={baseLimit}
          isEndEarly={isEndEarlyActive}
          onToggleEndEarly={(active) => {
            setIsEndEarlyActive(active);
            if (!active && matchFlow.winner && !isGameWon) {
              matchFlow.clearWinner();
            }
          }}
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
          matchHasStarted={court.score.hasStarted}
        />
      )}
    </div>
  );
}
