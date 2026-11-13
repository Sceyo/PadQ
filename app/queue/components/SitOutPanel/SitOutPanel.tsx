'use client';

import React, { useState } from 'react';
import { UserMinus } from 'lucide-react';
import {
  formatDisplayName,
  matchesPlayerFilter,
  SMART_FILTER_THRESHOLD,
} from '../../lib/nameFormatter';

export function SitOutPanel({
  players,
  sittingOut,
  onToggle,
  onSelectPlayer,
  hideToggle = false,
}: {
  players:    string[];
  sittingOut: string[];
  onToggle:   (name: string) => void;
  onSelectPlayer?: (name: string) => void;
  hideToggle?: boolean;
}) {
  const [open, setOpen] = useState(hideToggle);
  const [filterQuery, setFilterQuery] = useState('');

  const showFilter = players.length > SMART_FILTER_THRESHOLD;
  const filteredPlayers = showFilter
    ? players.filter(name => matchesPlayerFilter(name, filterQuery))
    : players;

  return (
    <div className="sitout-wrap live-panel">
      {!hideToggle && (
        <button
          className={`live-panel-toggle sitout-toggle-btn${open ? ' sitout-toggle-btn--open' : ''}`}
          onClick={() => setOpen(o => !o)}
          type="button"
          aria-expanded={open}
          aria-label={`Sit Out${sittingOut.length > 0 ? ` (${sittingOut.length})` : ''}`}
        >
          <UserMinus size={13} />
          Sit Out{sittingOut.length > 0 ? ` (${sittingOut.length})` : ''}
        </button>
      )}

      {(open || hideToggle) && (
        <>
          {showFilter && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Filter players…"
                aria-label="Filter players on break"
                value={filterQuery}
                onChange={e => setFilterQuery(e.target.value)}
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
              {filterQuery && (
                <button
                  type="button"
                  aria-label="Clear player filter"
                  onClick={() => setFilterQuery('')}
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
          <div className="sitout-panel">
            {filteredPlayers.map(name => {
              const out = sittingOut.includes(name);
              return (
                <div key={name} className={`sitout-row${out ? ' sitout-row--out' : ''}`}>
                  <span className="sitout-name" title={name}>{formatDisplayName(name)}</span>
                  {out ? (
                    <span className="status-pill status-pill--on-break">On break</span>
                  ) : (
                    <button
                      className="sitout-btn"
                      onClick={() => onToggle(name)}
                      type="button"
                      aria-label={`Sit out ${name}`}
                    >
                      Take a break
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {sittingOut.length > 0 && (
        <div className="on-break-strip" role="region" aria-label="Players on break">
          <div className="on-break-strip-header">
            <span className="on-break-strip-title">☕ On Break ({sittingOut.length})</span>
            <span className="on-break-strip-hint">Tap Back in when player is ready to play</span>
          </div>
          <div className="on-break-chips">
            {sittingOut.map(name => (
              <div
                key={`break-strip-${name}`}
                className="on-break-chip"
                onClick={() => onSelectPlayer?.(name)}
                style={onSelectPlayer ? { cursor: 'pointer' } : undefined}
              >
                <span className="on-break-chip-name" title={name}>{formatDisplayName(name)}</span>
                <span className="status-pill status-pill--on-break">On break</span>
                <button
                  type="button"
                  className="on-break-return-btn"
                  onClick={(e) => { e.stopPropagation(); onToggle(name); }}
                  aria-label={`Return ${name} to queue`}
                >
                  ↩ Back in
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
