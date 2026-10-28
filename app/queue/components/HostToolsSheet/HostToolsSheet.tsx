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
  onAddPlayer: (name: string) => boolean | void;
  scorePromptEnabled: boolean;
  onToggleScorePrompt: () => void;
  partnerPanelNode?: React.ReactNode;
  manualQueuePanelNode?: React.ReactNode;
  sitOutPanelNode?: React.ReactNode;
  diagnosticsNode?: React.ReactNode;
  initialSection?: 'partners' | 'queue' | 'sitout';
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
  initialSection,
}: Props) {
  const [playerName, setPlayerName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openPartners, setOpenPartners] = useState(initialSection === 'partners');
  const [openManualQueue, setOpenManualQueue] = useState(initialSection === 'queue');
  const [openSitOut, setOpenSitOut] = useState(initialSection === 'sitout');
  const [openDiagnostics, setOpenDiagnostics] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (initialSection === 'queue') setOpenManualQueue(true);
      if (initialSection === 'partners') setOpenPartners(true);
      if (initialSection === 'sitout') setOpenSitOut(true);
    }
  }, [isOpen, initialSection]);

  if (!isOpen) return null;

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = playerName.trim();
    if (!trimmed) return;
    if (trimmed.length > 60) {
      setErrorMsg('Player names must be 60 characters or fewer');
      return;
    }
    const result = onAddPlayer(trimmed);
    if (result === false) {
      setErrorMsg(`"${trimmed}" could not be added (duplicate or session full)`);
      return;
    }
    setErrorMsg(null);
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
              maxLength={60}
              onChange={e => { setPlayerName(e.target.value); if (errorMsg) setErrorMsg(null); }}
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
          {errorMsg && (
            <div role="alert" style={{ fontSize: 'var(--fs-xs, 0.8125rem)', color: '#f87171', fontWeight: 600 }}>
              {errorMsg}
            </div>
          )}
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
            role="switch"
            aria-checked={scorePromptEnabled}
            aria-label="Toggle Match Scores"
            onClick={onToggleScorePrompt}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '44px',
              minWidth: '44px',
            }}
          >
            <span
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                width: '64px',
                height: '32px',
                borderRadius: '9999px',
                background: scorePromptEnabled ? '#22c55e' : 'var(--surface-elevated, #2a324b)',
                border: scorePromptEnabled ? '1px solid #16a34a' : '1px solid var(--line-subtle, #3b4461)',
                transition: 'background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease',
                boxShadow: scorePromptEnabled ? '0 0 10px rgba(34, 197, 94, 0.35)' : 'inset 0 1px 3px rgba(0, 0, 0, 0.25)',
                userSelect: 'none',
                boxSizing: 'border-box',
              }}
            >
              {/* Slider Track Text */}
              <span
                style={{
                  position: 'absolute',
                  left: scorePromptEnabled ? '11px' : 'auto',
                  right: scorePromptEnabled ? 'auto' : '10px',
                  fontSize: '11px',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                  color: scorePromptEnabled ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                  transition: 'opacity 0.2s ease',
                  lineHeight: 1,
                }}
              >
                {scorePromptEnabled ? 'ON' : 'OFF'}
              </span>

              {/* Slider Circle Knob */}
              <span
                style={{
                  position: 'absolute',
                  top: '3px',
                  left: '3px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: '#ffffff',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.35)',
                  transform: scorePromptEnabled ? 'translateX(32px)' : 'translateX(0)',
                  transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                  display: 'block',
                }}
              />
            </span>
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
                <span>Set Partners</span>
              </div>
              {openPartners ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openPartners && (
              <div style={{ marginTop: '8px', padding: '10px', background: 'var(--surface-bg, #0b0d17)', border: '1px solid var(--line-subtle, #252d47)', borderRadius: '12px' }}>
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
                <span>Manage Queue</span>
              </div>
              {openManualQueue ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openManualQueue && (
              <div style={{ marginTop: '8px', padding: '10px', background: 'var(--surface-bg, #0b0d17)', border: '1px solid var(--line-subtle, #252d47)', borderRadius: '12px' }}>
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
              <div style={{ marginTop: '8px', padding: '10px', background: 'var(--surface-bg, #0b0d17)', border: '1px solid var(--line-subtle, #252d47)', borderRadius: '12px' }}>
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
              <div style={{ marginTop: '8px', padding: '10px', background: 'var(--surface-bg, #0b0d17)', border: '1px solid var(--line-subtle, #252d47)', borderRadius: '12px' }}>
                {diagnosticsNode}
              </div>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
