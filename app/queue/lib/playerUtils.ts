import type { RankTier, PlayerStat, SmartSuggestion, MatchHistoryEntry } from './types';
import type { SkillBracket } from '@/lib/sessionService';

const BRACKET_SKILL: Record<SkillBracket, number> = { beginner: 25, intermediate: 50, advanced: 75 };

/** Map a roster skill bracket to a numeric skill value used in skillMap. */
export function bracketSkillValue(skill: SkillBracket | undefined): number {
  return skill !== undefined ? BRACKET_SKILL[skill] : 50;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function calcRank(winRate: number, gamesPlayed: number): RankTier {
  if (gamesPlayed < 3) return 'Bronze';
  if (winRate >= 80)   return 'Diamond';
  if (winRate >= 65)   return 'Platinum';
  if (winRate >= 50)   return 'Gold';
  if (winRate >= 35)   return 'Silver';
  return 'Bronze';
}

export function parseMatchScore(score: string | undefined): { sA: number; sB: number } | null {
  if (!score) return null;
  const match = score.trim().match(/^(\d+)\s*[-–—:]\s*(\d+)$/);
  if (!match) return null;
  const sA = parseInt(match[1], 10);
  const sB = parseInt(match[2], 10);
  if (isNaN(sA) || isNaN(sB)) return null;
  return { sA, sB };
}

export function formatPointDiff(diff: number | undefined): string {
  if (diff === undefined || diff === 0) return '+0';
  return diff > 0 ? `+${diff}` : `${diff}`;
}

export function formatMatchupStrength(ms: number | undefined, gamesPlayed: number): string {
  if (gamesPlayed === 0) return '—';
  return `${Math.round(ms ?? 50)}%`;
}

export function comparePlayerStats(a: PlayerStat, b: PlayerStat): number {
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.winRate !== a.winRate) return b.winRate - a.winRate;
  const diffB = b.pointDiff ?? 0;
  const diffA = a.pointDiff ?? 0;
  if (diffB !== diffA) return diffB - diffA;
  const msB = b.matchupStrength ?? 50;
  const msA = a.matchupStrength ?? 50;
  if (msB !== msA) return msB - msA;
  if (b.gamesPlayed !== a.gamesPlayed) return b.gamesPlayed - a.gamesPlayed;
  return a.name.localeCompare(b.name);
}

