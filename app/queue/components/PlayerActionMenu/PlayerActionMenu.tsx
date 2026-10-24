'use client';

import React, { useEffect } from 'react';
import { UserMinus, ArrowUp, ArrowDown, UserX, RotateCcw, X } from 'lucide-react';

export interface PlayerActionMenuProps {
  player: string | null;
  zone: 'playing' | 'waiting' | 'break';
  isHost: boolean;
  isPriority?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  moveUpDisabledReason?: string;
  onClose: () => void;
  onCantPlayNow?: () => void;
  onTakeBreak?: () => void;
  onBackIn?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function PlayerActionMenu({
  player,
  zone,
  isHost,
  isPriority = false,
  canMoveUp = false,
  canMoveDown = false,
  moveUpDisabledReason,
  onClose,
  onCantPlayNow,
  onTakeBreak,
  onBackIn,
  onMoveUp,
  onMoveDown,
}: PlayerActionMenuProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!player) return null;

  const zoneLabel =
    zone === 'playing' ? 'Now Playing' : zone === 'waiting' ? 'Waiting in Line' : 'On Break';

  return (
    <div className="player-menu-backdrop" onClick={onClose} role="presentation">
      <div
        className="player-menu-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Options for ${player}`}
        onClick={e => e.stopPropagation()}
      >
        <div className="player-menu-header">
          <div className="player-menu-title-block">
            <span className="player-menu-name">{player}</span>
            <span className="player-menu-badge">
              {zoneLabel}
              {isPriority && <span className="player-menu-prio"> · Next up</span>}
            </span>
          </div>
          <button
            type="button"
            className="player-menu-close-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        <div className="player-menu-actions">
          {zone === 'playing' && onCantPlayNow && (
            <button
              type="button"
              className="player-menu-btn player-menu-btn--danger"
              onClick={() => {
                onCantPlayNow();
                onClose();
              }}
            >
              <UserX size={16} />
              <span>Can&apos;t play now</span>
              <span className="player-menu-subtext">Step off court, next in line takes spot</span>
            </button>
          )}

          {zone === 'waiting' && onTakeBreak && (
            <button
              type="button"
              className="player-menu-btn"
              onClick={() => {
                onTakeBreak();
                onClose();
              }}
            >
              <UserMinus size={16} />
              <span>Take a break</span>
              <span className="player-menu-subtext">Pause turns; get priority when returning</span>
            </button>
          )}

          {zone === 'waiting' && isHost && onMoveUp && (
            <button
              type="button"
              className="player-menu-btn"
              disabled={!canMoveUp}
              title={moveUpDisabledReason}
              onClick={() => {
                onMoveUp();
                onClose();
              }}
            >
              <ArrowUp size={16} />
              <span>Move up in line</span>
              {moveUpDisabledReason && (
                <span className="player-menu-subtext">{moveUpDisabledReason}</span>
              )}
            </button>
          )}

          {zone === 'waiting' && isHost && onMoveDown && (
            <button
              type="button"
              className="player-menu-btn"
              disabled={!canMoveDown}
              onClick={() => {
                onMoveDown();
                onClose();
              }}
            >
              <ArrowDown size={16} />
              <span>Move down in line</span>
            </button>
          )}

          {zone === 'break' && onBackIn && (
            <button
              type="button"
              className="player-menu-btn player-menu-btn--primary"
              onClick={() => {
                onBackIn();
                onClose();
              }}
            >
              <RotateCcw size={16} />
              <span>Back in (Next up)</span>
              <span className="player-menu-subtext">Return to queue with priority for next game</span>
            </button>
          )}

          <button
            type="button"
            className="player-menu-btn player-menu-btn--cancel"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
