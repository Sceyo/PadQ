'use client';

/**
 * ═══════════════════════════════════════════════════════════
 * PADQ — QueueSystem  (queue/page.tsx)
 * ═══════════════════════════════════════════════════════════
 *
 * CHANGES v8
 * ──────────
 *  • NEW § 2c: Isolated Singles King-of-the-Court engine (freshSinglesState,
 *    buildSinglesMatch, advanceSinglesState, addPlayerToSinglesWaiting).
 *  • New SinglesStatusPanel (§ 8d) shows king, streak, and queue order.
 *  • handleSinglesMatch wired to singles engine when mode === 'default'.
 *  • singlesStateRef + resetSinglesState mirror paddle-state pattern.
 *  • Single source of truth for injection: buildNextMatch is a pure reader;
 *    all waitingQueue injection lives exclusively in advancePaddleState.
 *  • Player fatigue control: lastPlayedMap + matchCount deprioritise recently played players.
 *  • Smart player selection: scores a window of 6–8 candidates (C(8,4)=70 combos) per phase.
 *  • Pool size balancing: MAX_POOL_SIZE=8 prevents runaway queue growth.
 *  • Stronger anti-repetition: RECENT_PAIRS_CAP=6, RECENT_MATCHES_CAP=4.
 *  • Scored team formation: full penalty system replaces binary pass/fail logic.
 *  • Wider shuffle window: MAX_SHUFFLE_ATTEMPTS=6 with guaranteed valid fallback.
 *  • Optional skill balancing: pass playerSkillMap to balance team skill totals.
 *  • Enforced strict Winners → Losers → Winners alternation
 *  • Reset playedThisCycle when losers phase completes
 *  • Prevented unplayed injection in losers phase
 *  • Added comments for phase transitions & partner swapping
 *
 * FILE STRUCTURE
 * ──────────────
 *  § 1   Types & Constants
 *  § 2   Pure Logic Helpers
 *  § 2b  Advanced Paddle Queue Engine (Doubles)
 *  § 2c  Singles King-of-the-Court Engine
 *  § 8d  Singles Status Panel
 *  § 3   Reusable UI Atoms
 *  § 4   Bracket Components
 *  § 5   Queue Table Components
 *  § 6   ScoreBoard
 *  § 7   DoublesMatch
 *  § 8   WinnerModal
 *  § 8b  User Guide Modal
 *  § 8c  Paddle Status Panel
 *  § 9   Analytics Dashboard
 *  § 10  Live-management Panels
 *  § 11  AI / Smart Suggestions
 *  § 12  SessionBar
 *  § 12b ShareButton
 *  § 13  Main Orchestrator
 *  § 14  Default export
 * ═══════════════════════════════════════════════════════════
 */

import React, {
  useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef, Suspense,
} from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
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


// ═══════════════════════════════════════════════════════════
// § 2b  ADVANCED PADDLE QUEUE ENGINE  (v4 — enhanced AWLQ)
//
// Architecture: strict state machine + modular match builder
//
// CyclePhase transitions:
//   INIT    → runs exactly once (produces 2 seeding matches)
//   INIT    → WINNERS  (after 2nd init match result)
//   WINNERS → LOSERS   (after every single W1 match)
//   LOSERS  → WINNERS  (after every single L1 match)
//   ... repeats indefinitely
//
// One match is generated per buildNextMatch() call.
// State is never mutated in place — all functions return new state.
//
// POST-MATCH ROUTING (core AWLQ rule, identical for W1 and L1 matches):
//   winners → append to BACK of W1
//   losers  → append to BACK of L1
//
// ENHANCEMENTS vs v3:
//   1. Single source of truth for injection — buildNextMatch is a pure
//      reader of state.w1 / state.l1; all injection lives in advancePaddleState.
//   2. Player fatigue control — lastPlayedMap + matchCount deprioritise
//      players who just played when selecting the next 4.
//   3. Smart player selection — evaluates a window of 6–8 candidates and
//      scores each combination instead of blindly taking first 4.
//   4. Pool size balancing — MAX_POOL_SIZE = 8 prevents runaway queues.
//   5. Stronger anti-repetition memory — RECENT_PAIRS_CAP = 6,
//      RECENT_MATCHES_CAP = 4.
//   6. Scored team formation — penalty system replaces binary pass/fail.
//   7. Wider shuffle window — maxAttempts = 6 with guaranteed valid fallback.
//   8. Optional skill balancing — pass playerSkillMap to balance team skill.
// ═══════════════════════════════════════════════════════════

// ── Types ──────────────────────────────────────────────────

export type CyclePhase = 'INIT' | 'WINNERS' | 'LOSERS';

/** A resolved doubles team — always exactly 2 named players. */
export type Team = [string, string];

/** A single generated match — deterministic, quality-maximised. */
export interface Match {
  teamA: Team;
  teamB: Team;
}

/**
 * Complete paddle-queue state.
 * Never mutated; advancePaddleState always returns a fresh copy.
 */
export interface PaddleState {
  /** Current phase of the state machine. */
  phase: CyclePhase;

  /** Matches played inside the current phase (used only during INIT). */
  matchIndexInPhase: number;

  /**
   * Global match counter — incremented once per confirmed match result.
   * Used by lastPlayedMap for fatigue calculations.
   */
  matchCount: number;

  // ── Core FIFO queues (per AWLQ spec, flat Player[]) ──────
  /**
   * W1 — winners queue (flat, individual players).
   * Winners appended to BACK. Unplayed players prepended to FRONT
   * ONLY inside advancePaddleState — never inside buildNextMatch.
   */
  w1: string[];

  /**
   * L1 — losers queue (flat, individual players).
   * Losers appended to BACK after any match.
   */
  l1: string[];

  /**
   * Players not yet in W1 or L1 (overflow beyond first 8, or live-adds).
   * Injected to FRONT of W1 in advancePaddleState before each WINNERS match.
   * buildNextMatch never reads this directly — state.w1 is already correct.
   */
  waitingQueue: string[];

  /**
   * Players who have played at least once this cycle.
   * Reset when every rostered player has completed a cycle.
   */
  playedThisCycle: Set<string>;

  // ── Anti-repetition memory ────────────────────────────────
  /**
   * Canonical teammate-pair keys from the last RECENT_PAIRS_CAP matches.
   * 2 keys per match (one per team), capped at RECENT_PAIRS_CAP × 2.
   */
  recentPairs: string[];

  /**
   * Canonical full match-up keys from the last RECENT_MATCHES_CAP matches.
   */
  recentMatches: string[];

  // ── Fatigue tracking ──────────────────────────────────────
  /**
   * Maps player name → matchCount value when they last played.
   * Used to deprioritise recently played players during smart selection.
   * Players with matchCount === matchCount - 1 just played last match.
   */
  lastPlayedMap: Record<string, number>;

  // ── Derived display-only fields (for PaddleStatusPanel) ──
  /**
   * w1 grouped into consecutive Team pairs for display only.
   * NOT a source of truth — always recomputed from w1.
   */
  winnersPool: Team[];

  /**
   * l1 grouped into consecutive Team pairs for display only.
   * NOT a source of truth — always recomputed from l1.
   */
  losersPool: Team[];
}

// ── Constants ──────────────────────────────────────────────

/** Track teammate pairs for this many past matches. Raised from 3 → 6. */
const RECENT_PAIRS_CAP = 6;

/** Track full match-ups for this many past matches. Raised from 2 → 4. */
const RECENT_MATCHES_CAP = 4;

/**
 * Candidate window for smart selection.
 * We look at this many players from the front of the queue and pick
 * the best 4, rather than blindly taking the first 4.
 */
const SELECTION_WINDOW = 8;

/**
 * Maximum size for W1 or L1 before overflow is redirected to the other pool.
 * Prevents runaway queue growth when one pool dominates.
 */
const MAX_POOL_SIZE = 8;

/**
 * Number of random shuffle attempts in formTeams before falling back.
 * Raised from 3 → 6 for better anti-repetition coverage.
 */
const MAX_SHUFFLE_ATTEMPTS = 6;

// ── Penalty weights for team-formation scoring ─────────────

/** Penalty added per repeated teammate pair found in recentPairs. */
const PENALTY_REPEAT_PAIR = 3;
/** Penalty added if the full match-up appears in recentMatches. */
const PENALTY_REPEAT_MATCH = 5;
/** Penalty per player who played in the immediately preceding match. */
const PENALTY_FATIGUE = 2;
/** Penalty per skill-point of imbalance between the two teams. */
const PENALTY_SKILL_IMBALANCE = 1;

// ── Pure helpers ───────────────────────────────────────────

/**
 * Group a flat player array into consecutive Team pairs for display.
 * Odd trailing player is dropped (they are still tracked in w1/l1).
 */
function toTeamArray(players: string[]): Team[] {
  const teams: Team[] = [];
  for (let i = 0; i + 1 < players.length; i += 2) {
    teams.push([players[i], players[i + 1]] as Team);
  }
  return teams;
}

/** Canonical, order-insensitive key for a teammate pair. */
function pairKey(a: string, b: string): string {
  return [a, b].sort().join('+');
}

/** Canonical, order-insensitive key for a full match between two teams. */
export function teamPairKey(teamA: Team, teamB: Team): string {
  const ka = [...teamA].sort().join('+');
  const kb = [...teamB].sort().join('+');
  return [ka, kb].sort().join('|');
}

/**
 * Score a single team pairing candidate.
 *
 * Lower score = better choice.
 *
 * Penalties applied:
 *   PENALTY_REPEAT_PAIR    × number of repeated teammate pairs in recentPairs
 *   PENALTY_REPEAT_MATCH   if the full match-up appears in recentMatches
 *   PENALTY_FATIGUE        × number of players who just played last match
 *   PENALTY_SKILL_IMBALANCE × |skillA - skillB| (optional, when skillMap provided)
 */
function scoreCandidate(
  teamA: Team,
  teamB: Team,
  recentPairs: string[],
  recentMatches: string[],
  lastMatchPlayers: Set<string>,
  skillMap: Record<string, number>,
): number {
  let score = 0;

  // ── Repeated teammate penalty ─────────────────────────────
  // Each pair that appears in recent memory adds a penalty.
  if (recentPairs.includes(pairKey(teamA[0], teamA[1]))) score += PENALTY_REPEAT_PAIR;
  if (recentPairs.includes(pairKey(teamB[0], teamB[1]))) score += PENALTY_REPEAT_PAIR;

  // ── Repeated match-up penalty ─────────────────────────────
  if (recentMatches.includes(teamPairKey(teamA, teamB))) score += PENALTY_REPEAT_MATCH;

  // ── Fatigue penalty ───────────────────────────────────────
  // Deprioritise players who appeared in the immediately preceding match.
  for (const p of [...teamA, ...teamB]) {
    if (lastMatchPlayers.has(p)) score += PENALTY_FATIGUE;
  }

  // ── Skill-balance penalty (optional) ─────────────────────
  // If a skill map is supplied, penalise unequal team skill totals.
  // This encourages competitive matches without forcing a rigid bracket.
  if (Object.keys(skillMap).length > 0) {
    const skillA = (skillMap[teamA[0]] ?? 50) + (skillMap[teamA[1]] ?? 50);
    const skillB = (skillMap[teamB[0]] ?? 50) + (skillMap[teamB[1]] ?? 50);
    score += Math.abs(skillA - skillB) * PENALTY_SKILL_IMBALANCE;
  }

  return score;
}

/**
 * Enumerate all 3 unique pairings of 4 players and return them as candidates.
 * With 4 players [a, b, c, d] the unique pairings are:
 *   {a+b vs c+d},  {a+c vs b+d},  {a+d vs b+c}
 */
function allPairings(players: [string, string, string, string]): Array<{ teamA: Team; teamB: Team }> {
  const [a, b, c, d] = players;
  return [
    { teamA: [a, b] as Team, teamB: [c, d] as Team },
    { teamA: [a, c] as Team, teamB: [b, d] as Team },
    { teamA: [a, d] as Team, teamB: [b, c] as Team },
  ];
}

