'use client';

import PlayerLabel from '../atoms/PlayerLabel';
import RankBadge from '../atoms/RankBadge';
import styles from './QueueTable.module.css';
import type { Player } from '@/types';

interface Props {
  players: Player[];
  courtId: string;
  isHost: boolean;
  onReorder?: (from: number, to: number) => void;
}

export default function QueueTable({ players, courtId, isHost, onReorder }: Props) {
  return (
    <div className={styles.container}>
      <h3 className={styles.heading}>Queue ({players.length})</h3>
      <ul className={styles.list}>
        {players.map((p, idx) => (
          <li key={p.id} className={styles.row}>
            <span className={styles.position}>#{idx + 1}</span>
            <PlayerLabel name={p.name} isActive={idx === 0} />
            <RankBadge rank={p.rank} />
            {isHost && onReorder && (
              <div className={styles.reorder}>
                <button onClick={() => onReorder(idx, Math.max(0, idx - 1))} aria-label="Move up">▲</button>
                <button onClick={() => onReorder(idx, Math.min(players.length - 1, idx + 1))} aria-label="Move down">▼</button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}