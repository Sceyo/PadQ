import React from 'react';
import { BarChart2, TrendingUp, Activity, Clock, Flame } from 'lucide-react';
import type { PlayerStat } from '../../lib/types';
import { RankBadge } from '../atoms/RankBadge';

const StatBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => (
  <div className="stat-bar-track">
    <div className="stat-bar-fill" style={{ width: `${max === 0 ? 0 : Math.round((value / max) * 100)}%`, background: color }} />
  </div>
);

export const AnalyticsDashboard: React.FC<{ stats: PlayerStat[] }> = ({ stats }) => {
  const sorted = [...stats].sort((a, b) => b.wins - a.wins);
  const maxGP = Math.max(...stats.map(s => s.gamesPlayed), 1);
  if (!stats.length) return <p className="muted-hint">No stats yet — play some matches!</p>;
  return (
    <div className="analytics-panel">
      <div className="analytics-section-label"><BarChart2 size={13} /> Leaderboard</div>
      <div className="analytics-table-scroll">
        <table className="analytics-table">
          <thead>
            <tr><th>#</th><th>Player</th><th>Rank</th><th><TrendingUp size={11} /> W</th><th>L</th><th><Activity size={11} /> GP</th><th>Win %</th><th>Streak</th></tr>
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
                <td><div className="winrate-cell"><span>{s.winRate}%</span><StatBar value={s.winRate} max={100} color="#22c55e" /></div></td>
                <td>{s.streak >= 2 ? <span className="streak-badge"><Flame size={11} />{s.streak}</span> : <span className="col-streak-zero">{s.streak}</span>}</td>
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
