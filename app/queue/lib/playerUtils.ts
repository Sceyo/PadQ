import type { RankTier, PlayerStat, SmartSuggestion, MatchHistoryEntry } from './types';

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

export function buildPlayerStats(players: string[], history: MatchHistoryEntry[]): PlayerStat[] {
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
      if (winnerNames.includes(name)) {
        wins[name] = (wins[name] ?? 0) + 1;
        streak[name] = (streak[name] ?? 0) + 1;
      } else {
        losses[name] = (losses[name] ?? 0) + 1;
        streak[name] = 0;
      }
    }
  }
  return players.map(name => {
    const w = wins[name] ?? 0, l = losses[name] ?? 0, gp = w + l;
    const wr = gp === 0 ? 0 : Math.round((w / gp) * 100);
    return { name, wins: w, losses: l, gamesPlayed: gp, winRate: wr, streak: streak[name] ?? 0, rank: calcRank(wr, gp) };
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
    const rates = queue.slice(0, 4).map(n => stats.find(s => s.name === n)?.winRate ?? 50);
    if (Math.abs((rates[0] + rates[1]) - (rates[2] + rates[3])) > 30)
      suggestions.push({ type: 'team-balance', message: 'The next doubles match may be unbalanced. Try swapping players.', players: queue.slice(0, 4) });
  }
  return suggestions;
}
