'use client';

import React, { useRef, useState } from 'react';
import { Swords, Sparkles, Trophy, Play, UserX } from 'lucide-react';
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
}> = ({ firstFour, suggestedTeamA, suggestedTeamB, playAllScore, statsMap, isHost, onMatch, onScoreChange, viewerScore, persistedScore, scoreReady, onMarkAbsent }) => {
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
  const submittingRef = useRef(false);

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
    // Lock synchronously. State alone would not stop a second click dispatched
    // before React replaces this match card with the next pairing.
    submittingRef.current = true;
    setSubmitting(true);
    try {
      await onMatch(teamA, teamB, winner, pendingScore);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const handleScoreChange = (score: LiveScoreState | null) => {
    // If the host corrects a score after selecting its winner, require the
    // corrected result to be reviewed again before the match is submitted.
    if (pendingScore) {
      setWinner(null);
      setPendingScore(undefined);
    }
    onScoreChange?.(score);
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
                  title="Mark absent — replace with waiting player"
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
        onWin={(side, sA, sB) => { setWinner(side); setPendingScore(`${sA} – ${sB}`); }}
        disabled={!isHost}
        onScoreChange={isHost ? handleScoreChange : undefined}
        viewerScore={!isHost ? viewerScore : null}
        persistedScore={isHost ? persistedScore : null}
        scoreReady={scoreReady}
      />
      <div className="winning-team">
        <span className="winning-label">Winner:</span>
        <button onClick={() => isHost && setWinner('A')} className={winner === 'A' ? 'selected-winner' : ''} disabled={teamA.length !== 2 || !isHost}>
          <Trophy size={12} /> Team A {winner === 'A' && pendingScore && `(${pendingScore})`}
        </button>
        <button onClick={() => isHost && setWinner('B')} className={winner === 'B' ? 'selected-winner' : ''} disabled={teamB.length !== 2 || !isHost}>
          <Trophy size={12} /> Team B {winner === 'B' && pendingScore && `(${pendingScore})`}
        </button>
      </div>
      {isHost && <button onClick={submit} className="match-action-btn" disabled={submitting}><Play size={13} /> {submitting ? 'Saving Match…' : 'Confirm Match'}</button>}
    </div>
  );
};
