import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'queue_app';

interface QueueState {
  gameMode: 'singles' | 'doubles' | null;
  players: string[];
  queue: string[];
}

// ---------------------------------------------------------------------------
// Play-All relationship tracking
// ---------------------------------------------------------------------------
// We track how many times each directional relationship has occurred so that
// we can always prefer "least-played" combinations once a full round-robin is
// complete, rather than hard-resetting or getting stuck.
//
//   teammates[key]  — key is the sorted pair "A+B", value is play-count
//   opponents[key]  — key is the sorted pair "A|B" (cross-team), value is play-count
//
// Both maps are kept outside React state (refs would also work) because they
// are derived bookkeeping data, not display state. They ARE serialised into
// sessionStorage alongside the queue state so a page refresh doesn't lose
// history.

export interface PlayAllRelationships {
  teammates: Record<string, number>;   // "Alice+Bob" → count
  opponents: Record<string, number>;   // "Alice|Carol" → count
}

// Stable sorted pair key helpers
const teammateKey = (a: string, b: string) =>
  [a, b].sort().join('+');

const opponentKey = (a: string, b: string) =>
  [a, b].sort().join('|');

// ---------------------------------------------------------------------------
// Record a completed doubles match into the relationship maps (mutates)
// ---------------------------------------------------------------------------
export function recordDoublesRelationships(
  teamA: string[],
  teamB: string[],
  rel: PlayAllRelationships
): PlayAllRelationships {
  const next: PlayAllRelationships = {
    teammates: { ...rel.teammates },
    opponents: { ...rel.opponents },
  };

  // Teammate pairs (within each team)
  for (let i = 0; i < teamA.length; i++) {
    for (let j = i + 1; j < teamA.length; j++) {
      const k = teammateKey(teamA[i], teamA[j]);
      next.teammates[k] = (next.teammates[k] ?? 0) + 1;
    }
  }
  for (let i = 0; i < teamB.length; i++) {
    for (let j = i + 1; j < teamB.length; j++) {
      const k = teammateKey(teamB[i], teamB[j]);
      next.teammates[k] = (next.teammates[k] ?? 0) + 1;
    }
  }

  // Opponent pairs (cross-team)
  for (const a of teamA) {
    for (const b of teamB) {
      const k = opponentKey(a, b);
      next.opponents[k] = (next.opponents[k] ?? 0) + 1;
    }
  }

  return next;
}

// ---------------------------------------------------------------------------
// Score a candidate team split — lower is better (fewer repeated pairings)
// ---------------------------------------------------------------------------
// Returns { score, teamA, teamB } where score is the SUM of existing play
// counts across all teammate and opponent pairs.  A score of 0 means every
// relationship in this split is brand new.
// ---------------------------------------------------------------------------
export function scoreTeamSplit(
  a1: string, a2: string, b1: string, b2: string,
  rel: PlayAllRelationships
): number {
  let score = 0;
  score += rel.teammates[teammateKey(a1, a2)] ?? 0;
  score += rel.teammates[teammateKey(b1, b2)] ?? 0;
  score += rel.opponents[opponentKey(a1, b1)] ?? 0;
  score += rel.opponents[opponentKey(a1, b2)] ?? 0;
  score += rel.opponents[opponentKey(a2, b1)] ?? 0;
  score += rel.opponents[opponentKey(a2, b2)] ?? 0;
  return score;
}

// ---------------------------------------------------------------------------
// Given the current queue and relationship map, find the best group-of-4
// (with the best team split) from a lookahead window at the front of the
// queue.  Always fixes queue[0] as the "anchor" — they've been waiting
// longest — and looks through the next LOOKAHEAD positions for the other
// three players.
// ---------------------------------------------------------------------------
const LOOKAHEAD = 6; // how many positions beyond index 0 to consider

export interface PlayAllSuggestion {
  // Reordered queue so that the best four are at the front
  reorderedQueue: string[];
  // Pre-split teams for those four players
  suggestedTeamA: [string, string];
  suggestedTeamB: [string, string];
  // Combined novelty score (lower = fresher)
  score: number;
}

