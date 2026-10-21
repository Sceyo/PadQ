'use client';

import { Trophy, Pencil } from 'lucide-react';
import type { CourtSlot } from '@/lib/sessionService';
import type { PlayerStat } from '../../lib/types';
import { PlayerLabel } from '../atoms/PlayerLabel';
import styles from './CourtCard.module.css';

interface Props {
  slot: CourtSlot;
  statsMap: Record<string, PlayerStat>;
  isHost: boolean;
  onWin: (courtId: string, side: 'A' | 'B') => void;
  onEdit?: (courtId: string) => void;
}

export function CourtCard({ slot, statsMap, isHost, onWin, onEdit }: Props) {
  const teamA = slot.onCourt.slice(0, 2);
  const teamB = slot.onCourt.slice(2, 4);
  const ready = slot.onCourt.length >= 4;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.courtName}>{slot.name}</span>
        {ready && <span className={styles.liveDot} />}
        {isHost && ready && onEdit && (
          <button
            className={styles.editBtn}
            onClick={() => onEdit(slot.id)}
            title="Edit player positions"
          >
            <Pencil size={11} />
          </button>
        )}
      </div>

      {ready ? (
        <>
          <div className={styles.matchup}>
            <div className={`${styles.team} ${styles.teamA}`}>
              <div className={styles.teamHeader}>Team 1</div>
              <div className={styles.playerList}>
                {teamA.map((p, i) => (
                  <div key={`a-${i}-${p}`} className={styles.playerRow}>
                    {i > 0 && <span className={styles.partnerConnector}>{' & '}</span>}
                    <div className={styles.playerChip}>
                      <PlayerLabel name={p} statsMap={statsMap} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.vsBadge}>VS</div>
            <div className={`${styles.team} ${styles.teamB}`}>
              <div className={styles.teamHeader}>Team 2</div>
              <div className={styles.playerList}>
                {teamB.map((p, i) => (
                  <div key={`b-${i}-${p}`} className={styles.playerRow}>
                    {i > 0 && <span className={styles.partnerConnector}>{' & '}</span>}
                    <div className={styles.playerChip}>
                      <PlayerLabel name={p} statsMap={statsMap} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {isHost && (
            <div className={styles.winBtns}>
              <button
                className={`${styles.winBtn} ${styles.winBtnA}`}
                onClick={() => onWin(slot.id, 'A')}
                title={`${teamA.join(' & ')} win`}
              >
                <Trophy size={12} />
                Team 1 Wins
              </button>
              <button
                className={`${styles.winBtn} ${styles.winBtnB}`}
                onClick={() => onWin(slot.id, 'B')}
                title={`${teamB.join(' & ')} win`}
              >
                <Trophy size={12} />
                Team 2 Wins
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