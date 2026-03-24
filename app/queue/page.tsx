'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useQueue, {
  suggestNextDoublesMatch,
  suggestNextSinglesMatch,
  PlayAllSuggestion,
} from '@/hooks/useQueue';
import './QueueSystem.css';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface MatchHistoryEntry {
  id: number;
  mode: string;
  players: string;
  winner: string;
  timestamp: string;
}

type EliminationType = 'single' | 'double';

// bracket — 'W' = winners bracket, 'L' = losers bracket, 'GF' = grand final
interface TournamentMatch {
  id: number;
  round: number;
  slot: number;
  bracket: 'W' | 'L' | 'GF';
  player1: string | null;
  player2: string | null;
  winner: string | null;
  loser: string | null;
  isBye: boolean;
}

// ---------------------------------------------------------------------------
// Single Elimination — pre-generate ALL rounds upfront
// ---------------------------------------------------------------------------
function buildSingleElim(shuffledPlayers: string[]): TournamentMatch[] {
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(shuffledPlayers.length, 2))));
  const totalRounds = Math.log2(size);
  let id = Date.now();
  const matches: TournamentMatch[] = [];

  const seeded = [...shuffledPlayers];
  while (seeded.length < size) seeded.push('__BYE__');

  for (let s = 0; s < size / 2; s++) {
    const p1 = seeded[s * 2];
    const p2 = seeded[s * 2 + 1];
    const isBye = p2 === '__BYE__';
    matches.push({
      id: id++, round: 0, slot: s, bracket: 'W',
      player1: p1, player2: isBye ? null : p2,
      winner: isBye ? p1 : null, loser: null, isBye,
    });
  }

  for (let r = 1; r < totalRounds; r++) {
    const slotCount = size / Math.pow(2, r + 1);
    for (let s = 0; s < slotCount; s++) {
      matches.push({ id: id++, round: r, slot: s, bracket: 'W', player1: null, player2: null, winner: null, loser: null, isBye: false });
    }
  }

  return propagateSingle(matches);
}

function propagateSingle(matches: TournamentMatch[]): TournamentMatch[] {
  const m = matches.map(x => ({ ...x }));
  const byRound: Record<number, TournamentMatch[]> = {};
  m.forEach(x => { if (!byRound[x.round]) byRound[x.round] = []; byRound[x.round].push(x); });
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  for (const r of rounds) {
    for (const match of byRound[r]) {
      if (!match.winner) continue;
      const nextRound = byRound[r + 1];
      if (!nextRound) continue;
      const nextSlot = Math.floor(match.slot / 2);
      const next = nextRound.find(nm => nm.slot === nextSlot);
      if (!next) continue;
      if (match.slot % 2 === 0) next.player1 = match.winner;
      else next.player2 = match.winner;
    }
  }
  return m;
}

function recordSingleWinner(matches: TournamentMatch[], matchId: number, winner: string): TournamentMatch[] {
  const loser = matches.find(m => m.id === matchId)!;
  const loserName = loser.player1 === winner ? loser.player2 : loser.player1;
  const updated = matches.map(m => m.id === matchId ? { ...m, winner, loser: loserName } : { ...m });
  return propagateSingle(updated);
}

