'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from '../OverlayHost/Dialog';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  courtName: string;
  /** onCourt[0..1] = Team A, onCourt[2..3] = Team B */
  onCourt: string[];
  onConfirm: (newOnCourt: string[]) => void;
}

export function EditTeamsDialog({
  isOpen,
  onClose,
  courtName,
  onCourt,
  onConfirm,
}: Props) {
  const [players, setPlayers] = useState<string[]>([...onCourt]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [swaps, setSwaps] = useState<Array<[number, number]>>([]);

  useEffect(() => {
    if (isOpen) {
      setPlayers([...onCourt]);
      setSelectedIdx(null);
      setSwaps([]);
    }
  }, [isOpen, onCourt]);

  if (!isOpen) return null;

  const handlePlayerTap = (idx: number) => {
    if (selectedIdx === null) {
      setSelectedIdx(idx);
      return;
    }
    if (selectedIdx === idx) {
      setSelectedIdx(null);
      return;
    }
    // Swap positions
    const next = [...players];
    [next[selectedIdx], next[idx]] = [next[idx], next[selectedIdx]];
    setPlayers(next);
    setSwaps(prev => [...prev, [selectedIdx, idx]]);
    setSelectedIdx(null);
  };

  const handleUndo = () => {
    if (swaps.length === 0) return;
    const last = swaps[swaps.length - 1];
    const next = [...players];
    [next[last[0]], next[last[1]]] = [next[last[1]], next[last[0]]];
    setPlayers(next);
    setSwaps(prev => prev.slice(0, -1));
    setSelectedIdx(null);
  };

  const hasChanges = players.join(',') !== onCourt.join(',');

  const renderSlot = (idx: number, side: 'A' | 'B') => {
    const isSelected = selectedIdx === idx;
    const isA = side === 'A';
    const border = isSelected
      ? 'var(--accent-primary, #5457e0)'
      : isA
      ? 'var(--team-a-border, rgba(74, 222, 128, 0.45))'
      : 'var(--team-b-border, rgba(96, 165, 250, 0.45))';

    return (
      <button
        key={idx}
        type="button"
        onClick={() => handlePlayerTap(idx)}
        aria-pressed={isSelected}
        style={{
          height: 'var(--tap-min, 48px)',
          padding: '0 var(--sp-3, 12px)',
          borderRadius: 'var(--r-md, 14px)',
          border: `2px solid ${border}`,
          background: 'var(--surface-bg, #0b0d17)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          color: 'var(--text-primary, #f8fafc)',
          boxSizing: 'border-box',
          transition: 'border-color 0.15s ease',
        }}
      >
        <span style={{ fontSize: 'var(--fs-base, 1rem)', fontWeight: 700 }}>
          {players[idx]}
        </span>
        <span
          style={{
            fontSize: 'var(--fs-xs, 0.8125rem)',
            color: isSelected ? 'var(--accent-primary, #5457e0)' : 'var(--text-muted, #94a3b8)',
            fontWeight: 600,
          }}
        >
          {isSelected ? 'Selected' : 'Swap'}
        </span>
      </button>
    );
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={`${courtName} — Edit teams`}
      description="Tap two players to swap their positions. Players on the same side are partners."
      footer={
        <>
          {swaps.length > 0 && (
            <button
              type="button"
              onClick={handleUndo}
              style={{
                marginRight: 'auto',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted, #94a3b8)',
                fontSize: 'var(--fs-xs, 0.8125rem)',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              ↩ Undo swap
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 'var(--tap-min, 44px)',
              padding: '0 var(--sp-4, 16px)',
              borderRadius: 'var(--r-sm, 10px)',
              border: '1px solid var(--line-subtle, #252d47)',
              background: 'var(--surface-elevated, #1a2035)',
              color: 'var(--text-primary, #f8fafc)',
              fontSize: 'var(--fs-sm, 0.9375rem)',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm(players);
              onClose();
            }}
            disabled={!hasChanges}
            style={{
              height: 'var(--tap-min, 44px)',
              padding: '0 var(--sp-5, 20px)',
              borderRadius: 'var(--r-sm, 10px)',
              border: 'none',
              background: 'var(--accent-primary, #5457e0)',
              color: '#ffffff',
              fontSize: 'var(--fs-sm, 0.9375rem)',
              fontWeight: 700,
              cursor: hasChanges ? 'pointer' : 'default',
              opacity: hasChanges ? 1 : 0.4,
            }}
          >
            Apply
          </button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4, 16px)' }}>
        {/* Team A */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2, 8px)' }}>
          <span
            style={{
              fontSize: 'var(--fs-xs, 0.8125rem)',
              fontWeight: 700,
              color: 'var(--team-a-text, #4ade80)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            TEAM A
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2, 8px)' }}>
            {renderSlot(0, 'A')}
            {renderSlot(1, 'A')}
          </div>
        </div>

        {/* Team B */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2, 8px)' }}>
          <span
            style={{
              fontSize: 'var(--fs-xs, 0.8125rem)',
              fontWeight: 700,
              color: 'var(--team-b-text, #60a5fa)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
            }}
          >
            TEAM B
          </span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-2, 8px)' }}>
            {renderSlot(2, 'B')}
            {renderSlot(3, 'B')}
          </div>
        </div>
      </div>
    </Dialog>
  );
}