/**
 * Derive the set of players who appeared in the last match from recentMatches.
 * Used by the fatigue penalty in scoreCandidate.
 * recentMatches stores keys in format "a+b|c+d"; we parse the last entry.
 */
function lastMatchPlayerSet(recentMatches: string[]): Set<string> {
  if (!recentMatches.length) return new Set();
  const last = recentMatches[recentMatches.length - 1];
  // Format: "sorted_name1+sorted_name2|sorted_name3+sorted_name4"
  return new Set(last.split(/[|+]/));
}

/**
 * formTeams — enhanced team-formation with full scoring.
 *
 * Strategy:
 *   1. Generate all 3 unique pairings of the 4 selected players.
 *   2. Score each pairing with the penalty system.
 *   3. Return the lowest-scoring pairing.
 *   4. On tie, prefer the spec-default P1+P3 vs P2+P4 ordering.
 *   5. If all pairings score identically badly, try up to MAX_SHUFFLE_ATTEMPTS
 *      random arrangements, accepting the first that improves the score.
 *   6. Guaranteed fallback: always returns a valid (non-empty) pairing.
 *
 * The optional skillMap parameter enables skill-balance scoring (task 8).
 */
function formTeams(
  p1: string, p2: string, p3: string, p4: string,
  recentPairs: string[],
  recentMatches: string[],
  lastMatchPlayers: Set<string>,
  skillMap: Record<string, number> = {},
): { teamA: Team; teamB: Team } {
  const players: [string, string, string, string] = [p1, p2, p3, p4];

  // ── Score all 3 unique pairings ───────────────────────────
  const candidates = allPairings(players).map(c => ({
    ...c,
    score: scoreCandidate(c.teamA, c.teamB, recentPairs, recentMatches, lastMatchPlayers, skillMap),
  }));

  // Sort by score ascending; ties broken by original order (P1+P3 first = spec default)
  candidates.sort((a, b) => a.score - b.score);
  const best = candidates[0];

  // ── Shuffle improvement: try wider search if best is still penalised ──
  // Only worth attempting if the best score isn't already clean (0).
  // maxAttempts = 6 (raised from v3's 3).
  if (best.score > 0) {
    for (let attempt = 0; attempt < MAX_SHUFFLE_ATTEMPTS; attempt++) {
      const sh = shuffleArray([...players]) as [string, string, string, string];
      const shuffleCandidates = allPairings(sh).map(c => ({
        ...c,
        score: scoreCandidate(c.teamA, c.teamB, recentPairs, recentMatches, lastMatchPlayers, skillMap),
      }));
      shuffleCandidates.sort((a, b) => a.score - b.score);
      // Accept immediately if we find a strictly lower score than current best.
      if (shuffleCandidates[0].score < best.score) {
        return { teamA: shuffleCandidates[0].teamA, teamB: shuffleCandidates[0].teamB };
      }
    }
  }

  // Guaranteed valid fallback — returns the scored best (never empty strings).
  return { teamA: best.teamA, teamB: best.teamB };
}

/**
 * smartSelectPool — select the best 4 from a candidate window of up to
 * SELECTION_WINDOW players (task 3).
 *
 * Instead of blindly taking w1[0..3], we consider the first SELECTION_WINDOW
 * players and return the 4 whose combined penalty score is lowest. This
 * means we consider:
 *   • How recently each player last played (fatigue — from lastPlayedMap)
 *   • Anti-repetition (recentPairs / recentMatches)
 *   • Skill balance (optional)
 *
 * Selection logic:
 *   1. Take window = candidates.slice(0, SELECTION_WINDOW).
 *   2. For every combination C(n,4) of that window, score the best pairing
 *      of those 4 players using formTeams' scoring.
 *   3. Return the 4-player combination with the lowest score.
 *   4. Preserve FIFO priority by breaking ties in favour of earlier indices.
 *
 * Performance note: C(8,4) = 70 combinations — trivially fast at runtime.
 */
function smartSelectPool(
  candidates: string[],
  recentPairs: string[],
  recentMatches: string[],
  lastMatchPlayers: Set<string>,
  skillMap: Record<string, number>,
): string[] {
  const window = candidates.slice(0, SELECTION_WINDOW);

  if (window.length <= 4) return window.slice(0, 4);

  // Enumerate all 4-player combinations from the window
  let bestScore = Infinity;
  let bestCombo: string[] = window.slice(0, 4); // FIFO fallback

  for (let i = 0; i < window.length - 3; i++) {
    for (let j = i + 1; j < window.length - 2; j++) {
      for (let k = j + 1; k < window.length - 1; k++) {
        for (let l = k + 1; l < window.length; l++) {
          const [a, b, c, d] = [window[i], window[j], window[k], window[l]];

          // Score the best pairing of these 4 players
          const pairings = allPairings([a, b, c, d] as [string, string, string, string]);
          const minPairingScore = Math.min(
            ...pairings.map(p =>
              scoreCandidate(p.teamA, p.teamB, recentPairs, recentMatches, lastMatchPlayers, skillMap),
            ),
          );

          // Additionally penalise if any player is fatigued (just played).
          // This encourages the selector to prefer rested players when possible.
          let comboScore = minPairingScore;
          for (const p of [a, b, c, d]) {
            if (lastMatchPlayers.has(p)) comboScore += PENALTY_FATIGUE;
          }

          // Prefer lower score; ties won by earlier FIFO index (i is smallest)
          if (comboScore < bestScore) {
            bestScore = comboScore;
            bestCombo = [a, b, c, d];
          }
        }
      }
    }
  }

  return bestCombo;
}

/**
 * swapPartners — kept for backward compatibility with any external imports.
 * Internally formTeams() handles all match generation in v4.
 */
export function swapPartners(
  pairA: Team,
  pairB: Team,
  history: string[],
): { teamA: Team; teamB: Team } {
  const primary   = { teamA: [pairA[0], pairB[0]] as Team, teamB: [pairA[1], pairB[1]] as Team };
  const alternate = { teamA: [pairA[0], pairB[1]] as Team, teamB: [pairA[1], pairB[0]] as Team };
  return history.includes(teamPairKey(primary.teamA, primary.teamB)) ? alternate : primary;
}

// ── Pool size balancing ─────────────────────────────────────

/**
 * balancePools — enforce MAX_POOL_SIZE on both W1 and L1 (task 4).
 *
 * If a pool exceeds MAX_POOL_SIZE players, the oldest entries (front of queue)
 * are moved to the other pool. This prevents one side from growing unboundedly
 * when results are lopsided over many consecutive matches.
 *
 * Overflow direction:
 *   W1 overflow → prepend to front of L1 (oldest winners face new challenge)
 *   L1 overflow → prepend to front of W1 (oldest losers get a chance at top)
 */
function balancePools(w1: string[], l1: string[]): { w1: string[]; l1: string[] } {
  let nextW1 = w1;
  let nextL1 = l1;

  // W1 too large: move oldest entries to L1
  if (nextW1.length > MAX_POOL_SIZE) {
    const overflow = nextW1.slice(0, nextW1.length - MAX_POOL_SIZE);
    nextW1 = nextW1.slice(nextW1.length - MAX_POOL_SIZE);
    nextL1 = [...overflow, ...nextL1];
  }

  // L1 too large: move oldest entries to W1
  if (nextL1.length > MAX_POOL_SIZE) {
    const overflow = nextL1.slice(0, nextL1.length - MAX_POOL_SIZE);
    nextL1 = nextL1.slice(nextL1.length - MAX_POOL_SIZE);
    nextW1 = [...nextW1, ...overflow]; // append to back of W1 (lowest priority)
  }

  return { w1: nextW1, l1: nextL1 };
}

// ── State factory ──────────────────────────────────────────

/** Returns a blank PaddleState ready for a new session. */
export function freshPaddleState(): PaddleState {
  return {
    phase: 'INIT',
    matchIndexInPhase: 0,
    matchCount: 0,
    w1: [],
    l1: [],
    waitingQueue: [],
    playedThisCycle: new Set(),
    recentPairs: [],
    recentMatches: [],
    lastPlayedMap: {},
    winnersPool: [],
    losersPool: [],
  };
}

// ── Emergency fallback ─────────────────────────────────────

/** Used when pools have fewer than 4 available players combined. */
function fallbackMatch(available: string[]): Match {
  const unique = available.filter((p, i, a) => p && a.indexOf(p) === i);
  return {
    teamA: [unique[0] ?? '', unique[1] ?? ''] as Team,
    teamB: [unique[2] ?? '', unique[3] ?? ''] as Team,
  };
}

// ── Core: buildNextMatch ───────────────────────────────────

/**
 * buildNextMatch(state, allPlayers, skillMap?) → Match
 *
 * CONTRACT:
 *   • Pure function — does NOT mutate state.
 *   • Reads state.w1 and state.l1 ONLY — never state.waitingQueue.
 *     (All injection is the responsibility of advancePaddleState.)
 *   • Returns a quality-scored, valid Match.
 *
 * Phase dispatch:
 *   INIT    → roster-order seeding (no BYE players).
 *   WINNERS → smartSelectPool from state.w1 (+ L1 top-up if needed).
 *   LOSERS  → smartSelectPool from state.l1 (+ W1 top-up if needed).
 *
 * The optional skillMap enables skill-balance scoring (task 8).
 * Pass a Record<playerName, skillRating> where rating is 0–100.
 */
export function buildNextMatch(
  state: PaddleState,
  allPlayers: string[],
  skillMap: Record<string, number> = {},
): Match {
  const lastMatchPlayers = lastMatchPlayerSet(state.recentMatches);

  // ── INIT phase ──────────────────────────────────────────
  // Match 1 → allPlayers[0..3],  Match 2 → allPlayers[4..7]
  // No smart selection during INIT — preserve pure roster order for seeding.
  if (state.phase === 'INIT') {
    const base = state.matchIndexInPhase * 4;
    const pool = allPlayers.slice(base, base + 4);

    // Pad from earliest available players if pool is short (no __BYE__ ever)
    const padded =
      pool.length >= 4
        ? pool
        : [...pool, ...allPlayers.filter(p => !pool.includes(p))].slice(0, 4);

    if (padded.length < 4) return fallbackMatch(padded);

    return formTeams(
      padded[0], padded[1], padded[2], padded[3],
      state.recentPairs, state.recentMatches, lastMatchPlayers, skillMap,
    );
  }

  // ── WINNERS phase ────────────────────────────────────────
  // Single source of truth: read state.w1 directly.
  // advancePaddleState guarantees all injections are already applied.
  if (state.phase === 'WINNERS') {
    // Build candidate pool: W1 window, topped up from L1 front if needed
    let candidates = [...state.w1];
    if (candidates.length < 4) {
      candidates = [...candidates, ...state.l1.slice(0, 4 - candidates.length)];
    }
    if (candidates.length < 4) return fallbackMatch(candidates);

    // Smart selection: pick best 4 from window of up to SELECTION_WINDOW
    const selected = smartSelectPool(
      candidates, state.recentPairs, state.recentMatches, lastMatchPlayers, skillMap,
    );
    if (selected.length < 4) return fallbackMatch(selected);

    return formTeams(
      selected[0], selected[1], selected[2], selected[3],
      state.recentPairs, state.recentMatches, lastMatchPlayers, skillMap,
    );
  }

  // ── LOSERS phase ─────────────────────────────────────────
  // Single source of truth: read state.l1 directly.
  // No unplayed injection in losers phase (spec §4).
  let candidates = [...state.l1];
  if (candidates.length < 4) {
    candidates = [...candidates, ...state.w1.slice(0, 4 - candidates.length)];
  }
  if (candidates.length < 4) return fallbackMatch(candidates);

  // Smart selection: pick best 4 from window of up to SELECTION_WINDOW
  const selected = smartSelectPool(
    candidates, state.recentPairs, state.recentMatches, lastMatchPlayers, skillMap,
  );
  if (selected.length < 4) return fallbackMatch(selected);

  return formTeams(
    selected[0], selected[1], selected[2], selected[3],
    state.recentPairs, state.recentMatches, lastMatchPlayers, skillMap,
  );
}