// ---------------------------------------------------------------------------
// Double Elimination — Winners bracket + Losers bracket + Grand Final
// ---------------------------------------------------------------------------
// Losers bracket round naming:
//   After WB round 0 → LB round 0 (drop-ins from WB R0)
//   LB plays alternating: feed round (new drop-ins fight existing losers) → elimination round
// ---------------------------------------------------------------------------
function buildDoubleElim(shuffledPlayers: string[]): TournamentMatch[] {
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(shuffledPlayers.length, 2))));
  const wbRounds = Math.log2(size);
  let id = Date.now();
  const matches: TournamentMatch[] = [];

  const seeded = [...shuffledPlayers];
  while (seeded.length < size) seeded.push('__BYE__');

  // ── Winners Bracket ──
  for (let r = 0; r < wbRounds; r++) {
    const slotCount = size / Math.pow(2, r + 1);
    for (let s = 0; s < slotCount; s++) {
      if (r === 0) {
        const p1 = seeded[s * 2];
        const p2 = seeded[s * 2 + 1];
        const isBye = p2 === '__BYE__';
        matches.push({ id: id++, round: r, slot: s, bracket: 'W', player1: p1, player2: isBye ? null : p2, winner: isBye ? p1 : null, loser: null, isBye });
      } else {
        matches.push({ id: id++, round: r, slot: s, bracket: 'W', player1: null, player2: null, winner: null, loser: null, isBye: false });
      }
    }
  }

  // ── Losers Bracket ──
  // LB has (2 * wbRounds - 2) rounds
  const lbRounds = 2 * wbRounds - 2;
  for (let r = 0; r < lbRounds; r++) {
    // Slot count halves every 2 LB rounds
    const slotCount = Math.max(1, size / Math.pow(2, Math.floor(r / 2) + 2));
    for (let s = 0; s < slotCount; s++) {
      matches.push({ id: id++, round: r, slot: s, bracket: 'L', player1: null, player2: null, winner: null, loser: null, isBye: false });
    }
  }

  // ── Grand Final ──
  matches.push({ id: id++, round: 0, slot: 0, bracket: 'GF', player1: null, player2: null, winner: null, loser: null, isBye: false });

  return propagateDouble(matches);
}

function propagateDouble(matches: TournamentMatch[]): TournamentMatch[] {
  const m = matches.map(x => ({ ...x }));

  const wb = (r: number) => m.filter(x => x.bracket === 'W' && x.round === r).sort((a, b) => a.slot - b.slot);
  const lb = (r: number) => m.filter(x => x.bracket === 'L' && x.round === r).sort((a, b) => a.slot - b.slot);
  const gf = () => m.find(x => x.bracket === 'GF')!;

  const wbRoundNums = [...new Set(m.filter(x => x.bracket === 'W').map(x => x.round))].sort((a, b) => a - b);
  const lbRoundNums = [...new Set(m.filter(x => x.bracket === 'L').map(x => x.round))].sort((a, b) => a - b);

  // Propagate within Winners Bracket
  for (const r of wbRoundNums) {
    const round = wb(r);
    const nextWb = wb(r + 1);
    for (const match of round) {
      if (match.winner && nextWb.length > 0) {
        const nextSlot = Math.floor(match.slot / 2);
        const next = nextWb.find(nm => nm.slot === nextSlot);
        if (next) {
          if (match.slot % 2 === 0) next.player1 = match.winner;
          else next.player2 = match.winner;
        }
      }
      // Drop loser into Losers Bracket
      if (match.loser) {
        // WB round r losers feed into LB round (r*2) — even-indexed LB rounds are "feed" rounds
        const targetLbRound = r * 2;
        const lbRound = lb(targetLbRound);
        if (lbRound.length > 0) {
          const targetSlot = match.slot;
          const lbMatch = lbRound.find(lm => lm.slot === targetSlot) ?? lbRound[Math.floor(targetSlot / 2)];
          if (lbMatch) {
            if (!lbMatch.player1) lbMatch.player1 = match.loser;
            else if (!lbMatch.player2) lbMatch.player2 = match.loser;
          }
        }
      }
    }
  }

  // Propagate within Losers Bracket
  for (const r of lbRoundNums) {
    const round = lb(r);
    const nextLb = lb(r + 1);
    for (const match of round) {
      if (match.winner && nextLb.length > 0) {
        const nextSlot = Math.floor(match.slot / 2);
        const next = nextLb.find(nm => nm.slot === nextSlot);
        if (next) {
          if (match.slot % 2 === 0) next.player1 = match.winner;
          else next.player2 = match.winner;
        }
      }
    }
  }

  // LB winner → Grand Final player2; WB winner → Grand Final player1
  const lastWbRound = Math.max(...wbRoundNums);
  const lastLbRound = lbRoundNums.length > 0 ? Math.max(...lbRoundNums) : -1;
  const wbFinal = wb(lastWbRound)[0];
  const lbFinal = lastLbRound >= 0 ? lb(lastLbRound)[0] : null;
  const grand = gf();

  if (wbFinal?.winner) grand.player1 = wbFinal.winner;
  if (lbFinal?.winner) grand.player2 = lbFinal.winner;

  return m;
}

