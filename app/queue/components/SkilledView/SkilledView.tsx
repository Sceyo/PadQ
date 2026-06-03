'use client';

import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2, X, Check } from 'lucide-react';
import type { SkillBracket } from '@/lib/sessionService';

export interface SkilledBrackets {
  beginner:     string[];
  intermediate: string[];
  advanced:     string[];
}

interface SkilledViewProps {
  brackets:   SkilledBrackets;
  players:    string[];        // session player list
  roster:     string[];        // global roster names
  isHost:     boolean;
  onAssign:   (bracket: SkillBracket, name: string) => void;
  onUnassign: (bracket: SkillBracket, name: string) => void;
  onAddNew:   (bracket: SkillBracket, names: string[]) => void;
}

const BRACKET_ORDER: SkillBracket[] = ['beginner', 'intermediate', 'advanced'];

const BRACKET_META: Record<SkillBracket, { label: string; short: string; accent: string; dimBg: string }> = {
  beginner:     { label: 'Beginner',     short: 'B', accent: '#22c55e', dimBg: 'rgba(34,197,94,.08)' },
  intermediate: { label: 'Intermediate', short: 'I', accent: '#f59e0b', dimBg: 'rgba(245,158,11,.08)' },
  advanced:     { label: 'Advanced',     short: 'A', accent: '#ef4444', dimBg: 'rgba(239,68,68,.08)' },
};

