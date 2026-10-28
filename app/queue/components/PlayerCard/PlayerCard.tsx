'use client';

import React from 'react';
import { ChevronRight } from 'lucide-react';
import { PlayerLabel } from '../atoms/PlayerLabel';
import type { PlayerStat } from '../../lib/types';

interface Props {
  name: string;
  side: 'A' | 'B';
  onTap: (name: string) => void;
  disabled?: boolean;
  statsMap?: Record<string, PlayerStat>;
}

export function PlayerCard({ name, side, onTap, disabled = false, statsMap }: Props) {
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
        background: isA ? 'var(--team-a-bg, var(--surface-bg, #0b0d17))' : 'var(--team-b-bg, var(--surface-bg, #0b0d17))',
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
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <PlayerLabel name={name} statsMap={statsMap} showRank={false} />
      </span>
      <ChevronRight
        size={16}
        style={{
          color: 'var(--text-muted, #94a3b8)',
          flexShrink: 0,
          marginLeft: 'var(--sp-2, 8px)',
        }}
      />
    </button>
  );
}
