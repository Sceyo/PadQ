'use client';

import React, { useState } from 'react';
import {
  Sun, Moon, ArrowLeft, Users, Swords, UserPlus,
  Trash2, Star, BookOpen, Play, Wifi,
} from 'lucide-react';
import type { RosterEntry, SkillBracket } from '@/lib/sessionService';

export interface SetupViewProps {
  gameMode:            'singles' | 'doubles' | null;
  darkMode:            boolean;
  onToggleDark:        () => void;
  courtCount:          number;
  onCourtCountChange:  (n: number) => void;
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
  onSetRosterSkill:    (name: string, skill: SkillBracket | undefined) => void;
  tempPlayers:         string[];
  currentName:         string;
  onCurrentNameChange: (s: string) => void;
  pasteInput:          string;
  onPasteInputChange:  (s: string) => void;
  onAddPlayer:         () => void;
  onRemoveTempPlayer:  (i: number) => void;
  onAddFromPaste:      () => void;
  onStartQueue:        () => void;
  isSaving:            boolean;
  onBack:              () => void;
  errorMsg?:           string;
}

export function SetupView({
  gameMode, darkMode, onToggleDark,
  courtCount, onCourtCountChange,
  setupPin, onPinChange,
  roster, showRoster, onToggleRoster,
  rosterSelected, onRosterToggle, onSelectAllRoster, onAddFromRoster, onSaveToRoster, onRemoveFromRoster,
  tempPlayers, currentName, onCurrentNameChange,
  pasteInput, onPasteInputChange,
  onAddPlayer, onRemoveTempPlayer, onAddFromPaste,
  onStartQueue, isSaving, onBack, errorMsg,
  onSetRosterSkill,
}: SetupViewProps) {
  const minPlayers = gameMode === 'doubles' && courtCount > 1 ? courtCount * 4 : 5;
  const [skillPickerFor, setSkillPickerFor] = useState<string | null>(null);

  const SKILL_BRACKETS: SkillBracket[] = ['beginner', 'intermediate', 'advanced'];
  const SKILL_LABEL: Record<SkillBracket, string> = { beginner: 'B', intermediate: 'I', advanced: 'A' };
  const SKILL_TITLE: Record<SkillBracket, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

  return (
    <div className={`queue-system setup-page ${darkMode ? 'dark' : ''}`}>
      <button className="dark-mode-toggle" onClick={onToggleDark}>
        {darkMode ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <button className="back-home" onClick={onBack}>
        <ArrowLeft size={14} /> Back
      </button>

      <div className="setup-hero">
        <div className="setup-hero-icon">
          {gameMode === 'singles' ? <Swords size={26} /> : <Users size={26} />}
        </div>
        <h1 className="app-name">{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue</h1>
        <p className="app-subtitle">Add players to get started</p>
      </div>

      <div className="player-input-container">
        {/* Court count — doubles only */}
        {gameMode === 'doubles' && (
          <div className="setup-field-row">
            <label className="setup-field-label">Number of courts</label>
            <div className="court-count-selector">
              <button
                className="court-count-btn court-count-adj"
                onClick={() => onCourtCountChange(Math.max(1, courtCount - 1))}
                type="button"
                disabled={courtCount <= 1}
              >−</button>
              <span className="court-count-value">{courtCount}</span>
              <button
                className="court-count-btn court-count-adj"
                onClick={() => onCourtCountChange(Math.min(6, courtCount + 1))}
                type="button"
                disabled={courtCount >= 6}
              >+</button>
            </div>
            {courtCount > 1 && (
              <span className="setup-field-hint">
                Needs {courtCount * 4}+ players · shared waiting queue
              </span>
            )}
          </div>
        )}

        {/* Optional access PIN */}
        <div className="setup-field-row">
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
          />
        </div>

        {/* Club Roster import */}
        <div className="roster-row">
          <button
            type="button"
            className={`roster-toggle-btn${showRoster ? ' roster-toggle-btn--active' : ''}`}
            onClick={onToggleRoster}
          >
            <BookOpen size={13} /> From Roster ({roster.length})
          </button>
          {tempPlayers.length > 0 && (
            <button type="button" className="roster-save-btn" onClick={onSaveToRoster}>
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
                  const isAdded = tempPlayers.some(p => p.toLowerCase() === entry.name.toLowerCase());
                  const pickerOpen = skillPickerFor === entry.name;
                  return (
                    <div key={`roster-${i}-${entry.name}`} className="roster-item roster-item--col">
                      <div className="roster-item-row">
                        <input
                          type="checkbox"
                          checked={rosterSelected.has(entry.name)}
                          disabled={isAdded}
                          onChange={() => onRosterToggle(entry.name)}
                        />
                        <span
                          className={`roster-name roster-name--clickable${isAdded ? ' roster-name--added' : ''}`}
                          onClick={() => setSkillPickerFor(pickerOpen ? null : entry.name)}
                          title="Tap to set skill bracket"
                        >
                          {entry.name}
                          {entry.skill && (
                            <span className={`skill-badge skill-badge--${entry.skill}`}>
                              {SKILL_LABEL[entry.skill]}
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          className="roster-remove-btn"
                          onClick={e => { e.preventDefault(); onRemoveFromRoster(entry.name); }}
                          title="Remove from roster"
                        >×</button>
                      </div>
                      {pickerOpen && (
                        <div className="skill-picker">
                          {SKILL_BRACKETS.map(bracket => (
                            <button
                              key={bracket}
                              type="button"
                              className={`skill-pick-btn skill-pick-btn--${bracket}${entry.skill === bracket ? ' skill-pick-btn--active' : ''}`}
                              title={SKILL_TITLE[bracket]}
                              onClick={() => {
                                onSetRosterSkill(entry.name, entry.skill === bracket ? undefined : bracket);
                                setSkillPickerFor(null);
                              }}
                            >
                              {SKILL_TITLE[bracket]}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="roster-actions">
                <button
                  type="button"
                  className="roster-action-btn"
                  onClick={onSelectAllRoster}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className={`roster-action-btn${rosterSelected.size > 0 ? ' roster-action-btn--primary' : ''}`}
                  onClick={onAddFromRoster}
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
          />
          <button onClick={onAddPlayer} className="add-btn"><UserPlus size={15} /></button>
        </div>
        {errorMsg && <p className="setup-error-msg">{errorMsg}</p>}
        <div className="input-group">
          <input
            type="text"
            value={pasteInput}
            onChange={e => onPasteInputChange(e.target.value)}
            placeholder="Paste names separated by commas…"
            onKeyDown={e => e.key === 'Enter' && onAddFromPaste()}
          />
          <button
            onClick={onAddFromPaste}
            className="add-btn add-btn--paste"
            title="Add all"
          >
            <Users size={15} />
          </button>
        </div>

        {tempPlayers.length > 0 && (
          <div className="players-list">
            <h3><Users size={13} /> Players ({tempPlayers.length})</h3>
            <ul>
              {tempPlayers.map((p, i) => (
                <li key={i}>
                  <span className="setup-player-num">#{i + 1}</span>
                  <span>{p}</span>
                  <button onClick={() => onRemoveTempPlayer(i)} className="remove-btn">
                    <Trash2 size={12} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <button
          onClick={onStartQueue}
          className="start-btn"
          disabled={tempPlayers.length < minPlayers || isSaving}
        >
          {isSaving
            ? <><Wifi size={14} /> Creating session…</>
            : <><Play size={14} /> Start Queue ({tempPlayers.length}/{minPlayers} min)</>
          }
        </button>
      </div>
    </div>
  );
}
