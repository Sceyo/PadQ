'use client';

import { useState, useEffect } from 'react';
import { Trophy, Pencil, UserX, Volume2 } from 'lucide-react';
import { formatElapsedSeconds, buildCourtCalloutText, speakCourtCallout, getOrInitCourtStartTime } from '../../lib/courtSpeechAndTimer';
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
  onMarkAbsent?: (player: string) => void;
  onSelectPlayer?: (player: string) => void;
  gameMode?: 'singles' | 'doubles';
}

export function CourtCard({ slot, statsMap, isHost, onWin, onEdit, onMarkAbsent, onSelectPlayer, gameMode = 'doubles' }: Props) {
  const isSingles = gameMode === 'singles';
  const requiredPlayers = isSingles ? 2 : 4;
  const teamA = slot.onCourt.slice(0, isSingles ? 1 : 2);
  const teamB = slot.onCourt.slice(isSingles ? 1 : 2, requiredPlayers);
  const ready = slot.onCourt.length >= requiredPlayers;
  const labelA = isSingles ? (teamA[0] ?? 'Player 1') : 'Team 1';
  const labelB = isSingles ? (teamB[0] ?? 'Player 2') : 'Team 2';

  const lineupKey = slot.onCourt.join(',');
  const [elapsed, setElapsed] = useState(() => {
    if (!ready) return 0;
    const start = getOrInitCourtStartTime(slot.id, lineupKey);
    return Math.floor((Date.now() - start) / 1000);
  });

  useEffect(() => {
    if (!ready) {
      setElapsed(0);
      return;
    }
    const start = getOrInitCourtStartTime(slot.id, lineupKey);
    setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));

    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    }, 1000);

    return () => clearInterval(timer);
  }, [slot.id, lineupKey, ready]);

  const handleVoiceCallout = () => {
    const text = buildCourtCalloutText(slot.name, teamA, teamB, gameMode);
    speakCourtCallout(text);
  };

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.courtName}>{slot.name}</span>
          {ready && <span className={styles.liveDot} />}
          {ready && (
            <span className={styles.timerBadge} title="Match elapsed time">
              {formatElapsedSeconds(elapsed)}
            </span>
          )}
        </div>
        <div className={styles.headerActions}>
          {ready && (
            <button
              type="button"
              className={styles.calloutBtn}
              onClick={handleVoiceCallout}
              title={`Announce ${slot.name} matchup`}
              aria-label={`Announce ${slot.name} matchup`}
            >
              <Volume2 size={12} />
            </button>
          )}
          {isHost && ready && onEdit && !isSingles && (
            <button
              className={styles.editBtn}
              onClick={() => onEdit(slot.id)}
              title="Edit player positions"
            >
              <Pencil size={11} />
            </button>
          )}
        </div>
      </div>

      {ready ? (
        <>
          <div className={styles.matchup}>
            <div className={`${styles.team} ${styles.teamA}`}>
              <div className={styles.teamHeader}>{labelA}</div>
              <div className={styles.playerList}>
                {teamA.map((p, i) => (
                  <div key={`a-${i}-${p}`} className={styles.playerRow}>
                    {i > 0 && <span className={styles.partnerConnector}>{' & '}</span>}
                    <div
                      className={styles.playerChip}
                      onClick={() => onSelectPlayer?.(p)}
                      style={onSelectPlayer ? { cursor: 'pointer' } : undefined}
                    >
                      <PlayerLabel name={p} statsMap={statsMap} />
                      {isHost && onMarkAbsent && (
                        <button
                          className="absent-mini-btn"
                          onClick={(e) => { e.stopPropagation(); onMarkAbsent(p); }}
                          title="Can't play now — replace with waiting player"
                          aria-label={`Can't play now: Replace ${p}`}
                          type="button"
                        >
                          <UserX size={10} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.vsBadge}>VS</div>
            <div className={`${styles.team} ${styles.teamB}`}>
              <div className={styles.teamHeader}>{labelB}</div>
              <div className={styles.playerList}>
                {teamB.map((p, i) => (
                  <div key={`b-${i}-${p}`} className={styles.playerRow}>
                    {i > 0 && <span className={styles.partnerConnector}>{' & '}</span>}
                    <div
                      className={styles.playerChip}
                      onClick={() => onSelectPlayer?.(p)}
                      style={onSelectPlayer ? { cursor: 'pointer' } : undefined}
                    >
                      <PlayerLabel name={p} statsMap={statsMap} />
                      {isHost && onMarkAbsent && (
                        <button
                          className="absent-mini-btn"
                          onClick={(e) => { e.stopPropagation(); onMarkAbsent(p); }}
                          title="Can't play now — replace with waiting player"
                          aria-label={`Can't play now: Replace ${p}`}
                          type="button"
                        >
                          <UserX size={10} />
                        </button>
                      )}
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
                aria-label={`${isSingles ? labelA : 'Team 1'} wins`}
                title={`${isSingles ? labelA : teamA.join(' & ')} wins`}
              >
                <Trophy size={12} />
                {isSingles ? `${labelA} Wins` : 'Team 1 Wins'}
              </button>
              <button
                className={`${styles.winBtn} ${styles.winBtnB}`}
                onClick={() => onWin(slot.id, 'B')}
                aria-label={`${isSingles ? labelB : 'Team 2'} wins`}
                title={`${isSingles ? labelB : teamB.join(' & ')} wins`}
              >
                <Trophy size={12} />
                {isSingles ? `${labelB} Wins` : 'Team 2 Wins'}
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
