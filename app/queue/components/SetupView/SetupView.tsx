'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import {
  Sun, Moon, ArrowLeft, Users, Swords, UserPlus,
  Trash2, Star, BookOpen, Play, Wifi, Check, Clock, UserCheck, RotateCcw, X,
} from 'lucide-react';
import type { RosterEntry, SkillBracket } from '@/lib/sessionService';
import { matchesPlayerFilter, SMART_FILTER_THRESHOLD } from '../../lib/nameFormatter';

export interface SetupViewProps {
  gameMode:            'singles' | 'doubles' | null;
  darkMode:            boolean;
  onToggleDark:        () => void;
  courtCount:          number;
  onCourtCountChange:  (n: number) => void;
  maxCourts:           number;
  showAccessPin:       boolean;
  showSkillTagging?:   boolean;
  setupPin:            string;
  onPinChange:         (s: string) => void;
  roster:              RosterEntry[];
  showRoster:          boolean;
  onToggleRoster:      () => void;
  rosterSelected:      Set<string>;
  onRosterToggle:      (name: string) => void;
  onSelectAllRoster:   () => void;
  onAddFromRoster:     () => void;
  onSaveToRoster:      () => void;
  onRemoveFromRoster:  (name: string) => void;
  onSetRosterSkill?:   (name: string, skill: SkillBracket | undefined) => void;
  tempPlayers:         string[];
  currentName:         string;
  onCurrentNameChange: (s: string) => void;
  pasteInput:          string;
  onPasteInputChange:  (s: string) => void;
  onAddPlayer:         () => void;
  onRemoveTempPlayer:  (i: number) => void;
  onAddFromPaste:      () => void;
  onStartQueue:        (mode?: 'default' | 'skilled') => void;
  isSaving:            boolean;
  onBack:              () => void;
  errorMsg?:           string;
  singlesFormat?:      'pool' | 'king';
  onSinglesFormatChange?: (format: 'pool' | 'king') => void;
  skilledBrackets?:    { beginner: string[]; intermediate: string[]; advanced: string[] };
  onSetPlayerSkill?:   (name: string, skill: SkillBracket | undefined) => void;
  expectedPlayers?:    string[];
  onCheckInPlayer?:    (name: string) => void;
  onUndoCheckInPlayer?: (name: string) => void;
  onCheckInAll?:       () => void;
  onRemoveExpectedPlayer?: (name: string) => void;
  onAddExpectedFromPaste?: () => void;
  onAddExpectedFromRoster?: () => void;
  onUncheckAll?:       () => void;
}

