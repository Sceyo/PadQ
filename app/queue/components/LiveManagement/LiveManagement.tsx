'use client';

import React, { useState } from 'react';
import { UserPlus, PlusCircle, ListOrdered, UserCheck, X } from 'lucide-react';
import type { PlayerStat } from '../../lib/types';
import { PlayerLabel } from '../atoms/PlayerLabel';

export const AddPlayerPanel: React.FC<{ onAdd: (name: string) => void }> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState('');
  const commit = () => { const t = val.trim(); if (!t) return; onAdd(t); setVal(''); setOpen(false); };
  return (
    <div className="live-panel">
      <button className="live-panel-toggle" onClick={() => setOpen(o => !o)}>
        <UserPlus size={13} /> {open ? 'Cancel' : 'Add Player'}
      </button>
      {open && (
        <div className="live-form">
          <input value={val} onChange={e => setVal(e.target.value)} placeholder="Player name" onKeyDown={e => e.key === 'Enter' && commit()} autoFocus />
          <button onClick={commit} className="live-form-submit"><PlusCircle size={12} /> Add</button>
        </div>
      )}
    </div>
  );
};

export const ManualQueuePanel: React.FC<{
  allPlayers: string[];
  queue:      string[];
  statsMap:   Record<string, PlayerStat>;
  onAdd:      (p: string) => void;
  onRemove:   (i: number) => void;
}> = ({ allPlayers, queue, statsMap, onAdd, onRemove }) => {
  const [open, setOpen] = useState(false);
  const notQueued = allPlayers.filter(p => !queue.includes(p));
  return (
    <div className="live-panel">
      <button className="live-panel-toggle" onClick={() => setOpen(o => !o)}>
        <ListOrdered size={13} /> {open ? 'Hide' : 'Manage'} Queue
      </button>
      {open && (
        <div className="mqp-body">
          <div className="mqp-col">
            <div className="mqp-col-header"><UserCheck size={11} /> Available</div>
            {notQueued.length === 0 && <p className="muted-hint">All players queued</p>}
            {notQueued.map((p, i) => (
              <button key={`avail-${i}-${p}`} className="mqp-btn mqp-btn--add" onClick={() => onAdd(p)}>
                <PlusCircle size={11} /><PlayerLabel name={p} statsMap={statsMap} />
              </button>
            ))}
          </div>
          <div className="mqp-col">
            <div className="mqp-col-header"><ListOrdered size={11} /> Queue</div>
            {queue.length === 0 && <p className="muted-hint">Empty</p>}
            {queue.map((p, i) => (
              <button key={`q-${i}-${p}`} className="mqp-btn mqp-btn--remove" onClick={() => onRemove(i)}>
                <span className="mqp-pos">#{i + 1}</span>
                <PlayerLabel name={p} statsMap={statsMap} />
                <X size={10} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
