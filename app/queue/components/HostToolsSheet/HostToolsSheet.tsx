'use client';

import React, { useState } from 'react';
import {
  UserPlus,
  UserCheck,
  Check,
  Trophy,
  Users,
  ListOrdered,
  Coffee,
  Activity,
  ChevronDown,
  ChevronUp,
  Layers,
} from 'lucide-react';
import { BottomSheet } from '../OverlayHost/BottomSheet';
import {
  formatDisplayName,
  matchesPlayerFilter,
  SMART_FILTER_THRESHOLD,
} from '../../lib/nameFormatter';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onAddPlayer: (name: string) => boolean | void;
  scorePromptEnabled: boolean;
  onToggleScorePrompt: () => void;
  queueMode?: 'default' | 'skilled';
  onQueueModeChange?: (mode: 'default' | 'skilled') => void;
  lateArrivals?: string[];
  onCheckInLateArrival?: (name: string) => boolean | Promise<boolean>;
  onCheckInAllLateArrivals?: () => boolean | number | void | Promise<boolean | number | void>;
  onDismissLateArrival?: (name: string) => void;
  partnerPanelNode?: React.ReactNode;
  manualQueuePanelNode?: React.ReactNode;
  sitOutPanelNode?: React.ReactNode;
  diagnosticsNode?: React.ReactNode;
  initialSection?: 'late' | 'partners' | 'queue' | 'sitout';
}