export function SetupView({
  gameMode, darkMode, onToggleDark,
  courtCount, onCourtCountChange, maxCourts, showAccessPin,
  setupPin, onPinChange,
  roster, showRoster, onToggleRoster,
  rosterSelected, onRosterToggle, onSelectAllRoster, onAddFromRoster, onSaveToRoster, onRemoveFromRoster,
  tempPlayers, currentName, onCurrentNameChange,
  pasteInput, onPasteInputChange,
  onAddPlayer, onRemoveTempPlayer, onAddFromPaste,
  onStartQueue, isSaving, onBack, errorMsg,
  singlesFormat = 'pool',
  onSinglesFormatChange,
  expectedPlayers = [],
  onCheckInPlayer,
  onUndoCheckInPlayer,
  onCheckInAll,
  onRemoveExpectedPlayer,
  onAddExpectedFromRoster,
  onUncheckAll,
}: SetupViewProps) {
  const minPlayers = gameMode === 'doubles' && courtCount > 1
    ? courtCount * 4
    : gameMode === 'singles' && courtCount > 1
      ? Math.max(5, courtCount * 2 + 1)
      : 5;
  const [showModeModal, setShowModeModal] = useState(false);
  const [expectedFilter, setExpectedFilter] = useState('');
  const showExpectedFilter = expectedPlayers.length > SMART_FILTER_THRESHOLD;
  const filteredExpectedPlayers = showExpectedFilter
    ? expectedPlayers.filter(name => matchesPlayerFilter(name, expectedFilter))
    : expectedPlayers;

  const handleStartClick = () => {
    if (tempPlayers.length < minPlayers || isSaving) return;
    if (gameMode === 'doubles') {
      setShowModeModal(true);
    } else {
      onStartQueue('default');
    }
  };

  return (
    <div className={`queue-system setup-page ${darkMode ? 'dark dark-mode' : ''}`} suppressHydrationWarning>
      <button type="button" className="dark-mode-toggle" onClick={onToggleDark} suppressHydrationWarning>
        {darkMode ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <button type="button" className="back-home" onClick={onBack} suppressHydrationWarning>
        <ArrowLeft size={14} /> Back
      </button>

      <div className="setup-hero">
        <Image
          src="/padq-logo.png"
          alt="PADQ"
          width={103}
          height={36}
          priority
          style={{ marginBottom: '8px' }}
        />
        <h1 className="app-name">{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue</h1>
        <p className="app-subtitle">Add players to get started</p>
      </div>

      <div className="player-input-container">
        {/* Court count — singles and doubles */}
        {(gameMode === 'doubles' || gameMode === 'singles') && (
          <div className="setup-field-row">
            <label className="setup-field-label">Number of courts</label>
            <div className="court-count-selector">
              <button
                className="court-count-btn court-count-adj"
                onClick={() => onCourtCountChange(Math.max(1, courtCount - 1))}
                type="button"
                disabled={courtCount <= 1}
                suppressHydrationWarning
              >−</button>
              <span className="court-count-value">{courtCount}</span>
              <button
                className="court-count-btn court-count-adj"
                onClick={() => onCourtCountChange(Math.min(maxCourts, courtCount + 1))}
                type="button"
                disabled={courtCount >= maxCourts}
                suppressHydrationWarning
              >+</button>
            </div>
            {courtCount > 1 && gameMode === 'doubles' && (
              <span className="setup-field-hint">
                {tempPlayers.length >= courtCount * 4
                  ? `${courtCount * 4} players on court, ${tempPlayers.length - courtCount * 4} waiting in queue`
                  : `Needs ${courtCount * 4}+ players · shared waiting queue`}
              </span>
            )}
            {courtCount > 1 && gameMode === 'singles' && (
              <span className="setup-field-hint">
                {tempPlayers.length >= courtCount * 2
                  ? `${courtCount * 2} players on court, ${tempPlayers.length - courtCount * 2} waiting in queue`
                  : `Needs ${courtCount * 2}+ players · shared waiting queue`}
              </span>
            )}
          </div>
        )}

        {/* Singles format selector (single-court only) */}
        {gameMode === 'singles' && courtCount === 1 && (
          <div className="setup-field-row">
            <label className="setup-field-label">Singles Format</label>
            <div className="singles-format-selector">
              <button
                type="button"
                className={`format-option-btn ${singlesFormat === 'pool' ? 'format-option-btn--active' : ''}`} suppressHydrationWarning
                onClick={() => onSinglesFormatChange?.('pool')}
              >
                Pool Rotation <span className="format-default-badge">(Default)</span>
              </button>
              <button
                type="button"
                className={`format-option-btn ${singlesFormat === 'king' ? 'format-option-btn--active' : ''}`} suppressHydrationWarning
                onClick={() => onSinglesFormatChange?.('king')}
              >
                King of the Court
              </button>
            </div>
            <span className="setup-field-hint">
              {singlesFormat === 'pool'
                ? 'Balanced winners & losers pools · Fair court time for everyone'
                : 'Winner stays on · Challenger comes from queue (max 3-streak)'}
            </span>
          </div>
        )}

        {/* Optional access PIN (deferred for V1) */}
        {showAccessPin && <div className="setup-field-row">
          <label className="setup-field-label">
            Access PIN <span className="setup-field-hint">(optional, 4 chars)</span>
          </label>
          <input
            className="setup-field-input"
            type="text"
            value={setupPin}
            onChange={e => onPinChange(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="Leave blank for open access"
            maxLength={4}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            suppressHydrationWarning
          />
        </div>}

        {/* Club Roster import */}
        <div className="roster-row">
          <button
            type="button"
            className={`roster-toggle-btn${showRoster ? ' roster-toggle-btn--active' : ''}`}
            onClick={onToggleRoster}
            suppressHydrationWarning
          >
            <BookOpen size={13} /> From Roster ({roster.length})
          </button>
          {(tempPlayers.length > 0 || expectedPlayers.length > 0) && (
            <button type="button" className="roster-save-btn" onClick={onSaveToRoster} suppressHydrationWarning>
              <Star size={13} /> Save to Roster
            </button>
          )}
        </div>
        {showRoster && (
          roster.length === 0 ? (
            <p className="muted-hint" style={{ marginBottom: 12 }}>
              No saved players yet. Add players then click &quot;Save to Roster&quot;.
            </p>
          ) : (
            <div className="roster-panel">
              <div className="roster-list">
                {roster.map((entry, i) => {
                  const isAdded = tempPlayers.some(p => p.toLowerCase() === entry.name.toLowerCase()) ||
                    expectedPlayers.some(p => p.toLowerCase() === entry.name.toLowerCase());
                  return (
                    <div key={`roster-${i}-${entry.name}`} className="roster-item roster-item--col">
                      <div className="roster-item-row">
                        <input
                          type="checkbox"
                          checked={rosterSelected.has(entry.name)}
                          disabled={isAdded}
                          onChange={() => onRosterToggle(entry.name)}
                        />
                        <span className={`roster-name${isAdded ? ' roster-name--added' : ''}`}>
                          {entry.name}
                        </span>
                        <button
                          type="button"
                          className="roster-remove-btn"
                          onClick={e => { e.preventDefault(); onRemoveFromRoster(entry.name); }}
                          title="Remove from roster"
                          suppressHydrationWarning
                        >×</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="roster-actions">
                <button
                  type="button"
                  className="roster-action-btn"
                  onClick={onSelectAllRoster}
                  suppressHydrationWarning
                >
                  Select All
                </button>
                <button
                  type="button"
                  className={`roster-action-btn${rosterSelected.size > 0 ? ' roster-action-btn--primary' : ''}`}
                  onClick={onAddExpectedFromRoster ?? onAddFromRoster}
                  suppressHydrationWarning
                  disabled={rosterSelected.size === 0}
                >
                  Add Selected ({rosterSelected.size})
                </button>
              </div>
            </div>
          )
        )}

        <div className="input-group">
          <input
            type="text"
            value={currentName}
            onChange={e => { onCurrentNameChange(e.target.value); }}
            placeholder="Enter player name"
            onKeyDown={e => e.key === 'Enter' && onAddPlayer()}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            suppressHydrationWarning
          />
          <button type="button" onClick={onAddPlayer} className="add-btn" suppressHydrationWarning title="Add to Expected Arrivals"><UserPlus size={15} /></button>
        </div>
        {errorMsg && <p className="setup-error-msg">{errorMsg}</p>}
        <div className="input-group">
          <textarea
            rows={2}
            className="paste-textarea"
            value={pasteInput}
            onChange={e => onPasteInputChange(e.target.value)}
            placeholder="Paste names separated by commas or numbered list…"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onAddFromPaste();
              }
            }}
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            suppressHydrationWarning
          />
          <button
            type="button"
            onClick={() => onAddFromPaste()}
            className="add-btn add-btn--paste"
            suppressHydrationWarning
            title="Add all to Expected Arrivals"
          >
            <Users size={15} />
          </button>
        </div>

        {/* Expected Arrivals / Not Yet Here */}
        {expectedPlayers.length > 0 && (
          <div className="expected-arrivals-panel">
            <div className="expected-arrivals-header">
              <h3>
                <Clock size={13} /> Expected Arrivals ({expectedPlayers.length})
              </h3>
              {onCheckInAll && (
                <button
                  type="button"
                  className="checkin-all-btn"
                  onClick={onCheckInAll}
                  suppressHydrationWarning
                >
                  <Check size={12} /> Check In All
                </button>
              )}
            </div>
            {showExpectedFilter && (
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Filter expected arrivals…"
                  aria-label="Filter expected arrivals"
                  value={expectedFilter}
                  onChange={e => setExpectedFilter(e.target.value)}
                  suppressHydrationWarning
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
                {expectedFilter && (
                  <button
                    type="button"
                    aria-label="Clear expected arrivals filter"
                    onClick={() => setExpectedFilter('')}
                    suppressHydrationWarning
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
            <div className="expected-chips-list">
              {filteredExpectedPlayers.map((name) => (
                <div key={`expected-${name}`} className="expected-player-chip">
                  <span className="expected-name">{name}</span>
                  <div className="expected-actions">
                    {onCheckInPlayer && (
                      <button
                        type="button"
                        className="checkin-btn"
                        onClick={() => onCheckInPlayer(name)}
                        title="Check in player"
                        suppressHydrationWarning
                      >
                        <UserCheck size={12} /> Check In
                      </button>
                    )}
                    {onRemoveExpectedPlayer && (
                      <button
                        type="button"
                        className="remove-expected-btn"
                        onClick={() => onRemoveExpectedPlayer(name)}
                        title="Remove expected player"
                        suppressHydrationWarning
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

        {tempPlayers.length > 0 && (
          <div className="players-list">
            <div className="setup-players-header">
              <h3><Users size={13} /> Players ({tempPlayers.length})</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="setup-checked-in-pill">Checked In</span>
                {onUncheckAll && (
                  <button
                    type="button"
                    className="uncheck-all-btn"
                    onClick={onUncheckAll}
                    title="Move all players to Expected Arrivals"
                    suppressHydrationWarning
                  >
                    Uncheck All
                  </button>
                )}
              </div>
            </div>
            <ul>
              {tempPlayers.map((p, i) => (
                <li key={i} className="setup-player-item-col">
                  <div className="setup-player-item-row">
                    <span className="setup-player-num">#{i + 1}</span>
                    <span className="setup-player-name">{p}</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      {onUndoCheckInPlayer && (
                        <button
                          type="button"
                          onClick={() => onUndoCheckInPlayer(p)}
                          className="remove-btn"
                          title="Move back to Expected"
                          suppressHydrationWarning
                        >
                          <RotateCcw size={12} />
                        </button>
                      )}
                      <button type="button" onClick={() => onRemoveTempPlayer(i)} className="remove-btn" suppressHydrationWarning title="Remove player">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          type="button"
          onClick={handleStartClick}
          className="start-btn"
          suppressHydrationWarning
          disabled={tempPlayers.length < minPlayers || isSaving}
        >
          {isSaving
            ? <><Wifi size={14} /> Creating session…</>
            : <><Play size={14} /> Start Queue ({tempPlayers.length}/{minPlayers} min)</>
          }
        </button>

        {showModeModal && typeof document !== 'undefined' && createPortal(
          <div
            role="presentation"
            onClick={() => setShowModeModal(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              width: '100vw',
              height: '100dvh',
              zIndex: 9999,
              background: 'rgba(6, 8, 20, 0.78)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem',
              boxSizing: 'border-box',
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="mode-modal-title"
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: '380px',
                borderRadius: 'var(--r-lg, 18px)',
                border: '1px solid var(--border, #2d3348)',
                background: 'var(--modal-bg, #1a1c2e)',
                boxShadow: 'var(--sh-lg, 0 12px 48px rgba(0,0,0,0.6))',
                padding: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h2
                  id="mode-modal-title"
                  style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    fontWeight: 800,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: 'var(--txt-1, #f0f4ff)',
                  }}
                >
                  MODE
                </h2>
                <button
                  type="button"
                  aria-label="Close mode selector"
                  onClick={() => setShowModeModal(false)}
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    border: '1px solid var(--border, #2d3348)',
                    background: 'var(--btn, #252840)',
                    color: 'var(--txt-2, #94a3b8)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <X size={15} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowModeModal(false);
                  onStartQueue('default');
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 'var(--r-md, 12px)',
                  border: '1.5px solid var(--border, #2d3348)',
                  background: 'var(--btn, #252840)',
                  color: 'var(--txt-1, #f0f4ff)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Default</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--txt-2, #94a3b8)' }}>
                  Standard rotation &amp; paddle rack queue
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowModeModal(false);
                  onStartQueue('skilled');
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px 16px',
                  borderRadius: 'var(--r-md, 12px)',
                  border: '1.5px solid var(--accent, #6366f1)',
                  background: 'rgba(99, 102, 241, 0.14)',
                  color: 'var(--txt-1, #f0f4ff)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ fontSize: '0.95rem', fontWeight: 700 }}>Matchmaking</span>
                <span style={{ fontSize: '0.78rem', color: 'var(--txt-2, #94a3b8)' }}>
                  Skill-based brackets (Beginner / Intermediate / Advanced)
                </span>
              </button>
            </div>
          </div>
        , document.body)}
      </div>
    </div>
  );
}
