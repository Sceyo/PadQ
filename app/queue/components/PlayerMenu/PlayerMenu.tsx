'use client';

import React from 'react';
import { BottomSheet } from '../OverlayHost/BottomSheet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  onReplace: (name: string) => void;
  onTakeBreak: (name: string) => void;
  onRemove: (name: string) => void;
}

export function PlayerMenu({
  isOpen,
  onClose,
  playerName,
  onReplace,
  onTakeBreak,
  onRemove,
}: Props) {
  if (!isOpen) return null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={playerName}
      description="Select an action for this player:"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2_5, 10px)' }}>
        {/* Replace Player */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onReplace(playerName);
          }}
          style={{
            height: 'var(--tap-min, 50px)',
            minHeight: 'var(--tap-min, 44px)',
            padding: '0 var(--sp-4, 16px)',
            borderRadius: 'var(--r-md, 14px)',
            border: '1.5px solid var(--line-subtle, #252d47)',
            background: 'var(--surface-bg, #0b0d17)',
            color: 'var(--text-primary, #f8fafc)',
            fontSize: 'var(--fs-base, 1rem)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <span>Replace player</span>
          <span style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
            Choose from waiting
          </span>
        </button>

        {/* Take a break */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onTakeBreak(playerName);
          }}
          style={{
            height: 'var(--tap-min, 50px)',
            minHeight: 'var(--tap-min, 44px)',
            padding: '0 var(--sp-4, 16px)',
            borderRadius: 'var(--r-md, 14px)',
            border: '1.5px solid var(--line-subtle, #252d47)',
            background: 'var(--surface-bg, #0b0d17)',
            color: 'var(--text-primary, #f8fafc)',
            fontSize: 'var(--fs-base, 1rem)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <span>Take a break</span>
          <span style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
            Pause rotation
          </span>
        </button>

        {/* Can't play now */}
        <button
          type="button"
          onClick={() => {
            onClose();
            onRemove(playerName);
          }}
          style={{
            height: 'var(--tap-min, 50px)',
            minHeight: 'var(--tap-min, 44px)',
            padding: '0 var(--sp-4, 16px)',
            borderRadius: 'var(--r-md, 14px)',
            border: '1.5px solid var(--status-danger-bg, rgba(239, 68, 68, 0.3))',
            background: 'rgba(239, 68, 68, 0.08)',
            color: 'var(--status-danger, #ef4444)',
            fontSize: 'var(--fs-base, 1rem)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
          }}
        >
          <span>Can&apos;t play now</span>
          <span style={{ fontSize: 'var(--fs-xs, 0.8125rem)', opacity: 0.8 }}>
            Remove
          </span>
        </button>
      </div>
    </BottomSheet>
  );
}
