export const MULTI_COURT_SINGLES_MAX_STREAK = 3;

/**
 * Maps player performance and roster skill tags into a 0..100 skill rating map.
 * Players with >= 1 game played use their winRate.
 * Unplayed players with a skill bracket use 25 (beginner), 50 (intermediate), or 75 (advanced).
 * Untagged unplayed players default to 50.
 */
export function buildNumericSkillMap(
  statsList: Array<{ name: string; gamesPlayed?: number; played?: number; winRate: number }>,
  rosterSkillMap?: Record<string, 'beginner' | 'intermediate' | 'advanced' | undefined>,
): Record<string, number> {
  const map: Record<string, number> = {};

  const bracketDefaults: Record<'beginner' | 'intermediate' | 'advanced', number> = {
    beginner: 25,
    intermediate: 50,
    advanced: 75,
  };

  for (const stat of statsList) {
    const games = stat.gamesPlayed ?? stat.played ?? 0;
    if (games >= 1) {
      map[stat.name] = stat.winRate;
    } else if (rosterSkillMap && rosterSkillMap[stat.name]) {
      const bracket = rosterSkillMap[stat.name]!;
      map[stat.name] = bracketDefaults[bracket];
    } else {
      map[stat.name] = 50;
    }
  }

  if (rosterSkillMap) {
    for (const [name, bracket] of Object.entries(rosterSkillMap)) {
      if (bracket && map[name] === undefined) {
        map[name] = bracketDefaults[bracket];
      }
    }
  }

  return map;
}

import { rotateMultiCourtDoubles, pairKey, teamPairKey, type LockedPartnerPair } from './doublesEngine';

export interface MultiCourtSlot {
  id: string;
  name: string;
  onCourt: string[];
}

export interface MultiCourtResultState {
  queue: string[];
  courtSlots: MultiCourtSlot[];
  lockedPartners?: Array<{ a: string; b: string }>;
  sittingOut?: string[];
  priorityPlayers?: string[];
  history?: Array<{ id?: number; mode?: string; players: string; winner: string; timestamp?: string; score?: string }>;
  skillMap?: Record<string, number>;
}

export interface PlannedCourtResult {
  queue: string[];
  courtSlots: MultiCourtSlot[];
  courtName: string;
  players: string;
  winner: string;
  priorityPlayers?: string[];
}

function getCourtSinglesStreak(
  courtName: string,
  winner: string,
  history?: Array<{ id?: number; mode?: string; courtName?: string; players?: string; winner?: string }>,
): number {
  if (!history || history.length === 0) return 0;
  let streak = 0;
  for (const h of history) {
    const isThisCourt =
      (h.courtName && h.courtName === courtName) ||
      (h.mode && (h.mode.includes(`(${courtName})`) || h.mode.includes(courtName)));
    if (isThisCourt) {
      if (h.winner === winner) {
        streak++;
      } else {
        break;
      }
    }
  }
  return streak;
}

