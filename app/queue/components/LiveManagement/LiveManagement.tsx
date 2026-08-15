'use client';

import React, { useState } from 'react';
import { UserPlus, PlusCircle, ListOrdered, UserCheck, Link2, X } from 'lucide-react';
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

export type LockedPartnerPair = [string, string];

export function getMaxPartnerPairs(playerCount: number): number {
  const count = Math.max(0, playerCount);
  const pairedLimit = Math.floor(count / 2);

  // If an odd roster locks every possible pair, the lone unpaired player can
  // never be selected for a four-player doubles match: every legal selection
  // would otherwise have to split a pair. Leave three singles available so a
  // locked pair can still rotate with two of them.
  return count % 2 === 0 ? pairedLimit : Math.max(0, pairedLimit - 1);
}

export function getAvailablePartnerPlayers(
  players: string[],
  pairs: LockedPartnerPair[],
): string[] {
  const pairedPlayers = new Set(pairs.flat());
  return players.filter(player => !pairedPlayers.has(player));
}

export function addPartnerPair(
  players: string[],
  pairs: LockedPartnerPair[],
  first: string,
  second: string,
): LockedPartnerPair[] {
  if (first === second || pairs.length >= getMaxPartnerPairs(players.length)) return pairs;
  const playerSet = new Set(players);
  const pairedPlayers = new Set(pairs.flat());
  if (!playerSet.has(first) || !playerSet.has(second)) return pairs;
  if (pairedPlayers.has(first) || pairedPlayers.has(second)) return pairs;
  return [...pairs, [first, second]];
}

export function getCompatiblePartnerPlayers(
  availablePlayers: string[],
  playerGroups: string[][],
  selected: string | null,
): string[] {
  if (!selected) return availablePlayers;
  const selectedGroup = playerGroups.find(group => group.includes(selected));
  if (!selectedGroup) return [selected];
  const groupSet = new Set(selectedGroup);
  return availablePlayers.filter(player => groupSet.has(player));
}

export const PartnerPanel: React.FC<{
  players:      string[];
  playerGroups: string[][];
  pairs:        LockedPartnerPair[];
  onChange:     (pairs: LockedPartnerPair[]) => void;
}> = ({ players, playerGroups, pairs, onChange }) => {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [draftPairs, setDraftPairs] = useState<LockedPartnerPair[]>(pairs);
  const maxPairs = getMaxPartnerPairs(players.length);
  const availablePlayers = getAvailablePartnerPlayers(players, draftPairs);
  const compatiblePlayers = getCompatiblePartnerPlayers(availablePlayers, playerGroups, selected);
  const limitReached = draftPairs.length >= maxPairs;

  const choosePlayer = (player: string) => {
    if (!selected) {
      setSelected(player);
      return;
    }
    if (selected === player) {
      setSelected(null);
      return;
    }
    if (!limitReached) setDraftPairs(addPartnerPair(players, draftPairs, selected, player));
    setSelected(null);
  };

  const toggleOpen = () => {
    if (!open) setDraftPairs(pairs);
    setOpen(value => !value);
    setSelected(null);
  };

  const savePairs = () => {
    onChange(draftPairs);
    setOpen(false);
    setSelected(null);
  };

  return (
    <div className="live-panel partner-panel">
      <button className="live-panel-toggle" onClick={toggleOpen} type="button">
        <Link2 size={13} /> {open ? 'Hide Partners' : 'Set Partners'}
        <span className="partner-panel-count">{pairs.length}/{maxPairs}</span>
      </button>

      {open && (
        <div className="partner-panel-body">
          <div className="partner-panel-heading">
            <div>
              <strong>Partner pairs</strong>
              <p>Choose two players from the same court or waiting queue. Changes apply on their next assignment.</p>
            </div>
            <span>{maxPairs} max for {players.length} players</span>
          </div>

          {draftPairs.length > 0 && (
            <div className="partner-pairs-list">
              {draftPairs.map(([a, b], index) => (
                <div className="partner-pair-chip" key={`${a}-${b}`}>
                  <Link2 size={11} />
                  <span>{a} &amp; {b}</span>
                  <button
                    type="button"
                    title={`Remove ${a} and ${b}`}
                    aria-label={`Remove partner pair ${a} and ${b}`}
                    onClick={() => setDraftPairs(draftPairs.filter((_, pairIndex) => pairIndex !== index))}
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {!limitReached && availablePlayers.length >= 2 ? (
            <div className="partner-player-grid">
              {compatiblePlayers.map(player => (
                <button
                  key={player}
                  type="button"
                  aria-pressed={selected === player}
                  className={`partner-player-btn${selected === player ? ' partner-player-btn--selected' : ''}`}
                  onClick={() => choosePlayer(player)}
                >
                  {player}
                </button>
              ))}
            </div>
          ) : (
            <p className="partner-panel-limit">
              {draftPairs.length === 0 ? 'At least two players are required.' : 'All available partner pairs are set.'}
            </p>
          )}

          <div className="partner-panel-actions">
            <button type="button" className="partner-panel-cancel" onClick={toggleOpen}>Cancel</button>
            <button type="button" className="partner-panel-save" onClick={savePairs}>
              Save {draftPairs.length === 1 ? '1 pair' : `${draftPairs.length} pairs`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
