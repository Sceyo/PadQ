'use client';

import React, { useRef, useState } from 'react';
import { Swords, Sparkles, Trophy, Play, UserX, Check } from 'lucide-react';
import type { PlayerStat } from '../../lib/types';
import type { LiveScoreState } from '@/lib/sessionService';
import { PlayerLabel } from '../atoms/PlayerLabel';
import { ScoreBoard } from '../ScoreBoard/ScoreBoard';

export const DoublesMatch: React.FC<{
  firstFour:        string[];
  suggestedTeamA?:  [string, string] | null;
  suggestedTeamB?:  [string, string] | null;
  playAllScore?:    number | null;
  statsMap:         Record<string, PlayerStat>;
  isHost:           boolean;
  onMatch:          (a: string[], b: string[], w: 'A' | 'B', score?: string) => Promise<boolean>;
  onScoreChange?:   (score: LiveScoreState | null) => void;
  viewerScore?:     LiveScoreState | null;
  persistedScore?:  LiveScoreState | null;
  scoreReady?:      boolean;
  onMarkAbsent?:    (player: string) => void;
  replaceDisabled?: boolean;
}> = ({ firstFour, suggestedTeamA, suggestedTeamB, playAllScore, statsMap, isHost, onMatch, onScoreChange, viewerScore, persistedScore, scoreReady, onMarkAbsent, replaceDisabled }) => {
  const [teamA, setTeamA] = useState<string[]>(() =>
    firstFour.length === 4
      ? (suggestedTeamA ? [...suggestedTeamA] : [firstFour[0], firstFour[1]])
      : []
  );
  const [teamB, setTeamB] = useState<string[]>(() =>
    firstFour.length === 4
      ? (suggestedTeamB ? [...suggestedTeamB] : [firstFour[2], firstFour[3]])
      : []
  );
  const [winner, setWinner] = useState<'A' | 'B' | null>(null);
  const [pendingScore, setPendingScore] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [saveStage, setSaveStage] = useState<'idle' | 'saving' | 'slow' | 'failed'>('idle');
  const savingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const slowTimerRef = useRef<NodeJS.Timeout | null>(null);

  // scoreWinner: set by ScoreBoard when a team reaches the score limit.
  // While set, the losing team's winner button is locked out.
  const [scoreWinner, setScoreWinner] = useState<'A' | 'B' | null>(null);
  const [hasScoredPoints, setHasScoredPoints] = useState<boolean>(() => {
    const s = persistedScore ?? viewerScore;
    return Boolean(s && (s.scoreA > 0 || s.scoreB > 0));
  });
  const isReplaceBlocked = Boolean(replaceDisabled || hasScoredPoints);
  const submittingRef = useRef(false);

  React.useEffect(() => {
    return () => {
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    };
  }, []);

  const toggle = (p: string) => {
    if (!isHost) return;
    if (teamA.includes(p)) { setTeamA(teamA.filter(x => x !== p)); return; }
    if (teamB.includes(p)) { setTeamB(teamB.filter(x => x !== p)); return; }
    if (teamA.length < 2) { setTeamA([...teamA, p]); return; }
    if (teamB.length < 2) { setTeamB([...teamB, p]); return; }
    alert('Teams are full (2 each)');
  };

  const submit = async () => {
    if (!isHost || submittingRef.current) return;
    if (teamA.length !== 2 || teamB.length !== 2) { alert('Assign all 4 players first'); return; }
    if (!winner) { alert('Select the winning team'); return; }

    submittingRef.current = true;
    setSubmitting(true);
    setSaveStage('idle');

    savingTimerRef.current = setTimeout(() => {
      setSaveStage('saving');
    }, 1000);

    slowTimerRef.current = setTimeout(() => {
      setSaveStage('slow');
    }, 8000);

    try {
      const ok = await onMatch(teamA, teamB, winner, pendingScore);
      if (ok === false) {
        setSaveStage('failed');
      }
    } catch {
      setSaveStage('failed');
    } finally {
      if (savingTimerRef.current) clearTimeout(savingTimerRef.current);
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleScoreChange = (score: LiveScoreState | null) => {
    setHasScoredPoints(Boolean(score && (score.scoreA > 0 || score.scoreB > 0)));
    if (score !== null) {
      if (score.scoreA >= score.limit) {
        setScoreWinner('A');
        setWinner('A');
        setPendingScore(`${score.scoreA} – ${score.scoreB}`);
      } else if (score.scoreB >= score.limit) {
        setScoreWinner('B');
        setWinner('B');
        setPendingScore(`${score.scoreA} – ${score.scoreB}`);
      } else {
        setScoreWinner(null);
        if (pendingScore) {
          setWinner(null);
          setPendingScore(undefined);
        }
      }
    } else {
      setScoreWinner(null);
      if (pendingScore) {
        setWinner(null);
        setPendingScore(undefined);
      }
    }
    onScoreChange?.(score);
  };

  // Called by ScoreBoard when a team reaches the score limit.
  const handleScoreWin = (side: 'A' | 'B', sA: number, sB: number) => {
    setScoreWinner(side);
    setWinner(side);
    setPendingScore(`${sA} – ${sB}`);
  };

  return (
    <div className="match-section">
      <h3 className="match-section-title"><Swords size={15} /> Form Teams</h3>
      {suggestedTeamA && suggestedTeamB && (
        <div className="playall-badge">
          <Sparkles size={12} />Maximum-novelty suggestion
          {playAllScore === 0 && ' — all new pairings!'}
          {(playAllScore ?? 0) > 0 && <span className="playall-score"> (repeat: {playAllScore})</span>}
        </div>
      )}
      <div className="team-display-row">
        <span className="team-chip team-chip--a">A: {teamA.join(' & ') || '—'}</span>
        <span className="vs-sep">vs</span>
        <span className="team-chip team-chip--b">B: {teamB.join(' & ') || '—'}</span>
      </div>
      <div className="player-buttons">
        {firstFour.map((p, i) => {
          const cls = teamA.includes(p) ? 'player-btn-team-a' : teamB.includes(p) ? 'player-btn-team-b' : 'player-btn-unassigned';
          return (
            <div key={`${i}-${p}`} className="player-btn-cell">
              <button onClick={() => toggle(p)} className={cls} disabled={!isHost}><PlayerLabel name={p} statsMap={statsMap} /></button>
              {isHost && onMarkAbsent && (
                <button
                  className="absent-mini-btn"
                  onClick={(e) => { e.stopPropagation(); onMarkAbsent(p); }}
                  disabled={isReplaceBlocked}
                  title={isReplaceBlocked ? 'Cannot replace player after scoring has started' : "Can't play now — replace with waiting player"}
                  aria-label={`Can't play now: Replace ${p}`}
                  type="button"
                >
                  <UserX size={10} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <ScoreBoard
        labelA={teamA.length ? teamA.join(' & ') : 'Team A'}
        labelB={teamB.length ? teamB.join(' & ') : 'Team B'}
        onWin={handleScoreWin}
        disabled={!isHost}
        onScoreChange={isHost ? handleScoreChange : undefined}
        viewerScore={!isHost ? viewerScore : null}
        persistedScore={isHost ? persistedScore : null}
        scoreReady={scoreReady}
        hideInlineConfirm={true}
      />
      <div className="winning-team">
        <span className="winning-label">Winner:</span>
        <button
          onClick={() => isHost && !scoreWinner && setWinner('A')}
          className={winner === 'A' ? 'selected-winner' : ''}
          disabled={teamA.length !== 2 || !isHost || scoreWinner === 'B'}
        >
          <Trophy size={12} /> Team A {winner === 'A' && pendingScore && `(${pendingScore})`}
        </button>
        <button
          onClick={() => isHost && !scoreWinner && setWinner('B')}
          className={winner === 'B' ? 'selected-winner' : ''}
          disabled={teamB.length !== 2 || !isHost || scoreWinner === 'A'}
        >
          <Trophy size={12} /> Team B {winner === 'B' && pendingScore && `(${pendingScore})`}
        </button>
      </div>

      {isHost && winner && (
        <div className="floating-confirm-wrap">
          <div className="floating-confirm-bar" role="region" aria-label="Confirm Match Result">
            <div className="floating-confirm-info">
              <span className="floating-confirm-badge">Match Ready</span>
              <span className="floating-confirm-summary">
                <strong>{winner === 'A' ? (teamA.join(' & ') || 'Team A') : (teamB.join(' & ') || 'Team B')}</strong> won
                {pendingScore ? ` (${pendingScore})` : ''}
              </span>
            </div>
            {saveStage === 'failed' && (
              <div className="floating-confirm-error" role="alert">
                Save failed. Check your connection and try again.
              </div>
            )}
            <button
              type="button"
              className="floating-confirm-btn"
              onClick={submit}
              disabled={submitting}
            >
              <Check size={16} />
              {submitting
                ? (saveStage === 'slow' ? 'Still saving, check your connection…' : 'Saving…')
                : (saveStage === 'failed'
                  ? 'Try Again'
                  : `Confirm ${winner === 'A' ? (teamA.join(' & ') || 'Team A') : (teamB.join(' & ') || 'Team B')} won${pendingScore ? `, ${pendingScore}` : ''}`)}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
