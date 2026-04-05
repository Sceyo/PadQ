'use client';

/**
 * ═══════════════════════════════════════════════════════════
 * PADQ — QueueSystem  (queue/page.tsx)
 * ═══════════════════════════════════════════════════════════
 *
 * CHANGES v3
 * ──────────
 *  • SessionBar: removed the viewer join-input entirely
 *    (watching is now done from the homepage Watch button)
 *  • Added ShareButton top-right corner — host only
 *    Shows a popover with the room code + QR code
 *  • SessionBar simplified to status strip only
 *
 * FILE STRUCTURE
 * ──────────────
 *  § 1  Types & Constants
 *  § 2  Pure Logic Helpers
 *  § 3  Reusable UI Atoms
 *  § 4  Bracket Components
 *  § 5  Queue Table Components
 *  § 6  ScoreBoard
 *  § 7  DoublesMatch
 *  § 8  WinnerModal
 *  § 9  Analytics Dashboard
 *  § 10 Live-management Panels
 *  § 11 AI / Smart Suggestions
 *  § 12 SessionBar  (status strip, no join input)
 *  § 12b ShareButton  ← NEW (top-right QR + code popover)
 *  § 13 Main Orchestrator
 *  § 14 Default export
 * ═══════════════════════════════════════════════════════════
 */