export function HostToolsSheet({
  isOpen,
  onClose,
  onAddPlayer,
  scorePromptEnabled,
  onToggleScorePrompt,
  queueMode = 'default',
  onQueueModeChange,
  lateArrivals = [],
  onCheckInLateArrival,
  onCheckInAllLateArrivals,
  onDismissLateArrival,
  partnerPanelNode,
  manualQueuePanelNode,
  sitOutPanelNode,
  diagnosticsNode,
  initialSection,
}: Props) {
  const [playerName, setPlayerName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [openLateArrivals, setOpenLateArrivals] = useState(initialSection === 'late');
  const [lateFilter, setLateFilter] = useState('');
  const [openPartners, setOpenPartners] = useState(initialSection === 'partners');
  const [openManualQueue, setOpenManualQueue] = useState(initialSection === 'queue');
  const [openSitOut, setOpenSitOut] = useState(initialSection === 'sitout');
  const [openDiagnostics, setOpenDiagnostics] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      if (initialSection === 'late') setOpenLateArrivals(true);
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

  const showLateFilter = lateArrivals.length > SMART_FILTER_THRESHOLD;
  const filteredLateArrivals = showLateFilter
    ? lateArrivals.filter(name => matchesPlayerFilter(name, lateFilter))
    : lateArrivals;

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
              aria-label="Add Player"
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

        {onQueueModeChange && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              paddingBottom: '16px',
              marginBottom: '16px',
              borderBottom: '1px solid var(--border, rgba(148, 163, 184, 0.16))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
              <Layers size={18} style={{ color: 'var(--accent, #6366f1)', flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.92rem', fontWeight: 700, color: 'var(--txt-1, #f8fafc)' }}>
                  Queue Mode
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--txt-2, #94a3b8)' }}>
                  {queueMode === 'skilled' ? 'Matchmaking (skill brackets)' : 'Default rotation'}
                </div>
              </div>
            </div>
            <div
              role="group"
              aria-label="Queue Mode"
              style={{
                display: 'inline-flex',
                padding: '3px',
                borderRadius: '10px',
                background: 'var(--btn, rgba(148, 163, 184, 0.14))',
                border: '1px solid var(--border, rgba(148, 163, 184, 0.2))',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              <button
                type="button"
                aria-pressed={queueMode !== 'skilled'}
                onClick={() => {
                  if (queueMode === 'skilled') {
                    onQueueModeChange('default');
                  }
                  onClose();
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  background: queueMode !== 'skilled' ? 'var(--accent, #6366f1)' : 'transparent',
                  color: queueMode !== 'skilled' ? '#fff' : 'var(--txt-2, #94a3b8)',
                }}
              >
                Default
              </button>
              <button
                type="button"
                aria-pressed={queueMode === 'skilled'}
                onClick={() => {
                  if (queueMode !== 'skilled') {
                    onQueueModeChange('skilled');
                  }
                  onClose();
                }}
                style={{
                  padding: '6px 10px',
                  borderRadius: '7px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  background: queueMode === 'skilled' ? 'var(--accent, #6366f1)' : 'transparent',
                  color: queueMode === 'skilled' ? '#fff' : 'var(--txt-2, #94a3b8)',
                }}
              >
                Matchmaking
              </button>
            </div>
          </div>
        )}

        {/* 3. Expected Late Arrivals Collapsible Tab */}
        {lateArrivals && lateArrivals.length > 0 && (
          <div>
            <button
              type="button"
              aria-expanded={openLateArrivals}
              onClick={() => setOpenLateArrivals(l => !l)}
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
                <UserCheck size={16} style={{ color: 'var(--accent-primary, #5457e0)' }} />
                <span>Expected Late Arrivals ({lateArrivals.length})</span>
              </div>
              {openLateArrivals ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openLateArrivals && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '10px',
                  background: 'var(--surface-bg, #0b0d17)',
                  border: '1px solid var(--line-subtle, #252d47)',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {(showLateFilter || onCheckInAllLateArrivals) && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: showLateFilter ? 'space-between' : 'flex-end',
                      gap: '8px',
                      flexWrap: 'wrap',
                    }}
                  >
                    {showLateFilter && (
                      <div style={{ position: 'relative', flex: 1, minWidth: '170px', display: 'flex', alignItems: 'center' }}>
                        <input
                          type="text"
                          placeholder="Filter late arrivals…"
                          aria-label="Filter late arrivals"
                          value={lateFilter}
                          onChange={e => setLateFilter(e.target.value)}
                          style={{
                            width: '100%',
                            height: '38px',
                            padding: '0 32px 0 10px',
                            borderRadius: 'var(--r-sm, 8px)',
                            border: '1px solid var(--line-subtle, #252d47)',
                            background: 'rgba(255, 255, 255, 0.04)',
                            color: 'var(--text-primary, #f8fafc)',
                            fontSize: '16px',
                            outline: 'none',
                            boxSizing: 'border-box',
                          }}
                        />
                        {lateFilter && (
                          <button
                            type="button"
                            aria-label="Clear late arrival filter"
                            onClick={() => setLateFilter('')}
                            style={{
                              position: 'absolute',
                              right: '4px',
                              width: '28px',
                              height: '28px',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-muted, #94a3b8)',
                              fontSize: '1rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    )}
                    {onCheckInAllLateArrivals && (
                      <button
                        type="button"
                        aria-label="Check in all late arrivals"
                        onClick={async () => {
                          const ok = await onCheckInAllLateArrivals();
                          if (ok === false) {
                            setErrorMsg('Could not check in late arrivals (session full)');
                          }
                        }}
                        style={{
                          minHeight: '38px',
                          padding: '0 12px',
                          borderRadius: 'var(--r-sm, 8px)',
                          border: '1px solid rgba(129, 140, 248, 0.35)',
                          background: 'rgba(99, 102, 241, 0.16)',
                          color: '#a5b4fc',
                          fontSize: 'var(--fs-xs, 0.8125rem)',
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                      >
                        <Check size={13} /> Check In All
                      </button>
                    )}
                  </div>
                )}

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))',
                    gap: '8px',
                    maxHeight: '220px',
                    overflowY: 'auto',
                  }}
                >
                  {filteredLateArrivals.map(name => (
                    <div
                      key={`host-late-${name}`}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        padding: '4px 6px 4px 12px',
                        borderRadius: 'var(--r-sm, 10px)',
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid var(--line-subtle, #252d47)',
                        minHeight: 'var(--tap-min, 44px)',
                        boxSizing: 'border-box',
                      }}
                    >
                      <span
                        title={name}
                        style={{
                          flex: 1,
                          minWidth: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          fontSize: 'var(--fs-sm, 0.9375rem)',
                          fontWeight: 600,
                          color: 'var(--text-primary, #f8fafc)',
                        }}
                      >
                        {formatDisplayName(name)}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        {onCheckInLateArrival && (
                          <button
                            type="button"
                            aria-label={`Check in ${name}`}
                            onClick={async () => {
                              const ok = await onCheckInLateArrival(name);
                              if (ok === false) {
                                setErrorMsg(`"${name}" could not be checked in (session full or duplicate)`);
                              }
                            }}
                            style={{
                              minHeight: 'var(--tap-min, 44px)',
                              padding: '0 12px',
                              borderRadius: 'var(--r-sm, 8px)',
                              border: 'none',
                              background: 'var(--accent-primary, #5457e0)',
                              color: '#ffffff',
                              fontSize: 'var(--fs-xs, 0.8125rem)',
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            Check In
                          </button>
                        )}
                        {onDismissLateArrival && (
                          <button
                            type="button"
                            aria-label={`Dismiss ${name}`}
                            onClick={() => onDismissLateArrival(name)}
                            style={{
                              minWidth: 'var(--tap-min, 44px)',
                              minHeight: 'var(--tap-min, 44px)',
                              padding: 0,
                              borderRadius: 'var(--r-sm, 8px)',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-muted, #94a3b8)',
                              fontSize: '1.25rem',
                              lineHeight: 1,
                              flexShrink: 0,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 4. Lock Doubles Partners Panel */}
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

        {/* 5. Manual Queue Management Panel */}
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

        {/* 6. Sit-Out / On Break Panel */}
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

        {/* 7. Engine Diagnostics */}
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
