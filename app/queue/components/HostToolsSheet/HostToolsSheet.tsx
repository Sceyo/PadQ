'use client';

import React, { useState } from 'react';
import {
  UserPlus,
  Trophy,
  Users,
  ListOrdered,
  Coffee,
  Activity,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { BottomSheet } from '../OverlayHost/BottomSheet';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddPlayer: (name: string) => void;
  scorePromptEnabled: boolean;
  onToggleScorePrompt: () => void;
  partnerPanelNode?: React.ReactNode;
  manualQueuePanelNode?: React.ReactNode;
  sitOutPanelNode?: React.ReactNode;
  diagnosticsNode?: React.ReactNode;
}

export function HostToolsSheet({
  isOpen,
  onClose,
  onAddPlayer,
  scorePromptEnabled,
  onToggleScorePrompt,
  partnerPanelNode,
  manualQueuePanelNode,
  sitOutPanelNode,
  diagnosticsNode,
}: Props) {
  const [playerName, setPlayerName] = useState('');
  const [openPartners, setOpenPartners] = useState(false);
  const [openManualQueue, setOpenManualQueue] = useState(false);
  const [openSitOut, setOpenSitOut] = useState(false);
  const [openDiagnostics, setOpenDiagnostics] = useState(false);

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
      description="Session management, late additions, and engine settings"
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
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <UserPlus size={14} />
            <span>Add Late Player</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Trophy size={18} style={{ color: 'var(--accent-primary, #5457e0)' }} />
            <div>
              <div style={{ fontSize: 'var(--fs-sm, 0.9375rem)', fontWeight: 700, color: 'var(--text-primary, #f8fafc)' }}>
                Match Scores
              </div>
              <div style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: 'var(--text-muted, #94a3b8)' }}>
                {scorePromptEnabled ? 'Enter scores before winning' : 'Tap winners directly'}
              </div>
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

        {/* 3. Lock Doubles Partners Panel */}
        {partnerPanelNode && (
          <div>
            <button
              type="button"
              onClick={() => setOpenPartners(p => !p)}
              style={{
                width: '100%',
                minHeight: 'var(--tap-min, 44px)',
                padding: '10px var(--sp-3, 12px)',
                borderRadius: 'var(--r-md, 14px)',
                border: '1px solid var(--line-subtle, #252d47)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} style={{ color: 'var(--team-b-text, #60a5fa)' }} />
                <span>Lock Doubles Partners</span>
              </div>
              {openPartners ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openPartners && (
              <div style={{ marginTop: '8px', padding: '10px', background: 'var(--surface-elevated, #1a2035)', borderRadius: '12px' }}>
                {partnerPanelNode}
              </div>
            )}
          </div>
        )}

        {/* 4. Manual Queue Management Panel */}
        {manualQueuePanelNode && (
          <div>
            <button
              type="button"
              onClick={() => setOpenManualQueue(m => !m)}
              style={{
                width: '100%',
                minHeight: 'var(--tap-min, 44px)',
                padding: '10px var(--sp-3, 12px)',
                borderRadius: 'var(--r-md, 14px)',
                border: '1px solid var(--line-subtle, #252d47)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ListOrdered size={16} style={{ color: 'var(--accent-primary, #5457e0)' }} />
                <span>Manage / Reorder Queue</span>
              </div>
              {openManualQueue ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openManualQueue && (
              <div style={{ marginTop: '8px', padding: '10px', background: 'var(--surface-elevated, #1a2035)', borderRadius: '12px' }}>
                {manualQueuePanelNode}
              </div>
            )}
          </div>
        )}

        {/* 5. Sit-Out / On Break Panel */}
        {sitOutPanelNode && (
          <div>
            <button
              type="button"
              onClick={() => setOpenSitOut(s => !s)}
              style={{
                width: '100%',
                minHeight: 'var(--tap-min, 44px)',
                padding: '10px var(--sp-3, 12px)',
                borderRadius: 'var(--r-md, 14px)',
                border: '1px solid var(--line-subtle, #252d47)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Coffee size={16} style={{ color: 'var(--status-warn, #f59e0b)' }} />
                <span>Manage Players On Break</span>
              </div>
              {openSitOut ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openSitOut && (
              <div style={{ marginTop: '8px', padding: '10px', background: 'var(--surface-elevated, #1a2035)', borderRadius: '12px' }}>
                {sitOutPanelNode}
              </div>
            )}
          </div>
        )}

        {/* 6. Engine Diagnostics */}
        {diagnosticsNode && (
          <div>
            <button
              type="button"
              onClick={() => setOpenDiagnostics(d => !d)}
              style={{
                width: '100%',
                minHeight: 'var(--tap-min, 44px)',
                padding: '10px var(--sp-3, 12px)',
                borderRadius: 'var(--r-md, 14px)',
                border: '1px solid var(--line-subtle, #252d47)',
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={16} style={{ color: 'var(--status-success, #22c55e)' }} />
                <span>Engine Diagnostics</span>
              </div>
              {openDiagnostics ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openDiagnostics && (
              <div style={{ marginTop: '8px', padding: '10px', background: 'var(--surface-elevated, #1a2035)', borderRadius: '12px' }}>
                {diagnosticsNode}
              </div>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