export function buildPlayerStats(players: string[], history: MatchHistoryEntry[]): PlayerStat[] {
  const wins: Record<string, number> = Object.create(null);
  const losses: Record<string, number> = Object.create(null);
  const streak: Record<string, number> = Object.create(null);
  const pointsScored: Record<string, number> = Object.create(null);
  const pointsConceded: Record<string, number> = Object.create(null);
  const scoredGames: Record<string, number> = Object.create(null);
  const opponentsMap: Record<string, Set<string>> = Object.create(null);

  for (const p of players) {
    wins[p] = 0;
    losses[p] = 0;
    streak[p] = 0;
    pointsScored[p] = 0;
    pointsConceded[p] = 0;
    scoredGames[p] = 0;
    opponentsMap[p] = new Set<string>();
  }

  for (const entry of [...history].reverse()) {
    const winnerNames = entry.winner.split(' & ').map(s => s.trim());
    const allNames = entry.players
      .split(' vs ').flatMap(s => s.split(' & ')).map(s => s.trim())
      .filter(n => players.includes(n));
    for (const name of allNames) {
      if (winnerNames.includes(name)) {
        wins[name] = (wins[name] ?? 0) + 1;
        streak[name] = (streak[name] ?? 0) + 1;
      } else {
        losses[name] = (losses[name] ?? 0) + 1;
        streak[name] = 0;
      }
    }

    const sides = entry.players.split(' vs ');
    if (sides.length === 2) {
      const sideAPlayers = sides[0].split(' & ').map(s => s.trim()).filter(n => n.length > 0);
      const sideBPlayers = sides[1].split(' & ').map(s => s.trim()).filter(n => n.length > 0);

      for (const a of sideAPlayers) {
        if (opponentsMap[a]) {
          for (const b of sideBPlayers) opponentsMap[a].add(b);
        }
      }
      for (const b of sideBPlayers) {
        if (opponentsMap[b]) {
          for (const a of sideAPlayers) opponentsMap[b].add(a);
        }
      }

      const parsedScore = parseMatchScore(entry.score);
      if (parsedScore) {
        const { sA, sB } = parsedScore;
        for (const a of sideAPlayers) {
          if (players.includes(a)) {
            pointsScored[a] = (pointsScored[a] ?? 0) + sA;
            pointsConceded[a] = (pointsConceded[a] ?? 0) + sB;
            scoredGames[a] = (scoredGames[a] ?? 0) + 1;
          }
        }
        for (const b of sideBPlayers) {
          if (players.includes(b)) {
            pointsScored[b] = (pointsScored[b] ?? 0) + sB;
            pointsConceded[b] = (pointsConceded[b] ?? 0) + sA;
            scoredGames[b] = (scoredGames[b] ?? 0) + 1;
          }
        }
      }
    }
  }

  return players.map(name => {
    const w = wins[name] ?? 0, l = losses[name] ?? 0, gp = w + l;
    const wr = gp === 0 ? 0 : Math.round((w / gp) * 100);
    const scored = pointsScored[name] ?? 0;
    const conceded = pointsConceded[name] ?? 0;
    const diff = scored - conceded;
    const sg = scoredGames[name] ?? 0;

    // Compute Matchup Strength (Opponent Win Percentage)
    const opponents = opponentsMap[name] ?? new Set<string>();
    let totalOppWins = 0;
    let totalOppGames = 0;

    if (opponents.size > 0) {
      for (const opp of opponents) {
        for (const entry of history) {
          const matchPlayers = entry.players
            .split(' vs ').flatMap(s => s.split(' & ')).map(s => s.trim());
          if (matchPlayers.includes(name)) continue;
          if (!matchPlayers.includes(opp)) continue;

          const winnerNames = entry.winner.split(' & ').map(s => s.trim());
          totalOppGames += 1;
          if (winnerNames.includes(opp)) {
            totalOppWins += 1;
          }
        }
      }
    }

    const matchupStrength = totalOppGames === 0 ? 50 : Math.round((totalOppWins / totalOppGames) * 100);

    return {
      name,
      wins: w,
      losses: l,
      gamesPlayed: gp,
      winRate: wr,
      streak: streak[name] ?? 0,
      rank: calcRank(wr, gp),
      pointDiff: diff,
      pointsScored: scored,
      pointsConceded: conceded,
      scoredGames: sg,
      matchupStrength,
    };
  });
}

export function generateSuggestions(stats: PlayerStat[], queue: string[]): SmartSuggestion[] {
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
    const p = queue.slice(0, 4);
    const rates = p.map(n => stats.find(s => s.name === n)?.winRate ?? 50);
    const diff = Math.abs((rates[0] + rates[1]) - (rates[2] + rates[3]));
    if (diff > 30) {
      const avgA = Math.round((rates[0] + rates[1]) / 2);
      const avgB = Math.round((rates[2] + rates[3]) / 2);

      // Check which swap creates better balance:
      const diff1 = Math.abs((rates[0] + rates[2]) - (rates[1] + rates[3]));
      const diff2 = Math.abs((rates[0] + rates[3]) - (rates[2] + rates[1]));

      let swapAdvice = `Try swapping ${p[1]} and ${p[2]}.`;
      if (diff2 < diff1) {
        swapAdvice = `Try swapping ${p[1]} and ${p[3]}.`;
      }

      suggestions.push({
        type: 'team-balance',
        message: `Next doubles match (${p[0]} & ${p[1]} vs ${p[2]} & ${p[3]}) may be unbalanced (${avgA}% vs ${avgB}% avg win rate). ${swapAdvice}`,
        players: p,
      });
    }
  }
  return suggestions;
}
