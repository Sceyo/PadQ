'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/useSession';
import styles from './ScoreBoard.module.css';

interface Props { courtId: string }

export default function ScoreBoard({ courtId }: Props) {
  const { session } = useSession();
  const [time, setTime] = useState<string>('00:00');
  // In real implementation, subscribe to a match timer from Firestore

  return (
    <div className={styles.board}>
      <div className={styles.courtLabel}>{session?.courts?.[courtId]?.name || courtId}</div>
      <div className={styles.score}>Team A 0 - 0 Team B</div>
      <div className={styles.timer}>{time}</div>
    </div>
  );
}