function recordDoubleWinner(matches: TournamentMatch[], matchId: number, winner: string): TournamentMatch[] {
  const match = matches.find(m => m.id === matchId)!;
  const loserName = match.player1 === winner ? match.player2 : match.player1;
  const updated = matches.map(m => m.id === matchId ? { ...m, winner, loser: loserName } : { ...m });
  return propagateDouble(updated);
}

// ---------------------------------------------------------------------------
// Bracket renderer — handles both SE and DE visually
// ---------------------------------------------------------------------------
const BracketSection: React.FC<{
  title: string;
  matches: TournamentMatch[];
  totalRounds: number;
  bracketType: 'W' | 'L' | 'GF';
}> = ({ title, matches, totalRounds, bracketType }) => {
  const byRound: Record<number, TournamentMatch[]> = {};
  matches.forEach(m => { if (!byRound[m.round]) byRound[m.round] = []; byRound[m.round].push(m); });
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  const roundLabel = (r: number) => {
    if (bracketType === 'GF') return 'Grand Final';
    if (bracketType === 'W') {
      const remaining = totalRounds - r;
      if (remaining === 1) return 'WB Final';
      if (remaining === 2) return 'WB Semi-Finals';
      if (remaining === 3) return 'WB Quarter-Finals';
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
              {byRound[r].sort((a, b) => a.slot - b.slot).map(m => (
                <div key={m.id} className={`bracket-match ${m.winner ? 'bracket-match--done' : ''} ${m.isBye ? 'bracket-match--bye' : ''} ${bracketType === 'L' ? 'bracket-match--losers' : ''} ${bracketType === 'GF' ? 'bracket-match--gf' : ''}`}>
                  <div className={`bracket-player ${m.winner === m.player1 ? 'bracket-player--winner' : ''} ${m.winner && m.winner !== m.player1 ? 'bracket-player--loser' : ''}`}>
                    <span>{m.player1 ?? <span className="bracket-tbd">TBD</span>}</span>
                    {m.winner === m.player1 && <span className="bracket-win-icon">✓</span>}
                  </div>
                  <div className="bracket-divider" />
                  <div className={`bracket-player ${m.winner === m.player2 ? 'bracket-player--winner' : ''} ${m.winner && m.winner !== m.player2 ? 'bracket-player--loser' : ''}`}>
                    <span>{m.isBye ? <span className="bracket-bye">BYE</span> : m.player2 ?? <span className="bracket-tbd">TBD</span>}</span>
                    {m.winner === m.player2 && <span className="bracket-win-icon">✓</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TournamentBracket: React.FC<{
  matches: TournamentMatch[];
  elimType: EliminationType;
}> = ({ matches, elimType }) => {
  if (elimType === 'single') {
    const wbRounds = [...new Set(matches.map(m => m.round))].length;
    return (
      <BracketSection
        title=""
        matches={matches}
        totalRounds={wbRounds}
        bracketType="W"
      />
    );
  }

  // Double elimination
  const wbMatches = matches.filter(m => m.bracket === 'W');
  const lbMatches = matches.filter(m => m.bracket === 'L');
  const gfMatches = matches.filter(m => m.bracket === 'GF');
  const wbRounds = [...new Set(wbMatches.map(m => m.round))].length;

  return (
    <div className="bracket-de-wrapper">
      <BracketSection title="Winners Bracket" matches={wbMatches} totalRounds={wbRounds} bracketType="W" />
      {lbMatches.length > 0 && (
        <BracketSection title="Losers Bracket" matches={lbMatches} totalRounds={0} bracketType="L" />
      )}
      {gfMatches.length > 0 && (
        <BracketSection title="" matches={gfMatches} totalRounds={0} bracketType="GF" />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Helper table components
// ---------------------------------------------------------------------------
const SinglesTable: React.FC<{ queue: string[] }> = ({ queue }) => {
  const pairs: { match: number; p1: string; p2: string }[] = [];
  for (let i = 0; i < queue.length; i += 2) {
    pairs.push({ match: i / 2 + 1, p1: queue[i], p2: i + 1 < queue.length ? queue[i + 1] : 'Bye' });
  }
  return (
    <table className="pairing-table">
      <thead><tr><th>Match #</th><th>Player 1</th><th>Player 2</th></tr></thead>
      <tbody>
        {pairs.map((pair, idx) => (
          <tr key={idx} className={idx === 0 ? 'next-match' : ''}>
            <td>{pair.match}</td><td>{pair.p1}</td><td>{pair.p2}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const DoublesTable: React.FC<{ queue: string[] }> = ({ queue }) => {
  const matches: { match: number; teamA: string[]; teamB: string[]; incomplete?: boolean }[] = [];
  for (let i = 0; i < queue.length; i += 4) {
    if (i + 3 < queue.length) {
      matches.push({ match: i / 4 + 1, teamA: [queue[i], queue[i + 1]], teamB: [queue[i + 2], queue[i + 3]] });
    } else {
      const remaining = queue.slice(i);
      matches.push({
        match: i / 4 + 1,
        teamA: remaining.length > 0 ? [remaining[0]] : [],
        teamB: remaining.length > 2 ? [remaining[1], remaining[2]] : remaining.length > 1 ? [remaining[1]] : [],
        incomplete: true,
      });
    }
  }
  return (
    <table className="pairing-table">
      <thead><tr><th>Match #</th><th>Team A</th><th>Team B</th></tr></thead>
      <tbody>
        {matches.map((match, idx) => (
          <tr key={idx} className={idx === 0 ? 'next-match' : ''}>
            <td>{match.match}</td>
            <td>{match.teamA.join(' & ') || '—'}</td>
            <td>{match.teamB.join(' & ') || '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ---------------------------------------------------------------------------
// DoublesMatch
// ---------------------------------------------------------------------------
const DoublesMatch: React.FC<{
  firstFour: string[];
  suggestedTeamA?: [string, string] | null;
  suggestedTeamB?: [string, string] | null;
  playAllScore?: number | null;
  onMatch: (teamA: string[], teamB: string[], winningTeam: 'A' | 'B') => void;
}> = ({ firstFour, suggestedTeamA, suggestedTeamB, playAllScore, onMatch }) => {
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [winningTeam, setWinningTeam] = useState<'A' | 'B' | null>(null);

  useEffect(() => {
    if (firstFour.length === 4) {
      if (suggestedTeamA && suggestedTeamB) {
        setTeamA([...suggestedTeamA]);
        setTeamB([...suggestedTeamB]);
      } else {
        setTeamA([firstFour[0], firstFour[1]]);
        setTeamB([firstFour[2], firstFour[3]]);
      }
    } else { setTeamA([]); setTeamB([]); }
    setWinningTeam(null);
  }, [firstFour, suggestedTeamA, suggestedTeamB]);

  const togglePlayer = (player: string) => {
    if (teamA.includes(player)) setTeamA(teamA.filter(p => p !== player));
    else if (teamB.includes(player)) setTeamB(teamB.filter(p => p !== player));
    else if (teamA.length < 2) setTeamA([...teamA, player]);
    else if (teamB.length < 2) setTeamB([...teamB, player]);
    else alert('Teams are full (2 players each)');
  };

  const handleMatch = () => {
    if (teamA.length !== 2 || teamB.length !== 2) { alert('Please assign all 4 players to two teams (2 each)'); return; }
    if (!winningTeam) { alert('Select winning team'); return; }
    onMatch(teamA, teamB, winningTeam);
  };

  const isPlayAllSuggested = suggestedTeamA != null && suggestedTeamB != null;

  return (
    <div className="match-section">
      <h3>Next Match: Form Teams</h3>
      {isPlayAllSuggested && (
        <div className="playall-badge">
          <span className="playall-icon">✨</span>
          <span>
            Teams suggested for maximum novelty
            {playAllScore === 0 && ' — all new pairings!'}
            {playAllScore !== null && playAllScore !== undefined && playAllScore > 0 && (
              <span className="playall-score"> (repeat score: {playAllScore})</span>
            )}
          </span>
        </div>
      )}
      <p>Players: {firstFour.join(', ')}</p>
      <div className="team-display">
        <strong>Team A:</strong> {teamA.join(', ') || 'None'} <br />
        <strong>Team B:</strong> {teamB.join(', ') || 'None'}
      </div>
      <div className="player-buttons">
        {firstFour.map(player => {
          const btnClass = teamA.includes(player) ? 'player-btn-team-a' : teamB.includes(player) ? 'player-btn-team-b' : 'player-btn-unassigned';
          return <button key={player} onClick={() => togglePlayer(player)} className={btnClass}>{player}</button>;
        })}
      </div>
      <div className="winning-team">
        <label>Winning Team:</label>
        <button onClick={() => setWinningTeam('A')} className={winningTeam === 'A' ? 'selected-winner' : ''} disabled={teamA.length !== 2}>Team A</button>
        <button onClick={() => setWinningTeam('B')} className={winningTeam === 'B' ? 'selected-winner' : ''} disabled={teamB.length !== 2}>Team B</button>
      </div>
      <button onClick={handleMatch} className="match-action-btn">Play Match</button>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Winner modal
// ---------------------------------------------------------------------------
const WinnerModal: React.FC<{
  isOpen: boolean; winner: string; onClose: () => void; autoClose: boolean; setAutoClose: (val: boolean) => void;
}> = ({ isOpen, winner, onClose, autoClose, setAutoClose }) => {
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isOpen && autoClose) timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [isOpen, autoClose, onClose]);

  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>🎉 Match Result 🎉</h2>
        <p className="winner-name">{winner}</p>
        <div className="modal-controls">
          <label className="auto-close-toggle">
            <input type="checkbox" checked={autoClose} onChange={e => setAutoClose(e.target.checked)} />
            Auto close (3 seconds)
          </label>
          <button onClick={onClose} className="close-modal-btn">Close</button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main content
// ---------------------------------------------------------------------------
function QueueSystemContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const mode = searchParams?.get('mode');
  const gameModeFromUrl = (mode === 'singles' || mode === 'doubles') ? mode : null;

  const {
    gameMode, players, queue, playAllRel,
    setGameMode, setPlayers, playSingles, playDoubles,
    randomizeQueue, setQueue, recordPlayAllDoubles,
    recordPlayAllSingles, resetPlayAllRelationships,
  } = useQueue();

  const [tempPlayers, setTempPlayers] = useState<string[]>([]);
  const [currentName, setCurrentName] = useState('');
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalWinner, setModalWinner] = useState('');
  const [autoClose, setAutoClose] = useState(false);
  const [queueMode, setQueueMode] = useState<'default' | 'tournament' | 'playall'>('default');
  const [elimType, setElimType] = useState<EliminationType>('single');
  const [showHistory, setShowHistory] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [tournamentMatches, setTournamentMatches] = useState<TournamentMatch[]>([]);
  const [tournamentActive, setTournamentActive] = useState(false);
  const [tournamentWinner, setTournamentWinner] = useState<string | null>(null);

  // Play-All suggestion
  const playAllSuggestion = useMemo<PlayAllSuggestion | null>(() => {
    if (queueMode !== 'playall' || gameMode !== 'doubles') return null;
    return suggestNextDoublesMatch(queue, playAllRel);
  }, [queueMode, gameMode, queue, playAllRel]);

  useEffect(() => {
    if (!playAllSuggestion) return;
    const suggested = playAllSuggestion.reorderedQueue;
    if (queue.slice(0, 4).join(',') !== suggested.slice(0, 4).join(',')) setQueue(suggested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAllSuggestion]);

  useEffect(() => {
    if (queueMode !== 'playall' || gameMode !== 'singles' || queue.length < 2) return;
    const result = suggestNextSinglesMatch(queue, playAllRel);
    if (!result) return;
    if (queue.slice(0, 2).join(',') !== result.reorderedQueue.slice(0, 2).join(',')) setQueue(result.reorderedQueue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAllRel, queueMode, gameMode]);

  const firstFourPlayers = useMemo(() => queue.slice(0, 4), [queue]);

  useEffect(() => { document.body.classList.toggle('dark-mode', darkMode); }, [darkMode]);

  useEffect(() => {
    if (gameModeFromUrl === 'singles' || gameModeFromUrl === 'doubles') {
      setGameMode(gameModeFromUrl);
    } else {
      router.push('/');
    }
  }, [gameModeFromUrl, setGameMode, router]);

  const addPlayer = () => {
    const trimmed = currentName.trim();
    if (!trimmed) return;
    if (tempPlayers.includes(trimmed)) { alert('Player already added'); return; }
    setTempPlayers([...tempPlayers, trimmed]);
    setCurrentName('');
  };

  const removePlayer = (index: number) => {
    const updated = [...tempPlayers];
    updated.splice(index, 1);
    setTempPlayers(updated);
  };

  const handleStartQueue = () => {
    if (tempPlayers.length < 5 || tempPlayers.length > 24) {
      alert(`Please add ${tempPlayers.length < 5 ? 'at least 5' : 'no more than 24'} players. Currently: ${tempPlayers.length}`);
      return;
    }
    try {
      setPlayers(tempPlayers);
      setTempPlayers([]);
      setMatchHistory([]);
      setTournamentActive(false);
      setTournamentWinner(null);
      setTournamentMatches([]);
      if (queueMode === 'tournament') initTournament(tempPlayers, elimType);
    } catch (err) { alert((err as Error).message); }
  };

  const initTournament = (playerList: string[], type: EliminationType) => {
    const shuffled = [...playerList];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const bracket = type === 'single' ? buildSingleElim(shuffled) : buildDoubleElim(shuffled);
    setTournamentMatches(bracket);
    setTournamentActive(true);
    setTournamentWinner(null);
  };

  const handleTournamentMatch = (matchId: number, winner: string) => {
    const match = tournamentMatches.find(m => m.id === matchId)!;

    setMatchHistory(prev => [{
      id: Date.now(), mode: 'Tournament',
      players: `${match.player1} vs ${match.player2 || 'Bye'}`,
      winner, timestamp: new Date().toLocaleTimeString(),
    }, ...prev]);

    const updated = elimType === 'single'
      ? recordSingleWinner(tournamentMatches, matchId, winner)
      : recordDoubleWinner(tournamentMatches, matchId, winner);

    setTournamentMatches(updated);

    // Check if tournament is complete
    const gfMatch = updated.find(m => m.bracket === 'GF');
    const lastWbMatch = elimType === 'single'
      ? (() => {
          const byRound: Record<number, TournamentMatch[]> = {};
          updated.forEach(m => { if (!byRound[m.round]) byRound[m.round] = []; byRound[m.round].push(m); });
          const lastRound = Math.max(...Object.keys(byRound).map(Number));
          return byRound[lastRound]?.[0];
        })()
      : null;

    const champion = gfMatch?.winner ?? lastWbMatch?.winner;
    if (champion) {
      setTournamentWinner(champion);
      setModalWinner(`${champion} is the tournament champion! 🏆`);
      setModalOpen(true);
    }
  };

  const handleRandomize = () => {
    if (queueMode === 'tournament') {
      initTournament(players, elimType);
    } else {
      try {
        randomizeQueue();
        if (queueMode === 'playall') resetPlayAllRelationships();
      } catch (err) { alert((err as Error).message); }
    }
  };

  const handleElimTypeChange = (type: EliminationType) => {
    setElimType(type);
    if (queueMode === 'tournament' && players.length > 0) {
      initTournament(players, type);
      setTournamentWinner(null);
      setMatchHistory([]);
    }
  };

  const handleSinglesMatch = (winner: string) => {
    try {
      const p1 = queue[0]; const p2 = queue[1];
      playSingles(winner);
      setMatchHistory(prev => [{ id: Date.now(), mode: 'Singles', players: `${p1} vs ${p2}`, winner, timestamp: new Date().toLocaleTimeString() }, ...prev]);
      if (queueMode === 'playall') recordPlayAllSingles(p1, p2);
      setModalWinner(`${winner} wins!`);
      setModalOpen(true);
    } catch (err) { alert((err as Error).message); }
  };

  const handleDoublesMatch = (teamA: string[], teamB: string[], winningTeam: 'A' | 'B') => {
    try {
      const sA = [...teamA]; const sB = [...teamB];
      playDoubles(sA, sB, winningTeam);
      const winnerNames = winningTeam === 'A' ? sA.join(' & ') : sB.join(' & ');
      setMatchHistory(prev => [{ id: Date.now(), mode: 'Doubles', players: `${sA.join(' & ')} vs ${sB.join(' & ')}`, winner: winnerNames, timestamp: new Date().toLocaleTimeString() }, ...prev]);
      if (queueMode === 'playall') recordPlayAllDoubles(sA, sB);
      setModalWinner(`${winnerNames} win!`);
      setModalOpen(true);
    } catch (err) { alert((err as Error).message); }
  };

  const handleModeChange = (newMode: 'default' | 'tournament' | 'playall') => {
    setQueueMode(newMode);
    if (newMode === 'tournament') {
      initTournament(players, elimType);
    } else {
      setTournamentActive(false);
      setTournamentWinner(null);
      setTournamentMatches([]);
    }
    if (newMode === 'playall') resetPlayAllRelationships();
  };

  // Player setup screen
  if (players.length === 0) {
    return (
      <div className={`queue-system setup-page ${darkMode ? 'dark' : ''}`}>
        <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☀️' : '🌙'}</button>
        <button className="back-home" onClick={() => router.push('/')}>← Back to Home</button>
        <h1>{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue Setup</h1>
        <div className="player-input-container">
          <div className="input-group">
            <input type="text" value={currentName} onChange={e => setCurrentName(e.target.value)} placeholder="Enter player name" onKeyPress={e => e.key === 'Enter' && addPlayer()} />
            <button onClick={addPlayer} className="add-btn">+</button>
          </div>
          {tempPlayers.length > 0 && (
            <div className="players-list">
              <h3>Players ({tempPlayers.length}/24):</h3>
              <ul>
                {tempPlayers.map((player, idx) => (
                  <li key={idx}>{player}<button onClick={() => removePlayer(idx)} className="remove-btn">✖</button></li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={handleStartQueue} className="start-btn" disabled={tempPlayers.length < 5}>
            Start Queue ({tempPlayers.length}/5 min)
          </button>
        </div>
      </div>
    );
  }

  const modeSelector = (
    <div className="mode-selector">
      <button className={`mode-btn ${queueMode === 'default' ? 'active' : ''}`} onClick={() => handleModeChange('default')}>Default</button>
      <button className={`mode-btn ${queueMode === 'tournament' ? 'active' : ''}`} onClick={() => handleModeChange('tournament')}>Tournament</button>
      <button className={`mode-btn ${queueMode === 'playall' ? 'active' : ''}`} onClick={() => handleModeChange('playall')}>Play‑all</button>
    </div>
  );

  // Elimination type sub-tab — only shown in Tournament mode
  const elimSelector = queueMode === 'tournament' ? (
    <div className="elim-selector">
      <button
        className={`elim-btn ${elimType === 'single' ? 'active' : ''}`}
        onClick={() => handleElimTypeChange('single')}
      >
        Single Elimination
      </button>
      <button
        className={`elim-btn ${elimType === 'double' ? 'active' : ''}`}
        onClick={() => handleElimTypeChange('double')}
      >
        Double Elimination
      </button>
    </div>
  ) : null;

  const uiControls = (
    <div className="ui-controls">
      <button onClick={() => setShowHistory(!showHistory)} className="control-btn">{showHistory ? 'Hide' : 'Show'} History</button>
    </div>
  );

  // Tournament view
  if (queueMode === 'tournament' && tournamentActive) {
    const pendingMatch = tournamentMatches.find(m => !m.winner && !m.isBye && m.player1 && m.player2) ?? null;

    return (
      <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
        <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☀️' : '🌙'}</button>
        <button className="back-home" onClick={() => router.push('/')}>← Back to Home</button>
        {modeSelector}
        {elimSelector}
        {uiControls}
        <div className="main-layout">
          <div className="queue-area">
            <h1>{gameMode === 'singles' ? 'Singles' : 'Doubles'} Tournament</h1>
            <button onClick={handleRandomize} className="randomize-btn">🎲 Reseed</button>

            {tournamentWinner && <h2 className="champion">🏆 Champion: {tournamentWinner} 🏆</h2>}

            <TournamentBracket matches={tournamentMatches} elimType={elimType} />

            {pendingMatch && !tournamentWinner && (
              <div className="match-section">
                <h3>
                  {pendingMatch.bracket === 'L' ? '🔴 Losers Bracket — ' : pendingMatch.bracket === 'GF' ? '🏆 Grand Final — ' : ''}
                  Current Match: {pendingMatch.player1} vs {pendingMatch.player2}
                </h3>
                <div className="match-buttons">
                  <button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player1!)}>{pendingMatch.player1} wins</button>
                  <button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player2!)}>{pendingMatch.player2} wins</button>
                </div>
              </div>
            )}
          </div>

          {showHistory && (
            <div className="history-area">
              <h3>Match History</h3>
              {matchHistory.length === 0 ? <p>No matches played yet.</p> : (
                <ul className="history-list">
                  {matchHistory.map(entry => (
                    <li key={entry.id} className="history-item">
                      <div className="history-time">{entry.timestamp}</div>
                      <div className="history-match">{entry.players}</div>
                      <div className="history-winner">🏆 {entry.winner}</div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <WinnerModal isOpen={modalOpen} winner={modalWinner} onClose={() => setModalOpen(false)} autoClose={autoClose} setAutoClose={setAutoClose} />
      </div>
    );
  }

  // Default / Play-All queue view
  return (
    <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
      <button className="dark-mode-toggle" onClick={() => setDarkMode(!darkMode)}>{darkMode ? '☀️' : '🌙'}</button>
      <button className="back-home" onClick={() => router.push('/')}>← Back to Home</button>
      {modeSelector}
      {uiControls}
      <div className="main-layout">
        <div className="queue-area">
          <h1>{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue</h1>

          {/* Default mode explanation */}
          {queueMode === 'default' && (
            <p className="mode-description">
              🏆 Winners go to the back of the queue · Losers return to the front — so similar-level players naturally face each other.
            </p>
          )}
          {queueMode === 'playall' && (
            <p className="mode-description">
              ✨ Every player gets to play with and against everyone else before repeating any pairing.
            </p>
          )}
          {queueMode === 'tournament' && (
            <p className="mode-description">
              🏆 Tournament mode: Players compete in a bracket system until a winner is determined.
            </p>
          )}

          <div className="queue-header-row">
            {queueMode === 'playall' ? (
              <button onClick={() => { randomizeQueue(); resetPlayAllRelationships(); }} className="randomize-btn">🔄 Reset Play-All History</button>
            ) : (
              <button onClick={handleRandomize} className="randomize-btn">🎲 Randomize Queue</button>
            )}
          </div>
          <div className="pairings-container">
            <h3>Upcoming Matches</h3>
            {gameMode === 'singles' && <SinglesTable queue={queue} />}
            {gameMode === 'doubles' && <DoublesTable queue={queue} />}
          </div>
          {gameMode === 'singles' && queue.length >= 2 && (
            <div className="match-section">
              <h3>Next Match: {queue[0]} vs {queue[1]}</h3>
              <div className="match-buttons">
                <button onClick={() => handleSinglesMatch(queue[0])}>{queue[0]} Wins</button>
                <button onClick={() => handleSinglesMatch(queue[1])}>{queue[1]} Wins</button>
              </div>
            </div>
          )}
          {gameMode === 'doubles' && queue.length >= 4 && (
            <DoublesMatch
              firstFour={firstFourPlayers}
              suggestedTeamA={playAllSuggestion?.suggestedTeamA ?? null}
              suggestedTeamB={playAllSuggestion?.suggestedTeamB ?? null}
              playAllScore={playAllSuggestion?.score ?? null}
              onMatch={handleDoublesMatch}
            />
          )}
          {gameMode === 'singles' && queue.length < 2 && <p>Not enough players for a match.</p>}
          {gameMode === 'doubles' && queue.length < 4 && <p>Not enough players for a match.</p>}
        </div>
        {showHistory && (
          <div className="history-area">
            <h3>Match History</h3>
            {matchHistory.length === 0 ? <p>No matches played yet.</p> : (
              <ul className="history-list">
                {matchHistory.map(entry => (
                  <li key={entry.id} className="history-item">
                    <div className="history-time">{entry.timestamp}</div>
                    <div className="history-match">{entry.players}</div>
                    <div className="history-winner">🏆 {entry.winner}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      <WinnerModal isOpen={modalOpen} winner={modalWinner} onClose={() => setModalOpen(false)} autoClose={autoClose} setAutoClose={setAutoClose} />
    </div>
  );
}

export default function QueueSystem() {
  return (
    <Suspense fallback={<div>Loading queue system...</div>}>
      <QueueSystemContent />
    </Suspense>
  );
}