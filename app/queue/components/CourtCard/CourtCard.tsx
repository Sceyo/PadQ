'use client';

import { Trophy } from 'lucide-react';
import type { CourtSlot } from '@/lib/sessionService';
import type { PlayerStat } from '../../lib/types';
import { PlayerLabel } from '../atoms/PlayerLabel';
import styles from './CourtCard.module.css';

interface Props {
  slot: CourtSlot;
  statsMap: Record<string, PlayerStat>;
  isHost: boolean;
  onWin: (courtId: string, side: 'A' | 'B') => void;
}

export function CourtCard({ slot, statsMap, isHost, onWin }: Props) {
  const teamA = slot.onCourt.slice(0, 2);
  const teamB = slot.onCourt.slice(2, 4);
  const ready = slot.onCourt.length >= 4;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.courtName}>{slot.name}</span>
        {ready && <span className={styles.liveDot} />}
      </div>

      {ready ? (
        <>
          <div className={styles.matchup}>
            <div className={styles.team}>
              {teamA.map((p, i) => (
                <PlayerLabel key={`a-${i}-${p}`} name={p} statsMap={statsMap} />
              ))}
            </div>
            <span className={styles.vs}>VS</span>
            <div className={styles.team}>
              {teamB.map((p, i) => (
                <PlayerLabel key={`b-${i}-${p}`} name={p} statsMap={statsMap} />
              ))}
            </div>
          </div>

          {isHost && (
            <div className={styles.winBtns}>
              <button
                className={`${styles.winBtn} ${styles.winBtnA}`}
                onClick={() => onWin(slot.id, 'A')}
              >
                <Trophy size={12} />
                {teamA.join(' & ')} win
              </button>
              <button
                className={`${styles.winBtn} ${styles.winBtnB}`}
                onClick={() => onWin(slot.id, 'B')}
              >
                <Trophy size={12} />
                {teamB.join(' & ')} win
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
