'use client';

import React, { useState, useEffect } from 'react';
import { Swords, Sparkles, Trophy, Play } from 'lucide-react';
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
  onMatch:          (a: string[], b: string[], w: 'A' | 'B', score?: string) => void;
  onScoreChange?:   (score: LiveScoreState | null) => void;
  viewerScore?:     LiveScoreState | null;
}> = ({ firstFour, suggestedTeamA, suggestedTeamB, playAllScore, statsMap, isHost, onMatch, onScoreChange, viewerScore }) => {
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [winner, setWinner] = useState<'A' | 'B' | null>(null);
  const [pendingScore, setPendingScore] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (firstFour.length !== 4) { setTeamA([]); setTeamB([]); }
    else {
      setTeamA(suggestedTeamA ? [...suggestedTeamA] : [firstFour[0], firstFour[1]]);
      setTeamB(suggestedTeamB ? [...suggestedTeamB] : [firstFour[2], firstFour[3]]);
    }
    setWinner(null); setPendingScore(undefined);
  }, [firstFour, suggestedTeamA, suggestedTeamB]);

  const toggle = (p: string) => {
    if (!isHost) return;
    if (teamA.includes(p)) { setTeamA(teamA.filter(x => x !== p)); return; }
    if (teamB.includes(p)) { setTeamB(teamB.filter(x => x !== p)); return; }
    if (teamA.length < 2) { setTeamA([...teamA, p]); return; }
    if (teamB.length < 2) { setTeamB([...teamB, p]); return; }
    alert('Teams are full (2 each)');
  };

  const submit = () => {
    if (!isHost) return;
    if (teamA.length !== 2 || teamB.length !== 2) { alert('Assign all 4 players first'); return; }
    if (!winner) { alert('Select the winning team'); return; }
    onMatch(teamA, teamB, winner, pendingScore);
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
          return <button key={`${i}-${p}`} onClick={() => toggle(p)} className={cls} disabled={!isHost}><PlayerLabel name={p} statsMap={statsMap} /></button>;
        })}
      </div>
      <ScoreBoard
        labelA={teamA.length ? teamA.join(' & ') : 'Team A'}
        labelB={teamB.length ? teamB.join(' & ') : 'Team B'}
        onWin={(side, sA, sB) => { setWinner(side); setPendingScore(`${sA} – ${sB}`); }}
        disabled={!isHost}
        onScoreChange={isHost ? onScoreChange : undefined}
        viewerScore={!isHost ? viewerScore : null}
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
      {isHost && <button onClick={submit} className="match-action-btn"><Play size={13} /> Confirm Match</button>}
    </div>
  );
};
