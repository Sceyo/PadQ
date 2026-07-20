'use client';

import { useState } from 'react';
import { X, ArrowLeftRight, Check } from 'lucide-react';
import type { PlayerStat } from '../../lib/types';
import styles from './CourtSwapModal.module.css';

interface Props {
  courtName: string;
  /** onCourt[0..1] = Team A, onCourt[2..3] = Team B */
  onCourt:   string[];
  statsMap:  Record<string, PlayerStat>;
  onConfirm: (newOnCourt: string[]) => void;
  onClose:   () => void;
}

const POSITIONS = [
  { index: 0, team: 'A', label: 'Team A' },
  { index: 1, team: 'A', label: 'Team A' },
  { index: 2, team: 'B', label: 'Team B' },
  { index: 3, team: 'B', label: 'Team B' },
] as const;

export function CourtSwapModal({ courtName, onCourt, statsMap, onConfirm, onClose }: Props) {
  const [players, setPlayers] = useState<string[]>([...onCourt]);
  const [selected, setSelected] = useState<number | null>(null);
  const [swaps, setSwaps] = useState<Array<[number, number]>>([]);

  const handlePlayerClick = (idx: number) => {
    if (selected === null) {
      setSelected(idx);
      return;
    }
    if (selected === idx) {
      setSelected(null);
      return;
    }
    // Swap the two selected players
    const next = [...players];
    [next[selected], next[idx]] = [next[idx], next[selected]];
    setPlayers(next);
    setSwaps(prev => [...prev, [selected, idx]]);
    setSelected(null);
  };

  const handleUndo = () => {
    if (swaps.length === 0) return;
    const lastSwap = swaps[swaps.length - 1];
    const next = [...players];
    [next[lastSwap[0]], next[lastSwap[1]]] = [next[lastSwap[1]], next[lastSwap[0]]];
    setPlayers(next);
    setSwaps(prev => prev.slice(0, -1));
    setSelected(null);
  };

  const hasChanges = players.join(',') !== onCourt.join(',');

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <ArrowLeftRight size={15} />
            <span>{courtName} — Edit Players</span>
          </div>
          <button className={styles.closeBtn} onClick={onClose}><X size={15} /></button>
        </div>

        <p className={styles.hint}>
          Tap two players to swap their positions. Players on the same side are partners.
        </p>

        <div className={styles.court}>
          {/* Team A */}
          <div className={styles.teamBlock}>
            <span className={styles.teamLabel}>Team A</span>
            {[0, 1].map(idx => {
              const p = players[idx];
              const stat = statsMap[p];
              return (
                <button
                  key={idx}
                  className={[
                    styles.playerBtn,
                    selected === idx ? styles.playerBtnSelected : '',
                    selected !== null && selected !== idx ? styles.playerBtnTarget : '',
                  ].join(' ')}
                  onClick={() => handlePlayerClick(idx)}
                >
                  <span className={styles.playerName}>{p}</span>
                  {stat && (
                    <span className={styles.playerStat}>{stat.winRate}% · {stat.gamesPlayed}g</span>
                  )}
                  {selected === idx && (
                    <span className={styles.selectedIndicator}>selected</span>
                  )}
                </button>
              );
            })}
          </div>

          <div className={styles.vsBlock}>
            <span className={styles.vs}>VS</span>
          </div>

          {/* Team B */}
          <div className={styles.teamBlock}>
            <span className={styles.teamLabel}>Team B</span>
            {[2, 3].map(idx => {
              const p = players[idx];
              const stat = statsMap[p];
              return (
                <button
                  key={idx}
                  className={[
                    styles.playerBtn,
                    selected === idx ? styles.playerBtnSelected : '',
                    selected !== null && selected !== idx ? styles.playerBtnTarget : '',
                  ].join(' ')}
                  onClick={() => handlePlayerClick(idx)}
                >
                  <span className={styles.playerName}>{p}</span>
                  {stat && (
                    <span className={styles.playerStat}>{stat.winRate}% · {stat.gamesPlayed}g</span>
                  )}
                  {selected === idx && (
                    <span className={styles.selectedIndicator}>selected</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {swaps.length > 0 && (
          <p className={styles.swapLog}>
            {swaps.length} swap{swaps.length > 1 ? 's' : ''} made
          </p>
        )}

        <div className={styles.actions}>
          {swaps.length > 0 && (
            <button className={styles.undoBtn} onClick={handleUndo}>
              ↩ Undo last swap
            </button>
          )}
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.confirmBtn}
            onClick={() => onConfirm(players)}
            disabled={!hasChanges}
          >
            <Check size={13} /> Apply
          </button>
        </div>
      </div>
    </div>
  );
}