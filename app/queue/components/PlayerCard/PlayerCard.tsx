'use client';

import React from 'react';

interface Props {
  name: string;
  side: 'A' | 'B';
  onTap: (name: string) => void;
  disabled?: boolean;
}

export function PlayerCard({ name, side, onTap, disabled = false }: Props) {
  const isA = side === 'A';
  return (
    <button
      type="button"
      onClick={() => !disabled && onTap(name)}
      disabled={disabled}
      aria-label={`Player ${name}, Team ${side}`}
      style={{
        height: 'var(--player-card-h, 48px)',
        minHeight: 'var(--tap-min, 44px)',
        width: '100%',
        background: 'var(--surface-bg, #0b0d17)',
        border: `1.5px solid ${isA ? 'var(--team-a-border)' : 'var(--team-b-border)'}`,
        borderRadius: 'var(--r-md, 14px)',
        padding: '0 var(--sp-3, 12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: disabled ? 'default' : 'pointer',
        color: 'var(--text-primary, #f8fafc)',
        boxSizing: 'border-box',
        transition: 'transform 0.1s ease, border-color 0.15s ease',
      }}
    >
      <span
        style={{
          fontSize: 'var(--fs-base, 1rem)',
          fontWeight: 700,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
      <span
        style={{
          color: 'var(--text-muted, #94a3b8)',
          fontSize: '1.25rem',
          lineHeight: 1,
          marginLeft: 'var(--sp-2, 8px)',
        }}
      >
        ›
      </span>
    </button>
  );
}
