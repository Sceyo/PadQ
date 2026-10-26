'use client';

import React, { useState } from 'react';
import { UserMinus } from 'lucide-react';

export function SitOutPanel({
  players,
  sittingOut,
  onToggle,
  onSelectPlayer,
}: {
  players:    string[];
  sittingOut: string[];
  onToggle:   (name: string) => void;
  onSelectPlayer?: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sitout-wrap live-panel">
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

      {open && (
        <div className="sitout-panel">
          {players.map(name => {
            const out = sittingOut.includes(name);
            return (
              <div key={name} className={`sitout-row${out ? ' sitout-row--out' : ''}`}>
                <span className="sitout-name">{name}</span>
                {out && <span className="status-pill status-pill--on-break">On break</span>}
                <button
                  className={`sitout-btn${out ? ' sitout-btn--return' : ''}`}
                  onClick={() => onToggle(name)}
                  type="button"
                  aria-label={out ? `Return ${name}` : `Sit out ${name}`}
                >
                  {out ? 'Back in' : 'Take a break'}
                </button>
              </div>
            );
          })}
        </div>
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
                <span className="on-break-chip-name">{name}</span>
                <span className="status-pill status-pill--on-break">On break</span>
                <button
                  type="button"
                  className="on-break-return-btn"
                  onClick={(e) => { e.stopPropagation(); onToggle(name); }}
                  aria-label={`Back in: Return ${name} to queue`}
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
