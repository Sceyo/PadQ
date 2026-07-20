'use client';

import { Trophy, Crown } from 'lucide-react';
import type { PlayerStat } from '../../lib/types';
import { PlayerLabel } from '../atoms/PlayerLabel';
import styles from '../CourtCard/CourtCard.module.css';

export interface SinglesCourtSlot {
  id:      string;
  name:    string;
  players: string[];   // [challenger, king] — king is index 1 if present, else both new
  king:    string | null;
}

interface Props {
  slot:     SinglesCourtSlot;
  statsMap: Record<string, PlayerStat>;
  isHost:   boolean;
  onWin:    (courtId: string, winner: string) => void;
}

export function SinglesCourtCard({ slot, statsMap, isHost, onWin }: Props) {
  const [p1, p2] = slot.players;
  const ready    = slot.players.length >= 2 && !!p1 && !!p2;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.courtName}>{slot.name}</span>
        {ready && <span className={styles.liveDot} />}
      </div>

      {ready ? (
        <>
          <div className={styles.matchup}>
            {/* Singles: two players side by side, king gets a crown */}
            <div className={styles.team} style={{ alignItems: 'center' }}>
              {slot.king === p1 && <Crown size={11} style={{ marginBottom: 2, opacity: 0.8 }} />}
              <PlayerLabel name={p1} statsMap={statsMap} />
            </div>
            <span className={styles.vs}>VS</span>
            <div className={styles.team} style={{ alignItems: 'center' }}>
              {slot.king === p2 && <Crown size={11} style={{ marginBottom: 2, opacity: 0.8 }} />}
              <PlayerLabel name={p2} statsMap={statsMap} />
            </div>
          </div>

          {isHost && (
            <div className={styles.winBtns}>
              <button
                className={`${styles.winBtn} ${styles.winBtnA}`}
                onClick={() => onWin(slot.id, p1)}
                >
                <Trophy size={12} /> {p1} wins
                </button>
                <button
                className={`${styles.winBtn} ${styles.winBtnB}`}
                onClick={() => onWin(slot.id, p2)}
                >
                <Trophy size={12} /> {p2} wins
                </button>
            </div>
          )}
        </>
      ) : (
        <p className={styles.empty}>Waiting for players…</p>
      )}
    </div>
  );
}