'use client';

import React from 'react';

interface Props {
  side: 'A' | 'B';
  players: string[];
  score: number;
  isWinner: boolean;
  onAdjustScore: (side: 'A' | 'B', delta: number) => void;
  disabled?: boolean;
  canAdd?: boolean;
  canSubtract?: boolean;
}

export function ScoreRow({
  side,
  players,
  score,
  isWinner,
  onAdjustScore,
  disabled = false,
  canAdd = true,
  canSubtract = true,
}: Props) {
  const isA = side === 'A';
  const color = isA ? 'var(--team-a-text, #4ade80)' : 'var(--team-b-text, #60a5fa)';
  const activeBorder = isWinner
    ? (isA ? 'var(--team-a-text, #4ade80)' : 'var(--team-b-text, #60a5fa)')
    : 'var(--line-subtle, #252d47)';

  return (
    <div
      style={{
        background: 'var(--surface-bg-alt, #0b0d17)',
        border: `1.5px solid ${activeBorder}`,
        boxShadow: isWinner ? `0 0 0 1px ${activeBorder}` : 'none',
        borderRadius: 'var(--r-md, 14px)',
        padding: 'var(--sp-3, 12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
      }}
    >
      {/* 2-line wrapped player names */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          fontSize: 'var(--fs-sm, 0.9375rem)',
          fontWeight: 700,
          lineHeight: 'var(--lh-snug, 1.25)',
          color,
          minWidth: 0,
          flex: 1,
          paddingRight: 'var(--sp-2, 8px)',
        }}
      >
        {players.map((p, idx) => (
          <span
            key={`${p}-${idx}`}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {p}
          </span>
        ))}
      </div>

      {/* [ − ] score [ + ] with 44px buttons */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-3, 12px)',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={() => onAdjustScore(side, -1)}
          disabled={disabled || score <= 0 || !canSubtract}
          aria-label={`Decrease Team ${side} score`}
          style={{
            width: 'var(--tap-min, 44px)',
            height: 'var(--tap-min, 44px)',
            borderRadius: 'var(--r-sm, 10px)',
            border: '1.5px solid var(--line-strong, #252d47)',
            background: 'var(--surface-card, #1a2035)',
            color: 'var(--text-primary, #f8fafc)',
            fontSize: '1.25rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled || score <= 0 || !canSubtract ? 'default' : 'pointer',
            opacity: disabled || score <= 0 || !canSubtract ? 0.45 : 1,
            boxShadow: 'var(--shadow-sm)',
            transition: 'background 0.15s ease, transform 0.1s ease',
          }}
        >
          −
        </button>

        <span
          className="tabular-nums"
          style={{
            fontSize: 'var(--fs-xl, 2.125rem)',
            fontWeight: 800,
            color: 'var(--text-primary, #f8fafc)',
            minWidth: '2.4rem',
            textAlign: 'center',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {score}
        </span>

        <button
          type="button"
          onClick={() => onAdjustScore(side, 1)}
          disabled={disabled || !canAdd}
          aria-label={`Increase Team ${side} score`}
          style={{
            width: 'var(--tap-min, 44px)',
            height: 'var(--tap-min, 44px)',
            borderRadius: 'var(--r-sm, 10px)',
            border: 'none',
            background: 'var(--accent-primary, #5457e0)',
            color: '#ffffff',
            fontSize: '1.25rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: disabled || !canAdd ? 'default' : 'pointer',
            opacity: disabled || !canAdd ? 0.35 : 1,
            transition: 'background 0.15s ease, transform 0.1s ease',
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}
