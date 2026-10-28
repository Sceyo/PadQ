import React, { useState } from 'react';
import { BarChart2, TrendingUp, Activity, Clock, Flame, Layers, Share2, Trophy } from 'lucide-react';
import type { PlayerStat, MatchHistoryEntry } from '../../lib/types';
import { comparePlayerStats, formatPointDiff, formatMatchupStrength } from '../../lib/playerUtils';
import type { CareerStatsMap } from '@/lib/sessionService';
import { RankBadge } from '../atoms/RankBadge';
import { RecapModal } from '../RecapCard';

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
  history?: MatchHistoryEntry[];
  roomCode?: string | null;
  mode?: string;
  initialTab?: 'session' | 'history' | 'skilled';
}> = ({ stats, careerStats: _careerStats, skilledBrackets, history = [], roomCode, mode = 'Doubles', initialTab }) => {
  const hasSkilled = !!skilledBrackets && (
    skilledBrackets.beginner.length > 0 ||
    skilledBrackets.intermediate.length > 0 ||
    skilledBrackets.advanced.length > 0
  );

  const [tab, setTab] = useState<'session' | 'history' | 'skilled'>(
    initialTab ?? (hasSkilled ? 'skilled' : 'session')
  );
  const [showRecapModal, setShowRecapModal] = useState(false);


  const sorted  = [...stats].sort(comparePlayerStats);
  const maxGP   = Math.max(...stats.map(s => s.gamesPlayed), 1);
  const statsMap = new Map(stats.map(s => [s.name, s]));

  return (
    <div className="analytics-panel">
      <div className="analytics-header-row">
        <div className="analytics-tab-row">
          {hasSkilled && (
            <button
              type="button"
              className={`analytics-tab-btn ${tab === 'skilled' ? 'active' : ''}`}
              onClick={() => setTab('skilled')}
            >
              <Layers size={14} />
              <span>Skilled</span>
            </button>
          )}
          <button
            type="button"
            className={`analytics-tab-btn ${tab === 'session' ? 'active' : ''}`}
            onClick={() => setTab('session')}
          >
            <Trophy size={14} />
            <span>Session</span>
          </button>
          <button
            type="button"
            className={`analytics-tab-btn ${tab === 'history' ? 'active' : ''}`}
            onClick={() => setTab('history')}
          >
            <Clock size={14} />
            <span>History</span>
          </button>
        </div>

        {(stats.length > 0 || history.length > 0) && (
          <button
            type="button"
            className="analytics-share-recap-btn"
            onClick={() => setShowRecapModal(true)}
            title="Create shareable Instagram/social recap image"
          >
            <Share2 size={13} />
            <span>Share Recap Card</span>
          </button>
        )}
      </div>

      <RecapModal
        isOpen={showRecapModal}
        onClose={() => setShowRecapModal(false)}
        stats={stats}
        history={history}
        roomCode={roomCode}
        mode={mode}
        defaultVariant="host"
      />

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
                .sort(comparePlayerStats);
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
                    <>
                      <div className="analytics-table-scroll analytics-desktop-only">
                        <table className="analytics-table">
                          <thead>
                            <tr>
                              <th>#</th><th>Player</th>
                              <th><TrendingUp size={11} /> W</th><th>L</th>
                              <th><Activity size={11} /> GP</th><th>Win %</th>
                              <th title="Point Differential (Points Scored - Conceded)">Diff</th>
                              <th title="Matchup Strength (Opponent Win %)">MS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bracketStats.map((s, i) => {
                              const diff = s.pointDiff ?? 0;
                              const diffClass = diff > 0 ? 'col-diff-pos' : diff < 0 ? 'col-diff-neg' : 'col-diff-zero';
                              return (
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
                                  <td className={diffClass} title={`Points: ${s.pointsScored ?? 0} scored, ${s.pointsConceded ?? 0} conceded`}>
                                    {formatPointDiff(s.pointDiff)}
                                  </td>
                                  <td title={`Opponent Win %: ${Math.round(s.matchupStrength ?? 50)}% (Quality of competition)`}>
                                    {formatMatchupStrength(s.matchupStrength, s.gamesPlayed)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <div className="analytics-mobile-cards">
                        {bracketStats.map((s, i) => {
                          const diff = s.pointDiff ?? 0;
                          const diffClass = diff > 0 ? 'col-diff-pos' : diff < 0 ? 'col-diff-neg' : 'col-diff-zero';
                          return (
                            <div key={s.name} className={`analytics-player-card ${i === 0 ? 'analytics-top-card' : ''}`}>
                              <div className="analytics-card-header">
                                <div className="analytics-card-player">
                                  <span className="analytics-card-rank-num">#{i + 1}</span>
                                  <strong className="analytics-card-name">{s.name}</strong>
                                </div>
                                <span className={`skill-badge skill-badge--${level}`}>{meta.letter}</span>
                              </div>
                              <div className="analytics-card-stats analytics-card-stats--3col">
                                <div className="analytics-stat-item">
                                  <span className="analytics-stat-label">W - L</span>
                                  <span className="analytics-stat-val">
                                    <span className="col-wins">{s.wins}</span> - <span className="col-losses">{s.losses}</span>
                                  </span>
                                </div>
                                <div className="analytics-stat-item">
                                  <span className="analytics-stat-label">GP</span>
                                  <span className="analytics-stat-val">{s.gamesPlayed}</span>
                                </div>
                                <div className="analytics-stat-item">
                                  <span className="analytics-stat-label">Win %</span>
                                  <div className="analytics-stat-val winrate-cell">
                                    <span>{s.winRate}%</span>
                                    <StatBar value={s.winRate} max={100} color={meta.barColor} />
                                  </div>
                                </div>
                                <div className="analytics-stat-item">
                                  <span className="analytics-stat-label">Diff</span>
                                  <span className={`analytics-stat-val ${diffClass}`}>
                                    {formatPointDiff(s.pointDiff)}
                                  </span>
                                </div>
                                <div className="analytics-stat-item">
                                  <span className="analytics-stat-label">Matchup</span>
                                  <span className="analytics-stat-val">
                                    {formatMatchupStrength(s.matchupStrength, s.gamesPlayed)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </>
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
                <div className="analytics-section-label"><BarChart2 size={13} /><span>Leaderboard</span></div>
                <div className="analytics-table-scroll analytics-desktop-only">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Player</th><th>Rank</th>
                        <th><TrendingUp size={11} /> W</th><th>L</th>
                        <th><Activity size={11} /> GP</th><th>Win %</th>
                        <th title="Point Differential (Points Scored - Conceded)">Diff</th>
                        <th title="Matchup Strength (Opponent Win %)">MS</th>
                        <th>Streak</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((s, i) => {
                        const diff = s.pointDiff ?? 0;
                        const diffClass = diff > 0 ? 'col-diff-pos' : diff < 0 ? 'col-diff-neg' : 'col-diff-zero';
                        return (
                          <tr key={s.name} className={i === 0 ? 'analytics-top' : ''}>
                            <td className="col-rank-num">{i + 1}</td>
                            <td><strong>{s.name}</strong></td>
                            <td><RankBadge rank={s.rank} /></td>
                            <td className="col-wins">{s.wins}</td>
                            <td className="col-losses">{s.losses}</td>
                            <td>{s.gamesPlayed}</td>
                            <td><div className="winrate-cell"><span>{s.winRate}%</span><StatBar value={s.winRate} max={100} color="#22c55e" /></div></td>
                            <td className={diffClass} title={`Points: ${s.pointsScored ?? 0} scored, ${s.pointsConceded ?? 0} conceded`}>
                              {formatPointDiff(s.pointDiff)}
                            </td>
                            <td title={`Opponent Win %: ${Math.round(s.matchupStrength ?? 50)}% (Quality of competition)`}>
                              {formatMatchupStrength(s.matchupStrength, s.gamesPlayed)}
                            </td>
                            <td>{s.streak >= 2 ? <span className="streak-badge"><Flame size={11} />{s.streak}</span> : <span className="col-streak-zero">{s.streak}</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="analytics-mobile-cards">
                  {sorted.map((s, i) => {
                    const diff = s.pointDiff ?? 0;
                    const diffClass = diff > 0 ? 'col-diff-pos' : diff < 0 ? 'col-diff-neg' : 'col-diff-zero';
                    return (
                      <div key={s.name} className={`analytics-player-card ${i === 0 ? 'analytics-top-card' : ''}`}>
                        <div className="analytics-card-header">
                          <div className="analytics-card-player">
                            <span className="analytics-card-rank-num">#{i + 1}</span>
                            <strong className="analytics-card-name">{s.name}</strong>
                          </div>
                          <div className="analytics-card-badges">
                            <RankBadge rank={s.rank} />
                            {s.streak >= 2 && (
                              <span className="streak-badge"><Flame size={11} />{s.streak}</span>
                            )}
                          </div>
                        </div>
                        <div className="analytics-card-stats analytics-card-stats--3col">
                          <div className="analytics-stat-item">
                            <span className="analytics-stat-label">W - L</span>
                            <span className="analytics-stat-val">
                              <span className="col-wins">{s.wins}</span> - <span className="col-losses">{s.losses}</span>
                            </span>
                          </div>
                          <div className="analytics-stat-item">
                            <span className="analytics-stat-label">GP</span>
                            <span className="analytics-stat-val">{s.gamesPlayed}</span>
                          </div>
                          <div className="analytics-stat-item">
                            <span className="analytics-stat-label">Win %</span>
                            <div className="analytics-stat-val winrate-cell">
                              <span>{s.winRate}%</span>
                              <StatBar value={s.winRate} max={100} color="#22c55e" />
                            </div>
                          </div>
                          <div className="analytics-stat-item">
                            <span className="analytics-stat-label">Diff</span>
                            <span className={`analytics-stat-val ${diffClass}`}>
                              {formatPointDiff(s.pointDiff)}
                            </span>
                          </div>
                          <div className="analytics-stat-item">
                            <span className="analytics-stat-label">Matchup</span>
                            <span className="analytics-stat-val">
                              {formatMatchupStrength(s.matchupStrength, s.gamesPlayed)}
                            </span>
                          </div>
                          <div className="analytics-stat-item">
                            <span className="analytics-stat-label">Streak</span>
                            <span className={`analytics-stat-val ${s.streak === 0 ? 'col-streak-zero' : ''}`}>
                              {s.streak >= 2 ? (
                                <span className="streak-badge"><Flame size={11} />{s.streak}</span>
                              ) : s.streak}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="analytics-section-label" style={{ marginTop: 24 }}><Clock size={13} /> Play Frequency</div>
                <div className="frequency-chart">
                  {sorted.map(s => (
                    <div key={s.name} className="freq-row">
                      <span className="freq-name" title={s.name}>{s.name}</span>
                      <StatBar value={s.gamesPlayed} max={maxGP} color="#818cf8" />
                      <span className="freq-count">{s.gamesPlayed} <span className="freq-unit">GP</span></span>
                    </div>
                  ))}
                </div>
              </>
            )}
        </>
      )}

      {tab === 'history' && (
        <div className="analytics-history-wrap">
          <div className="analytics-section-label">
            <Clock size={13} /> Match History {history.length > 0 && `(${history.length})`}
          </div>
          {history.length === 0 ? (
            <p className="muted-hint" style={{ padding: '24px 0', textAlign: 'center' }}>
              No matches played yet in this session.
            </p>
          ) : (
            <ul className="history-list">
              {history.map(e => (
                <li key={e.id} className="history-item">
                  <div className="history-time">{e.timestamp}</div>
                  <div className="history-match">
                    {e.mode?.includes('(') && (
                      <div className="history-court-tag">{e.mode.match(/\(([^)]+)\)/)?.[1]}</div>
                    )}
                    <div>{e.players}</div>
                  </div>
                  <div className="history-winner">
                    <Trophy size={11} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                    {e.winner}
                  </div>
                  {e.score && <div className="history-score">{e.score}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