export function SkilledView({ brackets, players, roster, isHost, onAssign, onUnassign, onAddNew }: SkilledViewProps) {
  const [open,       setOpen]       = useState<Record<SkillBracket, boolean>>({ beginner: false, intermediate: false, advanced: false });
  const [addingTo,   setAddingTo]   = useState<SkillBracket | null>(null);
  const [rosterPick, setRosterPick] = useState<Set<string>>(new Set());

  // Map: player name → which bracket they're in (if any)
  const assignedTo = useMemo<Record<string, SkillBracket>>(() => {
    const map: Record<string, SkillBracket> = {};
    BRACKET_ORDER.forEach(b => brackets[b].forEach(n => { map[n] = b; }));
    return map;
  }, [brackets]);

  const toggle = (b: SkillBracket) => {
    setOpen(prev => ({ ...prev, [b]: !prev[b] }));
    if (addingTo === b) closePicker();
  };

  const openPicker = (b: SkillBracket) => {
    setOpen(prev => ({ ...prev, [b]: true }));
    setAddingTo(b);
    setRosterPick(new Set());
  };

  const closePicker = () => {
    setAddingTo(null);
    setRosterPick(new Set());
  };

  const togglePick = (name: string) => {
    setRosterPick(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const confirmAdd = () => {
    if (!addingTo) return;
    const names = Array.from(rosterPick);
    if (names.length > 0) onAddNew(addingTo, names);
    closePicker();
  };

  return (
    <div className="skilled-view">
      <p className="skilled-desc">
        Assign session players to skill brackets. The engine pairs similar-skill players
        and fills gaps with the nearest bracket when one is short.
      </p>

      {BRACKET_ORDER.map(bracket => {
        const { label, accent, dimBg } = BRACKET_META[bracket];
        const assigned = brackets[bracket];
        const isOpen   = open[bracket];
        const isAdding = addingTo === bracket;

        // Session player split: unassigned = selectable, assigned elsewhere = grayed out
        const freePlayers  = players.filter(n => assignedTo[n] === undefined);
        const takenPlayers = players.filter(n => assignedTo[n] !== undefined && assignedTo[n] !== bracket);

        return (
          <div key={bracket} className="skilled-section">

            {/* ── Header ── */}
            <button
              className={`skilled-header${isOpen ? ' skilled-header--open' : ''}`}
              style={{ '--sk-accent': accent, '--sk-bg': dimBg } as React.CSSProperties}
              onClick={() => toggle(bracket)}
            >
              <span className="skilled-header-left">
                <span className="skilled-arrow">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <span className="skilled-label">{label}</span>
                <span className="skilled-count" style={{ background: dimBg, color: accent, borderColor: accent }}>
                  {assigned.length}
                </span>
              </span>
              <span className="skilled-color-bar" style={{ background: accent }} />
            </button>

            {/* ── Body ── */}
            {isOpen && (
              <div className="skilled-body">

                {/* Assigned player table */}
                <table className="skilled-table">
                  <thead>
                    <tr>
                      <th className="skilled-th skilled-th--rank">#</th>
                      <th className="skilled-th">Player</th>
                      {isHost && <th className="skilled-th skilled-th--actions" />}
                    </tr>
                  </thead>
                  <tbody>
                    {assigned.map((name, idx) => (
                      <tr key={name} className="skilled-tr">
                        <td className="skilled-td skilled-td--rank">{idx + 1}</td>
                        <td className="skilled-td">{name}</td>
                        {isHost && (
                          <td className="skilled-td skilled-td--actions">
                            <button
                              className="skilled-remove-btn"
                              title="Unassign (keeps player in session)"
                              onClick={() => onUnassign(bracket, name)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                    {assigned.length === 0 && !isAdding && (
                      <tr className="skilled-tr skilled-tr--empty">
                        <td colSpan={isHost ? 3 : 2} className="skilled-td skilled-td--empty">
                          No players assigned yet
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* ── Roster picker panel ── */}
                {isHost && isAdding && (
                  <div className="skilled-picker" style={{ '--sk-accent': accent } as React.CSSProperties}>

                    <div className="skilled-picker-header">
                      <span className="skilled-picker-title">Add to {label}</span>
                      <button className="skilled-cancel-btn" onClick={closePicker} title="Cancel">
                        <X size={12} />
                      </button>
                    </div>

                    {freePlayers.length === 0 && takenPlayers.length === 0 ? (
                      <p className="skilled-picker-empty">
                        All players have been assigned to brackets.
                      </p>
                    ) : (
                      <div className="skilled-picker-list">

                        {/* Selectable rows */}
                        {freePlayers.map(name => {
                          const isSelected = rosterPick.has(name);
                          return (
                            <button
                              key={name}
                              className={`skilled-picker-row${isSelected ? ' skilled-picker-row--selected' : ''}`}
                              onClick={() => togglePick(name)}
                            >
                              <span className="skilled-picker-row-check">
                                {isSelected && <Check size={10} />}
                              </span>
                              <span className="skilled-picker-row-name">{name}</span>
                            </button>
                          );
                        })}

                        {/* Taken rows — grayed, non-clickable, at bottom */}
                        {takenPlayers.length > 0 && (
                          <>
                            {freePlayers.length > 0 && <hr className="skilled-picker-taken-divider" />}
                            {takenPlayers.map(name => {
                              const inBracket = assignedTo[name];
                              return (
                                <div key={name} className="skilled-picker-row skilled-picker-row--taken">
                                  <span className="skilled-picker-row-check" />
                                  <span className="skilled-picker-row-name">{name}</span>
                                  <span
                                    className="skilled-chip-badge"
                                    style={{ background: BRACKET_META[inBracket].dimBg, color: BRACKET_META[inBracket].accent }}
                                  >
                                    {BRACKET_META[inBracket].label}
                                  </span>
                                </div>
                              );
                            })}
                          </>
                        )}

                      </div>
                    )}

                    {/* Footer — only shown when there's something to act on */}
                    {(freePlayers.length > 0 || takenPlayers.length > 0) && (
                      <div className="skilled-picker-footer">
                        <button
                          className="skilled-picker-confirm-btn"
                          disabled={rosterPick.size === 0}
                          onClick={confirmAdd}
                        >
                          Confirm Add{rosterPick.size > 0 ? ` (${rosterPick.size})` : ''}
                        </button>
                        <button className="skilled-picker-cancel-btn" onClick={closePicker}>
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Add Player trigger */}
                {isHost && !isAdding && (
                  <button className="skilled-add-btn" onClick={() => openPicker(bracket)}>
                    <Plus size={12} /> Add Player
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
