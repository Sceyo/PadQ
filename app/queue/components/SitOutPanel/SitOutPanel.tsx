'use client';

import React, { useState } from 'react';
import { UserMinus } from 'lucide-react';

export function SitOutPanel({
  players,
  sittingOut,
  onToggle,
}: {
  players:    string[];
  sittingOut: string[];
  onToggle:   (name: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="sitout-wrap">
      <button
        className={`sitout-toggle-btn${open ? ' sitout-toggle-btn--open' : ''}`}
        onClick={() => setOpen(o => !o)}
        type="button"
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
                <button
                  className={`sitout-btn${out ? ' sitout-btn--return' : ''}`}
                  onClick={() => onToggle(name)}
                  type="button"
                >
                  {out ? 'Return' : 'Sit Out'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