export function suggestNextDoublesMatch(
  queue: string[],
  rel: PlayAllRelationships
): PlayAllSuggestion | null {
  if (queue.length < 4) return null;

  const anchor = queue[0]; // always plays — they've waited the longest
  const pool = queue.slice(1, Math.min(queue.length, LOOKAHEAD + 1));

  let bestScore = Infinity;
  let bestGroup: [string, string, string] | null = null;
  let bestSplit: { teamA: [string, string]; teamB: [string, string] } | null = null;

  // Try every combination of 3 players from the pool
  for (let i = 0; i < pool.length; i++) {
    for (let j = i + 1; j < pool.length; j++) {
      for (let k = j + 1; k < pool.length; k++) {
        const [p2, p3, p4] = [pool[i], pool[j], pool[k]];

        // There are 3 distinct ways to split 4 players into 2 pairs:
        //   (anchor+p2) vs (p3+p4)
        //   (anchor+p3) vs (p2+p4)
        //   (anchor+p4) vs (p2+p3)
        const splits: Array<{ teamA: [string, string]; teamB: [string, string] }> = [
          { teamA: [anchor, p2], teamB: [p3, p4] },
          { teamA: [anchor, p3], teamB: [p2, p4] },
          { teamA: [anchor, p4], teamB: [p2, p3] },
        ];

        for (const split of splits) {
          const score = scoreTeamSplit(
            split.teamA[0], split.teamA[1],
            split.teamB[0], split.teamB[1],
            rel
          );
          if (score < bestScore) {
            bestScore = score;
            bestGroup = [p2, p3, p4];
            bestSplit = split;
          }
        }
      }
    }
  }

  if (!bestGroup || !bestSplit) return null;

  // Rebuild the queue: anchor + bestGroup at front, rest in original order
  const usedSet = new Set([anchor, ...bestGroup]);
  const remainder = queue.filter(p => !usedSet.has(p));
  const reorderedQueue = [anchor, ...bestGroup, ...remainder];

  return {
    reorderedQueue,
    suggestedTeamA: bestSplit.teamA,
    suggestedTeamB: bestSplit.teamB,
    score: bestScore,
  };
}

// ---------------------------------------------------------------------------
// Singles Play-All: track pairs and find the freshest next opponent
// ---------------------------------------------------------------------------
export function recordSinglesRelationships(
  p1: string,
  p2: string,
  rel: PlayAllRelationships
): PlayAllRelationships {
  const next: PlayAllRelationships = {
    teammates: { ...rel.teammates },
    opponents: { ...rel.opponents },
  };
  // For singles we reuse the opponents map (they faced each other)
  const k = opponentKey(p1, p2);
  next.opponents[k] = (next.opponents[k] ?? 0) + 1;
  return next;
}

export function suggestNextSinglesMatch(
  queue: string[],
  rel: PlayAllRelationships
): { reorderedQueue: string[]; score: number } | null {
  if (queue.length < 2) return null;

  const anchor = queue[0];
  const pool = queue.slice(1, Math.min(queue.length, LOOKAHEAD + 1));

  let bestScore = Infinity;
  let bestOpponent: string | null = null;

  for (const opponent of pool) {
    const k = opponentKey(anchor, opponent);
    const score = rel.opponents[k] ?? 0;
    if (score < bestScore) {
      bestScore = score;
      bestOpponent = opponent;
    }
  }

  if (!bestOpponent) return null;

  // Move best opponent to position 1 if needed
  if (queue[1] === bestOpponent) {
    return { reorderedQueue: queue, score: bestScore };
  }

  const newQueue = [...queue];
  const idx = newQueue.indexOf(bestOpponent);
  newQueue.splice(idx, 1);
  newQueue.splice(1, 0, bestOpponent);

  return { reorderedQueue: newQueue, score: bestScore };
}

