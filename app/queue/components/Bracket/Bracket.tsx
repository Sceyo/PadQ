import React from 'react';
import { Check } from 'lucide-react';
import type { TournamentMatch, EliminationType } from '../../lib/types';

export function buildSingleElim(entrants: string[]): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  let matchId = 1;
  let currentRound = entrants;
  let round = 0;
  while (currentRound.length > 1) {
    const nextRound: string[] = [];
    for (let i = 0; i < currentRound.length; i += 2) {
      const p1 = currentRound[i];
      const p2 = currentRound[i + 1] ?? null;
      const isBye = p2 === null;
      matches.push({ id: matchId++, round, slot: Math.floor(i / 2), bracket: 'W', player1: p1, player2: p2, winner: null, loser: null, isBye });
      nextRound.push(p1);
    }
    currentRound = nextRound;
    round++;
  }
  return matches;
}

export function buildDoubleElim(entrants: string[]): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  let matchId = 1;

  let wbRound = entrants;
  let round = 0;
  const wbMatches: TournamentMatch[] = [];
  while (wbRound.length > 1) {
    for (let i = 0; i < wbRound.length; i += 2) {
      const p1 = wbRound[i];
      const p2 = wbRound[i + 1] ?? null;
      const isBye = p2 === null;
      wbMatches.push({ id: matchId++, round, slot: Math.floor(i / 2), bracket: 'W', player1: p1, player2: p2, winner: null, loser: null, isBye });
    }
    wbRound = wbRound.slice(0, Math.ceil(wbRound.length / 2));
    round++;
  }
  matches.push(...wbMatches);

  let lbRound = entrants;
  round = 0;
  const lbMatches: TournamentMatch[] = [];
  while (lbRound.length > 1) {
    for (let i = 0; i < lbRound.length; i += 2) {
      const p1 = lbRound[i];
      const p2 = lbRound[i + 1] ?? null;
      const isBye = p2 === null;
      lbMatches.push({ id: matchId++, round, slot: Math.floor(i / 2), bracket: 'L', player1: p1, player2: p2, winner: null, loser: null, isBye });
    }
    lbRound = lbRound.slice(0, Math.ceil(lbRound.length / 2));
    round++;
  }
  matches.push(...lbMatches);

  matches.push({ id: matchId++, round: 0, slot: 0, bracket: 'GF', player1: null, player2: null, winner: null, loser: null, isBye: false });
  return matches;
}

export function recordSingleWinner(matches: TournamentMatch[], matchId: number, winner: string): TournamentMatch[] {
  const updated = [...matches];
  const idx = updated.findIndex(m => m.id === matchId);
  if (idx < 0) return updated;
  const match = updated[idx];
  const loser = match.player1 === winner ? match.player2 : match.player1;
  updated[idx] = { ...match, winner, loser };
  const nextMatch = updated.find(m => m.round === match.round + 1 && m.slot === Math.floor(match.slot / 2) && (m.player1 === null || m.player1 === match.player1));
  if (nextMatch) {
    const isSlot0 = match.slot % 2 === 0;
    updated[updated.indexOf(nextMatch)] = { ...nextMatch, ...(isSlot0 ? { player1: winner } : { player2: winner }) };
  }
  return updated;
}

export function recordDoubleWinner(matches: TournamentMatch[], matchId: number, winner: string): TournamentMatch[] {
  const updated = [...matches];
  const idx = updated.findIndex(m => m.id === matchId);
  if (idx < 0) return updated;
  const match = updated[idx];
  const loser = match.player1 === winner ? match.player2 : match.player1;
  updated[idx] = { ...match, winner, loser };
  if (match.bracket === 'W' || match.bracket === 'L') {
    const nextMatch = updated.find(m => m.bracket === match.bracket && m.round === match.round + 1 && m.slot === Math.floor(match.slot / 2) && (m.player1 === null || m.player1 === match.player1));
    if (nextMatch) {
      const isSlot0 = match.slot % 2 === 0;
      updated[updated.indexOf(nextMatch)] = { ...nextMatch, ...(isSlot0 ? { player1: winner } : { player2: winner }) };
    }
    if (match.bracket === 'W' && loser) {
      const lbMatch = updated.find(m => m.bracket === 'L' && m.round === match.round && m.slot === match.slot && m.player1 === null);
      if (lbMatch) {
        updated[updated.indexOf(lbMatch)] = { ...lbMatch, player1: loser };
      }
    }
  }
  if (match.bracket === 'W' && match.round === Math.max(...updated.filter(m => m.bracket === 'W').map(m => m.round))) {
    const gf = updated.find(m => m.bracket === 'GF');
    if (gf) {
      updated[updated.indexOf(gf)] = { ...gf, player1: winner };
    }
  }
  return updated;
}