// ── Core: advancePaddleState ───────────────────────────────

/**
 * advancePaddleState(state, winnerTeam, loserTeam, allPlayers, skillMap?)
 *
 * Called once per confirmed match result.
 * Returns { nextState, newQueue } ready for the NEXT match.
 *
 * POST-MATCH ROUTING (core AWLQ rule — same for W1 and L1 matches):
 *   • winners → append to BACK of W1
 *   • losers  → append to BACK of L1
 *
 * PHASE TRANSITIONS:
 *   INIT    → WINNERS  after 2nd seeding match
 *   WINNERS → LOSERS   after every single W match (strict 1:1 alternation)
 *   LOSERS  → WINNERS  after every single L match (strict 1:1 alternation)
 *
 * UNPLAYED INJECTION (single source of truth — task 1):
 *   ALL injection of waitingQueue players into W1 happens HERE.
 *   buildNextMatch never touches waitingQueue.
 *
 * POOL BALANCING (task 4):
 *   After routing, balancePools() enforces MAX_POOL_SIZE.
 *
 * FATIGUE TRACKING (task 2):
 *   lastPlayedMap updated with matchCount for all 4 players.
 *
 * CYCLE RESET:
 *   When all rostered players have played since the last reset,
 *   playedThisCycle is cleared to restart the fairness cycle.
 *
 * The optional skillMap is forwarded to buildNextMatch for the next match preview.
 */
export function advancePaddleState(
  state: PaddleState,
  winnerTeam: Team,
  loserTeam: Team,
  allPlayers: string[],
  skillMap: Record<string, number> = {},
): { nextState: PaddleState; newQueue: string[] } {

  const allFour       = [...winnerTeam, ...loserTeam];
  const nextMatchCount = state.matchCount + 1;

  // ── Step 1: Update anti-repetition memory ─────────────────
  // Two pair keys per match (one per team), capped at RECENT_PAIRS_CAP × 2
  const updatedRecentPairs = [
    ...state.recentPairs,
    pairKey(winnerTeam[0], winnerTeam[1]),
    pairKey(loserTeam[0],  loserTeam[1]),
  ].slice(-(RECENT_PAIRS_CAP * 2));

  // One match key per match, capped at RECENT_MATCHES_CAP
  const updatedRecentMatches = [
    ...state.recentMatches,
    teamPairKey(winnerTeam, loserTeam),
  ].slice(-RECENT_MATCHES_CAP);

  // ── Step 2: Update fatigue map ────────────────────────────
  // Record matchCount for every player who just played.
  // scoreCandidate checks lastPlayedMap[p] === matchCount - 1 to detect
  // players who played in the immediately preceding match.
  const updatedLastPlayedMap: Record<string, number> = { ...state.lastPlayedMap };
  for (const p of allFour) {
    updatedLastPlayedMap[p] = state.matchCount; // record *current* matchCount (before increment)
  }

  // ── Step 3: Mark all four players as played this cycle ─────
  const newPlayed = new Set(state.playedThisCycle);
  allFour.forEach(p => newPlayed.add(p));

  // ── Step 4: Remove the 4 played players from all source queues ──
  const playedSet   = new Set(allFour);
  let   nextW1      = state.w1.filter(p => !playedSet.has(p));
  let   nextL1      = state.l1.filter(p => !playedSet.has(p));
  let   nextWaiting = state.waitingQueue.filter(p => !playedSet.has(p));

  // ── Step 5: POST-MATCH ROUTING ────────────────────────────
  // Winners → BACK of W1 | Losers → BACK of L1
  // Identical rule regardless of whether the match came from W1 or L1.
  nextW1 = [...nextW1, ...winnerTeam];
  nextL1 = [...nextL1, ...loserTeam];

  // ── Step 6: Pool size balancing ───────────────────────────
  // Enforce MAX_POOL_SIZE to prevent runaway queue growth.
  ({ w1: nextW1, l1: nextL1 } = balancePools(nextW1, nextL1));

  // ── Step 7: Phase transition ───────────────────────────────
  let nextPhase           = state.phase;
  let nextMatchIndex      = state.matchIndexInPhase + 1;
  let nextPlayedThisCycle = newPlayed;

  if (state.phase === 'INIT') {
    // ── INIT → WINNERS after 2 seeding matches ───────────────
    if (nextMatchIndex >= 2) {
      // Overflow players (beyond first 8) go to waitingQueue
      const seededSet = new Set(allPlayers.slice(0, 8));
      const overflow  = allPlayers.filter(
        p => !seededSet.has(p) && !nextWaiting.includes(p),
      );
      nextWaiting = [...nextWaiting, ...overflow];

      // SINGLE SOURCE OF TRUTH: inject unplayed to FRONT of W1 here
      const unplayed = nextWaiting.filter(p => !nextPlayedThisCycle.has(p));
      nextW1      = [...unplayed, ...nextW1.filter(p => !unplayed.includes(p))];
      nextWaiting = nextWaiting.filter(p => nextPlayedThisCycle.has(p));

      // State transition: INIT → WINNERS
      nextPhase      = 'WINNERS';
      nextMatchIndex = 0;
    }

  } else if (state.phase === 'WINNERS') {
    // ── WINNERS → LOSERS (strict 1-match alternation) ────────
    nextPhase      = 'LOSERS';
    nextMatchIndex = 0;

  } else {
    // ── LOSERS → WINNERS ─────────────────────────────────────
    // Full cycle check: reset fairness when everyone has played
    const allHavePlayed = allPlayers.every(p => nextPlayedThisCycle.has(p));
    if (allHavePlayed) {
      nextPlayedThisCycle = new Set(); // new cycle — everyone is "unplayed"
    }

    // SINGLE SOURCE OF TRUTH: inject unplayed to FRONT of W1 here
    const unplayed = nextWaiting.filter(p => !nextPlayedThisCycle.has(p));
    if (unplayed.length > 0) {
      nextW1      = [...unplayed, ...nextW1.filter(p => !unplayed.includes(p))];
      nextWaiting = nextWaiting.filter(p => nextPlayedThisCycle.has(p));
    }

    // State transition: LOSERS → WINNERS
    nextPhase      = 'WINNERS';
    nextMatchIndex = 0;
  }

  // ── Step 8: Derive display-only Team[] pools ───────────────
  // PaddleStatusPanel reads winnersPool/losersPool as Team[].
  const nextWinnersPool = toTeamArray(nextW1);
  const nextLosersPool  = toTeamArray(nextL1);

  // ── Step 9: Assemble next state ────────────────────────────
  const nextState: PaddleState = {
    phase:             nextPhase,
    matchIndexInPhase: nextMatchIndex,
    matchCount:        nextMatchCount,
    w1:                nextW1,
    l1:                nextL1,
    waitingQueue:      nextWaiting,
    playedThisCycle:   nextPlayedThisCycle,
    recentPairs:       updatedRecentPairs,
    recentMatches:     updatedRecentMatches,
    lastPlayedMap:     updatedLastPlayedMap,
    winnersPool:       nextWinnersPool,
    losersPool:        nextLosersPool,
  };

  // ── Step 10: Pre-compute next match for the flat UI queue ──
  // Queue layout: [teamA[0], teamA[1], teamB[0], teamB[1], ...offCourt]
  const nextMatch = buildNextMatch(nextState, allPlayers, skillMap);
  const onCourt   = new Set([...nextMatch.teamA, ...nextMatch.teamB]);
  const offCourt  = allPlayers.filter(p => !onCourt.has(p));
  const newQueue  = [...nextMatch.teamA, ...nextMatch.teamB, ...offCourt];

  return { nextState, newQueue };
}

// ── Odd-player / live-add handling ────────────────────────

/**
 * addPlayerToWaiting: register a newly added live player.
 *
 * Player enters waitingQueue (FIFO) and will be injected to the FRONT of
 * W1 by advancePaddleState before the next WINNERS match.
 * This guarantees they play before any already-queued player repeats
 * (no BYE, no skip — spec §5).
 */
export function addPlayerToWaiting(
  state: PaddleState,
  playerName: string,
): PaddleState {
  // No-op if already tracked in any active queue
  if (
    state.waitingQueue.includes(playerName) ||
    state.w1.includes(playerName) ||
    state.l1.includes(playerName)
  ) return state;

  return { ...state, waitingQueue: [...state.waitingQueue, playerName] };
}

// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// § 2c  SINGLES KING-OF-THE-COURT ENGINE  (v1)
//
// COMPLETELY ISOLATED from the doubles AWLQ (§ 2b).
// Zero shared state, zero shared logic, zero shared types.
//
// Model: King-of-the-Court + FIFO hybrid
//   • Winner stays on court ("King") to defend against next challenger
//   • Loser goes to BACK of the main queue — classic King-of-the-Court
//   • Two safety valves prevent king domination:
//       1. MAX_WIN_STREAK — forced rotation after N consecutive wins
//       2. Fatigue control — forced rotation if king played last 2 matches
//   • All queue mutations are in advanceSinglesState (pure function)
//   • buildSinglesMatch is a pure reader — never mutates state
//
// Match flow:
//   INIT:  P1 vs P2 (front two from queue)
//   MAIN:  king vs queue.front (next challenger)
//   FORCE: if king hits streak/fatigue → king to back, P1 vs P2 from queue
//
// Complexity: O(n) per transition, n = roster size (≤ 24)
// ═══════════════════════════════════════════════════════════

// ── Types ──────────────────────────────────────────────────

/** A single 1v1 match — always exactly two named players. */
export interface SinglesMatch {
  /** The current King (court holder) or the first queue player in INIT. */
  playerA: string;
  /** The challenger (front of queue) or the second queue player in INIT. */
  playerB: string;
  /** True when a forced rotation triggered this match (no king involved). */
  isForced: boolean;
}

/**
 * Complete singles-queue state.
 * Never mutated; advanceSinglesState always returns a fresh copy.
 */
export interface SinglesState {
  /**
   * Main FIFO queue of challengers waiting to play.
   * In INIT phase: contains all players.
   * Post-INIT: contains players who are NOT the current king.
   */
  queue: string[];

  /**
   * The player currently holding the court (the "King").
   * null during INIT (before any match has been played).
   */
  king: string | null;

  /**
   * Global match counter — incremented after every confirmed result.
   * Used as a clock for lastPlayedMap fatigue calculations.
   */
  matchIndex: number;

  /**
   * Maps player name → matchIndex at which they last played.
   * Used to detect players who played in the immediately preceding match
   * (lastPlayedMap[p] === matchIndex - 1) for fatigue control.
   */
  lastPlayedMap: Record<string, number>;

  /**
   * Maps player name → number of consecutive wins from the current run.
   * Reset to 0 when that player loses or is force-rotated.
   */
  winStreak: Record<string, number>;

  /**
   * Players who have played at least once this cycle.
   * Reset when all rostered players have completed one game.
   */
  playedThisCycle: Set<string>;

  /**
   * Players added mid-session (late joiners).
   * Moved to BACK of main queue before the next match.
   */
  waitingQueue: string[];
}

// ── Constants ──────────────────────────────────────────────

/**
 * Maximum consecutive wins before forcing a king rotation.
 * After MAX_WIN_STREAK wins the king is sent to the back of the queue
 * and the next two players from the front play instead.
 */
export const SINGLES_MAX_WIN_STREAK = 3;

// ── State factory ──────────────────────────────────────────

/**
 * freshSinglesState(players) — initialise state for a new singles session.
 *
 * All players go into the main queue in roster order.
 * The king starts as null; the first buildSinglesMatch call will return
 * queue[0] vs queue[1] as an INIT match.
 */
export function freshSinglesState(players: string[]): SinglesState {
  return {
    queue:           [...players],
    king:            null,
    matchIndex:      0,
    lastPlayedMap:   {},
    winStreak:       {},
    playedThisCycle: new Set(),
    waitingQueue:    [],
  };
}

