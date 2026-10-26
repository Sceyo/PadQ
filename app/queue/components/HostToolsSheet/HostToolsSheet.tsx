'use client';

import React, { useState } from 'react';
import { BottomSheet } from '../OverlayHost/BottomSheet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddPlayer: (name: string) => void;
  scorePromptEnabled: boolean;
  onToggleScorePrompt: () => void;
  onOpenManageQueue?: () => void;
  onOpenPartners?: () => void;
  isDoubles?: boolean;
}

export function HostToolsSheet({
  isOpen,
  onClose,
  onAddPlayer,
  scorePromptEnabled,
  onToggleScorePrompt,
  onOpenManageQueue,
  onOpenPartners,
  isDoubles = true,
}: Props) {
  const [playerName, setPlayerName] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = playerName.trim();
    if (!trimmed) return;
    onAddPlayer(trimmed);
    setPlayerName('');
    onClose();
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Host Tools"
      description="Session management and live adjustments"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4, 16px)' }}>
        {/* 1. Add Late Player (16px input to stop iOS zoom) */}
        <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2, 8px)' }}>
          <label
            htmlFor="host-add-player-input"
            style={{
              fontSize: 'var(--fs-xs, 0.8125rem)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted, #94a3b8)',
            }}
          >
            Add Late Player
          </label>
          <div style={{ display: 'flex', gap: 'var(--sp-2, 8px)' }}>
            <input
              id="host-add-player-input"
              type="text"
              placeholder="Player name…"
              value={playerName}
              onChange={e => setPlayerName(e.target.value)}
              style={{
                flex: 1,
                height: 'var(--tap-min, 44px)',
                padding: '0 var(--sp-3, 12px)',
                borderRadius: 'var(--r-sm, 10px)',
                border: '1.5px solid var(--line-subtle, #252d47)',
                background: 'var(--surface-bg, #0b0d17)',
                color: 'var(--text-primary, #f8fafc)',
                fontSize: '16px', // strictly 16px stops iOS auto-zoom
                outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!playerName.trim()}
              style={{
                height: 'var(--tap-min, 44px)',
                padding: '0 var(--sp-4, 16px)',
                borderRadius: 'var(--r-sm, 10px)',
                border: 'none',
                background: 'var(--accent-primary, #5457e0)',
                color: '#ffffff',
                fontSize: 'var(--fs-sm, 0.9375rem)',
                fontWeight: 700,
                cursor: playerName.trim() ? 'pointer' : 'default',
                opacity: playerName.trim() ? 1 : 0.4,
              }}
            >
              Add
            </button>
          </div>
        </form>

        <div style={{ height: '1px', background: 'var(--line-subtle, #252d47)' }} />

        {/* 2. Toggle Match Scores */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 'var(--fs-sm, 0.9375rem)', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
              Match Scores
            </div>
            <div style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
              {scorePromptEnabled ? 'Enter scores before winning' : 'Tap winners directly'}
            </div>
          </div>
          <button
            type="button"
            onClick={onToggleScorePrompt}
            aria-pressed={scorePromptEnabled}
            style={{
              height: 'var(--tap-min, 44px)',
              padding: '0 var(--sp-3_5, 14px)',
              borderRadius: 'var(--r-pill, 9999px)',
              border: '1.5px solid var(--line-subtle, #252d47)',
              background: scorePromptEnabled ? 'var(--status-success-bg, rgba(34, 197, 94, 0.12))' : 'var(--surface-elevated, #1a2035)',
              color: scorePromptEnabled ? 'var(--status-success, #22c55e)' : 'var(--text-muted, #94a3b8)',
              fontSize: 'var(--fs-xs, 0.8125rem)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {scorePromptEnabled ? 'ON' : 'OFF'}
          </button>
        </div>

        {/* 3. Queue Management tools if provided */}
        {onOpenManageQueue && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenManageQueue();
            }}
            style={{
              height: 'var(--tap-min, 48px)',
              padding: '0 var(--sp-4, 16px)',
              borderRadius: 'var(--r-md, 14px)',
              border: '1.5px solid var(--line-subtle, #252d47)',
              background: 'var(--surface-bg, #0b0d17)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: 'var(--fs-sm, 0.9375rem)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <span>Manage / Reorder Queue</span>
            <span style={{ color: 'var(--text-muted, #94a3b8)' }}>›</span>
          </button>
        )}

        {isDoubles && onOpenPartners && (
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPartners();
            }}
            style={{
              height: 'var(--tap-min, 48px)',
              padding: '0 var(--sp-4, 16px)',
              borderRadius: 'var(--r-md, 14px)',
              border: '1.5px solid var(--line-subtle, #252d47)',
              background: 'var(--surface-bg, #0b0d17)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: 'var(--fs-sm, 0.9375rem)',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <span>Lock Doubles Partners</span>
            <span style={{ color: 'var(--text-muted, #94a3b8)' }}>›</span>
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