const BracketSection: React.FC<{
  title: string;
  matches: TournamentMatch[];
  totalRounds: number;
  bracketType: 'W' | 'L' | 'GF';
}> = ({ title, matches, totalRounds, bracketType }) => {
  const byRound: Record<number, TournamentMatch[]> = {};
  matches.forEach(m => { (byRound[m.round] ??= []).push(m); });
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
  const roundLabel = (r: number): string => {
    if (bracketType === 'GF') return 'Grand Final';
    if (bracketType === 'W') {
      const rem = totalRounds - r;
      if (rem === 1) return 'Final';
      if (rem === 2) return 'Semis';
      if (rem === 3) return 'Quarters';
      return `WB Round ${r + 1}`;
    }
    if (bracketType === 'L') {
      if (r === Math.max(...rounds)) return 'LB Final';
      return r % 2 === 0 ? `LB Round ${Math.floor(r / 2) + 1}` : `LB Elim ${Math.floor(r / 2) + 1}`;
    }
    return `Round ${r + 1}`;
  };
  return (
    <div className="bracket-section">
      {title && <div className="bracket-section-title">{title}</div>}
      <div className="bracket-container">
        {rounds.map(r => (
          <div key={r} className="bracket-round">
            <div className="bracket-round-label">{roundLabel(r)}</div>
            <div className="bracket-round-matches">
              {byRound[r].sort((a, b) => a.slot - b.slot).map(m => {
                const p1Won = m.winner === m.player1, p2Won = m.winner === m.player2;
                return (
                  <div key={m.id} className={['bracket-match', m.winner ? 'bracket-match--done' : '', m.isBye ? 'bracket-match--bye' : '', bracketType === 'L' ? 'bracket-match--losers' : '', bracketType === 'GF' ? 'bracket-match--gf' : ''].filter(Boolean).join(' ')}>
                    <div className={['bracket-player', p1Won ? 'bracket-player--winner' : m.winner ? 'bracket-player--loser' : ''].filter(Boolean).join(' ')}>
                      <span>{m.player1 ?? <span className="bracket-tbd">TBD</span>}</span>
                      {p1Won && <Check size={11} className="bracket-win-icon" />}
                    </div>
                    <div className="bracket-divider" />
                    <div className={['bracket-player', p2Won ? 'bracket-player--winner' : m.winner ? 'bracket-player--loser' : ''].filter(Boolean).join(' ')}>
                      <span>{m.isBye ? <span className="bracket-no-player">No Player</span> : m.player2 ?? <span className="bracket-tbd">TBD</span>}</span>
                      {p2Won && <Check size={11} className="bracket-win-icon" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TournamentBracket: React.FC<{ matches: TournamentMatch[]; elimType: EliminationType }> = ({ matches, elimType }) => {
  if (elimType === 'single') {
    const rounds = [...new Set(matches.map(m => m.round))].length;
    return <BracketSection title="" matches={matches} totalRounds={rounds} bracketType="W" />;
  }
  const wbM = matches.filter(m => m.bracket === 'W');
  const lbM = matches.filter(m => m.bracket === 'L');
  const gfM = matches.filter(m => m.bracket === 'GF');
  const wbRn = [...new Set(wbM.map(m => m.round))].length;
  return (
    <div className="bracket-de-wrapper">
      <BracketSection title="Winners Bracket" matches={wbM} totalRounds={wbRn} bracketType="W" />
      {lbM.length > 0 && <BracketSection title="Losers Bracket" matches={lbM} totalRounds={0} bracketType="L" />}
      {gfM.length > 0 && <BracketSection title="" matches={gfM} totalRounds={0} bracketType="GF" />}
    </div>
  );
};
