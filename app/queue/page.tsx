'use client';

/**
 * ═══════════════════════════════════════════════════════════
 * PADQ — QueueSystem  (queue/page.tsx)
 * ═══════════════════════════════════════════════════════════
 *
 * CHANGES IN THIS VERSION
 * ────────────────────────
 *  • "Form Teams" appears ABOVE "Upcoming Matches"
 *  • "Show/Hide History" + "Reset" are in the same row
 *  • Live Scoring system with configurable point limit
 *    - Toggle scoring on/off per match
 *    - +/− buttons for each side (team or player)
 *    - Auto-completes the match when limit is reached
 *    - Score limit selector: 11 / 21 / custom
 *
 * FILE STRUCTURE
 * ──────────────
 *  § 1  Types & Constants
 *  § 2  Pure Logic Helpers
 *  § 3  Reusable UI Atoms       (RankBadge, StreakBadge, PlayerLabel)
 *  § 4  Bracket Components
 *  § 5  Queue Table Components
 *  § 6  ScoreBoard component    ← NEW
 *  § 7  DoublesMatch component
 *  § 8  WinnerModal
 *  § 9  Analytics Dashboard
 *  § 10 Live-management Panels
 *  § 11 AI / Smart Suggestions
 *  § 12 Main Orchestrator
 *  § 13 Default export
 * ═══════════════════════════════════════════════════════════
 */

import React, {
  useState, useEffect, useMemo, useCallback, Suspense,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Swords, Users, Trophy, Flame, Shuffle, History,
  Sun, Moon, ArrowLeft, Play, RotateCcw, PlusCircle,
  Trash2, UserPlus, ListOrdered, UserCheck,
  Star, Sparkles, RefreshCw, Check, X, BarChart2,
  TrendingUp, Activity, Award, Shield, Zap, Clock,
  Brain, AlertTriangle, ThumbsUp, Plus, Minus,
  Target, Settings,
} from 'lucide-react';
import useQueue, {
  suggestNextDoublesMatch,
  suggestNextSinglesMatch,
  PlayAllSuggestion,
} from '@/hooks/useQueue';
import './QueueSystem.css';

// ═══════════════════════════════════════════════════════════
// § 1  TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════

interface MatchHistoryEntry {
  id: number;
  mode: string;
  players: string;
  winner: string;
  score?: string;       // e.g. "21 – 15"
  timestamp: string;
}

interface PlayerStat {
  name: string;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  streak: number;
  rank: RankTier;
}

type RankTier = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
type EliminationType = 'single' | 'double';
type QueueMode = 'default' | 'tournament' | 'playall';
type GameTab = 'queue' | 'analytics';

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

interface SmartSuggestion {
  type: 'overused' | 'underused' | 'hot-streak' | 'team-balance';
  message: string;
  players: string[];
}

/** Live score state for one active match */
interface LiveScore {
  scoreA: number;
  scoreB: number;
  limit: number;       // 11, 21, or custom
  active: boolean;     // scoring mode on/off
}

const SCORE_PRESETS = [11, 21] as const;

const RANK_CFG: Record<RankTier, { color: string; icon: React.ReactNode }> = {
  Bronze:   { color: '#cd7f32', icon: <Shield   size={10} /> },
  Silver:   { color: '#a8a9ad', icon: <Shield   size={10} /> },
  Gold:     { color: '#ffd700', icon: <Award    size={10} /> },
  Platinum: { color: '#00c8c8', icon: <Star     size={10} /> },
  Diamond:  { color: '#93c5fd', icon: <Zap      size={10} /> },
};

// ═══════════════════════════════════════════════════════════
// § 2  PURE LOGIC HELPERS
// ═══════════════════════════════════════════════════════════

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function calcRank(winRate: number, gamesPlayed: number): RankTier {
  if (gamesPlayed < 3)  return 'Bronze';
  if (winRate >= 80)    return 'Diamond';
  if (winRate >= 65)    return 'Platinum';
  if (winRate >= 50)    return 'Gold';
  if (winRate >= 35)    return 'Silver';
  return 'Bronze';
}

function buildPlayerStats(players: string[], history: MatchHistoryEntry[]): PlayerStat[] {
  const wins: Record<string, number>   = {};
  const losses: Record<string, number> = {};
  const streak: Record<string, number> = {};

  for (const p of players) { wins[p] = 0; losses[p] = 0; streak[p] = 0; }

  for (const entry of [...history].reverse()) {
    const winnerNames = entry.winner.split(' & ');
    const allNames = entry.players
      .split(' vs ')
      .flatMap(s => s.split(' & '))
      .map(s => s.trim())
      .filter(n => players.includes(n));

    for (const name of allNames) {
      if (winnerNames.includes(name)) {
        wins[name]   = (wins[name]   ?? 0) + 1;
        streak[name] = (streak[name] ?? 0) + 1;
      } else {
        losses[name] = (losses[name] ?? 0) + 1;
        streak[name] = 0;
      }
    }
  }

  return players.map(name => {
    const w  = wins[name]   ?? 0;
    const l  = losses[name] ?? 0;
    const gp = w + l;
    const wr = gp === 0 ? 0 : Math.round((w / gp) * 100);
    return { name, wins: w, losses: l, gamesPlayed: gp, winRate: wr, streak: streak[name] ?? 0, rank: calcRank(wr, gp) };
  });
}

function generateSuggestions(stats: PlayerStat[], queue: string[]): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];
  if (stats.length === 0) return suggestions;

  const avgGP = stats.reduce((a, b) => a + b.gamesPlayed, 0) / stats.length;

  const overused = stats.filter(s => s.gamesPlayed > avgGP * 1.5 && s.gamesPlayed > 2);
  if (overused.length > 0)
    suggestions.push({ type: 'overused', message: 'These players have played significantly more games — consider giving them a break.', players: overused.map(s => s.name) });

  const underused = stats.filter(s => s.gamesPlayed === 0);
  if (underused.length > 0)
    suggestions.push({ type: 'underused', message: "These players haven't played yet. Consider adding them to the queue.", players: underused.map(s => s.name) });

  const hot = stats.filter(s => s.streak >= 3);
  if (hot.length > 0)
    suggestions.push({ type: 'hot-streak', message: `${hot.map(s => s.name).join(', ')} ${hot.length === 1 ? 'is' : 'are'} on a hot streak 🔥`, players: hot.map(s => s.name) });

  if (queue.length >= 4) {
    const qStats = queue.slice(0, 4).map(n => stats.find(s => s.name === n));
    const rates = qStats.map(s => s?.winRate ?? 50);
    if (Math.abs((rates[0] + rates[1]) - (rates[2] + rates[3])) > 30)
      suggestions.push({ type: 'team-balance', message: 'The next doubles match may be unbalanced. Try swapping players for a fairer game.', players: queue.slice(0, 4) });
  }

  return suggestions;
}