// ── Pure helpers ───────────────────────────────────────────

/**
 * isFatigued — true when the given player appeared in the immediately
 * preceding match (matchIndex - 1).
 *
 * Used to trigger forced rotation if the king played back-to-back.
 * The spec requires forced rotation if king played in last 2 matches;
 * since the king always plays every match they hold the court, we check
 * whether this would be their 3rd consecutive appearance (matchIndex - 2
 * through current) — i.e., lastPlayedMap[p] === matchIndex - 2 means they
 * played two matches ago and are now about to play again.
 *
 * Implementation: we track whether their last played index is within 2 of
 * the current matchIndex. Since the king plays every match they hold,
 * back-to-back detection is equivalent to checking consecutive appearance.
 */
function isFatigued(player: string, state: SinglesState): boolean {
  const last = state.lastPlayedMap[player];
  if (last === undefined) return false;
  // Fatigued if they played in BOTH of the last two matches
  // (i.e. they have been king for 2+ straight matches already)
  return state.matchIndex - last <= 1;
}

/**
 * isStreakMaxed — true when the king has hit MAX_WIN_STREAK consecutive wins.
 */
function isStreakMaxed(player: string, state: SinglesState): boolean {
  return (state.winStreak[player] ?? 0) >= SINGLES_MAX_WIN_STREAK;
}

/**
 * shouldForceRotation — true when the king must step aside.
 *
 * Conditions (either triggers a force):
 *   1. winStreak[king] >= MAX_WIN_STREAK
 *   2. king played in the last 2 matches (fatigue)
 */
function shouldForceRotation(king: string, state: SinglesState): boolean {
  return isStreakMaxed(king, state) || isFatigued(king, state);
}

/**
 * selectChallenger — pick the best available challenger from the front of
 * the queue, skipping players who played in the immediately preceding match
 * IF an alternative exists.
 *
 * Selection rules (in priority order):
 *   1. Prefer players who have NOT played in the last match (fatigue skip)
 *   2. Among eligible players, take the one at the front of the queue (FIFO)
 *   3. If every player in the queue just played, take queue[0] anyway
 *      (unavoidable with very small player counts)
 *
 * Returns { challenger, remainingQueue } — the player selected and the
 * queue with that player removed.
 */
function selectChallenger(
  queue: string[],
  state: SinglesState,
): { challenger: string; remainingQueue: string[] } {
  if (queue.length === 0) {
    // Should never happen in normal flow; guard for safety
    return { challenger: '', remainingQueue: [] };
  }

  const lastMatchIdx = state.matchIndex - 1;

  // Prefer players who did NOT play in the immediately preceding match
  for (let i = 0; i < queue.length; i++) {
    const candidate = queue[i];
    const lastPlayed = state.lastPlayedMap[candidate] ?? -1;
    if (lastPlayed !== lastMatchIdx) {
      // Found a rested challenger
      const remaining = queue.filter((_, j) => j !== i);
      return { challenger: candidate, remainingQueue: remaining };
    }
  }

  // All candidates just played — fall back to FIFO front
  const [challenger, ...remaining] = queue;
  return { challenger, remainingQueue: remaining };
}

// ── Core: buildSinglesMatch ────────────────────────────────

/**
 * buildSinglesMatch(state) → SinglesMatch
 *
 * CONTRACT:
 *   • Pure function — does NOT mutate state.
 *   • Reads state.queue and state.king only.
 *   • All queue mutations live in advanceSinglesState.
 *
 * Match generation logic:
 *
 *   INIT (king === null):
 *     Match = queue[0] vs queue[1]
 *     isForced = false
 *
 *   FORCED (king hit streak or fatigue limit):
 *     Match = queue[0] vs queue[1]  (king not involved)
 *     isForced = true
 *
 *   NORMAL:
 *     Match = king vs selectChallenger(queue)
 *     isForced = false
 */
export function buildSinglesMatch(state: SinglesState): SinglesMatch {
  // ── INIT: no king yet ────────────────────────────────────
  if (state.king === null) {
    return {
      playerA:  state.queue[0] ?? '',
      playerB:  state.queue[1] ?? '',
      isForced: false,
    };
  }

  // ── FORCED ROTATION ───────────────────────────────────────
  // King has either won too many consecutive games or is fatigued.
  // The king is NOT involved in this match; two fresh players compete.
  if (shouldForceRotation(state.king, state)) {
    return {
      playerA:  state.queue[0] ?? '',
      playerB:  state.queue[1] ?? '',
      isForced: true,
    };
  }

  // ── NORMAL: king defends against next challenger ──────────
  const { challenger } = selectChallenger(state.queue, state);
  return {
    playerA:  state.king,
    playerB:  challenger,
    isForced: false,
  };
}

// ── Core: advanceSinglesState ──────────────────────────────

/**
 * advanceSinglesState(state, winner, allPlayers) → { nextState, newQueue }
 *
 * Called once per confirmed match result.
 * Returns the next state AND the flat queue array the UI should display.
 *
 * State machine transitions:
 *
 *   INIT match (king was null):
 *     winner → becomes king
 *     loser  → goes to BACK of queue
 *
 *   FORCED match (king hit limit):
 *     old king        → goes to BACK of queue (streak and fatigue reset)
 *     match winner    → becomes new king
 *     match loser     → goes to BACK of queue
 *
 *   NORMAL match (king vs challenger):
 *     If king wins:
 *       king stays, winStreak[king]++
 *       challenger → BACK of queue
 *     If challenger wins:
 *       challenger becomes new king, winStreak reset for old king
 *       old king → BACK of queue
 *
 *   LATE JOINERS:
 *     waitingQueue players are moved to BACK of queue before the transition.
 *
 *   CYCLE RESET:
 *     When all rostered players have played ≥ 1 game, playedThisCycle resets.
 *
 * UI queue layout returned:
 *   [king, queue[0], queue[1], ..., queue[n-1]]
 *   The king is always shown first so the UI can highlight them.
 */
export function advanceSinglesState(
  state: SinglesState,
  winner: string,
  allPlayers: string[],
): { nextState: SinglesState; newQueue: string[] } {

  // ── Step 1: Flush late joiners into main queue ────────────
  // waitingQueue players are appended to the BACK of the main queue
  // before any other transition logic runs.
  let nextQueue   = [...state.queue, ...state.waitingQueue];
  let nextWaiting: string[] = [];

  // ── Step 2: Determine match type and the loser ────────────
  const match     = buildSinglesMatch(state);
  const loser     = match.playerA === winner ? match.playerB : match.playerA;
  const wasInit   = state.king === null;
  const wasForced = !wasInit && shouldForceRotation(state.king!, state);

  // ── Step 3: Update fatigue map ────────────────────────────
  const nextLastPlayedMap: Record<string, number> = { ...state.lastPlayedMap };
  nextLastPlayedMap[match.playerA] = state.matchIndex;
  nextLastPlayedMap[match.playerB] = state.matchIndex;

  // ── Step 4: Update playedThisCycle ───────────────────────
  const newPlayed = new Set(state.playedThisCycle);
  newPlayed.add(match.playerA);
  newPlayed.add(match.playerB);

  // Cycle reset: when every rostered player has played, clear the set
  const allHavePlayed = allPlayers.every(p => newPlayed.has(p));
  const nextPlayedThisCycle = allHavePlayed ? new Set<string>() : newPlayed;

  // ── Step 5: Apply transition logic ────────────────────────
  let nextKing: string | null;
  let nextWinStreak: Record<string, number> = { ...state.winStreak };

  if (wasInit) {
    // ── INIT result ────────────────────────────────────────
    // Remove winner and loser from the front of the queue
    // (they were queue[0] and queue[1])
    nextQueue = nextQueue.filter(p => p !== match.playerA && p !== match.playerB);
    // Loser goes to BACK of queue; winner becomes king
    nextQueue = [...nextQueue, loser];
    nextKing  = winner;
    nextWinStreak[winner] = 1; // first win as king

  } else if (wasForced) {
    // ── FORCED rotation result ─────────────────────────────
    // Old king goes to BACK of queue; their streak is reset
    const oldKing = state.king!;
    // Remove the two players who just played from the front of the queue
    nextQueue = nextQueue.filter(p => p !== match.playerA && p !== match.playerB);
    // Loser and old king both go to BACK
    nextQueue = [...nextQueue, loser, oldKing];
    nextKing  = winner;
    // Reset old king's streak; set winner's streak to 1
    nextWinStreak[oldKing] = 0;
    nextWinStreak[winner]  = 1;

  } else {
    // ── NORMAL result ──────────────────────────────────────
    // Challenger was the match opponent — remove them from queue head
    const { remainingQueue } = selectChallenger(nextQueue, state);
    nextQueue = remainingQueue;

    if (winner === state.king) {
      // King wins: stays on court, streak increments, loser (challenger) to back
      nextKing = state.king;
      nextWinStreak[nextKing] = (nextWinStreak[nextKing] ?? 0) + 1;
      nextQueue = [...nextQueue, loser];
    } else {
      // Challenger wins: becomes new king, old king goes to back
      const oldKing = state.king!;
      nextKing = winner;
      nextWinStreak[oldKing] = 0;   // reset old king streak
      nextWinStreak[nextKing] = 1;  // challenger starts fresh as king
      nextQueue = [...nextQueue, oldKing];
    }
  }

  // ── Step 6: Assemble next state ────────────────────────────
  const nextState: SinglesState = {
    queue:           nextQueue,
    king:            nextKing,
    matchIndex:      state.matchIndex + 1,
    lastPlayedMap:   nextLastPlayedMap,
    winStreak:       nextWinStreak,
    playedThisCycle: nextPlayedThisCycle,
    waitingQueue:    nextWaiting,
  };

  // ── Step 7: Build the flat UI queue ───────────────────────
  // Layout: [king (if exists), queue[0], queue[1], ...]
  // The king is always shown first so the current-match UI reads correctly.
  const newQueue = nextKing
    ? [nextKing, ...nextQueue]
    : [...nextQueue];

  return { nextState, newQueue };
}

// ── Live-add handling ──────────────────────────────────────

/**
 * addPlayerToSinglesWaiting — register a late joiner.
 *
 * The player enters waitingQueue and is moved to the BACK of the main
 * queue at the start of the next advanceSinglesState call.
 * No-op if the player is already tracked.
 */
export function addPlayerToSinglesWaiting(
  state: SinglesState,
  playerName: string,
): SinglesState {
  if (
    state.queue.includes(playerName) ||
    state.king === playerName ||
    state.waitingQueue.includes(playerName)
  ) return state;

  return { ...state, waitingQueue: [...state.waitingQueue, playerName] };
}

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
// § 3.5  BRACKET BUILDERS
// ═══════════════════════════════════════════════════════════

function buildSingleElim(entrants: string[]): TournamentMatch[] {
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
      matches.push({
        id: matchId++,
        round,
        slot: Math.floor(i / 2),
        bracket: 'W',
        player1: p1,
        player2: p2,
        winner: null,
        loser: null,
        isBye,
      });
      nextRound.push(p1); // placeholder; will be filled by winner
    }
    currentRound = nextRound;
    round++;
  }

  return matches;
}

