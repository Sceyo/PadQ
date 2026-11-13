'use client';

import React from 'react';
import { UserMinus, ArrowUp, ArrowDown, UserX, RotateCcw } from 'lucide-react';
import { BottomSheet } from '../OverlayHost/BottomSheet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  zone?: 'playing' | 'waiting' | 'break';
  isPriority?: boolean;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  moveUpDisabledReason?: string;
  onReplace?: (name: string) => void;
  onTakeBreak?: (name: string) => void;
  onBackIn?: (name: string) => void;
  onMoveUp?: (name: string) => void;
  onMoveDown?: (name: string) => void;
  onRemove?: (name: string) => void;
}

export function PlayerMenu({
  isOpen,
  onClose,
  playerName,
  zone = 'waiting',
  isPriority = false,
  canMoveUp = false,
  canMoveDown = false,
  moveUpDisabledReason,
  onReplace,
  onTakeBreak,
  onBackIn,
  onMoveUp,
  onMoveDown,
  onRemove,
}: Props) {
  if (!isOpen) return null;

  const zoneLabel =
    zone === 'playing' ? 'Now Playing' : zone === 'waiting' ? 'Waiting in Line' : 'On Break';

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={playerName}
      description={`${zoneLabel}${isPriority ? ' · Next up Priority' : ''}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2_5, 10px)' }}>
        {/* ON COURT (zone === 'playing') */}
        {zone === 'playing' && onReplace && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onReplace(playerName);
            }}
            style={{
              minHeight: 'var(--tap-min, 48px)',
              padding: '12px var(--sp-4, 16px)',
              borderRadius: 'var(--r-md, 14px)',
              border: '1.5px solid var(--line-subtle, #252d47)',
              background: 'var(--surface-bg, #0b0d17)',
              color: 'var(--text-primary, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserMinus size={18} style={{ color: 'var(--accent-primary, #5457e0)' }} />
              <div>
                <div style={{ fontSize: 'var(--fs-base, 1rem)', fontWeight: 700 }}>
                  Replace player
                </div>
                <div style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
                  Step off court & move to break; choose waiting sub
                </div>
              </div>
            </div>
          </button>
        )}

        {/* WAITING IN QUEUE (zone === 'waiting') */}
        {zone === 'waiting' && onTakeBreak && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onTakeBreak(playerName);
            }}
            style={{
              minHeight: 'var(--tap-min, 48px)',
              padding: '12px var(--sp-4, 16px)',
              borderRadius: 'var(--r-md, 14px)',
              border: '1.5px solid var(--line-subtle, #252d47)',
              background: 'var(--surface-bg, #0b0d17)',
              color: 'var(--text-primary, #f8fafc)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserMinus size={18} style={{ color: 'var(--status-warn, #f59e0b)' }} />
              <div>
                <div style={{ fontSize: 'var(--fs-base, 1rem)', fontWeight: 700 }}>
                  Take a break
                </div>
                <div style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
                  Pause turns; get priority when returning
                </div>
              </div>
            </div>
          </button>
        )}

        {zone === 'waiting' && onMoveUp && (
          <button
            type="button"
            disabled={!canMoveUp}
            title={moveUpDisabledReason}
            onClick={() => {
              onClose();
              onMoveUp(playerName);
            }}
            style={{
              minHeight: 'var(--tap-min, 48px)',
              padding: '12px var(--sp-4, 16px)',
              borderRadius: 'var(--r-md, 14px)',
              border: '1.5px solid var(--line-subtle, #252d47)',
              background: 'var(--surface-bg, #0b0d17)',
              color: canMoveUp ? 'var(--text-primary, #f8fafc)' : 'var(--text-muted, #94a3b8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: canMoveUp ? 'pointer' : 'not-allowed',
              opacity: canMoveUp ? 1 : 0.45,
              textAlign: 'left',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ArrowUp size={18} />
              <div>
                <div style={{ fontSize: 'var(--fs-base, 1rem)', fontWeight: 700 }}>
                  Move up in line
                </div>
                {moveUpDisabledReason && (
                  <div style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--status-warn, #f59e0b)' }}>
                    {moveUpDisabledReason}
                  </div>
                )}
              </div>
            </div>
          </button>
        )}

        {zone === 'waiting' && onMoveDown && (
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={() => {
              onClose();
              onMoveDown(playerName);
            }}
            style={{
              minHeight: 'var(--tap-min, 48px)',
              padding: '12px var(--sp-4, 16px)',
              borderRadius: 'var(--r-md, 14px)',
              border: '1.5px solid var(--line-subtle, #252d47)',
              background: 'var(--surface-bg, #0b0d17)',
              color: canMoveDown ? 'var(--text-primary, #f8fafc)' : 'var(--text-muted, #94a3b8)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: canMoveDown ? 'pointer' : 'not-allowed',
              opacity: canMoveDown ? 1 : 0.45,
              textAlign: 'left',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <ArrowDown size={18} />
              <div>
                <div style={{ fontSize: 'var(--fs-base, 1rem)', fontWeight: 700 }}>
                  Move down in line
                </div>
              </div>
            </div>
          </button>
        )}

        {/* ON BREAK (zone === 'break') */}
        {zone === 'break' && onBackIn && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onBackIn(playerName);
            }}
            style={{
              minHeight: 'var(--tap-min, 48px)',
              padding: '12px var(--sp-4, 16px)',
              borderRadius: 'var(--r-md, 14px)',
              border: '1.5px solid var(--accent-primary, #5457e0)',
              background: 'rgba(84, 87, 224, 0.12)',
              color: 'var(--accent-primary, #5457e0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <RotateCcw size={18} />
              <div>
                <div style={{ fontSize: 'var(--fs-base, 1rem)', fontWeight: 700 }}>
                  Back in (Next up)
                </div>
                <div style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
                  Return to queue with priority for next game
                </div>
              </div>
            </div>
          </button>
        )}

        {/* REMOVE / CAN'T PLAY NOW */}
        {onRemove && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onRemove(playerName);
            }}
            style={{
              minHeight: 'var(--tap-min, 48px)',
              padding: '12px var(--sp-4, 16px)',
              borderRadius: 'var(--r-md, 14px)',
              border: '1.5px solid var(--status-danger-bg, rgba(239, 68, 68, 0.3))',
              background: 'rgba(239, 68, 68, 0.08)',
              color: 'var(--status-danger, #ef4444)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
              textAlign: 'left',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <UserX size={18} />
              <div>
                <div style={{ fontSize: 'var(--fs-base, 1rem)', fontWeight: 700 }}>
                  Can&apos;t play now
                </div>
                <div style={{ fontSize: 'var(--fs-xs, 0.8125rem)', opacity: 0.8 }}>
                  Remove from {zone === 'playing' ? 'court' : 'queue'}
                </div>
              </div>
            </div>
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
