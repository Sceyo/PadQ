import React, { useState } from 'react';
import { BarChart2, TrendingUp, Activity, Clock, Flame, Layers } from 'lucide-react';
import type { PlayerStat } from '../../lib/types';
import type { CareerStatsMap } from '@/lib/sessionService';
import { RankBadge } from '../atoms/RankBadge';

const StatBar: React.FC<{ value: number; max: number; color: string }> = ({ value, max, color }) => (
  <div className="stat-bar-track">
    <div className="stat-bar-fill" style={{ width: `${max === 0 ? 0 : Math.round((value / max) * 100)}%`, background: color }} />
  </div>
);

interface SkilledBracketsShape {
  beginner:     string[];
  intermediate: string[];
  advanced:     string[];
}

const BRACKET_META = {
  beginner:     { label: 'Beginner',     color: '#22c55e', barColor: '#22c55e', letter: 'B' },
  intermediate: { label: 'Intermediate', color: '#f59e0b', barColor: '#f59e0b', letter: 'I' },
  advanced:     { label: 'Advanced',     color: '#ef4444', barColor: '#ef4444', letter: 'A' },
} as const;

export const AnalyticsDashboard: React.FC<{
  stats: PlayerStat[];
  careerStats?: CareerStatsMap;
  skilledBrackets?: SkilledBracketsShape;
}> = ({ stats, careerStats, skilledBrackets }) => {
  const hasCareer  = careerStats && Object.keys(careerStats).length > 0;
  const hasSkilled = !!skilledBrackets && (
    skilledBrackets.beginner.length > 0 ||
    skilledBrackets.intermediate.length > 0 ||
    skilledBrackets.advanced.length > 0
  );

  const [tab, setTab] = useState<'session' | 'career' | 'skilled'>(
    hasSkilled ? 'skilled' : 'session'
  );

  const careerList = Object.entries(careerStats ?? {})
    .map(([name, s]) => ({
      name,
      wins: s.wins, losses: s.losses, gamesPlayed: s.gamesPlayed,
      winRate: s.gamesPlayed === 0 ? 0 : Math.round((s.wins / s.gamesPlayed) * 100),
    }))
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);

  const sorted  = [...stats].sort((a, b) => b.wins - a.wins);
  const maxGP   = Math.max(...stats.map(s => s.gamesPlayed), 1);
  const statsMap = new Map(stats.map(s => [s.name, s]));

  return (
    <div className="analytics-panel">
      {(hasCareer || hasSkilled) && (
        <div className="analytics-tab-row">
          {hasSkilled && (
            <button
              className={`analytics-tab-btn ${tab === 'skilled' ? 'active' : ''}`}
              onClick={() => setTab('skilled')}
            >
              <Layers size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Skilled
            </button>
          )}
          <button
            className={`analytics-tab-btn ${tab === 'session' ? 'active' : ''}`}
            onClick={() => setTab('session')}
          >
            Session
          </button>
          {hasCareer && (
            <button
              className={`analytics-tab-btn ${tab === 'career' ? 'active' : ''}`}
              onClick={() => setTab('career')}
            >
              Career
            </button>
          )}
        </div>
      )}

      {tab === 'skilled' && hasSkilled && (
        <>
          <div className="analytics-section-label"><Layers size={13} /> Skill Bracket Standings</div>
          <div className="analytics-skilled-brackets">
            {(['beginner', 'intermediate', 'advanced'] as const).map(level => {
              const meta  = BRACKET_META[level];
              const names = skilledBrackets![level];
              if (names.length === 0) return null;
              const bracketStats = names
                .map(name => statsMap.get(name))
                .filter((s): s is PlayerStat => !!s)
                .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate);
              return (
                <div key={level} className="analytics-skilled-bracket">
                  <div className={`analytics-skilled-bracket-header analytics-skilled-bracket-header--${level}`}>
                    <span className={`skill-badge skill-badge--${level}`}>{meta.letter}</span>
                    {meta.label}
                    <span className="analytics-skilled-bracket-count">({names.length})</span>
                  </div>
                  {bracketStats.length === 0 ? (
                    <p className="muted-hint" style={{ padding: '12px 14px', margin: 0 }}>No matches played yet.</p>
                  ) : (
                    <div className="analytics-table-scroll">
                      <table className="analytics-table">
                        <thead>
                          <tr><th>#</th><th>Player</th><th><TrendingUp size={11} /> W</th><th>L</th><th><Activity size={11} /> GP</th><th>Win %</th></tr>
                        </thead>
                        <tbody>
                          {bracketStats.map((s, i) => (
                            <tr key={s.name} className={i === 0 ? 'analytics-top' : ''}>
                              <td className="col-rank-num">{i + 1}</td>
                              <td><strong>{s.name}</strong></td>
                              <td className="col-wins">{s.wins}</td>
                              <td className="col-losses">{s.losses}</td>
                              <td>{s.gamesPlayed}</td>
                              <td>
                                <div className="winrate-cell">
                                  <span>{s.winRate}%</span>
                                  <StatBar value={s.winRate} max={100} color={meta.barColor} />
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === 'session' && (
        <>
          {!stats.length
            ? <p className="muted-hint">No stats yet — play some matches!</p>
            : (
              <>
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
              </>
            )}
        </>
      )}

      {tab === 'career' && hasCareer && (
        <>
          <div className="analytics-section-label"><BarChart2 size={13} /> All-Time Career Stats (this device)</div>
          {careerList.length === 0
            ? <p className="muted-hint">No career data yet.</p>
            : (
              <div className="analytics-table-scroll">
                <table className="analytics-table">
                  <thead>
                    <tr><th>#</th><th>Player</th><th><TrendingUp size={11} /> W</th><th>L</th><th><Activity size={11} /> GP</th><th>Win %</th></tr>
                  </thead>
                  <tbody>
                    {careerList.map((s, i) => (
                      <tr key={s.name} className={i === 0 ? 'analytics-top' : ''}>
                        <td className="col-rank-num">{i + 1}</td>
                        <td><strong>{s.name}</strong></td>
                        <td className="col-wins">{s.wins}</td>
                        <td className="col-losses">{s.losses}</td>
                        <td>{s.gamesPlayed}</td>
                        <td><div className="winrate-cell"><span>{s.winRate}%</span><StatBar value={s.winRate} max={100} color="#22c55e" /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </>
      )}
    </div>
  );
};
