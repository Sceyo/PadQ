'use client';

import React from 'react';
import type { MatchFlowStage } from '../../hooks/useMatchFlow';

interface Props {
  winner: 'A' | 'B' | null;
  stage: MatchFlowStage;
  winnerLabel: string;
  nextUpLabel?: string;
  scoreLabel?: string;
  onChooseWinner: (side: 'A' | 'B') => void;
  onClearWinner: () => void;
  onConfirm: () => void;
  disabled?: boolean;
  sideALabel?: string;
  sideBLabel?: string;
  isScoreZeroAndEnabled?: boolean;
}

export function ConfirmBar({
  winner,
  stage,
  winnerLabel,
  nextUpLabel,
  scoreLabel,
  onChooseWinner,
  onClearWinner,
  onConfirm,
  disabled = false,
  sideALabel,
  sideBLabel,
  isScoreZeroAndEnabled = false,
}: Props) {
  const isSaving = stage === 'saving' || stage === 'slow';
  const isFailed = stage === 'failed';

  return (
    <footer
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--surface-modal, #16192b)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        borderTop: '1px solid var(--line-subtle, #252d47)',
        padding: 'var(--sp-3, 12px) var(--sp-4, 16px) calc(var(--safe-bottom, 0px) + var(--sp-3, 12px))',
        zIndex: 'var(--z-action-bar, 200)',
        boxSizing: 'border-box',
      }}
    >
      {!winner ? (
        /* State A: WHO WON? */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2, 8px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px' }}>
            <span
              style={{
                fontSize: 'var(--fs-xs, 0.8125rem)',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: isScoreZeroAndEnabled ? 'var(--status-warn, #f59e0b)' : 'var(--text-muted, #94a3b8)',
              }}
            >
              WHO WON?
            </span>
            {isScoreZeroAndEnabled && (
              <span
                style={{
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  color: 'var(--status-warn, #f59e0b)',
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                }}
              >
                Score is 0–0 · Enter score above or turn Match Scores off
              </span>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-3, 12px)' }}>
            <button
              type="button"
              onClick={() => onChooseWinner('A')}
              disabled={disabled || isScoreZeroAndEnabled}
              title={isScoreZeroAndEnabled ? 'Enter score above or switch Match Scores off in Host Tools (≡)' : undefined}
              style={{
                height: 'var(--tap-min, 48px)',
                minHeight: 'var(--tap-min, 44px)',
                borderRadius: 'var(--r-md, 14px)',
                border: '1.5px solid var(--line-subtle, #252d47)',
                background: 'var(--surface-bg-alt, #1a2035)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: 'var(--fs-sm, 0.9375rem)',
                fontWeight: 700,
                cursor: (disabled || isScoreZeroAndEnabled) ? 'not-allowed' : 'pointer',
                opacity: (disabled || isScoreZeroAndEnabled) ? 0.35 : 1,
                transition: 'border-color 0.15s ease, opacity 0.15s ease',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '0 8px',
              }}
            >
              {sideALabel ?? 'Team A'}
            </button>
            <button
              type="button"
              onClick={() => onChooseWinner('B')}
              disabled={disabled || isScoreZeroAndEnabled}
              title={isScoreZeroAndEnabled ? 'Enter score above or switch Match Scores off in Host Tools (≡)' : undefined}
              style={{
                height: 'var(--tap-min, 48px)',
                minHeight: 'var(--tap-min, 44px)',
                borderRadius: 'var(--r-md, 14px)',
                border: '1.5px solid var(--line-subtle, #252d47)',
                background: 'var(--surface-bg-alt, #1a2035)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: 'var(--fs-sm, 0.9375rem)',
                fontWeight: 700,
                cursor: (disabled || isScoreZeroAndEnabled) ? 'not-allowed' : 'pointer',
                opacity: (disabled || isScoreZeroAndEnabled) ? 0.35 : 1,
                transition: 'border-color 0.15s ease, opacity 0.15s ease',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                padding: '0 8px',
              }}
            >
              {sideBLabel ?? 'Team B'}
            </button>
          </div>
        </div>
      ) : (
        /* State B: WINNER CHOSEN -> EXACTLY ONE CONFIRM RESULT BAR */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2_5, 10px)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--sp-2, 8px)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 'var(--fs-sm, 0.9375rem)',
                  fontWeight: 700,
                  color: 'var(--text-primary, #f8fafc)',
                }}
              >
                {winnerLabel} won{scoreLabel ? ` ${scoreLabel}` : ''}
              </div>
              {nextUpLabel && (
                <div
                  style={{
                    fontSize: 'var(--fs-xs, 0.8125rem)',
                    color: 'var(--text-muted, #94a3b8)',
                  }}
                >
                  Next on court: {nextUpLabel}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClearWinner}
              disabled={isSaving}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-primary, #5457e0)',
                fontSize: 'var(--fs-xs, 0.8125rem)',
                fontWeight: 700,
                padding: 'var(--sp-1, 4px) var(--sp-2, 8px)',
                cursor: isSaving ? 'default' : 'pointer',
                borderRadius: 'var(--r-xs, 6px)',
              }}
            >
              Change
            </button>
          </div>

          {isFailed && (
            <div
              role="alert"
              style={{
                fontSize: 'var(--fs-xs, 0.8125rem)',
                color: '#f87171',
                background: 'rgba(239, 68, 68, 0.12)',
                padding: '6px 12px',
                borderRadius: 'var(--r-xs, 6px)',
              }}
            >
              Save failed. Check your connection and try again.
            </div>
          )}

          {isScoreZeroAndEnabled && (
            <div
              role="alert"
              style={{
                fontSize: 'var(--fs-xs, 0.8125rem)',
                color: 'var(--status-warn, #f59e0b)',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                padding: '6px 12px',
                borderRadius: 'var(--r-xs, 6px)',
              }}
            >
              Score is 0–0. Enter points above or switch Match Scores off in Host Tools (≡).
            </div>
          )}

          <button
            type="button"
            onClick={onConfirm}
            disabled={isSaving || isScoreZeroAndEnabled}
            style={{
              width: '100%',
              height: 'var(--tap-min, 50px)',
              minHeight: 'var(--tap-min, 44px)',
              borderRadius: 'var(--r-md, 14px)',
              border: 'none',
              background: isFailed ? 'var(--status-danger, #ef4444)' : 'var(--accent-primary, #5457e0)',
              color: '#ffffff',
              fontSize: 'var(--fs-base, 1rem)',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--sp-2, 8px)',
              cursor: (isSaving || isScoreZeroAndEnabled) ? 'not-allowed' : 'pointer',
              opacity: (isSaving || isScoreZeroAndEnabled) ? 0.45 : 1,
              transition: 'background 0.15s ease, transform 0.1s ease',
              boxShadow: 'var(--shadow-md, 0 4px 16px rgba(0,0,0,0.45))',
            }}
          >
            {isScoreZeroAndEnabled
              ? 'Enter score above to confirm'
              : stage === 'slow'
              ? 'Still saving, check your connection…'
              : isSaving
              ? 'Saving…'
              : isFailed
              ? 'Try Again'
              : 'Confirm result'}
          </button>
        </div>
      )}
    </footer>
  );
}