function buildDoubleElim(entrants: string[]): TournamentMatch[] {
  const matches: TournamentMatch[] = [];
  let matchId = 1;

  // Winners bracket
  let wbRound = entrants;
  let round = 0;
  const wbMatches: TournamentMatch[] = [];

  while (wbRound.length > 1) {
    for (let i = 0; i < wbRound.length; i += 2) {
      const p1 = wbRound[i];
      const p2 = wbRound[i + 1] ?? null;
      const isBye = p2 === null;
      wbMatches.push({
        id: matchId++,
        round,
        slot: Math.floor(i / 2),
        bracket: 'W',
        player1: p1,
        player2: p2,
        winner: null,
        loser: null,
        isBye,
      });
    }
    wbRound = wbRound.slice(0, Math.ceil(wbRound.length / 2));
    round++;
  }

  matches.push(...wbMatches);

  // Losers bracket (simplified: parallel structure)
  let lbRound = entrants;
  round = 0;
  const lbMatches: TournamentMatch[] = [];

  while (lbRound.length > 1) {
    for (let i = 0; i < lbRound.length; i += 2) {
      const p1 = lbRound[i];
      const p2 = lbRound[i + 1] ?? null;
      const isBye = p2 === null;
      lbMatches.push({
        id: matchId++,
        round,
        slot: Math.floor(i / 2),
        bracket: 'L',
        player1: p1,
        player2: p2,
        winner: null,
        loser: null,
        isBye,
      });
    }
    lbRound = lbRound.slice(0, Math.ceil(lbRound.length / 2));
    round++;
  }

  matches.push(...lbMatches);

  // Grand Final
  matches.push({
    id: matchId++,
    round: 0,
    slot: 0,
    bracket: 'GF',
    player1: null,
    player2: null,
    winner: null,
    loser: null,
    isBye: false,
  });

  return matches;
}

function recordSingleWinner(matches: TournamentMatch[], matchId: number, winner: string): TournamentMatch[] {
  const updated = [...matches];
  const idx = updated.findIndex(m => m.id === matchId);
  if (idx < 0) return updated;

  const match = updated[idx];
  const loser = match.player1 === winner ? match.player2 : match.player1;
  updated[idx] = { ...match, winner, loser };

  // Advance winner to next round
  const nextMatch = updated.find(m => m.round === match.round + 1 && m.slot === Math.floor(match.slot / 2) && (m.player1 === null || m.player1 === match.player1));
  if (nextMatch) {
    const isSlot0 = match.slot % 2 === 0;
    updated[updated.indexOf(nextMatch)] = { ...nextMatch, ...(isSlot0 ? { player1: winner } : { player2: winner }) };
  }

  return updated;
}