import React, {
  useState, useEffect, useLayoutEffect, useMemo, useCallback, Suspense,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';   // npm install qrcode.react
import {
  Swords, Users, Trophy, Flame, Shuffle, History,
  Sun, Moon, ArrowLeft, Play, RotateCcw, PlusCircle,
  Trash2, UserPlus, ListOrdered, UserCheck,
  Star, Sparkles, RefreshCw, Check, X, BarChart2,
  TrendingUp, Activity, Award, Shield, Zap, Clock,
  Brain, AlertTriangle, ThumbsUp, Plus, Minus,
  Target, Settings, Copy, Wifi, WifiOff, QrCode, ExternalLink,
} from 'lucide-react';
import useQueue, {
  suggestNextDoublesMatch,
  suggestNextSinglesMatch,
  PlayAllSuggestion,
} from '@/hooks/useQueue';
import { useSession } from '@/hooks/useSession';
import type { LiveScoreState } from '@/lib/sessionService';
import './QueueSystem.css';

// ═══════════════════════════════════════════════════════════
// § 1  TYPES & CONSTANTS
// ═══════════════════════════════════════════════════════════

interface MatchHistoryEntry {
  id: number; mode: string; players: string;
  winner: string; score?: string; timestamp: string;
}
interface PlayerStat {
  name: string; wins: number; losses: number;
  gamesPlayed: number; winRate: number; streak: number; rank: RankTier;
}
type RankTier        = 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond';
type EliminationType = 'single' | 'double';
type QueueMode       = 'default' | 'tournament' | 'playall';
type GameTab         = 'queue' | 'analytics';

interface TournamentMatch {
  id: number; round: number; slot: number; bracket: 'W' | 'L' | 'GF';
  player1: string | null; player2: string | null;
  winner: string | null; loser: string | null; isBye: boolean;
}
interface SmartSuggestion {
  type: 'overused' | 'underused' | 'hot-streak' | 'team-balance';
  message: string; players: string[];
}

const SCORE_PRESETS = [11, 21] as const;

const RANK_CFG: Record<RankTier, { color: string; icon: React.ReactNode }> = {
  Bronze:   { color: '#cd7f32', icon: <Shield size={10} /> },
  Silver:   { color: '#a8a9ad', icon: <Shield size={10} /> },
  Gold:     { color: '#ffd700', icon: <Award  size={10} /> },
  Platinum: { color: '#00c8c8', icon: <Star   size={10} /> },
  Diamond:  { color: '#93c5fd', icon: <Zap    size={10} /> },
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
  if (gamesPlayed < 3) return 'Bronze';
  if (winRate >= 80)   return 'Diamond';
  if (winRate >= 65)   return 'Platinum';
  if (winRate >= 50)   return 'Gold';
  if (winRate >= 35)   return 'Silver';
  return 'Bronze';
}

function buildPlayerStats(players: string[], history: MatchHistoryEntry[]): PlayerStat[] {
  const wins: Record<string, number> = {};
  const losses: Record<string, number> = {};
  const streak: Record<string, number> = {};
  for (const p of players) { wins[p] = 0; losses[p] = 0; streak[p] = 0; }

  for (const entry of [...history].reverse()) {
    const winnerNames = entry.winner.split(' & ');
    const allNames = entry.players
      .split(' vs ').flatMap(s => s.split(' & ')).map(s => s.trim())
      .filter(n => players.includes(n));
    for (const name of allNames) {
      if (winnerNames.includes(name)) { wins[name] = (wins[name] ?? 0) + 1; streak[name] = (streak[name] ?? 0) + 1; }
      else { losses[name] = (losses[name] ?? 0) + 1; streak[name] = 0; }
    }
  }
  return players.map(name => {
    const w = wins[name] ?? 0, l = losses[name] ?? 0, gp = w + l;
    const wr = gp === 0 ? 0 : Math.round((w / gp) * 100);
    return { name, wins: w, losses: l, gamesPlayed: gp, winRate: wr, streak: streak[name] ?? 0, rank: calcRank(wr, gp) };
  });
}

function generateSuggestions(stats: PlayerStat[], queue: string[]): SmartSuggestion[] {
  const suggestions: SmartSuggestion[] = [];
  if (!stats.length) return suggestions;
  const avgGP = stats.reduce((a, b) => a + b.gamesPlayed, 0) / stats.length;
  const overused = stats.filter(s => s.gamesPlayed > avgGP * 1.5 && s.gamesPlayed > 2);
  if (overused.length) suggestions.push({ type: 'overused', message: 'These players have played significantly more — consider giving them a break.', players: overused.map(s => s.name) });
  const underused = stats.filter(s => s.gamesPlayed === 0);
  if (underused.length) suggestions.push({ type: 'underused', message: "These players haven't played yet. Consider adding them to the queue.", players: underused.map(s => s.name) });
  const hot = stats.filter(s => s.streak >= 3);
  if (hot.length) suggestions.push({ type: 'hot-streak', message: `${hot.map(s => s.name).join(', ')} ${hot.length === 1 ? 'is' : 'are'} on a hot streak 🔥`, players: hot.map(s => s.name) });
  if (queue.length >= 4) {
    const rates = queue.slice(0, 4).map(n => stats.find(s => s.name === n)?.winRate ?? 50);
    if (Math.abs((rates[0] + rates[1]) - (rates[2] + rates[3])) > 30)
      suggestions.push({ type: 'team-balance', message: 'The next doubles match may be unbalanced. Try swapping players.', players: queue.slice(0, 4) });
  }
  return suggestions;
}

// ── Single Elimination ───────────────────────────────────
function buildSingleElim(players: string[]): TournamentMatch[] {
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(players.length, 2))));
  const totalRounds = Math.log2(size);
  let id = Date.now();
  const matches: TournamentMatch[] = [];
  const seeded = [...players];
  while (seeded.length < size) seeded.push('No player');
  for (let s = 0; s < size / 2; s++) {
    const [p1, p2] = [seeded[s * 2], seeded[s * 2 + 1]];
    const isBye = p2 === 'No player';
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

// ── Double Elimination ───────────────────────────────────
function buildDoubleElim(players: string[]): TournamentMatch[] {
  const size = Math.pow(2, Math.ceil(Math.log2(Math.max(players.length, 2))));
  const wbR = Math.log2(size);
  let id = Date.now();
  const matches: TournamentMatch[] = [];
  const seeded = [...players];
  while (seeded.length < size) seeded.push('No player');
  for (let r = 0; r < wbR; r++) {
    const slots = size / Math.pow(2, r + 1);
    for (let s = 0; s < slots; s++) {
      if (r === 0) {
        const [p1, p2] = [seeded[s * 2], seeded[s * 2 + 1]];
        const isBye = p2 === 'No player';
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
      if (match.winner) { const next = wb(r + 1).find(nm => nm.slot === Math.floor(match.slot / 2)); if (next) { match.slot % 2 === 0 ? (next.player1 = match.winner) : (next.player2 = match.winner); } }
      if (match.loser) { const lbRow = lb(r * 2); if (lbRow.length) { const lbM = lbRow.find(l => l.slot === match.slot) ?? lbRow[Math.floor(match.slot / 2)]; if (lbM) { !lbM.player1 ? (lbM.player1 = match.loser) : !lbM.player2 && (lbM.player2 = match.loser); } } }
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
  return <span className="rank-badge" style={{ '--rc': color } as React.CSSProperties}>{icon}{rank}</span>;
};
const StreakBadge: React.FC<{ streak: number }> = ({ streak }) =>
  streak < 2 ? null : <span className="streak-badge"><Flame size={11} />{streak}</span>;
const PlayerLabel: React.FC<{ name: string; statsMap?: Record<string, PlayerStat>; showRank?: boolean }> = ({ name, statsMap, showRank = false }) => {
  const s = statsMap?.[name];
  return <span className="player-label">{name}{s && <StreakBadge streak={s.streak} />}{s && showRank && <RankBadge rank={s.rank} />}</span>;
};

// ═══════════════════════════════════════════════════════════
// § 4  BRACKET COMPONENTS
// ═══════════════════════════════════════════════════════════

const BracketSection: React.FC<{ title: string; matches: TournamentMatch[]; totalRounds: number; bracketType: 'W' | 'L' | 'GF' }> = ({ title, matches, totalRounds, bracketType }) => {
  const byRound: Record<number, TournamentMatch[]> = {};
  matches.forEach(m => { (byRound[m.round] ??= []).push(m); });
  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);
  const roundLabel = (r: number): string => {
    if (bracketType === 'GF') return 'Grand Final';
    if (bracketType === 'W') { const rem = totalRounds - r; if (rem === 1) return 'Final'; if (rem === 2) return 'Semis'; if (rem === 3) return 'Quarters'; return `WB Round ${r + 1}`; }
    if (bracketType === 'L') { if (r === Math.max(...rounds)) return 'LB Final'; return r % 2 === 0 ? `LB Round ${Math.floor(r / 2) + 1}` : `LB Elim ${Math.floor(r / 2) + 1}`; }
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
                    <div className={['bracket-player', p1Won ? 'bracket-player--winner' : m.winner ? 'bracket-player--loser' : ''].filter(Boolean).join(' ')}><span>{m.player1 ?? <span className="bracket-tbd">TBD</span>}</span>{p1Won && <Check size={11} className="bracket-win-icon" />}</div>
                    <div className="bracket-divider" />
                    <div className={['bracket-player', p2Won ? 'bracket-player--winner' : m.winner ? 'bracket-player--loser' : ''].filter(Boolean).join(' ')}><span>{m.isBye ? <span className="bracket-no-player">No Player</span> : m.player2 ?? <span className="bracket-tbd">TBD</span>}</span>{p2Won && <Check size={11} className="bracket-win-icon" />}</div>
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
  if (elimType === 'single') { const rounds = [...new Set(matches.map(m => m.round))].length; return <BracketSection title="" matches={matches} totalRounds={rounds} bracketType="W" />; }
  const wbM = matches.filter(m => m.bracket === 'W'), lbM = matches.filter(m => m.bracket === 'L'), gfM = matches.filter(m => m.bracket === 'GF');
  const wbRn = [...new Set(wbM.map(m => m.round))].length;
  return (<div className="bracket-de-wrapper"><BracketSection title="Winners Bracket" matches={wbM} totalRounds={wbRn} bracketType="W" />{lbM.length > 0 && <BracketSection title="Losers Bracket" matches={lbM} totalRounds={0} bracketType="L" />}{gfM.length > 0 && <BracketSection title="" matches={gfM} totalRounds={0} bracketType="GF" />}</div>);
};

// ═══════════════════════════════════════════════════════════
// § 5  QUEUE TABLE COMPONENTS
// ═══════════════════════════════════════════════════════════

const SinglesTable: React.FC<{ queue: string[]; statsMap: Record<string, PlayerStat> }> = ({ queue, statsMap }) => {
  const pairs = [];
  for (let i = 0; i < queue.length; i += 2) pairs.push({ n: i / 2 + 1, p1: queue[i], p2: i + 1 < queue.length ? queue[i + 1] : 'Bye' });
  return (
    <table className="pairing-table">
      <thead><tr><th>Match</th><th>Player 1</th><th>Player 2</th></tr></thead>
      <tbody>
        {pairs.map((p, i) => (
          <tr key={i} className={i === 0 ? 'next-match' : ''}>
            <td className="match-label-cell">
              {i === 0 ? <span className="on-court-label">▶ On Court</span> : `Upcoming Match ${p.n - 1}`}
            </td>
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
    if (i + 3 < queue.length) matches.push({ n: i / 4 + 1, a: [queue[i], queue[i + 1]], b: [queue[i + 2], queue[i + 3]] });
    else { const rem = queue.slice(i); matches.push({ n: i / 4 + 1, a: rem.slice(0, 2), b: rem.slice(2, 4) }); }
  }
  const TeamCell = ({ names }: { names: string[] }) => (<>{names.map((n, i) => (<React.Fragment key={n}><PlayerLabel name={n} statsMap={statsMap} />{i < names.length - 1 && <span className="team-amp"> & </span>}</React.Fragment>))}</>);
  return (
    <table className="pairing-table">
      <thead><tr><th>Match</th><th>Team A</th><th>Team B</th></tr></thead>
      <tbody>
        {matches.map((m, i) => (
          <tr key={i} className={i === 0 ? 'next-match' : ''}>
            <td className="match-label-cell">
              {i === 0 ? <span className="on-court-label">▶ On Court</span> : `Upcoming Match ${m.n - 1}`}
            </td>
            <td>{m.a.length ? <TeamCell names={m.a} /> : '—'}</td>
            <td>{m.b.length ? <TeamCell names={m.b} /> : '—'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ═══════════════════════════════════════════════════════════
// § 6  SCOREBOARD
// ═══════════════════════════════════════════════════════════

/**
 * ScoreBoard v3
 * ─────────────────────────────────────────────────────────
 * DEUCE / SLIDE RULE:
 *   When BOTH sides reach (baseLimit − 1), "deuce" starts.
 *   The limit extends by +2. If they tie at the new threshold − 1,
 *   it extends by another +2, and so on.
 *   Example: limit 21 → deuce at 20-20 → new limit 22.
 *            still tied at 21-21 → limit 23, etc.
 *
 * LIVE SYNC:
 *   onScoreChange fires on every point change. The orchestrator
 *   writes it to Firebase so viewers see it in real time.
 *   viewerScore (Firebase read) renders a read-only display when
 *   disabled=true AND a score is active.
 */
const ScoreBoard: React.FC<{
  labelA:         string;
  labelB:         string;
  onWin:          (side: 'A' | 'B', sA: number, sB: number) => void;
  disabled?:      boolean;
  onScoreChange?: (score: LiveScoreState | null) => void;
  viewerScore?:   LiveScoreState | null;
}> = ({ labelA, labelB, onWin, disabled = false, onScoreChange, viewerScore }) => {

  const [active,      setActive]      = useState(true);
  const [scoreA,      setScoreA]      = useState(0);
  const [scoreB,      setScoreB]      = useState(0);
  const [baseLimit,   setBaseLimit]   = useState(11);
  const [limit,       setLimit]       = useState(21);
  const [customLimit, setCustomLimit] = useState('');
  const [showCustom,  setShowCustom]  = useState(false);
  const [finished,    setFinished]    = useState(false);
  const [inDeuce,     setInDeuce]     = useState(false);

  // ── Auto-reset when a new match starts (labels change = new players on court) ──
  // Keep scoring active but wipe the scores so host doesn't have to manually reset.
  useEffect(() => {
    setScoreA(0);
    setScoreB(0);
    setFinished(false);
    setInDeuce(false);
    setLimit(baseLimit);
    // Tell Firebase the score is fresh (keeps active=true if scoring was on)
    if (active) {
      onScoreChange?.({ scoreA: 0, scoreB: 0, limit: baseLimit, baseLimit, labelA, labelB, deuce: false, active: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelA, labelB]);

  const reset = (newBase?: number) => {
    const b = newBase ?? baseLimit;
    setScoreA(0); setScoreB(0); setFinished(false);
    setInDeuce(false); setLimit(b);
    if (newBase !== undefined) setBaseLimit(b);
    onScoreChange?.({ scoreA: 0, scoreB: 0, limit: b, baseLimit: b, labelA, labelB, deuce: false, active });
  };

  const toggleActive = () => {
    if (active) { reset(); onScoreChange?.(null); }
    else { onScoreChange?.({ scoreA: 0, scoreB: 0, limit, baseLimit, labelA, labelB, deuce: false, active: true }); }
    setActive(a => !a);
  };

  const increment = (side: 'A' | 'B') => {
    if (finished || disabled) return;
    let nextA = scoreA, nextB = scoreB;
    if (side === 'A') nextA++; else nextB++;

    // ── Deuce check ──────────────────────────────────────────
    let nextLimit = limit;
    let nextDeuce = inDeuce;

    if (!inDeuce && nextA === baseLimit - 1 && nextB === baseLimit - 1) {
      // Both just hit the deuce point — extend limit by 2
      nextLimit = baseLimit + 2;
      nextDeuce = true;
      setLimit(nextLimit); setInDeuce(true);
    } else if (inDeuce && nextA === nextLimit - 1 && nextB === nextLimit - 1) {
      // Tied again at the current extended limit − 1 → extend once more
      nextLimit = nextLimit + 2;
      setLimit(nextLimit);
    }

    setScoreA(nextA); setScoreB(nextB);
    const state: LiveScoreState = {
      scoreA: nextA, scoreB: nextB,
      limit: nextLimit, baseLimit, labelA, labelB,
      deuce: nextDeuce, active: true,
    };
    onScoreChange?.(state);

    if (nextA >= nextLimit) {
      setFinished(true);
      onScoreChange?.({ ...state, active: false });
      onWin('A', nextA, nextB);
    } else if (nextB >= nextLimit) {
      setFinished(true);
      onScoreChange?.({ ...state, active: false });
      onWin('B', nextA, nextB);
    }
  };

  const decrement = (side: 'A' | 'B') => {
    if (finished || disabled) return;
    let nextA = scoreA, nextB = scoreB;
    if (side === 'A' && nextA > 0) nextA--;
    if (side === 'B' && nextB > 0) nextB--;
    setScoreA(nextA); setScoreB(nextB);
    // Exit deuce if scores drop back below the threshold
    if (inDeuce && !(nextA >= baseLimit - 1 && nextB >= baseLimit - 1)) {
      setInDeuce(false); setLimit(baseLimit);
    }
    onScoreChange?.({ scoreA: nextA, scoreB: nextB, limit, baseLimit, labelA, labelB, deuce: inDeuce, active: true });
  };

  const applyCustomLimit = () => {
    const v = parseInt(customLimit, 10);
    if (!isNaN(v) && v > 1) { reset(v); setShowCustom(false); setCustomLimit(''); }
  };

  // ── Viewer read-only scoreboard (receives live data from Firebase) ──
  if (disabled && viewerScore?.active) {
    const vs = viewerScore;
    const aWon = vs.scoreA >= vs.limit;
    const bWon = vs.scoreB >= vs.limit;
    return (
      <div className="scoreboard-wrap scoreboard-wrap--viewer">
        <div className="scoreboard-viewer-label">
          <Target size={12} /> Live Score
          {vs.deuce && <span className="deuce-badge">DEUCE</span>}
        </div>
        <div className="scoreboard scoreboard--viewer">
          <div className={`score-side score-side--a ${aWon ? 'score-side--winner' : ''}`}>
            <div className="score-team-badge score-team-badge--a">Team A</div>
            <div className="score-player-name">{vs.labelA}</div>
            <div className="score-display">{vs.scoreA}</div>
          </div>
          <div className="score-centre">
            <span className="score-limit-badge">to {vs.limit}</span>
            {(aWon || bWon) && <div className="score-finished-label">Game Over!</div>}
          </div>
          <div className={`score-side score-side--b ${bWon ? 'score-side--winner' : ''}`}>
            <div className="score-team-badge score-team-badge--b">Team B</div>
            <div className="score-player-name">{vs.labelB}</div>
            <div className="score-display">{vs.scoreB}</div>
          </div>
        </div>
      </div>
    );
  }
  // Viewer, but no active score → render nothing
  if (disabled) return null;

  // ── Host controls ──────────────────────────────────────────
  return (
    <div className="scoreboard-wrap">
      <div className="scoreboard-toolbar">
        <button
          className={`scoreboard-toggle ${active ? 'scoreboard-toggle--on' : ''}`}
          onClick={toggleActive}
        >
          <Target size={13} />{active ? 'Scoring ON' : 'Enable Scoring'}
        </button>
        {active && (
          <div className="score-limit-row">
            <span className="score-limit-label"><Settings size={11} /> Limit:</span>
            {SCORE_PRESETS.map(p => (
              <button key={p}
                className={`score-preset-btn ${baseLimit === p && !showCustom ? 'active' : ''}`}
                onClick={() => { reset(p); setShowCustom(false); }}>
                {p}
              </button>
            ))}
            <button className={`score-preset-btn ${showCustom ? 'active' : ''}`} onClick={() => setShowCustom(s => !s)}>Custom</button>
            {showCustom && (
              <span className="score-custom-wrap">
                <input type="number" className="score-custom-input" value={customLimit}
                  onChange={e => setCustomLimit(e.target.value)} placeholder="e.g. 15" min={2}
                  onKeyDown={e => e.key === 'Enter' && applyCustomLimit()} />
                <button className="score-custom-ok" onClick={applyCustomLimit}><Check size={12} /></button>
              </span>
            )}
            <button className="score-reset-btn" onClick={() => reset()} title="Reset scores"><RotateCcw size={12} /></button>
          </div>
        )}
      </div>

      {active && (
        <div className={`scoreboard ${finished ? 'scoreboard--finished' : ''} ${inDeuce ? 'scoreboard--deuce' : ''}`}>
          <div className={`score-side score-side--a ${scoreA >= limit ? 'score-side--winner' : ''}`}>
            <div className="score-team-badge score-team-badge--a">Team A</div>
            <div className="score-player-name">{labelA}</div>
            <div className="score-display">{scoreA}</div>
            <div className="score-btns">
              <button onClick={() => increment('A')} disabled={finished} className="score-btn score-btn--plus"><Plus size={16} /></button>
              <button onClick={() => decrement('A')} disabled={finished || scoreA === 0} className="score-btn score-btn--minus"><Minus size={14} /></button>
            </div>
          </div>
          <div className="score-centre">
            <span className="score-limit-badge">to {limit}</span>
            {inDeuce && !finished && <div className="deuce-badge">DEUCE</div>}
            {finished && <div className="score-finished-label">Game Over!</div>}
          </div>
          <div className={`score-side score-side--b ${scoreB >= limit ? 'score-side--winner' : ''}`}>
            <div className="score-team-badge score-team-badge--b">Team B</div>
            <div className="score-player-name">{labelB}</div>
            <div className="score-display">{scoreB}</div>
            <div className="score-btns">
              <button onClick={() => increment('B')} disabled={finished} className="score-btn score-btn--plus"><Plus size={16} /></button>
              <button onClick={() => decrement('B')} disabled={finished || scoreB === 0} className="score-btn score-btn--minus"><Minus size={14} /></button>
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
  firstFour: string[]; suggestedTeamA?: [string, string] | null; suggestedTeamB?: [string, string] | null;
  playAllScore?: number | null; statsMap: Record<string, PlayerStat>; isHost: boolean;
  onMatch: (a: string[], b: string[], w: 'A' | 'B', score?: string) => void;
  onScoreChange?: (score: LiveScoreState | null) => void;
  viewerScore?:   LiveScoreState | null;
}> = ({ firstFour, suggestedTeamA, suggestedTeamB, playAllScore, statsMap, isHost, onMatch, onScoreChange, viewerScore }) => {
  const [teamA, setTeamA] = useState<string[]>([]);
  const [teamB, setTeamB] = useState<string[]>([]);
  const [winner, setWinner] = useState<'A' | 'B' | null>(null);
  const [pendingScore, setPendingScore] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (firstFour.length !== 4) { setTeamA([]); setTeamB([]); }
    else { setTeamA(suggestedTeamA ? [...suggestedTeamA] : [firstFour[0], firstFour[1]]); setTeamB(suggestedTeamB ? [...suggestedTeamB] : [firstFour[2], firstFour[3]]); }
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
      {suggestedTeamA && suggestedTeamB && (<div className="playall-badge"><Sparkles size={12} />Maximum-novelty suggestion{playAllScore === 0 && ' — all new pairings!'}{(playAllScore ?? 0) > 0 && <span className="playall-score"> (repeat: {playAllScore})</span>}</div>)}
      <div className="team-display-row"><span className="team-chip team-chip--a">A: {teamA.join(' & ') || '—'}</span><span className="vs-sep">vs</span><span className="team-chip team-chip--b">B: {teamB.join(' & ') || '—'}</span></div>
      <div className="player-buttons">{firstFour.map(p => { const cls = teamA.includes(p) ? 'player-btn-team-a' : teamB.includes(p) ? 'player-btn-team-b' : 'player-btn-unassigned'; return <button key={p} onClick={() => toggle(p)} className={cls} disabled={!isHost}><PlayerLabel name={p} statsMap={statsMap} /></button>; })}</div>
      <ScoreBoard labelA={teamA.length ? teamA.join(' & ') : 'Team A'} labelB={teamB.length ? teamB.join(' & ') : 'Team B'}
        onWin={(side, sA, sB) => { setWinner(side); setPendingScore(`${sA} – ${sB}`); }}
        disabled={!isHost}
        onScoreChange={isHost ? onScoreChange : undefined}
        viewerScore={!isHost ? viewerScore : null} />
      <div className="winning-team">
        <span className="winning-label">Winner:</span>
        <button onClick={() => isHost && setWinner('A')} className={winner === 'A' ? 'selected-winner' : ''} disabled={teamA.length !== 2 || !isHost}><Trophy size={12} /> Team A {winner === 'A' && pendingScore && `(${pendingScore})`}</button>
        <button onClick={() => isHost && setWinner('B')} className={winner === 'B' ? 'selected-winner' : ''} disabled={teamB.length !== 2 || !isHost}><Trophy size={12} /> Team B {winner === 'B' && pendingScore && `(${pendingScore})`}</button>
      </div>
      {isHost && <button onClick={submit} className="match-action-btn"><Play size={13} /> Confirm Match</button>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// § 8  WINNER MODAL
// ═══════════════════════════════════════════════════════════

const WinnerModal: React.FC<{ isOpen: boolean; winner: string; score?: string; onClose: () => void; autoClose: boolean; setAutoClose: (v: boolean) => void }> = ({ isOpen, winner, score, onClose, autoClose, setAutoClose }) => {
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
          <label className="auto-close-toggle"><input type="checkbox" checked={autoClose} onChange={e => setAutoClose(e.target.checked)} />Auto-close (3s)</label>
          <button onClick={onClose} className="close-modal-btn"><X size={13} /> Close</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// § 9  ANALYTICS DASHBOARD
// ═══════════════════════════════════════════════════════════

const StatBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => (<div className="stat-bar-track"><div className="stat-bar-fill" style={{ width: `${max === 0 ? 0 : Math.round((value / max) * 100)}%`, background: color }} /></div>);

const AnalyticsDashboard: React.FC<{ stats: PlayerStat[] }> = ({ stats }) => {
  const sorted = [...stats].sort((a, b) => b.wins - a.wins);
  const maxGP = Math.max(...stats.map(s => s.gamesPlayed), 1);
  if (!stats.length) return <p className="muted-hint">No stats yet — play some matches!</p>;
  return (
    <div className="analytics-panel">
      <div className="analytics-section-label"><BarChart2 size={13} /> Leaderboard</div>
      <div className="analytics-table-scroll">
        <table className="analytics-table">
          <thead><tr><th>#</th><th>Player</th><th>Rank</th><th><TrendingUp size={11} /> W</th><th>L</th><th><Activity size={11} /> GP</th><th>Win %</th><th>Streak</th></tr></thead>
          <tbody>
            {sorted.map((s, i) => (<tr key={s.name} className={i === 0 ? 'analytics-top' : ''}><td className="col-rank-num">{i + 1}</td><td><strong>{s.name}</strong></td><td><RankBadge rank={s.rank} /></td><td className="col-wins">{s.wins}</td><td className="col-losses">{s.losses}</td><td>{s.gamesPlayed}</td><td><div className="winrate-cell"><span>{s.winRate}%</span><StatBar value={s.winRate} max={100} color="#22c55e" /></div></td><td>{s.streak >= 2 ? <span className="streak-badge"><Flame size={11} />{s.streak}</span> : <span className="col-streak-zero">{s.streak}</span>}</td></tr>))}
          </tbody>
        </table>
      </div>
      <div className="analytics-section-label" style={{ marginTop: 24 }}><Clock size={13} /> Play Frequency</div>
      <div className="frequency-chart">{sorted.map(s => (<div key={s.name} className="freq-row"><span className="freq-name">{s.name}</span><StatBar value={s.gamesPlayed} max={maxGP} color="#818cf8" /><span className="freq-count">{s.gamesPlayed}</span></div>))}</div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// § 10  LIVE-MANAGEMENT PANELS
// ═══════════════════════════════════════════════════════════

const AddPlayerPanel: React.FC<{ onAdd: (name: string) => void }> = ({ onAdd }) => {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState('');
  const commit = () => { const t = val.trim(); if (!t) return; onAdd(t); setVal(''); setOpen(false); };
  return (<div className="live-panel"><button className="live-panel-toggle" onClick={() => setOpen(o => !o)}><UserPlus size={13} /> {open ? 'Cancel' : 'Add Player'}</button>{open && (<div className="live-form"><input value={val} onChange={e => setVal(e.target.value)} placeholder="Player name" onKeyDown={e => e.key === 'Enter' && commit()} autoFocus /><button onClick={commit} className="live-form-submit"><PlusCircle size={12} /> Add</button></div>)}</div>);
};

const ManualQueuePanel: React.FC<{ allPlayers: string[]; queue: string[]; statsMap: Record<string, PlayerStat>; onAdd: (p: string) => void; onRemove: (i: number) => void }> = ({ allPlayers, queue, statsMap, onAdd, onRemove }) => {
  const [open, setOpen] = useState(false);
  const notQueued = allPlayers.filter(p => !queue.includes(p));
  return (<div className="live-panel"><button className="live-panel-toggle" onClick={() => setOpen(o => !o)}><ListOrdered size={13} /> {open ? 'Hide' : 'Manage'} Queue</button>{open && (<div className="mqp-body"><div className="mqp-col"><div className="mqp-col-header"><UserCheck size={11} /> Available</div>{notQueued.length === 0 && <p className="muted-hint">All players queued</p>}{notQueued.map(p => (<button key={p} className="mqp-btn mqp-btn--add" onClick={() => onAdd(p)}><PlusCircle size={11} /><PlayerLabel name={p} statsMap={statsMap} /></button>))}</div><div className="mqp-col"><div className="mqp-col-header"><ListOrdered size={11} /> Queue</div>{queue.length === 0 && <p className="muted-hint">Empty</p>}{queue.map((p, i) => (<button key={i} className="mqp-btn mqp-btn--remove" onClick={() => onRemove(i)}><span className="mqp-pos">#{i + 1}</span><PlayerLabel name={p} statsMap={statsMap} /><X size={10} /></button>))}</div></div>)}</div>);
};

// ═══════════════════════════════════════════════════════════
// § 11  AI / SMART SUGGESTIONS
// ═══════════════════════════════════════════════════════════

const SUGGESTION_ICONS: Record<SmartSuggestion['type'], React.ReactNode> = { 'overused': <AlertTriangle size={13} />, 'underused': <ThumbsUp size={13} />, 'hot-streak': <Flame size={13} />, 'team-balance': <Brain size={13} /> };
const SUGGESTION_COLORS: Record<SmartSuggestion['type'], string> = { 'overused': '#f59e0b', 'underused': '#22c55e', 'hot-streak': '#ef4444', 'team-balance': '#6366f1' };

const SmartSuggestions: React.FC<{ suggestions: SmartSuggestion[] }> = ({ suggestions }) => {
  if (!suggestions.length) return null;
  return (<div className="smart-suggestions"><div className="smart-header"><Brain size={13} /> Smart Suggestions</div>{suggestions.map((s, i) => (<div key={i} className="smart-card" style={{ '--sc': SUGGESTION_COLORS[s.type] } as React.CSSProperties}><span className="smart-icon">{SUGGESTION_ICONS[s.type]}</span><span className="smart-message">{s.message}</span></div>))}</div>);
};

// ═══════════════════════════════════════════════════════════
// § 12  SESSION BAR — status strip only (no join input)
// ═══════════════════════════════════════════════════════════

/**
 * SessionBar: shows Live/Saving status + room code for the host.
 * Viewers are no longer joined from here — they use the homepage Watch button.
 * The bar is hidden entirely when there's no active session.
 */
const SessionBar: React.FC<{
  sessionId:   string | null;
  isHost:      boolean;
  isConnected: boolean;
  isSaving:    boolean;
}> = ({ sessionId, isHost, isConnected, isSaving }) => {
  if (!sessionId) return null;   // ← nothing shown before session starts

  return (
    <div className={`session-bar ${isHost ? 'session-bar--host' : 'session-bar--viewer'}`}>
      <span className={`session-dot ${isConnected ? 'session-dot--live' : 'session-dot--offline'}`} />
      <span className="session-status-text">
        {isSaving ? 'Saving…' : isConnected ? 'Live' : 'Connecting…'}
      </span>
      <span className="session-label">Room:</span>
      <span className="session-code">{sessionId}</span>
      <span className={`session-role-badge ${!isHost ? 'session-role-badge--viewer' : ''}`}>
        {isHost ? 'HOST' : 'WATCHING'}
      </span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// § 12b  SHARE BUTTON — top-right QR + code popover (host only)
// ═══════════════════════════════════════════════════════════

/**
/**
 * ShareButton — "Go Live"
 * ─────────────────────────────────────────────────────────
 * Sits top-right in every game view (host only).
 * Three ways to share:
 *   1. Native share sheet (Web Share API — WhatsApp, SMS, etc.)
 *   2. Room code — large display font, read it out loud
 *   3. QR code — scan to open /watch/{sessionId}
 */
const ShareButton: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  const [open,        setOpen]       = useState(false);
  const [tab,         setTab]        = useState<'share' | 'code' | 'qr'>('share');
  const [copied,      setCopied]     = useState(false);
  const [justShared,  setJustShared] = useState(false);

  // Build watchUrl client-side only — window is not available during SSR
  const [watchUrl, setWatchUrl] = useState(`/watch/${sessionId}`);
  useEffect(() => {
    setWatchUrl(`${window.location.origin}/watch/${sessionId}`);
  }, [sessionId]);

  // Does this browser support the Web Share API?
  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const copyLink = () => {
    navigator.clipboard.writeText(watchUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Web Share API — opens native share sheet (WhatsApp, SMS, copy, etc.)
  const nativeShare = async () => {
    try {
      await navigator.share({
        title: `PADQ — Watch Session ${sessionId}`,
        text:  `Watch this live badminton session! Room code: ${sessionId}`,
        url:   watchUrl,
      });
      setJustShared(true);
      setTimeout(() => setJustShared(false), 2000);
    } catch {
      // User cancelled or API not supported — fall through silently
    }
  };

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.share-popover-wrap')) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="share-popover-wrap">

      {/* ── Trigger — "Go Live" ── */}
      <button
        className={`share-trigger share-trigger--live ${open ? 'share-trigger--active' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Share this session with viewers"
      >
        <span className="go-live-dot" />
        Go Live
      </button>

      {/* ── Popover ── */}
      {open && (
        <div className="share-popover">
          <div className="share-popover-header">
            <span className="share-popover-title">
              <span className="go-live-dot go-live-dot--sm" /> Share Session
            </span>
            <button className="share-popover-close" onClick={() => setOpen(false)}>
              <X size={14} />
            </button>
          </div>

          {/* Room code always visible at top — quick reference */}
          <div className="share-code-hero">
            <span className="share-code-label">Room Code</span>
            <span className="share-code-big">{sessionId}</span>
          </div>

          {/* Tab switcher */}
          <div className="share-tabs">
            {canNativeShare && (
              <button className={`share-tab ${tab === 'share' ? 'active' : ''}`} onClick={() => setTab('share')}>
                Share
              </button>
            )}
            <button className={`share-tab ${tab === 'code' ? 'active' : ''}`} onClick={() => setTab('code')}>
              Link
            </button>
            <button className={`share-tab ${tab === 'qr' ? 'active' : ''}`} onClick={() => setTab('qr')}>
              QR
            </button>
          </div>

          {/* Native share tab */}
          {tab === 'share' && canNativeShare && (
            <div className="share-code-view">
              <p className="share-hint">Send via WhatsApp, SMS, or any app</p>
              <button
                className={`share-native-btn ${justShared ? 'share-native-btn--done' : ''}`}
                onClick={nativeShare}
              >
                {justShared
                  ? <><Check size={15} /> Shared!</>
                  : <><ExternalLink size={15} /> Share Link</>
                }
              </button>
              <p className="share-hint share-hint--sm">
                Viewers open the link → they see your queue live
              </p>
            </div>
          )}

          {/* Copy link tab */}
          {tab === 'code' && (
            <div className="share-code-view">
              <p className="share-hint">Copy the full watch link</p>
              <div className="share-url-row">
                <span className="share-url-text">{watchUrl}</span>
              </div>
              <div className="share-actions">
                <button className="share-action share-action--copy" onClick={copyLink}>
                  {copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Link</>}
                </button>
                <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="share-action share-action--open">
                  <ExternalLink size={13} /> Open
                </a>
              </div>
            </div>
          )}

          {/* QR tab */}
          {tab === 'qr' && (
            <div className="share-qr-view">
              <div className="share-qr-wrap">
                <QRCodeSVG
                  value={watchUrl}
                  size={180}
                  bgColor="#ffffff"
                  fgColor="#1e293b"
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="share-hint share-hint--sm">Scan to open the watch page instantly</p>
            </div>
          )}

          <p className="share-footer">
            Viewers see the queue live — read only, no sign-in needed.
          </p>
        </div>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════
// § 13  MAIN ORCHESTRATOR
// ═══════════════════════════════════════════════════════════

function QueueSystemContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams?.get('mode');
  const gameModeFromUrl = modeParam === 'singles' || modeParam === 'doubles' ? modeParam : null;

  const {
    gameMode, players, queue, playAllRel,
    setGameMode, setPlayers, playSingles, playDoubles,
    randomizeQueue, setQueue, recordPlayAllDoubles,
    recordPlayAllSingles, resetPlayAllRelationships,
  } = useQueue();

  const session = useSession();

  // Sync Firebase → local queue hook
  useEffect(() => {
    if (!session.isConnected || !session.players.length) return;
    if (session.players.join(',') !== players.join(',')) setPlayers(session.players);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.players, session.isConnected]);

  useEffect(() => {
    if (!session.isConnected || !session.queue.length) return;
    if (session.queue.join(',') !== queue.join(',')) setQueue(session.queue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.queue, session.isConnected]);

  // UI-only state (never persisted)
  const [tempPlayers,  setTempPlayers]  = useState<string[]>([]);
  const [currentName,  setCurrentName]  = useState('');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalWinner,  setModalWinner]  = useState('');
  const [modalScore,   setModalScore]   = useState<string | undefined>(undefined);
  const [autoClose,    setAutoClose]    = useState(false);
  const [showHistory,  setShowHistory]  = useState(true);
  const [darkMode,     setDarkMode]     = useState(true);   // ← dark by default
  const [activeTab,    setActiveTab]    = useState<GameTab>('queue');
  // Live score — host writes on every point, viewers read via session.liveScore
  const [liveScore,    setLiveScore]    = useState<LiveScoreState | null>(null);
  // Show a "Your session is live — share it!" nudge for 10s after session starts
  const [showSharePrompt, setShowSharePrompt] = useState(false);

  // Persisted state — local fallbacks when not connected
  const [localQueueMode,        setLocalQueueMode]        = useState<QueueMode>('default');
  const [localElimType,         setLocalElimType]         = useState<EliminationType>('single');
  const [localTournamentM,      setLocalTournamentM]      = useState<TournamentMatch[]>([]);
  const [localTournamentActive, setLocalTournamentActive] = useState(false);
  const [localTournamentWinner, setLocalTournamentWinner] = useState<string | null>(null);
  const [localHistory,          setLocalHistory]          = useState<MatchHistoryEntry[]>([]);

  // Unified setters
  const setQueueMode = (m: QueueMode) => { setLocalQueueMode(m); if (session.sessionId) session.syncField({ queueMode: m }); };
  const setElimType  = (t: EliminationType) => { setLocalElimType(t); if (session.sessionId) session.syncField({ elimType: t }); };
  const setTournamentMatches = (tm: TournamentMatch[]) => { setLocalTournamentM(tm); if (session.sessionId) session.syncField({ tournamentMatches: tm }); };
  const setTournamentActive  = (v: boolean)      => { setLocalTournamentActive(v); if (session.sessionId) session.syncField({ tournamentActive: v }); };
  const setTournamentWinner  = (w: string | null) => { setLocalTournamentWinner(w); if (session.sessionId) session.syncField({ tournamentWinner: w }); };
  const addHistory = (entry: MatchHistoryEntry) => {
    setLocalHistory(prev => [entry, ...prev]);
    if (session.sessionId) session.commitMatchResult({ queue }, { id: entry.id, mode: entry.mode, players: entry.players, winner: entry.winner, score: entry.score, timestamp: entry.timestamp });
  };

  // Push live score to Firebase so viewers see it in real-time.
  // Called by ScoreBoard's onScoreChange on every point.
  const handleScoreChange = (score: LiveScoreState | null) => {
    setLiveScore(score);
    if (session.sessionId) session.syncField({ liveScore: score });
  };

  // Resolve active values
  const activeQueueMode        = session.isConnected ? session.queueMode         : localQueueMode;
  const activeElimType         = session.isConnected ? session.elimType          : localElimType;
  const activeTournamentM      = session.isConnected && session.tournamentMatches?.length > 0
    ? session.tournamentMatches : localTournamentM;
  // Use OR: tournament is active if EITHER local state OR Firebase says so.
  // This prevents a race where Firebase hasn't synced tournamentActive yet
  // but local state already set it to true via handleStartQueue.
  const activeTournamentActive = localTournamentActive || (session.isConnected ? session.tournamentActive : false);
  const activeTournamentWinner = session.isConnected ? session.tournamentWinner  : localTournamentWinner;
  const activeHistory          = session.isConnected ? (session.matchHistory as unknown as MatchHistoryEntry[]) : localHistory;

  // Derived
  const statsList = useMemo(() => buildPlayerStats(players, activeHistory), [players, activeHistory]);
  const statsMap  = useMemo(() => Object.fromEntries(statsList.map(s => [s.name, s])), [statsList]);
  const suggestions = useMemo(() => activeTab === 'queue' ? generateSuggestions(statsList, queue) : [], [statsList, queue, activeTab]);
  const playAllSuggestion = useMemo<PlayAllSuggestion | null>(() => {
    if (activeQueueMode !== 'playall' || gameMode !== 'doubles') return null;
    return suggestNextDoublesMatch(queue, playAllRel);
  }, [activeQueueMode, gameMode, queue, playAllRel]);
  const firstFour = useMemo(() => queue.slice(0, 4), [queue]);

  // Side effects
  // darkMode is true by default → apply immediately on first mount (synchronous),
  // then keep it in sync whenever the toggle changes.
  // We use a layout effect so it runs before paint, preventing a flash.
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  // Synchronously apply dark mode before the first paint to avoid flash.
  // This runs during commit phase (before browser paint).
  useLayoutEffect(() => {
    document.body.classList.add('dark-mode');
  }, []);
  useEffect(() => { if (gameModeFromUrl) setGameMode(gameModeFromUrl); else router.push('/'); }, [gameModeFromUrl, setGameMode, router]);
  useEffect(() => {
    if (!playAllSuggestion) return;
    const s = playAllSuggestion.reorderedQueue;
    if (queue.slice(0, 4).join(',') !== s.slice(0, 4).join(',')) setQueue(s);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAllSuggestion]);
  useEffect(() => {
    if (activeQueueMode !== 'playall' || gameMode !== 'singles' || queue.length < 2) return;
    const result = suggestNextSinglesMatch(queue, playAllRel);
    if (!result) return;
    if (queue.slice(0, 2).join(',') !== result.reorderedQueue.slice(0, 2).join(',')) setQueue(result.reorderedQueue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playAllRel, activeQueueMode, gameMode]);

  // Handlers
  const addTempPlayer = () => { const t = currentName.trim(); if (!t) return; if (tempPlayers.includes(t)) { alert('Player already added'); return; } setTempPlayers(prev => [...prev, t]); setCurrentName(''); };
  const removeTempPlayer = (i: number) => setTempPlayers(prev => prev.filter((_, j) => j !== i));

  const handleStartQueue = async () => {
    if (tempPlayers.length < 5 || tempPlayers.length > 24) { alert(`Need 5–24 players. Currently: ${tempPlayers.length}`); return; }
    setPlayers(tempPlayers); setTempPlayers([]); setLocalHistory([]);
    setLocalTournamentActive(false); setLocalTournamentWinner(null); setLocalTournamentM([]);
    let initialBracket: TournamentMatch[] = [];
    if (localQueueMode === 'tournament') {
      const shuffled = shuffleArray(tempPlayers);
      // For doubles: pair players into teams (Team 1 = player 0 & 1, Team 2 = player 2 & 3, etc.)
      // For singles: use individual player names
      const bracketEntrants = gameMode === 'doubles'
        ? shuffled.reduce<string[]>((acc, _, i) => {
            if (i % 2 === 0 && i + 1 < shuffled.length) acc.push(`${shuffled[i]} & ${shuffled[i + 1]}`);
            else if (i % 2 === 0) acc.push(shuffled[i]); // odd player out gets a bye
            return acc;
          }, [])
        : shuffled;
      initialBracket = localElimType === 'single' ? buildSingleElim(bracketEntrants) : buildDoubleElim(bracketEntrants);
      setLocalTournamentM(initialBracket); setLocalTournamentActive(true);
    }
    await session.startSession({ gameMode: gameMode ?? 'singles', queueMode: localQueueMode, elimType: localElimType, players: tempPlayers, queue: tempPlayers, playAllRel: {}, tournamentMatches: initialBracket, tournamentActive: localQueueMode === 'tournament', tournamentWinner: null });
    // Show the share prompt for 10 seconds so the host knows to invite viewers
    setShowSharePrompt(true);
    setTimeout(() => setShowSharePrompt(false), 10000);
  };

  const initTournament = useCallback((playerList: string[], type: EliminationType) => {
    const shuffled = shuffleArray(playerList);
    // For doubles: pair consecutive players into team strings e.g. "Alice & Bob"
    // For singles: use individual player names directly
    const entrants = gameMode === 'doubles'
      ? shuffled.reduce<string[]>((acc, _, i) => {
          if (i % 2 === 0) {
            // Pair player i with player i+1; if odd one out, they get a solo slot
            acc.push(i + 1 < shuffled.length
              ? `${shuffled[i]} & ${shuffled[i + 1]}`
              : shuffled[i]);
          }
          return acc;
        }, [])
      : shuffled;
    const bracket = type === 'single' ? buildSingleElim(entrants) : buildDoubleElim(entrants);
    setTournamentMatches(bracket); setTournamentActive(true); setTournamentWinner(null);
  // gameMode is stable (set from URL on mount, never changes mid-session)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode]);

  const handleTournamentMatch = (matchId: number, winner: string) => {
    const match = activeTournamentM.find(m => m.id === matchId)!;
    addHistory({ id: Date.now(), mode: 'Tournament', players: `${match.player1} vs ${match.player2 || 'Bye'}`, winner, timestamp: new Date().toLocaleTimeString() });
    const updated = activeElimType === 'single' ? recordSingleWinner(activeTournamentM, matchId, winner) : recordDoubleWinner(activeTournamentM, matchId, winner);
    setTournamentMatches(updated);
    const gfMatch = updated.find(m => m.bracket === 'GF');
    const lastWbM = activeElimType === 'single' ? (() => { const by: Record<number, TournamentMatch[]> = {}; updated.forEach(m => { (by[m.round] ??= []).push(m); }); return by[Math.max(...Object.keys(by).map(Number))]?.[0]; })() : null;
    const champion = gfMatch?.winner ?? lastWbM?.winner;
    if (champion) { setTournamentWinner(champion); setModalWinner(`${champion} is the tournament champion! 🏆`); setModalScore(undefined); setModalOpen(true); }
  };

  const handleRandomize = () => { if (activeQueueMode === 'tournament') { initTournament(players, activeElimType); return; } randomizeQueue(); if (activeQueueMode === 'playall') resetPlayAllRelationships(); };
  const handleElimTypeChange = (type: EliminationType) => { setElimType(type); if (activeQueueMode === 'tournament' && players.length > 0) { initTournament(players, type); setLocalHistory([]); } };
  const handleModeChange = (newMode: QueueMode) => {
    setQueueMode(newMode);
    // Only init tournament bracket if we already have players (game is running)
    // On setup screen (players.length === 0), bracket is built in handleStartQueue
    if (newMode === 'tournament' && players.length > 0) initTournament(players, activeElimType);
    else if (newMode !== 'tournament') { setTournamentActive(false); setTournamentWinner(null); setTournamentMatches([]); }
    if (newMode === 'playall') resetPlayAllRelationships();
  };
  const handleSinglesMatch = (winner: string, score?: string) => { const [p1, p2] = [queue[0], queue[1]]; playSingles(winner); if (activeQueueMode === 'playall') recordPlayAllSingles(p1, p2); addHistory({ id: Date.now(), mode: 'Singles', players: `${p1} vs ${p2}`, winner, score, timestamp: new Date().toLocaleTimeString() }); setModalWinner(`${winner} wins!`); setModalScore(score); setModalOpen(true); };
  const handleDoublesMatch = (a: string[], b: string[], w: 'A' | 'B', score?: string) => { playDoubles([...a], [...b], w); if (activeQueueMode === 'playall') recordPlayAllDoubles(a, b); const winnerNames = w === 'A' ? a.join(' & ') : b.join(' & '); addHistory({ id: Date.now(), mode: 'Doubles', players: `${a.join(' & ')} vs ${b.join(' & ')}`, winner: winnerNames, score, timestamp: new Date().toLocaleTimeString() }); setModalWinner(`${winnerNames} win!`); setModalScore(score); setModalOpen(true); };
  const handleAddPlayerLive = (name: string) => { if (players.includes(name)) { alert('Player already exists'); return; } const np = [...players, name], nq = [...queue, name]; setPlayers(np); setQueue(nq); if (session.sessionId) session.syncField({ players: np, queue: nq }); };
  const handleFullReset = () => {
    if (!confirm('Reset everything and return to player setup?')) return;
    session.endSession();
    window.location.reload();
  };

  // Task 4: Hard Reset — clears ALL localStorage, sessionStorage, and reloads.
  // Use when session state is stuck or corrupted.
  const handleHardReset = () => {
    if (!confirm('Hard Reset will clear ALL cached data including your session. Continue?')) return;
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch { /* ignore storage errors */ }
    window.location.href = '/';  // navigate to home and force full reload
  };

  // Shared fragments
  // canControl: true if there's no live session yet (setup screen) OR user is the host
  const canControl = !session.sessionId || session.isHost;
  const modeSelector = (<div className="mode-selector">{(['default', 'tournament', 'playall'] as const).map(m => (<button key={m} className={`mode-btn ${activeQueueMode === m ? 'active' : ''}`} onClick={() => canControl && handleModeChange(m)} disabled={!canControl}>{m === 'default' && <><Swords size={12} /> Default</>}{m === 'tournament' && <><Trophy size={12} /> Tournament</>}{m === 'playall' && <><Star size={12} /> Play‑all</>}</button>))}</div>);
  const elimSelector = activeQueueMode === 'tournament' && (<div className="elim-selector">{(['single', 'double'] as const).map(t => (<button key={t} className={`elim-btn ${activeElimType === t ? 'active' : ''}`} onClick={() => canControl && handleElimTypeChange(t)}>{t === 'single' ? 'Single Elim' : 'Double Elim'}</button>))}</div>);
  const uiControls = (<div className="ui-controls"><button className="control-btn" onClick={() => setShowHistory(h => !h)}><History size={12} /> {showHistory ? 'Hide' : 'Show'} History</button>{(session.isHost || !session.sessionId) && (<button className="control-btn control-btn--danger" onClick={handleFullReset}><RotateCcw size={12} /> Reset</button>)}</div>);
  const tabBar = (<div className="tab-bar"><button className={`tab-btn ${activeTab === 'queue' ? 'active' : ''}`} onClick={() => setActiveTab('queue')}><Swords size={12} /> Queue</button><button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}><BarChart2 size={12} /> Stats</button></div>);
  const historyPanel = showHistory && (<div className="history-area"><h3><History size={13} /> History</h3>{activeHistory.length === 0 ? <p className="muted-hint">No matches played yet.</p> : (<ul className="history-list">{activeHistory.map(e => (<li key={e.id} className="history-item"><div className="history-time">{e.timestamp}</div><div className="history-match">{e.players}</div><div className="history-winner"><Trophy size={11} /> {e.winner}</div>{e.score && <div className="history-score">{e.score}</div>}</li>))}</ul>)}</div>);

  // ── RENDER A — Setup ──────────────────────────────────────
  if (players.length === 0) {
    return (
      <div className={`queue-system setup-page ${darkMode ? 'dark' : ''}`}>
        <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
        <button className="back-home" onClick={() => router.push('/')}><ArrowLeft size={14} /> Back</button>
        <div className="setup-hero">
          <div className="setup-hero-icon">{gameMode === 'singles' ? <Swords size={26} /> : <Users size={26} />}</div>
          <h1 className="app-name">{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue</h1>
          <p className="app-subtitle">Add 5 – 24 players to get started</p>
        </div>
        {/* Mode selector intentionally NOT shown during player setup —
            Task 3: options should not be available while adding players.
            Mode is selected AFTER the queue starts in the game view. */}
        <div className="player-input-container">
          <div className="input-group">
            <input type="text" value={currentName} onChange={e => setCurrentName(e.target.value)} placeholder="Enter player name" onKeyDown={e => e.key === 'Enter' && addTempPlayer()} />
            <button onClick={addTempPlayer} className="add-btn"><UserPlus size={15} /></button>
          </div>
          {tempPlayers.length > 0 && (<div className="players-list"><h3><Users size={13} /> Players ({tempPlayers.length}/24)</h3><ul>{tempPlayers.map((p, i) => (<li key={i}><span className="setup-player-num">#{i + 1}</span><span>{p}</span><button onClick={() => removeTempPlayer(i)} className="remove-btn"><Trash2 size={12} /></button></li>))}</ul></div>)}
          <button onClick={handleStartQueue} className="start-btn" disabled={tempPlayers.length < 5 || session.isSaving}>
            {session.isSaving ? <><Wifi size={14} /> Creating session…</> : <><Play size={14} /> Start Queue ({tempPlayers.length}/5 min)</>}
          </button>
        </div>
      </div>
    );
  }

  // ── RENDER B — Tournament ─────────────────────────────────
  if (activeQueueMode === 'tournament' && activeTournamentActive) {
    const pendingMatch = activeTournamentM.find(m => !m.winner && !m.isBye && m.player1 && m.player2) ?? null;
    return (
      <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
        {/* Top-right corner: dark mode + share button */}
        <div className="topright-controls">
          <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
          {session.isHost && session.sessionId && <ShareButton sessionId={session.sessionId} />}
          {canControl && (
            <button className="hard-reset-btn" onClick={handleHardReset} title="Hard Reset — clears all cached data">
              <RotateCcw size={13} /> Hard Reset
            </button>
          )}
        </div>

        <button className="back-home" onClick={() => router.push('/')}><ArrowLeft size={14} /> Back</button>
        <SessionBar sessionId={session.sessionId} isHost={session.isHost} isConnected={session.isConnected} isSaving={session.isSaving} />

        {/* Session expired — TTL deleted it while host was away */}
        {session.isExpired && (
          <div className="session-alert session-alert--expired">
            <WifiOff size={14} /> Session expired. Your data has been cleared.{' '}
            <button onClick={() => router.push('/')}>Go Home</button>
          </div>
        )}
        {/* Reconnecting — Firestore connection dropped temporarily */}
        {session.isReconnecting && !session.isExpired && (
          <div className="session-alert session-alert--reconnecting">
            <Wifi size={14} /> Reconnecting to session…
          </div>
        )}

        {/* Share nudge — shown for 10s after session starts */}
        {showSharePrompt && session.sessionId && (
          <div className="share-prompt-banner">
            <span className="go-live-dot go-live-dot--sm" />
            Your session is live! Invite viewers →
            <button className="share-prompt-btn" onClick={() => {
              setShowSharePrompt(false);
              // Open the share popover — trigger a click on the Go Live button
              (document.querySelector('.share-trigger') as HTMLElement)?.click();
            }}>
              Go Live
            </button>
            <button className="share-prompt-dismiss" onClick={() => setShowSharePrompt(false)}>
              <X size={12} />
            </button>
          </div>
        )}

        {modeSelector}{elimSelector}{uiControls}{tabBar}
        {!session.isHost && session.sessionId && (<div className="viewer-banner"><Wifi size={13} /> Watching live — only the host can make changes.</div>)}

        {activeTab === 'analytics' ? <AnalyticsDashboard stats={statsList} /> : (
          <div className="main-layout">
            <div className="queue-area">
              <h1 className="queue-title"><Trophy size={20} />{gameMode === 'singles' ? 'Singles' : 'Doubles'} Tournament</h1>
              {session.isHost && <button onClick={handleRandomize} className="randomize-btn"><Shuffle size={12} /> Reseed</button>}
              {activeTournamentWinner && <div className="champion-banner"><Trophy size={18} /> Champion: {activeTournamentWinner}</div>}
              <TournamentBracket matches={activeTournamentM} elimType={activeElimType} />
              {pendingMatch && !activeTournamentWinner && (
                <div className="match-section">
                  <h3 className="match-section-title">
                    {pendingMatch.bracket === 'GF' && <Trophy size={14} />}
                    {pendingMatch.bracket === 'L' && '🔴 Losers — '}
                    {pendingMatch.bracket === 'GF' && ' Grand Final — '}
                    {gameMode === 'doubles'
                      ? `${pendingMatch.player1} vs ${pendingMatch.player2}`
                      : `${pendingMatch.player1} vs ${pendingMatch.player2}`}
                  </h3>

                  {/* Doubles: show team A/B chips with labels, singles: show player buttons */}
                  {gameMode === 'doubles' ? (
                    <>
                      <div className="team-display-row">
                        <div className="tourn-team-block">
                          <span className="tourn-team-label tourn-team-label--a">Team A</span>
                          <span className="team-chip team-chip--a">{pendingMatch.player1}</span>
                        </div>
                        <span className="vs-sep">vs</span>
                        <div className="tourn-team-block">
                          <span className="tourn-team-label tourn-team-label--b">Team B</span>
                          <span className="team-chip team-chip--b">{pendingMatch.player2}</span>
                        </div>
                      </div>
                      <ScoreBoard
                        labelA={pendingMatch.player1!}
                        labelB={pendingMatch.player2!}
                        disabled={!session.isHost}
                        onScoreChange={session.isHost ? handleScoreChange : undefined}
                        viewerScore={!session.isHost ? (session.liveScore ?? null) : null}
                        onWin={(side) => {
                          if (!session.isHost) return;
                          handleTournamentMatch(pendingMatch.id, side === 'A' ? pendingMatch.player1! : pendingMatch.player2!);
                        }} />
                      {session.isHost && (
                        <div className="winning-team">
                          <span className="winning-label">Winner:</span>
                          <button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player1!)}>
                            <Trophy size={12} /> {pendingMatch.player1}
                          </button>
                          <button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player2!)}>
                            <Trophy size={12} /> {pendingMatch.player2}
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <ScoreBoard
                        labelA={pendingMatch.player1!}
                        labelB={pendingMatch.player2!}
                        disabled={!session.isHost}
                        onScoreChange={session.isHost ? handleScoreChange : undefined}
                        viewerScore={!session.isHost ? (session.liveScore ?? null) : null}
                        onWin={(side) => {
                          if (!session.isHost) return;
                          handleTournamentMatch(pendingMatch.id, side === 'A' ? pendingMatch.player1! : pendingMatch.player2!);
                        }} />
                      {session.isHost && (
                        <div className="match-buttons" style={{ marginTop: 14 }}>
                          <button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player1!)}>
                            <Trophy size={12} /> {pendingMatch.player1}
                          </button>
                          <button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player2!)}>
                            <Trophy size={12} /> {pendingMatch.player2}
                          </button>
                        </div>
                      )}
                    </>
                  )}
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

  // ── RENDER C — Default / Play-all ─────────────────────────
  return (
    <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
      {/* Top-right corner: dark mode + share button */}
      <div className="topright-controls">
        <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
        {session.isHost && session.sessionId && <ShareButton sessionId={session.sessionId} />}
        {canControl && (
          <button className="hard-reset-btn" onClick={handleHardReset} title="Hard Reset — clears all cached data">
            <RotateCcw size={13} /> Hard Reset
          </button>
        )}
      </div>

      <button className="back-home" onClick={() => router.push('/')}><ArrowLeft size={14} /> Back</button>
      <SessionBar sessionId={session.sessionId} isHost={session.isHost} isConnected={session.isConnected} isSaving={session.isSaving} />

      {/* Session expired — TTL deleted it while host was away */}
      {session.isExpired && (
        <div className="session-alert session-alert--expired">
          <WifiOff size={14} /> Session expired. Your data has been cleared.{' '}
          <button onClick={() => router.push('/')}>Go Home</button>
        </div>
      )}
      {/* Reconnecting — Firestore connection dropped temporarily */}
      {session.isReconnecting && !session.isExpired && (
        <div className="session-alert session-alert--reconnecting">
          <Wifi size={14} /> Reconnecting to session…
        </div>
      )}

      {/* Share nudge — shown for 10s after session starts */}
      {showSharePrompt && session.sessionId && (
        <div className="share-prompt-banner">
          <span className="go-live-dot go-live-dot--sm" />
          Your session is live! Invite viewers →
          <button className="share-prompt-btn" onClick={() => {
            setShowSharePrompt(false);
            (document.querySelector('.share-trigger') as HTMLElement)?.click();
          }}>
            Go Live
          </button>
          <button className="share-prompt-dismiss" onClick={() => setShowSharePrompt(false)}>
            <X size={12} />
          </button>
        </div>
      )}

      {modeSelector}{uiControls}{tabBar}
      {!session.isHost && session.sessionId && (<div className="viewer-banner"><Wifi size={13} /> Watching live — only the host can make changes.</div>)}

      {activeTab === 'analytics' ? <AnalyticsDashboard stats={statsList} /> : (
        <div className="main-layout">
          <div className="queue-area">
            <h1 className="queue-title">{gameMode === 'singles' ? <Swords size={19} /> : <Users size={19} />}{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue</h1>
            {activeQueueMode === 'default' && (<p className="mode-description"><Trophy size={11} className="mode-desc-icon" /> Winners → back · Losers → front</p>)}
            {activeQueueMode === 'playall' && (<p className="mode-description"><Sparkles size={11} className="mode-desc-icon" /> Every player faces everyone before repeating</p>)}
            <div className="queue-header-row">{session.isHost && (activeQueueMode === 'playall' ? <button onClick={() => { randomizeQueue(); resetPlayAllRelationships(); }} className="randomize-btn"><RefreshCw size={12} /> Reset Play-All</button> : <button onClick={handleRandomize} className="randomize-btn"><Shuffle size={12} /> Randomize</button>)}</div>
            {session.isHost && (<div className="live-tools-row"><AddPlayerPanel onAdd={handleAddPlayerLive} /><ManualQueuePanel allPlayers={players} queue={queue} statsMap={statsMap} onAdd={p => { const nq = [...queue, p]; setQueue(nq); if (session.sessionId) session.syncField({ queue: nq }); }} onRemove={i => { const nq = queue.filter((_, j) => j !== i); setQueue(nq); if (session.sessionId) session.syncField({ queue: nq }); }} /></div>)}
            {gameMode === 'singles' && queue.length >= 2 && (
              <div className="match-section">
                <h3 className="match-section-title"><Swords size={14} /> Current Match</h3>
                <div className="current-match-players"><PlayerLabel name={queue[0]} statsMap={statsMap} /><span className="vs-sep">vs</span><PlayerLabel name={queue[1]} statsMap={statsMap} /></div>
                <ScoreBoard labelA={queue[0]} labelB={queue[1]} disabled={!session.isHost}
                  onScoreChange={session.isHost ? handleScoreChange : undefined}
                  viewerScore={!session.isHost ? (session.liveScore ?? null) : null}
                  onWin={(side, sA, sB) => { if (!session.isHost) return; handleSinglesMatch(side === 'A' ? queue[0] : queue[1], `${sA} – ${sB}`); }} />
                {session.isHost && (<div className="match-buttons" style={{ marginTop: 14 }}><button onClick={() => handleSinglesMatch(queue[0])}><Trophy size={12} /> <PlayerLabel name={queue[0]} statsMap={statsMap} /> wins</button><button onClick={() => handleSinglesMatch(queue[1])}><Trophy size={12} /> <PlayerLabel name={queue[1]} statsMap={statsMap} /> wins</button></div>)}
              </div>
            )}
            {gameMode === 'doubles' && queue.length >= 4 && (<DoublesMatch firstFour={firstFour} suggestedTeamA={playAllSuggestion?.suggestedTeamA ?? null} suggestedTeamB={playAllSuggestion?.suggestedTeamB ?? null} playAllScore={playAllSuggestion?.score ?? null} statsMap={statsMap} isHost={session.isHost} onMatch={handleDoublesMatch}
              onScoreChange={session.isHost ? handleScoreChange : undefined}
              viewerScore={!session.isHost ? (session.liveScore ?? null) : null} />)}
            {gameMode === 'singles' && queue.length < 2 && <p className="muted-hint">Not enough players for a match.</p>}
            {gameMode === 'doubles' && queue.length < 4 && <p className="muted-hint">Not enough players for a match.</p>}
            <div className="pairings-container"><h3 className="pairings-label">Upcoming Matches</h3>{gameMode === 'singles' && <SinglesTable queue={queue} statsMap={statsMap} />}{gameMode === 'doubles' && <DoublesTable queue={queue} statsMap={statsMap} />}</div>
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
// § 14  DEFAULT EXPORT
// ═══════════════════════════════════════════════════════════
export default function QueueSystem() {
  return (
    <Suspense fallback={<div className="qs-loading">Loading…</div>}>
      <QueueSystemContent />
    </Suspense>
  );
}