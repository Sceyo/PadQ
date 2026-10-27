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

const PRESET_LIMITS = [11, 15, 21] as const;

export const CourtScoreModal: React.FC<Props> = ({
  isOpen,
  match,
  onConfirm,
  onCancel,
}) => {
  const [targetLimit, setTargetLimit] = useState<number>(11);
  const [winnerScore, setWinnerScore] = useState('11');
  const [loserScore, setLoserScore] = useState('');
  const [isCustomTargetOpen, setIsCustomTargetOpen] = useState(false);
  const [customTargetInput, setCustomTargetInput] = useState('');
  const loserInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setWinnerScore(String(targetLimit));
      setLoserScore('');
      setIsCustomTargetOpen(false);
      // Autofocus loser score so host can just type the opponent's score and press Enter
      const t = setTimeout(() => {
        loserInputRef.current?.focus();
        loserInputRef.current?.select();
      }, 50);
      return () => clearTimeout(t);
    }
  }, [isOpen, match, targetLimit]);

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
  const winnerLabel = winnerTeam.length === 1 ? winnerTeam[0] : winnerTeam.join(' & ');
  const loserLabel  = loserTeam.length === 1 ? loserTeam[0] : loserTeam.join(' & ');

  const handleTargetChange = (newTarget: number) => {
    setTargetLimit(newTarget);
    setWinnerScore(String(newTarget));
    setLoserScore('');
    setIsCustomTargetOpen(false);
  };

  const getPresetsForTarget = (target: number) => {
    if (target === 11) return [9, 8, 7, 6, 5, 3, 0];
    if (target === 15) return [13, 12, 10, 8, 5, 0];
    if (target === 21) return [19, 18, 15, 12, 8, 0];
    const diffs = [2, 3, 5, Math.floor(target / 2), 0];
    return diffs.map(d => Math.max(0, target - d)).filter((v, i, a) => a.indexOf(v) === i);
  };

  const scorePresets = getPresetsForTarget(targetLimit);

  const handleLoserChange = (val: string) => {
    setLoserScore(val);
    const parsedLoser = parseInt(val.trim(), 10);
    if (!isNaN(parsedLoser)) {
      if (parsedLoser >= targetLimit - 1) {
        // Deuce: must win by 2
        setWinnerScore(String(parsedLoser + 2));
      } else {
        setWinnerScore(String(targetLimit));
      }
    }
  };

  const handleSave = () => {
    const rawLoser = loserScore.trim();
    const parsedLoser = rawLoser === '' ? 0 : parseInt(rawLoser, 10);
    const rawWinner = winnerScore.trim();
    const parsedWinner = rawWinner === '' ? targetLimit : parseInt(rawWinner, 10);

    const w = isNaN(parsedWinner) ? targetLimit : parsedWinner;
    const l = isNaN(parsedLoser) ? 0 : parsedLoser;

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
    setWinnerScore(String(targetLimit));
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

        {/* Target limit presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #cbd5e1)', fontWeight: 600 }}>
            Play to:
          </span>
          {PRESET_LIMITS.map(preset => {
            const isActive = targetLimit === preset && !isCustomTargetOpen;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => handleTargetChange(preset)}
                style={{
                  fontSize: '0.8125rem',
                  color: isActive ? '#ffffff' : 'var(--text-secondary, #cbd5e1)',
                  background: isActive ? 'var(--accent-primary, #5457e0)' : 'var(--surface-elevated, #1a2035)',
                  border: `1px solid ${isActive ? 'transparent' : 'var(--line-subtle, #252d47)'}`,
                  borderRadius: '9999px',
                  padding: '3px 10px',
                  cursor: 'pointer',
                  fontWeight: isActive ? 700 : 600,
                  transition: 'all 0.15s ease',
                }}
              >
                {preset}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setIsCustomTargetOpen(prev => !prev)}
            style={{
              fontSize: '0.8125rem',
              color: isCustomTargetOpen || !PRESET_LIMITS.includes(targetLimit as any) ? '#ffffff' : 'var(--text-secondary, #cbd5e1)',
              background: isCustomTargetOpen || !PRESET_LIMITS.includes(targetLimit as any) ? 'var(--accent-primary, #5457e0)' : 'var(--surface-elevated, #1a2035)',
              border: `1px solid ${isCustomTargetOpen || !PRESET_LIMITS.includes(targetLimit as any) ? 'transparent' : 'var(--line-subtle, #252d47)'}`,
              borderRadius: '9999px',
              padding: '3px 10px',
              cursor: 'pointer',
              fontWeight: isCustomTargetOpen || !PRESET_LIMITS.includes(targetLimit as any) ? 700 : 600,
              transition: 'all 0.15s ease',
            }}
          >
            {!PRESET_LIMITS.includes(targetLimit as any) ? `Special (${targetLimit})` : 'Special'}
          </button>
        </div>

        {isCustomTargetOpen && (
          <form
            onSubmit={e => {
              e.preventDefault();
              const val = parseInt(customTargetInput, 10);
              if (!isNaN(val) && val >= 2 && val <= 99) {
                handleTargetChange(val);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              background: 'var(--surface-elevated, #1a2035)',
              border: '1px solid var(--line-subtle, #252d47)',
              borderRadius: '12px',
              marginBottom: '10px',
            }}
          >
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #cbd5e1)', fontWeight: 600 }}>
              Special limit:
            </span>
            <input
              type="number"
              min={2}
              max={99}
              value={customTargetInput}
              onChange={e => setCustomTargetInput(e.target.value)}
              placeholder="e.g. 7"
              autoFocus
              style={{
                width: '64px',
                padding: '4px 8px',
                fontSize: '16px',
                background: 'var(--surface-bg, #0b0d17)',
                border: '1px solid var(--line-subtle, #252d47)',
                borderRadius: '6px',
                color: 'var(--text-primary, #f8fafc)',
                textAlign: 'center',
                fontWeight: 700,
              }}
            />
            <button
              type="submit"
              style={{
                padding: '5px 12px',
                background: 'var(--accent-primary, #5457e0)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Set
            </button>
          </form>
        )}

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
              placeholder="0"
              className={styles.scoreInput}
              value={loserScore}
              onChange={e => handleLoserChange(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label={`Score for ${loserLabel}`}
            />
          </div>
        </div>

        <div className={styles.presetsSection}>
          <span className={styles.presetsLabel}>Quick Presets:</span>
          <div className={styles.presetsRow}>
            {scorePresets.map(pts => {
              const isActive = winnerScore === String(targetLimit) && loserScore === String(pts);
              return (
                <button
                  key={pts}
                  type="button"
                  className={`${styles.presetBtn} ${isActive ? styles.presetBtnActive : ''}`}
                  onClick={() => handleApplyPreset(pts)}
                >
                  {targetLimit} – {pts}
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
