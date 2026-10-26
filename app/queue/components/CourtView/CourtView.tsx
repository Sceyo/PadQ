'use client';

import React from 'react';
import { PlayerCard } from '../PlayerCard/PlayerCard';
import type { CourtViewModel } from '../../lib/viewModels';

interface Props {
  court: CourtViewModel;
  onEditTeams?: () => void;
  onSelectPlayer: (player: string) => void;
  disabled?: boolean;
}

export function CourtView({
  court,
  onEditTeams,
  onSelectPlayer,
  disabled = false,
}: Props) {
  const teamA = court.teams[0];
  const teamB = court.teams[1];

  return (
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
      {/* Header: Court Name, Now playing pill, Edit teams button */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2_5, 10px)' }}>
          <h2
            style={{
              margin: 0,
              fontSize: 'var(--fs-base, 1rem)',
              fontWeight: 700,
              color: 'var(--text-primary, #f8fafc)',
            }}
          >
            {court.name}
          </h2>
          <span
            style={{
              fontSize: 'var(--fs-xs, 0.8125rem)',
              fontWeight: 700,
              color: 'var(--status-success, #22c55e)',
              background: 'var(--status-success-bg, rgba(34, 197, 94, 0.12))',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: 'var(--r-pill, 9999px)',
              padding: '2px 10px',
            }}
          >
            Now playing
          </span>
        </div>

        {court.canEdit && onEditTeams && (
          <button
            type="button"
            onClick={onEditTeams}
            disabled={disabled}
            style={{
              minHeight: 'var(--tap-min, 44px)',
              padding: '0 var(--sp-3_5, 14px)',
              borderRadius: 'var(--r-sm, 10px)',
              border: '1px solid var(--line-subtle, #252d47)',
              background: 'var(--surface-elevated, #1a2035)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: 'var(--fs-xs, 0.8125rem)',
              fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
              transition: 'border-color 0.15s ease',
            }}
          >
            Edit teams
          </button>
        )}
      </div>

      {/* Team A */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1_5, 6px)' }}>
        <span
          style={{
            fontSize: 'var(--fs-xs, 0.8125rem)',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--team-a-text, #4ade80)',
          }}
        >
          TEAM A
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2_5, 10px)' }}>
          {teamA.players.map((name) => (
            <PlayerCard
              key={`a-${name}`}
              name={name}
              side="A"
              onTap={onSelectPlayer}
              disabled={disabled}
            />
          ))}
        </div>
      </div>

      {/* Team B */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1_5, 6px)' }}>
        <span
          style={{
            fontSize: 'var(--fs-xs, 0.8125rem)',
            fontWeight: 800,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: 'var(--team-b-text, #60a5fa)',
          }}
        >
          TEAM B
        </span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2_5, 10px)' }}>
          {teamB.players.map((name) => (
            <PlayerCard
              key={`b-${name}`}
              name={name}
              side="B"
              onTap={onSelectPlayer}
              disabled={disabled}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