// ── Single Elimination ────────────────────────────────────

function buildSingleElim(players: string[]): TournamentMatch[] {
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(players.length, 2))));
  const totalRounds = Math.log2(size);
  let id = Date.now();
  const matches: TournamentMatch[] = [];
  const seeded = [...players];
  while (seeded.length < size) seeded.push('__BYE__');

  for (let s = 0; s < size / 2; s++) {
    const [p1, p2] = [seeded[s * 2], seeded[s * 2 + 1]];
    const isBye = p2 === '__BYE__';
    matches.push({ id: id++, round: 0, slot: s, bracket: 'W', player1: p1, player2: isBye ? null : p2, winner: isBye ? p1 : null, loser: null, isBye });
  }
  for (let r = 1; r < totalRounds; r++) {
    const slots = size / Math.pow(2, r + 1);
    for (let s = 0; s < slots; s++)
      matches.push({ id: id++, round: r, slot: s, bracket: 'W', player1: null, player2: null, winner: null, loser: null, isBye: false });
  }
  return propagateSingle(matches);
}

function propagateSingle(matches: TournamentMatch[]): TournamentMatch[] {
  const m = matches.map(x => ({ ...x }));
  const byRound: Record<number, TournamentMatch[]> = {};
  m.forEach(x => { (byRound[x.round] ??= []).push(x); });
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
  for (const r of rounds) {
    for (const match of byRound[r]) {
      if (!match.winner) continue;
      const next = byRound[r + 1]?.find(nm => nm.slot === Math.floor(match.slot / 2));
      if (!next) continue;
      if (match.slot % 2 === 0) next.player1 = match.winner; else next.player2 = match.winner;
    }
  }
  return m;
}

function recordSingleWinner(matches: TournamentMatch[], matchId: number, winner: string): TournamentMatch[] {
  const match = matches.find(m => m.id === matchId)!;
  const loser = match.player1 === winner ? match.player2 : match.player1;
  return propagateSingle(matches.map(m => m.id === matchId ? { ...m, winner, loser } : { ...m }));
}

function buildDoubleElim(players: string[]): TournamentMatch[] {
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(players.length, 2))));
  const wbR = Math.log2(size);
  let id = Date.now();
  const matches: TournamentMatch[] = [];
  const seeded = [...players];
  while (seeded.length < size) seeded.push('__BYE__');

  for (let r = 0; r < wbR; r++) {
    const slots = size / Math.pow(2, r + 1);
    for (let s = 0; s < slots; s++) {
      if (r === 0) {
        const [p1, p2] = [seeded[s * 2], seeded[s * 2 + 1]];
        const isBye = p2 === '__BYE__';
        matches.push({ id: id++, round: r, slot: s, bracket: 'W', player1: p1, player2: isBye ? null : p2, winner: isBye ? p1 : null, loser: null, isBye });
      } else {
        matches.push({ id: id++, round: r, slot: s, bracket: 'W', player1: null, player2: null, winner: null, loser: null, isBye: false });
      }
    }
  }
  const lbRounds = 2 * wbR - 2;
  for (let r = 0; r < lbRounds; r++) {
    const slots = Math.max(1, size / Math.pow(2, Math.floor(r / 2) + 2));
    for (let s = 0; s < slots; s++)
      matches.push({ id: id++, round: r, slot: s, bracket: 'L', player1: null, player2: null, winner: null, loser: null, isBye: false });
  }
  matches.push({ id: id++, round: 0, slot: 0, bracket: 'GF', player1: null, player2: null, winner: null, loser: null, isBye: false });
  return propagateDouble(matches);
}

function propagateDouble(matches: TournamentMatch[]): TournamentMatch[] {
  const m = matches.map(x => ({ ...x }));
  const wb = (r: number) => m.filter(x => x.bracket === 'W' && x.round === r).sort((a, b) => a.slot - b.slot);
  const lb = (r: number) => m.filter(x => x.bracket === 'L' && x.round === r).sort((a, b) => a.slot - b.slot);
  const gf = () => m.find(x => x.bracket === 'GF')!;
  const wbRounds = [...new Set(m.filter(x => x.bracket === 'W').map(x => x.round))].sort((a, b) => a - b);
  const lbRounds = [...new Set(m.filter(x => x.bracket === 'L').map(x => x.round))].sort((a, b) => a - b);

  for (const r of wbRounds) {
    for (const match of wb(r)) {
      if (match.winner) {
        const next = wb(r + 1).find(nm => nm.slot === Math.floor(match.slot / 2));
        if (next) { match.slot % 2 === 0 ? (next.player1 = match.winner) : (next.player2 = match.winner); }
      }
      if (match.loser) {
        const lbRow = lb(r * 2);
        if (lbRow.length) {
          const lbM = lbRow.find(l => l.slot === match.slot) ?? lbRow[Math.floor(match.slot / 2)];
          if (lbM) { !lbM.player1 ? (lbM.player1 = match.loser) : !lbM.player2 && (lbM.player2 = match.loser); }
        }
      }
    }
  }
  for (const r of lbRounds) {
    for (const match of lb(r)) {
      if (!match.winner || !lb(r + 1).length) continue;
      const next = lb(r + 1).find(nm => nm.slot === Math.floor(match.slot / 2));
      if (next) { match.slot % 2 === 0 ? (next.player1 = match.winner) : (next.player2 = match.winner); }
    }
  }
  const grand = gf();
  const wbF = wb(Math.max(...wbRounds))[0];
  const lbF = lbRounds.length ? lb(Math.max(...lbRounds))[0] : null;
  if (wbF?.winner) grand.player1 = wbF.winner;
  if (lbF?.winner) grand.player2 = lbF.winner;
  return m;
}

function recordDoubleWinner(matches: TournamentMatch[], matchId: number, winner: string): TournamentMatch[] {
  const match = matches.find(m => m.id === matchId)!;
  const loser = match.player1 === winner ? match.player2 : match.player1;
  return propagateDouble(matches.map(m => m.id === matchId ? { ...m, winner, loser } : { ...m }));
}

// ═══════════════════════════════════════════════════════════
// § 3  REUSABLE UI ATOMS
// ═══════════════════════════════════════════════════════════

const RankBadge: React.FC<{ rank: RankTier }> = ({ rank }) => {
  const { color, icon } = RANK_CFG[rank];
  return (
    <span className="rank-badge" style={{ '--rc': color } as React.CSSProperties}>
      {icon}{rank}
    </span>
  );
};