export function planMultiCourtResult(
  state: MultiCourtResultState,
  courtId: string,
  expectedPlayers: string[],
  winningSide: 'A' | 'B',
  gameMode: 'singles' | 'doubles' = 'doubles',
): PlannedCourtResult | null {
  const slot = state.courtSlots.find(court => court.id === courtId);
  const expectedCourtSize = gameMode === 'singles' ? 2 : 4;
  if (!slot || slot.onCourt.length !== expectedCourtSize) return null;
  if (slot.onCourt.some((player, index) => player !== expectedPlayers[index])) return null;

  const unavailable = new Set(state.sittingOut ?? []);
  const occupiedElsewhere = new Set(
    state.courtSlots
      .filter(court => court.id !== courtId)
      .flatMap(court => court.onCourt),
  );
  const eligibleWaiting = state.queue.filter(
    player => !unavailable.has(player) && !occupiedElsewhere.has(player),
  );

  const priorityList = state.priorityPlayers ?? [];
  const prioritySet = new Set(priorityList);
  const eligiblePriority = priorityList.filter(
    p => eligibleWaiting.includes(p) && !unavailable.has(p) && !occupiedElsewhere.has(p),
  );
  const remainingEligible = eligibleWaiting.filter(p => !prioritySet.has(p));
  const orderedWaiting = [...eligiblePriority, ...remainingEligible];

  if (gameMode === 'singles') {
    const [playerA, playerB] = slot.onCourt;
    const winner = winningSide === 'A' ? playerA : playerB;
    const loser = winningSide === 'A' ? playerB : playerA;

    const isWinnerAvailable = !unavailable.has(winner);
    const isLoserAvailable = !unavailable.has(loser);

    let nextOnCourt: string[];
    let consumedWaitingCount: number;

    const priorWins = getCourtSinglesStreak(slot.name, winner, state.history);
    const isStreakMaxed = (priorWins + 1) >= MULTI_COURT_SINGLES_MAX_STREAK;
    const canRotateKing = isStreakMaxed && (orderedWaiting.length >= 2 || (orderedWaiting.length >= 1 && isLoserAvailable));

    if (isWinnerAvailable && !canRotateKing) {
      const nextChallenger = orderedWaiting[0];
      if (nextChallenger) {
        nextOnCourt = [winner, nextChallenger];
        consumedWaitingCount = 1;
      } else if (isLoserAvailable) {
        nextOnCourt = [winner, loser];
        consumedWaitingCount = 0;
      } else {
        nextOnCourt = [winner, ''];
        consumedWaitingCount = 0;
      }
    } else {
      // Winner is sitting out or max streak reached -> king steps down to queue/break
      const challengerA = orderedWaiting[0] ?? '';
      const challengerB = orderedWaiting[1] ?? (isLoserAvailable ? loser : '');
      nextOnCourt = [challengerA, challengerB];
      consumedWaitingCount = (orderedWaiting[0] ? 1 : 0) + (orderedWaiting[1] ? 1 : 0);
    }

    const consumedChallengers = new Set(orderedWaiting.slice(0, consumedWaitingCount));
    const remainingWaiting = state.queue.filter(
      player => !consumedChallengers.has(player) && !unavailable.has(player),
    );
    const queue = [
      ...remainingWaiting,
      ...(isLoserAvailable && !nextOnCourt.includes(loser) ? [loser] : []),
      ...(isWinnerAvailable && !nextOnCourt.includes(winner) ? [winner] : []),
    ];

    const courtSlots = state.courtSlots.map(court =>
      court.id === courtId ? { ...court, onCourt: nextOnCourt } : court,
    );

    const nextOnCourtSet = new Set(nextOnCourt.filter(Boolean));
    const nextPriorityPlayers = priorityList.filter(
      p => !nextOnCourtSet.has(p) && !unavailable.has(p),
    );

    return {
      queue,
      courtSlots,
      courtName: slot.name,
      players: `${playerA} vs ${playerB}`,
      winner,
      priorityPlayers: nextPriorityPlayers,
    };
  }

  const teamA = slot.onCourt.slice(0, 2) as [string, string];
  const teamB = slot.onCourt.slice(2, 4) as [string, string];
  const winner = (winningSide === 'A' ? teamA : teamB).join(' & ');
  const lockedPartners: LockedPartnerPair[] = (state.lockedPartners ?? []).map(
    pair => [pair.a, pair.b],
  );

  // Defensively exclude any finisher who is sittingOut so they do not re-enter queue or court
  const availableFinishers = slot.onCourt.filter(player => !unavailable.has(player));
  const recentPairs: string[] = [];
  const recentMatches: string[] = [];
  if (state.history && state.history.length > 0) {
    for (const h of state.history) {
      if (h.players && h.players.includes('&') && h.players.includes(' vs ')) {
        const [left, right] = h.players.split(' vs ').map(s => s.trim());
        const t1 = left.split('&').map(s => s.trim()) as [string, string];
        const t2 = right.split('&').map(s => s.trim()) as [string, string];
        if (t1.length === 2 && t2.length === 2) {
          recentPairs.push(pairKey(t1[0], t1[1]));
          recentPairs.push(pairKey(t2[0], t2[1]));
          recentMatches.push(teamPairKey(t1, t2));
          if (recentPairs.length >= 8) break;
        }
      }
    }
  }

  const next = rotateMultiCourtDoubles(orderedWaiting, availableFinishers, lockedPartners, {
    recentPairs,
    recentMatches,
    skillMap: state.skillMap,
  });
  const courtSlots = state.courtSlots.map(court =>
    court.id === courtId ? { ...court, onCourt: next.onCourt } : court,
  );

  const nextOnCourtSet = new Set(next.onCourt);
  const nextPriorityPlayers = priorityList.filter(
    p => !nextOnCourtSet.has(p) && !unavailable.has(p),
  );

  return {
    queue: next.waiting.filter(player => !unavailable.has(player)),
    courtSlots,
    courtName: slot.name,
    players: `${teamA.join(' & ')} vs ${teamB.join(' & ')}`,
    winner,
    priorityPlayers: nextPriorityPlayers,
  };
}
