'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Trophy, X, Check } from 'lucide-react';
import styles from './CourtScoreModal.module.css';

export interface PendingCourtMatch {
  courtId: string;
  courtName: string;
  side: 'A' | 'B';
  teamA: string[];
  teamB: string[];
  mode?: 'singles' | 'doubles' | 'skilled';
}

interface Props {
  isOpen: boolean;
  match: PendingCourtMatch | null;
  onConfirm: (score?: string) => void;
  onCancel: () => void;
}

const SCORE_PRESETS = [9, 8, 7, 6, 5, 3, 0];

export const CourtScoreModal: React.FC<Props> = ({
  isOpen,
  match,
  onConfirm,
  onCancel,
}) => {
  const [winnerScore, setWinnerScore] = useState('11');
  const [loserScore, setLoserScore] = useState('');
  const loserInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setWinnerScore('11');
      setLoserScore('');
      // Autofocus loser score so host can just type the opponent's score and press Enter
      const t = setTimeout(() => {
        loserInputRef.current?.focus();
        loserInputRef.current?.select();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen, match]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || !match) return null;

  const winnerTeam = match.side === 'A' ? match.teamA : match.teamB;
  const loserTeam  = match.side === 'A' ? match.teamB : match.teamA;
  const winnerLabel = winnerTeam.join(' & ');
  const loserLabel  = loserTeam.join(' & ');

  const handleSave = () => {
    const w = parseInt(winnerScore.trim(), 10);
    const l = parseInt(loserScore.trim(), 10);
    if (isNaN(w) || isNaN(l)) {
      // If host left score empty, complete without score
      onConfirm(undefined);
      return;
    }
    // Format score in Team A vs Team B order
    const scoreA = match.side === 'A' ? w : l;
    const scoreB = match.side === 'A' ? l : w;
    onConfirm(`${scoreA} – ${scoreB}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  const handleApplyPreset = (presetOpponentScore: number) => {
    setWinnerScore('11');
    setLoserScore(String(presetOpponentScore));
  };

  return (
    <div className={styles.overlay} onClick={onCancel} role="dialog" aria-modal="true">
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <span className={styles.courtBadge}>{match.courtName}</span>
            <h2 className={styles.title}>
              <Trophy size={18} color="#eab308" /> Record Final Score
            </h2>
          </div>
          <button className={styles.closeX} onClick={onCancel} title="Cancel" aria-label="Cancel">
            <X size={16} />
          </button>
        </div>

        <div className={styles.scoreboard}>
          {/* Winner Side */}
          <div className={styles.teamSide}>
            <span className={styles.badgeWinner}>
              <Check size={10} /> Winner
            </span>
            <div className={styles.teamNames}>{winnerLabel}</div>
            <input
              type="number"
              min="0"
              max="99"
              className={`${styles.scoreInput} ${styles.scoreInputWinner}`}
              value={winnerScore}
              onChange={e => setWinnerScore(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label={`Score for ${winnerLabel}`}
            />
          </div>

          <div className={styles.scoreDivider}>–</div>

          {/* Opponent Side */}
          <div className={styles.teamSide}>
            <span className={styles.badgeOpponent}>Opponent</span>
            <div className={styles.teamNames}>{loserLabel}</div>
            <input
              ref={loserInputRef}
              type="number"
              min="0"
              max="99"
              placeholder="e.g. 9"
              className={styles.scoreInput}
              value={loserScore}
              onChange={e => setLoserScore(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label={`Score for ${loserLabel}`}
            />
          </div>
        </div>

        <div className={styles.presetsSection}>
          <span className={styles.presetsLabel}>Quick Presets:</span>
          <div className={styles.presetsRow}>
            {SCORE_PRESETS.map(pts => {
              const isActive = winnerScore === '11' && loserScore === String(pts);
              return (
                <button
                  key={pts}
                  type="button"
                  className={`${styles.presetBtn} ${isActive ? styles.presetBtnActive : ''}`}
                  onClick={() => handleApplyPreset(pts)}
                >
                  11 – {pts}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.actions}>
          <button type="button" className={styles.saveBtn} onClick={handleSave}>
            <Check size={16} /> Save Score &amp; Continue
          </button>
          <div className={styles.secondaryRow}>
            <button
              type="button"
              className={styles.skipBtn}
              onClick={() => onConfirm(undefined)}
              title="Record winner without score"
            >
              Skip Score
            </button>
            <button type="button" className={styles.cancelBtn} onClick={onCancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