function recordDoubleWinner(matches: TournamentMatch[], matchId: number, winner: string): TournamentMatch[] {
  const updated = [...matches];
  const idx = updated.findIndex(m => m.id === matchId);
  if (idx < 0) return updated;

  const match = updated[idx];
  const loser = match.player1 === winner ? match.player2 : match.player1;
  updated[idx] = { ...match, winner, loser };

  // Advance winner in winners/losers bracket
  if (match.bracket === 'W' || match.bracket === 'L') {
    const nextMatch = updated.find(m => m.bracket === match.bracket && m.round === match.round + 1 && m.slot === Math.floor(match.slot / 2) && (m.player1 === null || m.player1 === match.player1));
    if (nextMatch) {
      const isSlot0 = match.slot % 2 === 0;
      updated[updated.indexOf(nextMatch)] = { ...nextMatch, ...(isSlot0 ? { player1: winner } : { player2: winner }) };
    }

    // Loser goes to losers bracket or grand final
    if (match.bracket === 'W' && loser) {
      const lbMatch = updated.find(m => m.bracket === 'L' && m.round === match.round && m.slot === match.slot && m.player1 === null);
      if (lbMatch) {
        updated[updated.indexOf(lbMatch)] = { ...lbMatch, player1: loser };
      }
    }
  }

  // Grand Final: advance from winners bracket finals
  if (match.bracket === 'W' && match.round === Math.max(...updated.filter(m => m.bracket === 'W').map(m => m.round))) {
    const gf = updated.find(m => m.bracket === 'GF');
    if (gf) {
      updated[updated.indexOf(gf)] = { ...gf, player1: winner };
    }
  }

  return updated;
}

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
        {pairs.map((p) => (
          <tr key={`match-${p.n}`} className={p.n === 1 ? 'next-match' : ''}>
            <td className="match-label-cell">
              {p.n === 1 ? <span className="on-court-label">▶ On Court</span> : `Upcoming Match ${p.n - 1}`}
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
        {matches.map((m) => (
          <tr key={`match-${m.n}`} className={m.n === 1 ? 'next-match' : ''}>
            <td className="match-label-cell">
              {m.n === 1 ? <span className="on-court-label">▶ On Court</span> : `Upcoming Match ${m.n - 1}`}
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

  useEffect(() => {
    setScoreA(0); setScoreB(0); setFinished(false); setInDeuce(false); setLimit(baseLimit);
    if (active) onScoreChange?.({ scoreA: 0, scoreB: 0, limit: baseLimit, baseLimit, labelA, labelB, deuce: false, active: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labelA, labelB]);

  const reset = (newBase?: number) => {
    const b = newBase ?? baseLimit;
    setScoreA(0); setScoreB(0); setFinished(false); setInDeuce(false); setLimit(b);
    if (newBase !== undefined) setBaseLimit(b);
    onScoreChange?.({ scoreA: 0, scoreB: 0, limit: b, baseLimit: b, labelA, labelB, deuce: false, active });
  };

  const toggleActive = () => {
    if (active) { reset(); onScoreChange?.(null); } else { onScoreChange?.({ scoreA: 0, scoreB: 0, limit, baseLimit, labelA, labelB, deuce: false, active: true }); }
    setActive(a => !a);
  };

  const increment = (side: 'A' | 'B') => {
    if (finished || disabled) return;
    let nextA = scoreA, nextB = scoreB;
    if (side === 'A') nextA++; else nextB++;
    let nextLimit = limit, nextDeuce = inDeuce;
    if (!inDeuce && nextA === baseLimit - 1 && nextB === baseLimit - 1) { nextLimit = baseLimit + 2; nextDeuce = true; setLimit(nextLimit); setInDeuce(true); }
    else if (inDeuce && nextA === nextLimit - 1 && nextB === nextLimit - 1) { nextLimit = nextLimit + 2; setLimit(nextLimit); }
    setScoreA(nextA); setScoreB(nextB);
    const state: LiveScoreState = { scoreA: nextA, scoreB: nextB, limit: nextLimit, baseLimit, labelA, labelB, deuce: nextDeuce, active: true };
    onScoreChange?.(state);
    if (nextA >= nextLimit) { setFinished(true); onScoreChange?.({ ...state, active: false }); onWin('A', nextA, nextB); }
    else if (nextB >= nextLimit) { setFinished(true); onScoreChange?.({ ...state, active: false }); onWin('B', nextA, nextB); }
  };

  const decrement = (side: 'A' | 'B') => {
    if (finished || disabled) return;
    let nextA = scoreA, nextB = scoreB;
    if (side === 'A' && nextA > 0) nextA--;
    if (side === 'B' && nextB > 0) nextB--;
    setScoreA(nextA); setScoreB(nextB);
    if (inDeuce && !(nextA >= baseLimit - 1 && nextB >= baseLimit - 1)) { setInDeuce(false); setLimit(baseLimit); }
    onScoreChange?.({ scoreA: nextA, scoreB: nextB, limit, baseLimit, labelA, labelB, deuce: inDeuce, active: true });
  };

  const applyCustomLimit = () => {
    const v = parseInt(customLimit, 10);
    if (!isNaN(v) && v > 1) { reset(v); setShowCustom(false); setCustomLimit(''); }
  };

  if (disabled && viewerScore?.active) {
    const vs = viewerScore;
    const aWon = vs.scoreA >= vs.limit, bWon = vs.scoreB >= vs.limit;
    return (
      <div className="scoreboard-wrap scoreboard-wrap--viewer">
        <div className="scoreboard-viewer-label"><Target size={12} /> Live Score{vs.deuce && <span className="deuce-badge">DEUCE</span>}</div>
        <div className="scoreboard scoreboard--viewer">
          <div className={`score-side score-side--a ${aWon ? 'score-side--winner' : ''}`}>
            <div className="score-team-badge score-team-badge--a">Team A</div>
            <div className="score-player-name">{vs.labelA}</div>
            <div className="score-display">{vs.scoreA}</div>
          </div>
          <div className="score-centre"><span className="score-limit-badge">to {vs.limit}</span>{(aWon || bWon) && <div className="score-finished-label">Game Over!</div>}</div>
          <div className={`score-side score-side--b ${bWon ? 'score-side--winner' : ''}`}>
            <div className="score-team-badge score-team-badge--b">Team B</div>
            <div className="score-player-name">{vs.labelB}</div>
            <div className="score-display">{vs.scoreB}</div>
          </div>
        </div>
      </div>
    );
  }
  if (disabled) return null;

  return (
    <div className="scoreboard-wrap">
      <div className="scoreboard-toolbar">
        <button className={`scoreboard-toggle ${active ? 'scoreboard-toggle--on' : ''}`} onClick={toggleActive}><Target size={13} />{active ? 'Scoring ON' : 'Enable Scoring'}</button>
        {active && (
          <div className="score-limit-row">
            <span className="score-limit-label"><Settings size={11} /> Limit:</span>
            {SCORE_PRESETS.map(p => (<button key={p} className={`score-preset-btn ${baseLimit === p && !showCustom ? 'active' : ''}`} onClick={() => { reset(p); setShowCustom(false); }}>{p}</button>))}
            <button className={`score-preset-btn ${showCustom ? 'active' : ''}`} onClick={() => setShowCustom(s => !s)}>Custom</button>
            {showCustom && (<span className="score-custom-wrap"><input type="number" className="score-custom-input" value={customLimit} onChange={e => setCustomLimit(e.target.value)} placeholder="e.g. 15" min={2} onKeyDown={e => e.key === 'Enter' && applyCustomLimit()} /><button className="score-custom-ok" onClick={applyCustomLimit}><Check size={12} /></button></span>)}
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
// § 8b  USER GUIDE MODAL
// ═══════════════════════════════════════════════════════════

const GUIDE_SECTIONS = [
  {
    title: '🚀 Starting a Session',
    body: 'Add 5–24 players, choose Singles or Doubles, then tap Start Queue. Players are queued in the order you enter them. A 4-character Room Code is generated for spectators.',
  },
  {
    title: '🏸 Paddle Queue (Default)',
    body: 'INIT — First 8 players play 2 warm-up matches:\n  Match 1: P1 & P2 vs P3 & P4\n  Match 2: P5 & P6 vs P7 & P8\nThis produces W1, W2 (winner pairs) and L1, L2 (loser pairs).\n\nWINNERS CYCLE:\n• Unplayed players waiting → W1 plays the unplayed pair; winner then faces W2\n• No unplayed → W1 vs W2 (partners swapped: [a,b]+[c,d] → [a,c] vs [b,d])\n\nLOSERS CYCLE (same structure with L1, L2)\n\nCycles alternate Winners → Losers → repeat.\nPartners always swap to avoid repeating the same teams.',
  },
  {
    title: '🔄 Queue Modes',
    body: 'Default (Advanced Paddle Queue) — structured Winners/Losers cycles with unplayed-player prioritisation.\nPlay-All — maximises variety; everyone faces everyone before repeating.\nTournament — single or double elimination bracket, auto-advances.',
  },
  {
    title: '🏆 Scoring',
    body: "Tap + / − next to each team's score. Deuce rule applies: game extends by +2 until one team leads by 2 past the limit. Score auto-resets when the next match begins.",
  },
  {
    title: '📡 Go Live & Sharing',
    body: 'Tap Go Live to allow spectators. Share via QR code, copy link, or native share sheet (WhatsApp/SMS). Viewers see the queue, score, and bracket in real time — no account needed.',
  },
  {
    title: '📊 Stats & Suggestions',
    body: 'Stats tab shows wins, losses, win rate, streak, and rank tiers (Bronze→Diamond). Smart Suggestions alert you to overused/underused players, hot streaks, and unbalanced teams.',
  },
  {
    title: '⚙️ Reset Options',
    body: 'Clear History — wipes match log only; queue and players stay.\nHard Reset — clears ALL cached data and returns to homepage.',
  },
] as const;

const UserGuide: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const [section, setSection] = useState(0);
  useEffect(() => { if (isOpen) setSection(0); }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);
  if (!isOpen) return null;
  const cur = GUIDE_SECTIONS[section];
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content guide-modal" onClick={e => e.stopPropagation()}>
        <div className="guide-header">
          <span className="guide-title">PADQ — User Guide</span>
          <button className="guide-close-x" onClick={onClose} title="Close"><X size={15} /></button>
        </div>
        <div className="guide-nav">
          {GUIDE_SECTIONS.map((s, i) => (
            <button key={i} className={`guide-nav-btn ${i === section ? 'active' : ''}`} onClick={() => setSection(i)}>
              {s.title.split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="guide-body">
          <h3 className="guide-section-title">{cur.title}</h3>
          <p className="guide-section-body">{cur.body}</p>
        </div>
        <div className="guide-footer">
          <button className="guide-arrow" disabled={section === 0} onClick={() => setSection(s => s - 1)}>◀ Prev</button>
          <span className="guide-pager">{section + 1} / {GUIDE_SECTIONS.length}</span>
          <button className="guide-arrow" disabled={section === GUIDE_SECTIONS.length - 1} onClick={() => setSection(s => s + 1)}>Next ▶</button>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// § 8c  PADDLE STATUS PANEL
// ═══════════════════════════════════════════════════════════
// Shows the current paddle cycle state inline above the match section.
// Only visible in Default doubles mode.

const PaddleStatusPanel: React.FC<{
  paddleState: PaddleState;
  allPlayers: string[];
}> = ({ paddleState, allPlayers }) => {
  const { phase, winnersPool: winners, losersPool: losers, playedThisCycle } = paddleState;

  // Don't render until init has produced at least one result
  if (phase === 'INIT' && winners.length === 0 && losers.length === 0) return null;

  // Unplayed = in roster but not in playedThisCycle
  const unplayed = allPlayers.filter(p => !playedThisCycle.has(p));

  const phaseLabel =
    phase === 'INIT'    ? '⚡ Warm-up (2 init matches)' :
    phase === 'WINNERS' ? '🏆 Winners Cycle' :
                          '🔴 Losers Cycle';

  return (
    <div className="paddle-status">
      <div className="paddle-status-header">
        <span className="paddle-phase-label">{phaseLabel}</span>
        {unplayed.length > 0 && (
          <span className="paddle-waiting-badge">
            ⏳ {unplayed.length} waiting
          </span>
        )}
      </div>

      <div className="paddle-pools">
        {/* Winners pool — prefix keys with 'w-' to avoid duplicate keys */}
        {winners.length > 0 && (
          <div className="paddle-pool paddle-pool--w">
            <span className="paddle-pool-tag">W</span>
            <div className="paddle-pool-pairs">
              {winners.map((pair, i) => (
                <span key={`w-${i}`} className={`paddle-pair ${i === 0 ? 'paddle-pair--active' : ''}`}>
                  {pair.join(' & ')}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Losers pool — prefix keys with 'l-' */}
        {losers.length > 0 && (
          <div className="paddle-pool paddle-pool--l">
            <span className="paddle-pool-tag">L</span>
            <div className="paddle-pool-pairs">
              {losers.map((pair, i) => (
                <span key={`l-${i}`} className={`paddle-pair ${i === 0 ? 'paddle-pair--active' : ''}`}>
                  {pair.join(' & ')}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Waiting players */}
      {unplayed.length > 0 && (
        <div className="paddle-unplayed">
          <span className="paddle-unplayed-label">Next unplayed:</span>
          <span className="paddle-unplayed-names">{unplayed.join(' · ')}</span>
        </div>
      )}
    </div>
  );
};


// ═══════════════════════════════════════════════════════════
// § 8d  SINGLES STATUS PANEL
// ═══════════════════════════════════════════════════════════
// Shows the current Singles King-of-the-Court state inline above
// the match section. Only visible in Default singles mode.

const SinglesStatusPanel: React.FC<{
  singlesState: SinglesState;
  allPlayers: string[];
}> = ({ singlesState, allPlayers }) => {
  const { king, winStreak, queue, playedThisCycle } = singlesState;

  // Don't render before the first match
  if (king === null && queue.length < 2) return null;

  const streak   = king ? (winStreak[king] ?? 0) : 0;
  const unplayed = allPlayers.filter(p => !playedThisCycle.has(p));

  return (
    <div className="paddle-status">
      <div className="paddle-status-header">
        <span className="paddle-phase-label">
          {king
            ? <>👑 King: <strong>{king}</strong>{streak > 0 && <span className="paddle-waiting-badge" style={{ marginLeft: 6 }}>🔥 {streak}/{SINGLES_MAX_WIN_STREAK} wins</span>}</>
            : '⚡ Warm-up — first match'}
        </span>
        {unplayed.length > 0 && (
          <span className="paddle-waiting-badge">⏳ {unplayed.length} unplayed</span>
        )}
      </div>

      {/* Challenger queue */}
      {queue.length > 0 && (
        <div className="paddle-pools">
          <div className="paddle-pool paddle-pool--w">
            <span className="paddle-pool-tag">Q</span>
            <div className="paddle-pool-pairs">
              {queue.map((p, i) => (
                <span key={`sq-${i}`} className={`paddle-pair ${i === 0 ? 'paddle-pair--active' : ''}`}>
                  {i === 0 ? '▶ ' : ''}{p}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {unplayed.length > 0 && (
        <div className="paddle-unplayed">
          <span className="paddle-unplayed-label">Next unplayed:</span>
          <span className="paddle-unplayed-names">{unplayed.join(' · ')}</span>
        </div>
      )}
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
  return (<div className="live-panel"><button className="live-panel-toggle" onClick={() => setOpen(o => !o)}><ListOrdered size={13} /> {open ? 'Hide' : 'Manage'} Queue</button>{open && (<div className="mqp-body"><div className="mqp-col"><div className="mqp-col-header"><UserCheck size={11} /> Available</div>{notQueued.length === 0 && <p className="muted-hint">All players queued</p>}{notQueued.map(p => (<button key={p} className="mqp-btn mqp-btn--add" onClick={() => onAdd(p)}><PlusCircle size={11} /><PlayerLabel name={p} statsMap={statsMap} /></button>))}</div><div className="mqp-col"><div className="mqp-col-header"><ListOrdered size={11} /> Queue</div>{queue.length === 0 && <p className="muted-hint">Empty</p>}{queue.map((p, i) => (<button key={p} className="mqp-btn mqp-btn--remove" onClick={() => onRemove(i)}><span className="mqp-pos">#{i + 1}</span><PlayerLabel name={p} statsMap={statsMap} /><X size={10} /></button>))}</div></div>)}</div>);
};

// ═══════════════════════════════════════════════════════════
// § 11  AI / SMART SUGGESTIONS
// ═══════════════════════════════════════════════════════════

const SUGGESTION_ICONS: Record<SmartSuggestion['type'], React.ReactNode> = { 'overused': <AlertTriangle size={13} />, 'underused': <ThumbsUp size={13} />, 'hot-streak': <Flame size={13} />, 'team-balance': <Brain size={13} /> };
const SUGGESTION_COLORS: Record<SmartSuggestion['type'], string> = { 'overused': '#f59e0b', 'underused': '#22c55e', 'hot-streak': '#ef4444', 'team-balance': '#6366f1' };

const SmartSuggestions: React.FC<{ suggestions: SmartSuggestion[] }> = ({ suggestions }) => {
  if (!suggestions.length) return null;
  return (<div className="smart-suggestions"><div className="smart-header"><Brain size={13} /> Smart Suggestions</div>{suggestions.map((s, i) => (<div key={`${s.type}-${i}`} className="smart-card" style={{ '--sc': SUGGESTION_COLORS[s.type] } as React.CSSProperties}><span className="smart-icon">{SUGGESTION_ICONS[s.type]}</span><span className="smart-message">{s.message}</span></div>))}</div>);
};

// ═══════════════════════════════════════════════════════════
// § 12  SESSION BAR
// ═══════════════════════════════════════════════════════════

const SessionBar: React.FC<{
  sessionId:   string | null;
  isHost:      boolean;
  isConnected: boolean;
  isSaving:    boolean;
}> = ({ sessionId, isHost, isConnected, isSaving }) => {
  if (!sessionId) return null;
  return (
    <div className={`session-bar ${isHost ? 'session-bar--host' : 'session-bar--viewer'}`}>
      <span className={`session-dot ${isConnected ? 'session-dot--live' : 'session-dot--offline'}`} />
      <span className="session-status-text">{isSaving ? 'Saving…' : isConnected ? 'Connected' : 'Connecting…'}</span>
      <span className="session-label">Room:</span>
      <span className="session-code">{sessionId}</span>
      <span className={`session-role-badge ${!isHost ? 'session-role-badge--viewer' : ''}`}>{isHost ? 'HOST' : 'WATCHING'}</span>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════
// § 12b  SHARE BUTTON
// ═══════════════════════════════════════════════════════════

/**
 * ShareButton — Explicit "Go Live" toggle
 */
const ShareButton: React.FC<{
  sessionId: string;
  isLive:    boolean;
  onToggle:  (live: boolean) => void;
}> = ({ sessionId, isLive, onToggle }) => {
  const [open,       setOpen]      = useState(false);
  const [tab,        setTab]       = useState<'share' | 'code' | 'qr'>('share');
  const [copied,     setCopied]    = useState(false);
  const [justShared, setJustShared] = useState(false);

  const [watchUrl, setWatchUrl] = useState(`/watch/${sessionId}`);
  useEffect(() => { setWatchUrl(`${window.location.origin}/watch/${sessionId}`); }, [sessionId]);

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  const handleGoLive = () => { const next = !isLive; onToggle(next); if (next) setOpen(true); };
  const copyLink = () => { navigator.clipboard.writeText(watchUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const nativeShare = async () => {
    try { await navigator.share({ title: `PADQ — Watch Session ${sessionId}`, text: `Watch this live session! Room code: ${sessionId}`, url: watchUrl }); setJustShared(true); setTimeout(() => setJustShared(false), 2000); } catch { /* cancelled */ }
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.share-popover-wrap')) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="share-popover-wrap">
      <button
        className={`share-trigger ${isLive ? 'share-trigger--is-live' : 'share-trigger--offline'} ${open && isLive ? 'share-trigger--active' : ''}`}
        onClick={isLive ? () => setOpen(o => !o) : handleGoLive}
        title={isLive ? 'Session is live — click to manage sharing' : 'Go live so viewers can join'}
      >
        {isLive ? <><span className="go-live-dot" /> LIVE</> : <><QrCode size={13} /> Go Live</>}
      </button>

      {open && isLive && (
        <div className="share-popover">
          <div className="share-popover-header">
            <span className="share-popover-title"><span className="go-live-dot go-live-dot--sm" /> Session Live</span>
            <button className="share-popover-close" onClick={() => setOpen(false)}><X size={14} /></button>
          </div>
          <div className="share-code-hero">
            <span className="share-code-label">Room Code</span>
            <span className="share-code-big">{sessionId}</span>
          </div>
          <div className="share-tabs">
            {canNativeShare && <button className={`share-tab ${tab === 'share' ? 'active' : ''}`} onClick={() => setTab('share')}>Share</button>}
            <button className={`share-tab ${tab === 'code' ? 'active' : ''}`} onClick={() => setTab('code')}>Link</button>
            <button className={`share-tab ${tab === 'qr' ? 'active' : ''}`} onClick={() => setTab('qr')}>QR</button>
          </div>
          {tab === 'share' && canNativeShare && (
            <div className="share-code-view">
              <p className="share-hint">Send via WhatsApp, SMS, or any app</p>
              <button className={`share-native-btn ${justShared ? 'share-native-btn--done' : ''}`} onClick={nativeShare}>
                {justShared ? <><Check size={15} /> Shared!</> : <><ExternalLink size={15} /> Share Link</>}
              </button>
              <p className="share-hint share-hint--sm">Viewers open the link → watch live</p>
            </div>
          )}
          {tab === 'code' && (
            <div className="share-code-view">
              <p className="share-hint">Copy the full watch link</p>
              <div className="share-url-row"><span className="share-url-text">{watchUrl}</span></div>
              <div className="share-actions">
                <button className="share-action share-action--copy" onClick={copyLink}>{copied ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Link</>}</button>
                <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="share-action share-action--open"><ExternalLink size={13} /> Open</a>
              </div>
            </div>
          )}
          {tab === 'qr' && (
            <div className="share-qr-view">
              <div className="share-qr-wrap"><QRCodeSVG value={watchUrl} size={180} bgColor="#ffffff" fgColor="#1e293b" level="M" includeMargin={false} /></div>
              <p className="share-hint share-hint--sm">Scan to open the watch page instantly</p>
            </div>
          )}
          <div className="share-end-row">
            <button className="share-end-btn" onClick={() => { onToggle(false); setOpen(false); }}>End Live Session</button>
          </div>
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
    if (!session.isConnected || !session.queue.length || session.isSaving) return;
    if (session.queue.join(',') !== queue.join(',')) setQueue(session.queue);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.queue, session.isConnected, session.isSaving]);

  // UI-only state
  const [tempPlayers,  setTempPlayers]  = useState<string[]>([]);
  const [currentName,  setCurrentName]  = useState('');
  const [modalOpen,    setModalOpen]    = useState(false);
  const [modalWinner,  setModalWinner]  = useState('');
  const [modalScore,   setModalScore]   = useState<string | undefined>(undefined);
  const [autoClose,    setAutoClose]    = useState(false);
  const [showHistory,  setShowHistory]  = useState(true);
  const [darkMode,     setDarkMode]     = useState(true);
  const [activeTab,    setActiveTab]    = useState<GameTab>('queue');
  const [liveScore,    setLiveScore]    = useState<LiveScoreState | null>(null);
  const [isLiveLocal,  setIsLiveLocal]  = useState(false);
  const [showGuide,    setShowGuide]    = useState(false);

  // ── Doubles Paddle Queue state ─────────────────────────────────────────────
  // Stored in a ref so handleDoublesMatch can read/write synchronously without
  // stale-closure issues. A separate React state copy drives re-renders for the
  // PaddleStatusPanel display.
  const paddleStateRef                              = useRef<PaddleState>(freshPaddleState());
  const [paddleStateUI, setPaddleStateUI]           = useState<PaddleState>(freshPaddleState());

  const resetPaddleState = useCallback(() => {
    const fresh = freshPaddleState();
    paddleStateRef.current = fresh;
    setPaddleStateUI(fresh);
  }, []);

  // ── Singles King-of-the-Court state ────────────────────────────────────────
  // Mirrors the doubles pattern: ref for synchronous reads in handlers,
  // state copy for SinglesStatusPanel re-renders.
  const singlesStateRef                              = useRef<SinglesState>(freshSinglesState([]));
  const [singlesStateUI, setSinglesStateUI]          = useState<SinglesState>(freshSinglesState([]));

  const resetSinglesState = useCallback((playerList: string[]) => {
    const fresh = freshSinglesState(playerList);
    singlesStateRef.current = fresh;
    setSinglesStateUI(fresh);
  }, []);

  // getPartneredQueue: players always start in roster order (no shuffle)
  const getPartneredQueue = useCallback((pList: string[]) => [...pList], []);

  // Sync session.isLive → local
  useEffect(() => { setIsLiveLocal(session.isLive ?? false); }, [session.isLive]);

  const handleGoLive = (live: boolean) => {
    setIsLiveLocal(live);
    if (session.sessionId) session.syncField({ isLive: live });
  };

  // Debounced score writes
  const scoreWriteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleScoreChange = (score: LiveScoreState | null) => {
    setLiveScore(score);
    if (!session.sessionId) return;
    if (scoreWriteTimer.current) clearTimeout(scoreWriteTimer.current);
    scoreWriteTimer.current = setTimeout(() => { session.syncField({ liveScore: score }); }, 300);
  };

  // Persisted state — local fallbacks when not connected
  const [localQueueMode,        setLocalQueueMode]        = useState<QueueMode>('default');
  const [localElimType,         setLocalElimType]         = useState<EliminationType>('single');
  const [localTournamentM,      setLocalTournamentM]      = useState<TournamentMatch[]>([]);
  const [localTournamentActive, setLocalTournamentActive] = useState(false);
  const [localTournamentWinner, setLocalTournamentWinner] = useState<string | null>(null);
  const [localHistory,          setLocalHistory]          = useState<MatchHistoryEntry[]>([]);

  const setQueueMode       = (m: QueueMode)          => { setLocalQueueMode(m); if (session.sessionId) session.syncField({ queueMode: m }); };
  const setElimType        = (t: EliminationType)    => { setLocalElimType(t); if (session.sessionId) session.syncField({ elimType: t }); };
  const setTournamentMatches = (tm: TournamentMatch[]) => { setLocalTournamentM(tm); if (session.sessionId) session.syncField({ tournamentMatches: tm }); };
  const setTournamentActive  = (v: boolean)          => { setLocalTournamentActive(v); if (session.sessionId) session.syncField({ tournamentActive: v }); };
  const setTournamentWinner  = (w: string | null)    => { setLocalTournamentWinner(w); if (session.sessionId) session.syncField({ tournamentWinner: w }); };

  const addHistory = (entry: MatchHistoryEntry, newQueue?: string[]) => {
    setLocalHistory(prev => [entry, ...prev]);
    const queueToCommit = newQueue ?? queue;
    if (session.sessionId) session.commitMatchResult(
      { queue: queueToCommit },
      { id: entry.id, mode: entry.mode, players: entry.players, winner: entry.winner, score: entry.score, timestamp: entry.timestamp }
    );
  };

  // Resolved active values
  const activeQueueMode        = session.isConnected ? session.queueMode         : localQueueMode;
  const activeElimType         = session.isConnected ? session.elimType          : localElimType;
  const activeTournamentM      = session.isConnected && session.tournamentMatches?.length > 0 ? session.tournamentMatches : localTournamentM;
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
  useEffect(() => { document.body.classList.toggle('dark-mode', darkMode); }, [darkMode]);
  useLayoutEffect(() => { document.body.classList.add('dark-mode'); }, []);
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

  // ── Handlers ──────────────────────────────────────────────────────────────

  const addTempPlayer = () => {
    const t = currentName.trim();
    if (!t) return;
    if (tempPlayers.includes(t)) { alert('Player already added'); return; }
    setTempPlayers(prev => [...prev, t]); setCurrentName('');
  };
  const removeTempPlayer = (i: number) => setTempPlayers(prev => prev.filter((_, j) => j !== i));

  const handleStartQueue = async () => {
    if (tempPlayers.length < 5 || tempPlayers.length > 24) { alert(`Need 5–24 players. Currently: ${tempPlayers.length}`); return; }
    const orderedPlayers = getPartneredQueue(tempPlayers);
    resetPaddleState();              // fresh doubles cycle
    resetSinglesState(tempPlayers); // fresh singles cycle
    setPlayers(tempPlayers); setTempPlayers([]); setLocalHistory([]);
    setLocalTournamentActive(false); setLocalTournamentWinner(null); setLocalTournamentM([]);
    let initialBracket: TournamentMatch[] = [];
    if (localQueueMode === 'tournament') {
      const shuffled = shuffleArray(orderedPlayers);
      const bracketEntrants = gameMode === 'doubles'
        ? shuffled.reduce<string[]>((acc, _, i) => {
            if (i % 2 === 0 && i + 1 < shuffled.length) acc.push(`${shuffled[i]} & ${shuffled[i + 1]}`);
            else if (i % 2 === 0) acc.push(shuffled[i]);
            return acc;
          }, [])
        : shuffled;
      initialBracket = localElimType === 'single' ? buildSingleElim(bracketEntrants) : buildDoubleElim(bracketEntrants);
      setLocalTournamentM(initialBracket); setLocalTournamentActive(true);
    }
    await session.startSession({ gameMode: gameMode ?? 'singles', queueMode: localQueueMode, elimType: localElimType, players: tempPlayers, queue: orderedPlayers, playAllRel: {}, tournamentMatches: initialBracket, tournamentActive: localQueueMode === 'tournament', tournamentWinner: null, isLive: false });
  };

  const initTournament = useCallback((playerList: string[], type: EliminationType) => {
    const shuffled = shuffleArray(playerList);
    const entrants = gameMode === 'doubles'
      ? shuffled.reduce<string[]>((acc, _, i) => {
          if (i % 2 === 0) acc.push(i + 1 < shuffled.length ? `${shuffled[i]} & ${shuffled[i + 1]}` : shuffled[i]);
          return acc;
        }, [])
      : shuffled;
    const bracket = type === 'single' ? buildSingleElim(entrants) : buildDoubleElim(entrants);
    setTournamentMatches(bracket); setTournamentActive(true); setTournamentWinner(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameMode]);

  const handleTournamentMatch = (matchId: number, winner: string) => {
    const match = activeTournamentM.find(m => m.id === matchId)!;
    addHistory({ id: Date.now(), mode: 'Tournament', players: `${match.player1} vs ${match.player2 || 'Bye'}`, winner, timestamp: new Date().toLocaleTimeString() }, queue);
    const updated = activeElimType === 'single' ? recordSingleWinner(activeTournamentM, matchId, winner) : recordDoubleWinner(activeTournamentM, matchId, winner);
    setTournamentMatches(updated);
    const gfMatch = updated.find(m => m.bracket === 'GF');
    const lastWbM = activeElimType === 'single' ? (() => { const by: Record<number, TournamentMatch[]> = {}; updated.forEach(m => { (by[m.round] ??= []).push(m); }); return by[Math.max(...Object.keys(by).map(Number))]?.[0]; })() : null;
    const champion = gfMatch?.winner ?? lastWbM?.winner;
    if (champion) { setTournamentWinner(champion); setModalWinner(`${champion} is the tournament champion! 🏆`); setModalScore(undefined); setModalOpen(true); }
  };

  const handleRandomize = () => {
    if (activeQueueMode === 'tournament') { initTournament(players, activeElimType); return; }
    randomizeQueue();
    if (activeQueueMode === 'playall') resetPlayAllRelationships();
  };
  const handleElimTypeChange = (type: EliminationType) => {
    setElimType(type);
    if (activeQueueMode === 'tournament' && players.length > 0) { initTournament(players, type); setLocalHistory([]); }
  };
  const handleModeChange = (newMode: QueueMode) => {
    setQueueMode(newMode);
    if (newMode === 'tournament' && players.length > 0) initTournament(players, activeElimType);
    else if (newMode !== 'tournament') { setTournamentActive(false); setTournamentWinner(null); setTournamentMatches([]); }
    if (newMode === 'playall') resetPlayAllRelationships();
    // Reset both engines when switching to default
    if (newMode === 'default') { resetPaddleState(); resetSinglesState(players); }
  };

  const handleSinglesMatch = (winner: string, score?: string) => {
    const [p1, p2] = [queue[0], queue[1]];
    playSingles(winner);
    if (activeQueueMode === 'playall') recordPlayAllSingles(p1, p2);

    let newQueue: string[];

    if (activeQueueMode === 'default' && gameMode === 'singles') {
      // ── Singles King-of-the-Court engine (§ 2c) ────────────────────────
      // advanceSinglesState handles king tracking, win-streak enforcement,
      // fatigue control, forced rotations, and cycle fairness.
      const { nextState, newQueue: singlesQueue } = advanceSinglesState(
        singlesStateRef.current,
        winner,
        players,
      );
      singlesStateRef.current = nextState;
      setSinglesStateUI(nextState);
      newQueue = singlesQueue;
    } else {
      // Play-All / tournament fallback: simple loser-front rotation
      const rest = queue.slice(2);
      const loser = winner === p1 ? p2 : p1;
      newQueue = [loser, ...rest, winner];
    }

    setQueue(newQueue);
    addHistory({ id: Date.now(), mode: 'Singles', players: `${p1} vs ${p2}`, winner, score, timestamp: new Date().toLocaleTimeString() }, newQueue);
    setModalWinner(`${winner} wins!`); setModalScore(score); setModalOpen(true);
  };

  const handleDoublesMatch = (a: string[], b: string[], w: 'A' | 'B', score?: string) => {
    playDoubles([...a], [...b], w);
    if (activeQueueMode === 'playall') recordPlayAllDoubles(a, b);

    const winnerTeam = (w === 'A' ? a : b) as [string, string];
    const loserTeam  = (w === 'A' ? b : a) as [string, string];
    const winnerNames = winnerTeam.join(' & ');

    let newQueue: string[];

    if (activeQueueMode === 'default' && gameMode === 'doubles') {
      // ── Advanced Paddle Queue ───────────────────────────────────��──────────
      // advancePaddleState (§ 2b) handles all cycle logic:
      //   • Init phase: records first 2 match results into W/L pools
      //   • Winners/Losers phases: applies swap + unplayed prioritisation
      //   • Returns next paddle state AND the new flat queue
      const { nextState, newQueue: paddleQueue } = advancePaddleState(
        paddleStateRef.current,
        winnerTeam,
        loserTeam,
        players,    // full roster in original setup order
      );
      paddleStateRef.current = nextState;
      setPaddleStateUI(nextState); // trigger PaddleStatusPanel re-render
      newQueue = paddleQueue;

    } else {
      // Fallback for Play-All and other modes: standard loser-front rotation
      const rest = queue.slice(4);
      newQueue = [...loserTeam, ...rest, ...winnerTeam];
    }

    setQueue(newQueue);
    addHistory(
      { id: Date.now(), mode: 'Doubles', players: `${a.join(' & ')} vs ${b.join(' & ')}`, winner: winnerNames, score, timestamp: new Date().toLocaleTimeString() },
      newQueue
    );
    setModalWinner(`${winnerNames} win!`); setModalScore(score); setModalOpen(true);
  };

  const handleAddPlayerLive = (name: string) => {
    if (players.includes(name)) { alert('Player already exists'); return; }
    const np = [...players, name], nq = [...queue, name];
    setPlayers(np); setQueue(nq);
    // ── NEW: register for waiting-queue injection (odd-player handling)
    if (activeQueueMode === 'default' && gameMode === 'doubles') {
      const newPaddleState = addPlayerToWaiting(paddleStateRef.current, name);
      paddleStateRef.current = newPaddleState;
      setPaddleStateUI(newPaddleState);
    }
    // ── END NEW
    if (session.sessionId) session.syncField({ players: np, queue: nq });
  };

  const handleFullReset = async () => {
    if (!confirm('Clear all match history? The queue and players will stay.')) return;
    setLocalHistory([]);
    await session.clearMatchHistory();
  };

  const handleHardReset = () => {
    if (!confirm('Hard Reset will clear ALL cached data including your session. Continue?')) return;
    try { localStorage.clear(); sessionStorage.clear(); } catch { /* ignore */ }
    window.location.href = '/';
  };

  // ── Shared fragments ───────────────────────────────────────────────────────
  const canControl = !session.sessionId || session.isHost;
  const modeSelector = (<div className="mode-selector">{(['default', 'tournament', 'playall'] as const).map(m => (<button key={m} className={`mode-btn ${activeQueueMode === m ? 'active' : ''}`} onClick={() => canControl && handleModeChange(m)} disabled={!canControl}>{m === 'default' && <><Swords size={12} /> Default</>}{m === 'tournament' && <><Trophy size={12} /> Tournament</>}{m === 'playall' && <><Star size={12} /> Play‑all</>}</button>))}</div>);
  const elimSelector = activeQueueMode === 'tournament' && (<div className="elim-selector">{(['single', 'double'] as const).map(t => (<button key={t} className={`elim-btn ${activeElimType === t ? 'active' : ''}`} onClick={() => canControl && handleElimTypeChange(t)}>{t === 'single' ? 'Single Elim' : 'Double Elim'}</button>))}</div>);
  const uiControls = (<div className="ui-controls"><button className="control-btn" onClick={() => setShowHistory(h => !h)}><History size={12} /> {showHistory ? 'Hide' : 'Show'} History</button></div>);
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
        <div className="topright-controls">
          <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
          {session.isHost && session.sessionId && <ShareButton sessionId={session.sessionId!} isLive={isLiveLocal} onToggle={handleGoLive} />}
          {canControl && <button className="hard-reset-btn" onClick={handleHardReset} title="Hard Reset"><RotateCcw size={13} /> Hard Reset</button>}
          <button className="help-btn" onClick={() => setShowGuide(true)} title="User Guide">?</button>
        </div>
        <button className="back-home" onClick={() => router.push('/')}><ArrowLeft size={14} /> Back</button>
        <SessionBar sessionId={session.sessionId} isHost={session.isHost} isConnected={session.isConnected} isSaving={session.isSaving} />
        {session.isExpired && (<div className="session-alert session-alert--expired"><WifiOff size={14} /> Session expired. <button onClick={() => router.push('/')}>Go Home</button></div>)}
        {session.isReconnecting && !session.isExpired && (<div className="session-alert session-alert--reconnecting"><Wifi size={14} /> Reconnecting…</div>)}
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
                    {`${pendingMatch.player1} vs ${pendingMatch.player2}`}
                  </h3>
                  {gameMode === 'doubles' ? (
                    <>
                      <div className="team-display-row">
                        <div className="tourn-team-block"><span className="tourn-team-label tourn-team-label--a">Team A</span><span className="team-chip team-chip--a">{pendingMatch.player1}</span></div>
                        <span className="vs-sep">vs</span>
                        <div className="tourn-team-block"><span className="tourn-team-label tourn-team-label--b">Team B</span><span className="team-chip team-chip--b">{pendingMatch.player2}</span></div>
                      </div>
                      <ScoreBoard labelA={pendingMatch.player1!} labelB={pendingMatch.player2!} disabled={!session.isHost} onScoreChange={session.isHost ? handleScoreChange : undefined} viewerScore={!session.isHost ? (session.liveScore ?? null) : null} onWin={(side) => { if (!session.isHost) return; handleTournamentMatch(pendingMatch.id, side === 'A' ? pendingMatch.player1! : pendingMatch.player2!); }} />
                      {session.isHost && (<div className="winning-team"><span className="winning-label">Winner:</span><button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player1!)}><Trophy size={12} /> {pendingMatch.player1}</button><button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player2!)}><Trophy size={12} /> {pendingMatch.player2}</button></div>)}
                    </>
                  ) : (
                    <>
                      <ScoreBoard labelA={pendingMatch.player1!} labelB={pendingMatch.player2!} disabled={!session.isHost} onScoreChange={session.isHost ? handleScoreChange : undefined} viewerScore={!session.isHost ? (session.liveScore ?? null) : null} onWin={(side) => { if (!session.isHost) return; handleTournamentMatch(pendingMatch.id, side === 'A' ? pendingMatch.player1! : pendingMatch.player2!); }} />
                      {session.isHost && (<div className="match-buttons" style={{ marginTop: 14 }}><button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player1!)}><Trophy size={12} /> {pendingMatch.player1}</button><button onClick={() => handleTournamentMatch(pendingMatch.id, pendingMatch.player2!)}><Trophy size={12} /> {pendingMatch.player2}</button></div>)}
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
        <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
      </div>
    );
  }

  // ── RENDER C — Default / Play-all ─────────────────────────
  return (
    <div className={`queue-system game-view ${darkMode ? 'dark' : ''}`}>
      <div className="topright-controls">
        <button className="dark-mode-toggle" onClick={() => setDarkMode(d => !d)}>{darkMode ? <Sun size={17} /> : <Moon size={17} />}</button>
        {session.isHost && session.sessionId && <ShareButton sessionId={session.sessionId!} isLive={isLiveLocal} onToggle={handleGoLive} />}
        {canControl && <button className="hard-reset-btn" onClick={handleHardReset} title="Hard Reset"><RotateCcw size={13} /> Hard Reset</button>}
        <button className="help-btn" onClick={() => setShowGuide(true)} title="User Guide">?</button>
      </div>

      <button className="back-home" onClick={() => router.push('/')}><ArrowLeft size={14} /> Back</button>
      <SessionBar sessionId={session.sessionId} isHost={session.isHost} isConnected={session.isConnected} isSaving={session.isSaving} />

      {session.isExpired && (<div className="session-alert session-alert--expired"><WifiOff size={14} /> Session expired. Your data has been cleared.{' '}<button onClick={() => router.push('/')}>Go Home</button></div>)}
      {session.isReconnecting && !session.isExpired && (<div className="session-alert session-alert--reconnecting"><Wifi size={14} /> Reconnecting to session…</div>)}

      {modeSelector}{uiControls}{tabBar}
      {!session.isHost && session.sessionId && (<div className="viewer-banner"><Wifi size={13} /> Watching live — only the host can make changes.</div>)}

      {activeTab === 'analytics' ? <AnalyticsDashboard stats={statsList} /> : (
        <div className="main-layout">
          <div className="queue-area">
            <h1 className="queue-title">{gameMode === 'singles' ? <Swords size={19} /> : <Users size={19} />}{gameMode === 'singles' ? 'Singles' : 'Doubles'} Queue</h1>

            {/* Mode description */}
            {activeQueueMode === 'default' && (
              <p className="mode-description">
                <Trophy size={11} className="mode-desc-icon" />
                Advanced Paddle Queue · Winners &amp; Losers cycles · Partners always swap
              </p>
            )}
            {activeQueueMode === 'playall' && (<p className="mode-description"><Sparkles size={11} className="mode-desc-icon" /> Every player faces everyone before repeating</p>)}

            <div className="queue-header-row">
              {session.isHost && activeQueueMode === 'playall' && (
                <button onClick={() => { randomizeQueue(); resetPlayAllRelationships(); }} className="randomize-btn"><RefreshCw size={12} /> Reset Play-All</button>
              )}
            </div>

            {/* Live tools */}
            {session.isHost && (
              <div className="live-tools-row">
                <AddPlayerPanel onAdd={handleAddPlayerLive} />
                <ManualQueuePanel allPlayers={players} queue={queue} statsMap={statsMap}
                  onAdd={p => { const nq = [...queue, p]; setQueue(nq); if (session.sessionId) session.syncField({ queue: nq }); }}
                  onRemove={i => { const nq = queue.filter((_, j) => j !== i); setQueue(nq); if (session.sessionId) session.syncField({ queue: nq }); }}
                />
              </div>
            )}

            {/* Paddle Status Panel — only in Default doubles */}
            {activeQueueMode === 'default' && gameMode === 'doubles' && (
              <PaddleStatusPanel paddleState={paddleStateUI} allPlayers={players} />
            )}

            {/* Singles Status Panel — only in Default singles */}
            {activeQueueMode === 'default' && gameMode === 'singles' && (
              <SinglesStatusPanel singlesState={singlesStateUI} allPlayers={players} />
            )}

            {/* Current Match */}
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
            {gameMode === 'doubles' && queue.length >= 4 && (
              <DoublesMatch
                firstFour={firstFour}
                suggestedTeamA={playAllSuggestion?.suggestedTeamA ?? null}
                suggestedTeamB={playAllSuggestion?.suggestedTeamB ?? null}
                playAllScore={playAllSuggestion?.score ?? null}
                statsMap={statsMap}
                isHost={session.isHost}
                onMatch={handleDoublesMatch}
                onScoreChange={session.isHost ? handleScoreChange : undefined}
                viewerScore={!session.isHost ? (session.liveScore ?? null) : null}
              />
            )}
            {gameMode === 'singles' && queue.length < 2 && <p className="muted-hint">Not enough players for a match.</p>}
            {gameMode === 'doubles' && queue.length < 4 && <p className="muted-hint">Not enough players for a match.</p>}

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
      <UserGuide isOpen={showGuide} onClose={() => setShowGuide(false)} />
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