const StreakBadge: React.FC<{ streak: number }> = ({ streak }) =>
  streak < 2 ? null : (
    <span className="streak-badge"><Flame size={11} />{streak}</span>
  );

const PlayerLabel: React.FC<{
  name: string;
  statsMap?: Record<string, PlayerStat>;
  showRank?: boolean;
}> = ({ name, statsMap, showRank = false }) => {
  const s = statsMap?.[name];
  return (
    <span className="player-label">
      {name}
      {s && <StreakBadge streak={s.streak} />}
      {s && showRank && <RankBadge rank={s.rank} />}
    </span>
  );
};

// ═══════════════════════════════════════════════════════════
// § 4  BRACKET COMPONENTS
// ═══════════════════════════════════════════════════════════

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
                const p1Won = m.winner === m.player1;
                const p2Won = m.winner === m.player2;
                return (
                  <div key={m.id} className={[
                    'bracket-match',
                    m.winner ? 'bracket-match--done' : '',
                    m.isBye  ? 'bracket-match--bye'  : '',
                    bracketType === 'L'  ? 'bracket-match--losers' : '',
                    bracketType === 'GF' ? 'bracket-match--gf'     : '',
                  ].filter(Boolean).join(' ')}>
                    <div className={['bracket-player', p1Won ? 'bracket-player--winner' : m.winner ? 'bracket-player--loser' : ''].filter(Boolean).join(' ')}>
                      <span>{m.player1 ?? <span className="bracket-tbd">TBD</span>}</span>
                      {p1Won && <Check size={11} className="bracket-win-icon" />}
                    </div>
                    <div className="bracket-divider" />
                    <div className={['bracket-player', p2Won ? 'bracket-player--winner' : m.winner ? 'bracket-player--loser' : ''].filter(Boolean).join(' ')}>
                      <span>{m.isBye ? <span className="bracket-bye">BYE</span> : m.player2 ?? <span className="bracket-tbd">TBD</span>}</span>
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

const TournamentBracket: React.FC<{ matches: TournamentMatch[]; elimType: EliminationType }> = ({ matches, elimType }) => {
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

// ═══════════════════════════════════════════════════════════
// § 5  QUEUE TABLE COMPONENTS
// ═══════════════════════════════════════════════════════════

const SinglesTable: React.FC<{ queue: string[]; statsMap: Record<string, PlayerStat> }> = ({ queue, statsMap }) => {
  const pairs = [];
  for (let i = 0; i < queue.length; i += 2)
    pairs.push({ n: i / 2 + 1, p1: queue[i], p2: i + 1 < queue.length ? queue[i + 1] : 'Bye' });
  return (
    <table className="pairing-table">
      <thead><tr><th>#</th><th>Player 1</th><th>Player 2</th></tr></thead>
      <tbody>
        {pairs.map((p, i) => (
          <tr key={i} className={i === 0 ? 'next-match' : ''}>
            <td>{p.n}</td>
            <td><PlayerLabel name={p.p1} statsMap={statsMap} /></td>
            <td><PlayerLabel name={p.p2} statsMap={statsMap} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const DoublesTable: React.FC<{ queue: string[]; statsMap: Record<string, PlayerStat> }> = ({ queue, statsMap }) => {
  const matches = [];
  for (let i = 0; i < queue.length; i += 4) {
    if (i + 3 < queue.length) {
      matches.push({ n: i / 4 + 1, a: [queue[i], queue[i + 1]], b: [queue[i + 2], queue[i + 3]] });
    } else {
      const rem = queue.slice(i);
      matches.push({ n: i / 4 + 1, a: rem.slice(0, 2), b: rem.slice(2, 4), incomplete: true });
    }
  }
  const TeamCell = ({ names }: { names: string[] }) => (
    <>
      {names.map((n, i) => (
        <React.Fragment key={n}>
          <PlayerLabel name={n} statsMap={statsMap} />
          {i < names.length - 1 && <span className="team-amp"> & </span>}
        </React.Fragment>
      ))}
    </>
  );
  return (
    <table className="pairing-table">
      <thead><tr><th>#</th><th>Team A</th><th>Team B</th></tr></thead>
      <tbody>
        {matches.map((m, i) => (
          <tr key={i} className={i === 0 ? 'next-match' : ''}>
            <td>{m.n}</td>
            <td>{m.a.length ? <TeamCell names={m.a} /> : '—'}</td>
            <td>{m.b.length ? <TeamCell names={m.b} /> : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ═══════════════════════════════════════════════════════════
// § 6  SCOREBOARD COMPONENT  ← NEW
// ═══════════════════════════════════════════════════════════

/**
 * ScoreBoard — live scoring widget embedded inside the match section.
 *
 * Props:
 *  labelA / labelB  — names shown above each score column
 *  onWin(side)      — called when a side reaches the limit
 *  onScoreChange    — optional callback with current scores
 */
const ScoreBoard: React.FC<{
  labelA: string;
  labelB: string;
  onWin: (side: 'A' | 'B', scoreA: number, scoreB: number) => void;
}> = ({ labelA, labelB, onWin }) => {
  const [active,      setActive]      = useState(false);
  const [scoreA,      setScoreA]      = useState(0);
  const [scoreB,      setScoreB]      = useState(0);
  const [limit,       setLimit]       = useState(21);
  const [customLimit, setCustomLimit] = useState('');
  const [showCustom,  setShowCustom]  = useState(false);
  const [finished,    setFinished]    = useState(false);

  // Reset everything when scoring is toggled off
  const reset = () => {
    setScoreA(0); setScoreB(0);
    setFinished(false);
  };

  const toggleActive = () => {
    if (active) { reset(); }
    setActive(a => !a);
  };

  /** Increment a score and auto-detect winner */
  const increment = (side: 'A' | 'B') => {
    if (finished) return;
    let nextA = scoreA, nextB = scoreB;
    if (side === 'A') nextA++;
    else nextB++;
    setScoreA(nextA);
    setScoreB(nextB);

    if (nextA >= limit) { setFinished(true); onWin('A', nextA, nextB); }
    else if (nextB >= limit) { setFinished(true); onWin('B', nextA, nextB); }
  };

  const decrement = (side: 'A' | 'B') => {
    if (finished) return;
    if (side === 'A' && scoreA > 0) setScoreA(s => s - 1);
    if (side === 'B' && scoreB > 0) setScoreB(s => s - 1);
  };

  const applyCustomLimit = () => {
    const v = parseInt(customLimit, 10);
    if (!isNaN(v) && v > 0) { setLimit(v); setShowCustom(false); setCustomLimit(''); reset(); }
  };

  return (
    <div className="scoreboard-wrap">
      {/* Toggle + limit selector row */}
      <div className="scoreboard-toolbar">
        <button
          className={`scoreboard-toggle ${active ? 'scoreboard-toggle--on' : ''}`}
          onClick={toggleActive}
        >
          <Target size={13} />
          {active ? 'Scoring ON' : 'Enable Scoring'}
        </button>

        {active && (
          <div className="score-limit-row">
            <span className="score-limit-label"><Settings size={11} /> Limit:</span>
            {SCORE_PRESETS.map(p => (
              <button
                key={p}
                className={`score-preset-btn ${limit === p && !showCustom ? 'active' : ''}`}
                onClick={() => { setLimit(p); setShowCustom(false); reset(); }}
              >
                {p}
              </button>
            ))}
            <button
              className={`score-preset-btn ${showCustom ? 'active' : ''}`}
              onClick={() => setShowCustom(s => !s)}
            >
              Custom
            </button>
            {showCustom && (
              <span className="score-custom-wrap">
                <input
                  type="number"
                  className="score-custom-input"
                  value={customLimit}
                  onChange={e => setCustomLimit(e.target.value)}
                  placeholder="e.g. 15"
                  min={1}
                  onKeyDown={e => e.key === 'Enter' && applyCustomLimit()}
                />
                <button className="score-custom-ok" onClick={applyCustomLimit}>
                  <Check size={12} />
                </button>
              </span>
            )}
            <button className="score-reset-btn" onClick={reset} title="Reset scores">
              <RotateCcw size={12} />
            </button>
          </div>
        )}
      </div>

      {/* Score display */}
      {active && (
        <div className={`scoreboard ${finished ? 'scoreboard--finished' : ''}`}>
          {/* Side A */}
          <div className={`score-side score-side--a ${scoreA >= limit ? 'score-side--winner' : ''}`}>
            <div className="score-player-name">{labelA}</div>
            <div className="score-display">{scoreA}</div>
            <div className="score-btns">
              <button onClick={() => increment('A')} disabled={finished} className="score-btn score-btn--plus">
                <Plus size={16} />
              </button>
              <button onClick={() => decrement('A')} disabled={finished || scoreA === 0} className="score-btn score-btn--minus">
                <Minus size={14} />
              </button>
            </div>
          </div>

          {/* Centre */}
          <div className="score-centre">
            <span className="score-limit-badge">to {limit}</span>
            {finished && <div className="score-finished-label">Game Over!</div>}
          </div>

          {/* Side B */}
          <div className={`score-side score-side--b ${scoreB >= limit ? 'score-side--winner' : ''}`}>
            <div className="score-player-name">{labelB}</div>
            <div className="score-display">{scoreB}</div>
            <div className="score-btns">
              <button onClick={() => increment('B')} disabled={finished} className="score-btn score-btn--plus">
                <Plus size={16} />
              </button>
              <button onClick={() => decrement('B')} disabled={finished || scoreB === 0} className="score-btn score-btn--minus">
                <Minus size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// § 7  DOUBLES MATCH BUILDER
// ═══════════════════════════════════════════════════════════

const DoublesMatch: React.FC<{
  firstFour: string[];
  suggestedTeamA?: [string, string] | null;
  suggestedTeamB?: [string, string] | null;
  playAllScore?: number | null;
  statsMap: Record<string, PlayerStat>;
  onMatch: (a: string[], b: string[], w: 'A' | 'B', score?: string) => void;
}> = ({ firstFour, suggestedTeamA, suggestedTeamB, playAllScore, statsMap, onMatch }) => {
  const [teamA,  setTeamA]  = useState<string[]>([]);
  const [teamB,  setTeamB]  = useState<string[]>([]);
  const [winner, setWinner] = useState<'A' | 'B' | null>(null);
  const [pendingScore, setPendingScore] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (firstFour.length !== 4) { setTeamA([]); setTeamB([]); }
    else {
      setTeamA(suggestedTeamA ? [...suggestedTeamA] : [firstFour[0], firstFour[1]]);
      setTeamB(suggestedTeamB ? [...suggestedTeamB] : [firstFour[2], firstFour[3]]);
    }
    setWinner(null);
    setPendingScore(undefined);
  }, [firstFour, suggestedTeamA, suggestedTeamB]);

  const toggle = (p: string) => {
    if (teamA.includes(p)) { setTeamA(teamA.filter(x => x !== p)); return; }
    if (teamB.includes(p)) { setTeamB(teamB.filter(x => x !== p)); return; }
    if (teamA.length < 2)  { setTeamA([...teamA, p]); return; }
    if (teamB.length < 2)  { setTeamB([...teamB, p]); return; }
    alert('Teams are full (2 each)');
  };

  /** Called by ScoreBoard when a team reaches the limit */
  const handleScoreWin = (side: 'A' | 'B', sA: number, sB: number) => {
    setWinner(side);
    setPendingScore(`${sA} – ${sB}`);
  };

  const submit = () => {
    if (teamA.length !== 2 || teamB.length !== 2) { alert('Assign all 4 players first'); return; }
    if (!winner) { alert('Select the winning team or use scoring to determine a winner'); return; }
    onMatch(teamA, teamB, winner, pendingScore);
  };

  const teamALabel = teamA.length ? teamA.join(' & ') : 'Team A';
  const teamBLabel = teamB.length ? teamB.join(' & ') : 'Team B';

  return (
    <div className="match-section">
      <h3 className="match-section-title"><Swords size={15} /> Form Teams</h3>

      {suggestedTeamA && suggestedTeamB && (
        <div className="playall-badge">
          <Sparkles size={12} />
          Maximum-novelty suggestion
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
        {firstFour.map(p => {
          const cls = teamA.includes(p) ? 'player-btn-team-a' : teamB.includes(p) ? 'player-btn-team-b' : 'player-btn-unassigned';
          return <button key={p} onClick={() => toggle(p)} className={cls}><PlayerLabel name={p} statsMap={statsMap} /></button>;
        })}
      </div>

      {/* ── Scoring ── */}
      <ScoreBoard
        labelA={teamALabel}
        labelB={teamBLabel}
        onWin={handleScoreWin}
      />

      {/* Manual winner override (when not using scoring or as fallback) */}
      <div className="winning-team">
        <span className="winning-label">Winner:</span>
        <button onClick={() => setWinner('A')} className={winner === 'A' ? 'selected-winner' : ''} disabled={teamA.length !== 2}>
          <Trophy size={12} /> Team A {winner === 'A' && pendingScore && `(${pendingScore})`}
        </button>
        <button onClick={() => setWinner('B')} className={winner === 'B' ? 'selected-winner' : ''} disabled={teamB.length !== 2}>
          <Trophy size={12} /> Team B {winner === 'B' && pendingScore && `(${pendingScore})`}
        </button>
      </div>

      <button onClick={submit} className="match-action-btn"><Play size={13} /> Confirm Match</button>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// § 8  WINNER MODAL
// ═══════════════════════════════════════════════════════════

const WinnerModal: React.FC<{
  isOpen: boolean; winner: string; score?: string;
  onClose: () => void; autoClose: boolean; setAutoClose: (v: boolean) => void;
}> = ({ isOpen, winner, score, onClose, autoClose, setAutoClose }) => {
  useEffect(() => {
    if (!isOpen || !autoClose) return;
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [isOpen, autoClose, onClose]);

  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <Trophy size={42} className="modal-trophy" />
        <h2>Match Result</h2>
        <p className="winner-name">{winner}</p>
        {score && <p className="modal-score">{score}</p>}
        <div className="modal-controls">
          <label className="auto-close-toggle">
            <input type="checkbox" checked={autoClose} onChange={e => setAutoClose(e.target.checked)} />
            Auto-close (3s)
          </label>
          <button onClick={onClose} className="close-modal-btn"><X size={13} /> Close</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// § 9  ANALYTICS DASHBOARD
// ═══════════════════════════════════════════════════════════

const StatBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => (
  <div className="stat-bar-track">
    <div className="stat-bar-fill" style={{ width: `${max === 0 ? 0 : Math.round((value / max) * 100)}%`, background: color }} />
  </div>
);

const AnalyticsDashboard: React.FC<{ stats: PlayerStat[] }> = ({ stats }) => {
  const sorted = [...stats].sort((a, b) => b.wins - a.wins);
  const maxGP  = Math.max(...stats.map(s => s.gamesPlayed), 1);
  if (stats.length === 0) return <p className="muted-hint">No stats yet — play some matches!</p>;

  return (
    <div className="analytics-panel">
      <div className="analytics-section-label"><BarChart2 size={13} /> Leaderboard</div>
      <div className="analytics-table-scroll">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>#</th><th>Player</th><th>Rank</th>
              <th><TrendingUp size={11} /> W</th><th>L</th>
              <th><Activity size={11} /> GP</th><th>Win %</th><th>Streak</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s, i) => (
              <tr key={s.name} className={i === 0 ? 'analytics-top' : ''}>
                <td className="col-rank-num">{i + 1}</td>
                <td><strong>{s.name}</strong></td>
                <td><RankBadge rank={s.rank} /></td>
                <td className="col-wins">{s.wins}</td>
                <td className="col-losses">{s.losses}</td>
                <td>{s.gamesPlayed}</td>
                <td>
                  <div className="winrate-cell">
                    <span>{s.winRate}%</span>
                    <StatBar value={s.winRate} max={100} color="#22c55e" />
                  </div>
                </td>
                <td>
                  {s.streak >= 2
                    ? <span className="streak-badge"><Flame size={11} />{s.streak}</span>
                    : <span className="col-streak-zero">{s.streak}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="analytics-section-label" style={{ marginTop: 24 }}><Clock size={13} /> Play Frequency</div>
      <div className="frequency-chart">
        {sorted.map(s => (
          <div key={s.name} className="freq-row">
            <span className="freq-name">{s.name}</span>
            <StatBar value={s.gamesPlayed} max={maxGP} color="#818cf8" />
            <span className="freq-count">{s.gamesPlayed}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// § 10  LIVE-MANAGEMENT PANELS
// ═══════════════════════════════════════════════════════════

const AddPlayerPanel: React.FC<{ onAdd: (name: string) => void }> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const [val,  setVal]  = useState('');
  const commit = () => {
    const t = val.trim(); if (!t) return;
    onAdd(t); setVal(''); setOpen(false);
  };
  return (
    <div className="live-panel">
      <button className="live-panel-toggle" onClick={() => setOpen(o => !o)}>
        <UserPlus size={13} /> {open ? 'Cancel' : 'Add Player'}
      </button>
      {open && (
        <div className="live-form">
          <input value={val} onChange={e => setVal(e.target.value)}
            placeholder="Player name" onKeyDown={e => e.key === 'Enter' && commit()} autoFocus />
          <button onClick={commit} className="live-form-submit">
            <PlusCircle size={12} /> Add
          </button>
        </div>
      )}
    </div>
  );
};

const ManualQueuePanel: React.FC<{
  allPlayers: string[];
  queue: string[];
  statsMap: Record<string, PlayerStat>;
  onAdd: (p: string) => void;
  onRemove: (i: number) => void;
}> = ({ allPlayers, queue, statsMap, onAdd, onRemove }) => {
  const [open, setOpen] = useState(false);
  const notQueued = allPlayers.filter(p => !queue.includes(p));
  return (
    <div className="live-panel">
      <button className="live-panel-toggle" onClick={() => setOpen(o => !o)}>
        <ListOrdered size={13} /> {open ? 'Hide' : 'Manage'} Queue
      </button>
      {open && (
        <div className="mqp-body">
          <div className="mqp-col">
            <div className="mqp-col-header"><UserCheck size={11} /> Available</div>
            {notQueued.length === 0 && <p className="muted-hint">All players queued</p>}
            {notQueued.map(p => (
              <button key={p} className="mqp-btn mqp-btn--add" onClick={() => onAdd(p)}>
                <PlusCircle size={11} /><PlayerLabel name={p} statsMap={statsMap} />
              </button>
            ))}
          </div>
          <div className="mqp-col">
            <div className="mqp-col-header"><ListOrdered size={11} /> Queue</div>
            {queue.length === 0 && <p className="muted-hint">Empty</p>}
            {queue.map((p, i) => (
              <button key={i} className="mqp-btn mqp-btn--remove" onClick={() => onRemove(i)}>
                <span className="mqp-pos">#{i + 1}</span><PlayerLabel name={p} statsMap={statsMap} /><X size={10} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// § 11  AI / SMART SUGGESTIONS
// ═══════════════════════════════════════════════════════════

const SUGGESTION_ICONS: Record<SmartSuggestion['type'], React.ReactNode> = {
  'overused':     <AlertTriangle size={13} />,
  'underused':    <ThumbsUp      size={13} />,
  'hot-streak':   <Flame         size={13} />,
  'team-balance': <Brain         size={13} />,
};
const SUGGESTION_COLORS: Record<SmartSuggestion['type'], string> = {
  'overused':     '#f59e0b',
  'underused':    '#22c55e',
  'hot-streak':   '#ef4444',
  'team-balance': '#6366f1',
};

const SmartSuggestions: React.FC<{ suggestions: SmartSuggestion[] }> = ({ suggestions }) => {
  if (suggestions.length === 0) return null;
  return (
    <div className="smart-suggestions">
      <div className="smart-header"><Brain size={13} /> Smart Suggestions</div>
      {suggestions.map((s, i) => (
        <div key={i} className="smart-card" style={{ '--sc': SUGGESTION_COLORS[s.type] } as React.CSSProperties}>
          <span className="smart-icon">{SUGGESTION_ICONS[s.type]}</span>
          <span className="smart-message">{s.message}</span>
        </div>
      ))}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// § 12  MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════

function QueueSystemContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const modeParam    = searchParams?.get('mode');
  const gameModeFromUrl = modeParam === 'singles' || modeParam === 'doubles' ? modeParam : null;

  const {
    gameMode, players, queue, playAllRel,
    setGameMode, setPlayers, playSingles, playDoubles,
    randomizeQueue, setQueue, recordPlayAllDoubles,
    recordPlayAllSingles, resetPlayAllRelationships,
  } = useQueue();

  const [tempPlayers,       setTempPlayers]       = useState<string[]>([]);
  const [currentName,       setCurrentName]       = useState('');
  const [matchHistory,      setMatchHistory]      = useState<MatchHistoryEntry[]>([]);
  const [modalOpen,         setModalOpen]         = useState(false);
  const [modalWinner,       setModalWinner]       = useState('');
  const [modalScore,        setModalScore]        = useState<string | undefined>(undefined);
  const [autoClose,         setAutoClose]         = useState(false);
  const [queueMode,         setQueueMode]         = useState<QueueMode>('default');
  const [elimType,          setElimType]          = useState<EliminationType>('single');
  const [showHistory,       setShowHistory]       = useState(true);
  const [darkMode,          setDarkMode]          = useState(false);
  const [tournamentMatches, setTournamentMatches] = useState<TournamentMatch[]>([]);
  const [tournamentActive,  setTournamentActive]  = useState(false);
  const [tournamentWinner,  setTournamentWinner]  = useState<string | null>(null);
  const [activeTab,         setActiveTab]         = useState<GameTab>('queue');

  // Derived
  const statsList = useMemo(() => buildPlayerStats(players, matchHistory), [players, matchHistory]);
  const statsMap  = useMemo(() => Object.fromEntries(statsList.map(s => [s.name, s])), [statsList]);
  const suggestions = useMemo(
    () => (activeTab === 'queue' ? generateSuggestions(statsList, queue) : []),
    [statsList, queue, activeTab],
  );
  const playAllSuggestion = useMemo<PlayAllSuggestion | null>(() => {
    if (queueMode !== 'playall' || gameMode !== 'doubles') return null;
    return suggestNextDoublesMatch(queue, playAllRel);
  }, [queueMode, gameMode, queue, playAllRel]);

  const firstFour = useMemo(() => queue.slice(0, 4), [queue]);

  // Side effects
  useEffect(() => { document.body.classList.toggle('dark-mode', darkMode); }, [darkMode]);
  useEffect(() => {
    if (gameModeFromUrl) setGameMode(gameModeFromUrl); else router.push('/');
  }, [gameModeFromUrl, setGameMode, router]);
  useEffect(() => {
    if (!playAllSuggestion) return;
    const s = playAllSuggestion.reorderedQueue;
    if (queue.slice(0, 4).join(',') !== s.slice(0, 4).join(',')) setQueue(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAllSuggestion]);
  useEffect(() => {
    if (queueMode !== 'playall' || gameMode !== 'singles' || queue.length < 2) return;
    const result = suggestNextSinglesMatch(queue, playAllRel);
    if (!result) return;
    if (queue.slice(0, 2).join(',') !== result.reorderedQueue.slice(0, 2).join(',')) setQueue(result.reorderedQueue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAllRel, queueMode, gameMode]);

  // Setup handlers
  const addTempPlayer = () => {
    const t = currentName.trim(); if (!t) return;
    if (tempPlayers.includes(t)) { alert('Player already added'); return; }
    setTempPlayers(prev => [...prev, t]); setCurrentName('');
  };
  const removeTempPlayer = (i: number) => setTempPlayers(prev => prev.filter((_, j) => j !== i));
  const handleStartQueue = () => {
    if (tempPlayers.length < 5 || tempPlayers.length > 24) {
      alert(`Need 5–24 players. Currently: ${tempPlayers.length}`); return;
    }
    setPlayers(tempPlayers); setTempPlayers([]); setMatchHistory([]);
    setTournamentActive(false); setTournamentWinner(null); setTournamentMatches([]);
    if (queueMode === 'tournament') initTournament(tempPlayers, elimType);
  };

  // Tournament
  const initTournament = useCallback((playerList: string[], type: EliminationType) => {
    const shuffled = shuffleArray(playerList);
    const bracket  = type === 'single' ? buildSingleElim(shuffled) : buildDoubleElim(shuffled);
    setTournamentMatches(bracket); setTournamentActive(true); setTournamentWinner(null);
  }, []);

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
    const gfMatch = updated.find(m => m.bracket === 'GF');
    const lastWbM = elimType === 'single'
      ? (() => { const by: Record<number, TournamentMatch[]> = {}; updated.forEach(m => { (by[m.round] ??= []).push(m); }); return by[Math.max(...Object.keys(by).map(Number))]?.[0]; })()
      : null;
    const champion = gfMatch?.winner ?? lastWbM?.winner;
    if (champion) { setTournamentWinner(champion); setModalWinner(`${champion} is the tournament champion! 🏆`); setModalScore(undefined); setModalOpen(true); }
  };

  // Queue handlers
  const handleRandomize = () => {
    if (queueMode === 'tournament') { initTournament(players, elimType); return; }
    randomizeQueue(); if (queueMode === 'playall') resetPlayAllRelationships();
  };
  const handleElimTypeChange = (type: EliminationType) => {
    setElimType(type);
    if (queueMode === 'tournament' && players.length > 0) { initTournament(players, type); setMatchHistory([]); }
  };
  const handleModeChange = (newMode: QueueMode) => {
    setQueueMode(newMode);
    if (newMode === 'tournament') initTournament(players, elimType);
    else { setTournamentActive(false); setTournamentWinner(null); setTournamentMatches([]); }
    if (newMode === 'playall') resetPlayAllRelationships();
  };

  /** Singles match complete — with optional score string */
  const handleSinglesMatch = (winner: string, score?: string) => {
    const [p1, p2] = [queue[0], queue[1]];
    playSingles(winner);
    setMatchHistory(prev => [{
      id: Date.now(), mode: 'Singles', players: `${p1} vs ${p2}`,
      winner, score, timestamp: new Date().toLocaleTimeString(),
    }, ...prev]);
    if (queueMode === 'playall') recordPlayAllSingles(p1, p2);
    setModalWinner(`${winner} wins!`); setModalScore(score); setModalOpen(true);
  };

  /** Doubles match complete — with optional score string */
  const handleDoublesMatch = (a: string[], b: string[], w: 'A' | 'B', score?: string) => {
    playDoubles([...a], [...b], w);
    const winnerNames = w === 'A' ? a.join(' & ') : b.join(' & ');
    setMatchHistory(prev => [{
      id: Date.now(), mode: 'Doubles',
      players: `${a.join(' & ')} vs ${b.join(' & ')}`,
      winner: winnerNames, score, timestamp: new Date().toLocaleTimeString(),
    }, ...prev]);
    if (queueMode === 'playall') recordPlayAllDoubles(a, b);
    setModalWinner(`${winnerNames} win!`); setModalScore(score); setModalOpen(true);
  };

  const handleAddPlayerLive = (name: string) => {
    if (players.includes(name)) { alert('Player already exists'); return; }
    setPlayers([...players, name]); setQueue([...queue, name]);
  };
  const handleFullReset = () => {
    if (!confirm('Reset everything and return to player setup?')) return;
    setPlayers([]); setTempPlayers([]); setMatchHistory([]);
    setTournamentActive(false); setTournamentWinner(null); setTournamentMatches([]);
  };

  // ── Shared fragments ──────────────────────────────────

  const modeSelector = (
    <div className="mode-selector">
      {(['default', 'tournament', 'playall'] as const).map(m => (
        <button key={m} className={`mode-btn ${queueMode === m ? 'active' : ''}`} onClick={() => handleModeChange(m)}>
          {m === 'default'    && <><Swords size={12} /> Default</>}
          {m === 'tournament' && <><Trophy size={12} /> Tournament</>}
          {m === 'playall'    && <><Star   size={12} /> Play‑all</>}
        </button>
      ))}
    </div>
  );

  const elimSelector = queueMode === 'tournament' && (
    <div className="elim-selector">
      {(['single', 'double'] as const).map(t => (
        <button key={t} className={`elim-btn ${elimType === t ? 'active' : ''}`} onClick={() => handleElimTypeChange(t)}>
          {t === 'single' ? 'Single Elim' : 'Double Elim'}
        </button>
      ))}
    </div>
  );

  /**
   * ★ CHANGE: "Show/Hide History" and "Reset" now live in the SAME row.
   * Using a single .ui-controls flex container for both buttons.
   */
  const uiControls = (
    <div className="ui-controls">
      <button className="control-btn" onClick={() => setShowHistory(h => !h)}>
        <History size={12} /> {showHistory ? 'Hide' : 'Show'} History
      </button>
      <button className="control-btn control-btn--danger" onClick={handleFullReset}>
        <RotateCcw size={12} /> Reset
      </button>
    </div>
  );

  const tabBar = (
    <div className="tab-bar">
      <button className={`tab-btn ${activeTab === 'queue'     ? 'active' : ''}`} onClick={() => setActiveTab('queue')}>
        <Swords size={12} /> Queue
      </button>
      <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>
        <BarChart2 size={12} /> Stats
      </button>
    </div>
  );

  const historyPanel = showHistory && (
    <div className="history-area">
      <h3><History size={13} /> History</h3>
      {matchHistory.length === 0
        ? <p className="muted-hint">No matches played yet.</p>
        : (
          <ul className="history-list">
            {matchHistory.map(e => (
              <li key={e.id} className="history-item">
                <div className="history-time">{e.timestamp}</div>
                <div className="history-match">{e.players}</div>
                <div className="history-winner"><Trophy size={11} /> {e.winner}</div>
                {e.score && <div className="history-score">{e.score}</div>}
              </li>
            ))}
          </ul>
        )}
    </div>
  );

  // ════════════════════════════════════════════════════
  // RENDER A — Setup screen
  // ════════════════════════════════════════════════════
  if (players.length === 0) {
    return (
      <div className={`queue-system setup-page ${darkMode ? 'dark' : ''}`}>
        <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button className="back-home" onClick={() => router.push('/')}><ArrowLeft size={14} /> Back</button>
        <div className="setup-hero">
          <div className="setup-hero-icon">
            {gameMode === 'singles' ? <Swords size={26} /> : <Users size={26} />}
          </div>
          <h1 className="app-name">{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue</h1>
          <p className="app-subtitle">Add 5 – 24 players to get started</p>
        </div>
        <div className="player-input-container">
          <div className="input-group">
            <input type="text" value={currentName}
              onChange={e => setCurrentName(e.target.value)}
              placeholder="Enter player name"
              onKeyDown={e => e.key === 'Enter' && addTempPlayer()} />
            <button onClick={addTempPlayer} className="add-btn"><UserPlus size={15} /></button>
          </div>
          {tempPlayers.length > 0 && (
            <div className="players-list">
              <h3><Users size={13} /> Players ({tempPlayers.length}/24)</h3>
              <ul>
                {tempPlayers.map((p, i) => (
                  <li key={i}>
                    <span className="setup-player-num">#{i + 1}</span>
                    <span>{p}</span>
                    <button onClick={() => removeTempPlayer(i)} className="remove-btn"><Trash2 size={12} /></button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button onClick={handleStartQueue} className="start-btn" disabled={tempPlayers.length < 5}>
            <Play size={14} /> Start Queue ({tempPlayers.length}/5 min)
          </button>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  // RENDER B — Tournament view
  // ════════════════════════════════════════════════════
  if (queueMode === 'tournament' && tournamentActive) {
    const pendingMatch = tournamentMatches.find(m => !m.winner && !m.isBye && m.player1 && m.player2) ?? null;

    return (
      <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
        <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>
          {darkMode ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        <button className="back-home" onClick={() => router.push('/')}><ArrowLeft size={14} /> Back</button>
        {modeSelector}{elimSelector}{uiControls}{tabBar}

        {activeTab === 'analytics' ? (
          <AnalyticsDashboard stats={statsList} />
        ) : (
          <div className="main-layout">
            <div className="queue-area">
              <h1 className="queue-title">
                <Trophy size={20} />{gameMode === 'singles' ? 'Singles' : 'Doubles'} Tournament
              </h1>
              <button onClick={handleRandomize} className="randomize-btn"><Shuffle size={12} /> Reseed</button>
              {tournamentWinner && <div className="champion-banner"><Trophy size={18} /> Champion: {tournamentWinner}</div>}
              <TournamentBracket matches={tournamentMatches} elimType={elimType} />
              {pendingMatch && !tournamentWinner && (
                <div className="match-section">
                  <h3 className="match-section-title">
                    {pendingMatch.bracket === 'GF' && <Trophy size={14} />}
                    {pendingMatch.bracket === 'L'  && '🔴 Losers — '}
                    {pendingMatch.bracket === 'GF' && ' Grand Final — '}
                    {pendingMatch.player1} vs {pendingMatch.player2}
                  </h3>
                  {/* Scoring for tournament matches */}
                  <ScoreBoard
                    labelA={pendingMatch.player1!}
                    labelB={pendingMatch.player2!}
                    onWin={(side, sA, sB) => {
                      const w = side === 'A' ? pendingMatch.player1! : pendingMatch.player2!;
                      handleTournamentMatch(pendingMatch.id, w);
                    }}
                  />
                  <div className="match-buttons" style={{ marginTop: 14 }}>
                    <button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player1!)}>
                      <Trophy size={12} /> {pendingMatch.player1}
                    </button>
                    <button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player2!)}>
                      <Trophy size={12} /> {pendingMatch.player2}
                    </button>
                  </div>
                </div>
              )}
              <SmartSuggestions suggestions={suggestions} />
            </div>
            {historyPanel}
          </div>
        )}
        <WinnerModal isOpen={modalOpen} winner={modalWinner} score={modalScore} onClose={() => setModalOpen(false)} autoClose={autoClose} setAutoClose={setAutoClose} />
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  // RENDER C — Default / Play-all queue
  // ════════════════════════════════════════════════════

  /**
   * ★ CHANGE: "Form Teams" (DoublesMatch / singles match buttons) are
   *   rendered BEFORE "Upcoming Matches" pairings table.
   */
  return (
    <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
      <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>
        {darkMode ? <Sun size={17} /> : <Moon size={17} />}
      </button>
      <button className="back-home" onClick={() => router.push('/')}><ArrowLeft size={14} /> Back</button>
      {modeSelector}{uiControls}{tabBar}

      {activeTab === 'analytics' ? (
        <AnalyticsDashboard stats={statsList} />
      ) : (
        <div className="main-layout">
          <div className="queue-area">
            <h1 className="queue-title">
              {gameMode === 'singles' ? <Swords size={19} /> : <Users size={19} />}
              {gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue
            </h1>

            {queueMode === 'default' && (
              <p className="mode-description">
                <Trophy size={11} className="mode-desc-icon" /> Winners → back · Losers → front
              </p>
            )}
            {queueMode === 'playall' && (
              <p className="mode-description">
                <Sparkles size={11} className="mode-desc-icon" /> Every player faces everyone before repeating
              </p>
            )}

            <div className="queue-header-row">
              {queueMode === 'playall' ? (
                <button onClick={() => { randomizeQueue(); resetPlayAllRelationships(); }} className="randomize-btn">
                  <RefreshCw size={12} /> Reset Play-All
                </button>
              ) : (
                <button onClick={handleRandomize} className="randomize-btn">
                  <Shuffle size={12} /> Randomize
                </button>
              )}
            </div>

            <div className="live-tools-row">
              <AddPlayerPanel onAdd={handleAddPlayerLive} />
              <ManualQueuePanel
                allPlayers={players} queue={queue} statsMap={statsMap}
                onAdd={p => setQueue([...queue, p])}
                onRemove={i => setQueue(queue.filter((_, j) => j !== i))}
              />
            </div>

            {/* ★ FORM TEAMS / CURRENT MATCH — above the table */}

            {gameMode === 'singles' && queue.length >= 2 && (
              <div className="match-section">
                <h3 className="match-section-title"><Swords size={14} /> Current Match</h3>
                <div className="current-match-players">
                  <PlayerLabel name={queue[0]} statsMap={statsMap} />
                  <span className="vs-sep">vs</span>
                  <PlayerLabel name={queue[1]} statsMap={statsMap} />
                </div>

                {/* ★ Scoring for singles */}
                <ScoreBoard
                  labelA={queue[0]}
                  labelB={queue[1]}
                  onWin={(side, sA, sB) => {
                    const w = side === 'A' ? queue[0] : queue[1];
                    handleSinglesMatch(w, `${sA} – ${sB}`);
                  }}
                />

                <div className="match-buttons" style={{ marginTop: 14 }}>
                  <button onClick={() => handleSinglesMatch(queue[0])}>
                    <Trophy size={12} /> <PlayerLabel name={queue[0]} statsMap={statsMap} /> wins
                  </button>
                  <button onClick={() => handleSinglesMatch(queue[1])}>
                    <Trophy size={12} /> <PlayerLabel name={queue[1]} statsMap={statsMap} /> wins
                  </button>
                </div>
              </div>
            )}

            {gameMode === 'doubles' && queue.length >= 4 && (
              <DoublesMatch
                firstFour={firstFour}
                suggestedTeamA={playAllSuggestion?.suggestedTeamA ?? null}
                suggestedTeamB={playAllSuggestion?.suggestedTeamB ?? null}
                playAllScore={playAllSuggestion?.score ?? null}
                statsMap={statsMap}
                onMatch={handleDoublesMatch}
              />
            )}

            {gameMode === 'singles' && queue.length < 2 && <p className="muted-hint">Not enough players for a match.</p>}
            {gameMode === 'doubles' && queue.length < 4 && <p className="muted-hint">Not enough players for a match.</p>}

            {/* ★ UPCOMING MATCHES — below the current match */}
            <div className="pairings-container">
              <h3 className="pairings-label">Upcoming Matches</h3>
              {gameMode === 'singles' && <SinglesTable queue={queue} statsMap={statsMap} />}
              {gameMode === 'doubles' && <DoublesTable queue={queue} statsMap={statsMap} />}
            </div>

            <SmartSuggestions suggestions={suggestions} />
          </div>

          {historyPanel}
        </div>
      )}

      <WinnerModal isOpen={modalOpen} winner={modalWinner} score={modalScore} onClose={() => setModalOpen(false)} autoClose={autoClose} setAutoClose={setAutoClose} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// § 13  DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════
export default function QueueSystem() {
  return (
    <Suspense fallback={<div className="qs-loading">Loading…</div>}>
      <QueueSystemContent />
    </Suspense>
  );
}