// ---------------------------------------------------------------------------
// Main hook
// ---------------------------------------------------------------------------
function shuffleArray(arr: string[]): string[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const EMPTY_RELATIONSHIPS: PlayAllRelationships = { teammates: {}, opponents: {} };

export default function useQueue() {
  const [state, setState] = useState<QueueState>({
    gameMode: null,
    players: [],
    queue: [],
  });

  // Play-All relationship data lives in its own state slice so that
  // consumers can read it directly (e.g. to show a "novelty score" badge).
  const [playAllRel, setPlayAllRel] = useState<PlayAllRelationships>(EMPTY_RELATIONSHIPS);

  // Load from storage
  useEffect(() => {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Support old saves that don't have playAllRel yet
        if (parsed.playAllRel) setPlayAllRel(parsed.playAllRel);
        // Strip playAllRel before setting queue state
        const { playAllRel: _ignored, ...queueState } = parsed;
        setState(queueState);
      } catch (e) {
        console.error('Failed to parse stored queue state');
      }
    }
  }, []);

  // Save to storage (include playAllRel)
  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, playAllRel }));
  }, [state, playAllRel]);

  const setGameMode = useCallback((mode: 'singles' | 'doubles') => {
    setState(prev => ({ ...prev, gameMode: mode }));
  }, []);

  const setPlayers = useCallback((newPlayers: string[]) => {
    if (newPlayers.length < 5 || newPlayers.length > 24) {
      throw new Error('Number of players must be between 5 and 24');
    }
    const shuffledQueue = shuffleArray(newPlayers);
    setState(prev => ({
      ...prev,
      players: newPlayers,
      queue: shuffledQueue,
    }));
    // Reset relationships whenever a new player list is set
    setPlayAllRel(EMPTY_RELATIONSHIPS);
  }, []);

  const playSingles = useCallback((winner: string) => {
    setState(prev => {
      const { queue, gameMode } = prev;
      if (gameMode !== 'singles') throw new Error('Not in singles mode');
      if (queue.length < 2) throw new Error('Not enough players for singles');
      const [player1, player2] = queue;
      if (winner !== player1 && winner !== player2) {
        throw new Error('Winner must be one of the current players');
      }
      const newQueue = queue.slice(2);
      const loser = winner === player1 ? player2 : player1;
      newQueue.unshift(loser);
      newQueue.push(winner);
      return { ...prev, queue: newQueue };
    });
  }, []);

  const playDoubles = useCallback((teamA: string[], teamB: string[], winningTeam: 'A' | 'B') => {
    setState(prev => {
      const { queue, gameMode } = prev;
      if (gameMode !== 'doubles') throw new Error('Not in doubles mode');
      if (queue.length < 4) throw new Error('Not enough players for doubles');
      const firstFour = queue.slice(0, 4);
      const allPlayers = [...teamA, ...teamB];
      if (new Set(allPlayers).size !== 4 || !allPlayers.every(p => firstFour.includes(p))) {
        throw new Error('Teams must consist of the first four players in queue');
      }
      let newQueue = queue.slice(4);
      const winners = winningTeam === 'A' ? teamA : teamB;
      const losers = winningTeam === 'A' ? teamB : teamA;
      newQueue = [...losers, ...newQueue];
      newQueue.push(...winners);
      return { ...prev, queue: newQueue };
    });
  }, []);

  const randomizeQueue = useCallback(() => {
    setState(prev => {
      const { players } = prev;
      if (players.length === 0) throw new Error('No players set');
      const shuffled = shuffleArray(players);
      return { ...prev, queue: shuffled };
    });
  }, []);

  const setQueue = useCallback((newQueue: string[]) => {
    setState(prev => ({ ...prev, queue: newQueue }));
  }, []);

  /** Call this after every completed doubles match in Play-All mode */
  const recordPlayAllDoubles = useCallback((teamA: string[], teamB: string[]) => {
    setPlayAllRel(prev => recordDoublesRelationships(teamA, teamB, prev));
  }, []);

  /** Call this after every completed singles match in Play-All mode */
  const recordPlayAllSingles = useCallback((p1: string, p2: string) => {
    setPlayAllRel(prev => recordSinglesRelationships(p1, p2, prev));
  }, []);

  /** Wipe relationship history (e.g. manual reset button) */
  const resetPlayAllRelationships = useCallback(() => {
    setPlayAllRel(EMPTY_RELATIONSHIPS);
  }, []);

  const reset = useCallback(() => {
    setState({ gameMode: null, players: [], queue: [] });
    setPlayAllRel(EMPTY_RELATIONSHIPS);
  }, []);

  return {
    ...state,
    playAllRel,
    setGameMode,
    setPlayers,
    playSingles,
    playDoubles,
    randomizeQueue,
    setQueue,
    recordPlayAllDoubles,
    recordPlayAllSingles,
    resetPlayAllRelationships,
    reset,
  };
}