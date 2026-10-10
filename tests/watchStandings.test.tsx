// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RankBadge } from '@/app/queue/components/atoms/RankBadge';
import { Flame } from 'lucide-react';
import type { PlayerStat } from '@/app/queue/lib/types';

const mockStats: PlayerStat[] = [
  { name: 'Alice', rank: 'Diamond', wins: 5, losses: 1, gamesPlayed: 6, winRate: 83, streak: 3 },
  { name: 'Bob', rank: 'Gold', wins: 4, losses: 2, gamesPlayed: 6, winRate: 67, streak: 2 },
  { name: 'Charlie', rank: 'Silver', wins: 2, losses: 4, gamesPlayed: 6, winRate: 33, streak: 0 },
];

// Standings section matching app/watch/[sessionId]/page.tsx
const WatchStandingsSection: React.FC<{ stats: PlayerStat[] }> = ({ stats }) => (
  <div className="w-section">
    <div className="w-stats-table-wrap w-stats-desktop-only">
      <table className="w-stats-table">
        <thead>
          <tr>
            <th>#</th><th>Player</th><th>Rank</th><th>W</th><th>L</th><th>GP</th><th>Win%</th><th>🔥</th>
          </tr>
        </thead>
        <tbody>
          {[...stats].sort((a, b) => b.wins - a.wins).map((s, i) => (
            <tr key={s.name}>
              <td className="w-col-num">{i + 1}</td>
              <td><strong>{s.name}</strong></td>
              <td><RankBadge rank={s.rank} className="w-rank-badge" /></td>
              <td className="w-col-win">{s.wins}</td>
              <td className="w-col-loss">{s.losses}</td>
              <td>{s.gamesPlayed}</td>
              <td>{s.winRate}%</td>
              <td>{s.streak >= 2 ? s.streak : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <div className="w-stats-mobile-cards">
      {[...stats].sort((a, b) => b.wins - a.wins).map((s, i) => (
        <div key={s.name} className={`w-player-card ${i === 0 ? 'w-player-card--top' : ''}`}>
          <div className="w-card-header">
            <div className="w-card-player">
              <span className="w-card-rank-num">#{i + 1}</span>
              <strong className="w-card-name">{s.name}</strong>
            </div>
            <div className="w-card-badges">
              <RankBadge rank={s.rank} className="w-rank-badge" />
              {s.streak >= 2 && (
                <span className="w-streak-badge"><Flame size={11} />{s.streak}</span>
              )}
            </div>
          </div>
          <div className="w-card-stats">
            <div className="w-card-stat-item">
              <span className="w-card-stat-label">W - L</span>
              <span className="w-card-stat-val">
                <span className="w-col-win">{s.wins}</span> - <span className="w-col-loss">{s.losses}</span>
              </span>
            </div>
            <div className="w-card-stat-item">
              <span className="w-card-stat-label">GP</span>
              <span className="w-card-stat-val">{s.gamesPlayed}</span>
            </div>
            <div className="w-card-stat-item">
              <span className="w-card-stat-label">Win %</span>
              <span className="w-card-stat-val">{s.winRate}%</span>
            </div>
            <div className="w-card-stat-item">
              <span className="w-card-stat-label">Streak</span>
              <span className="w-card-stat-val">{s.streak}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

describe('Watch Standings Mobile Card Parity', () => {
  it('renders both desktop table and mobile cards for spectators', () => {
    const { container } = render(<WatchStandingsSection stats={mockStats} />);

    const desktopWrap = container.querySelector('.w-stats-table-wrap.w-stats-desktop-only');
    expect(desktopWrap).not.toBeNull();
    expect(desktopWrap?.querySelectorAll('tbody tr').length).toBe(3);

    const mobileCards = container.querySelector('.w-stats-mobile-cards');
    expect(mobileCards).not.toBeNull();
    const cards = mobileCards?.querySelectorAll('.w-player-card');
    expect(cards?.length).toBe(3);

    // Top player has top accent class
    expect(cards?.[0].classList.contains('w-player-card--top')).toBe(true);

    // First card contains rank, name, stats
    const firstCard = cards?.[0];
    expect(firstCard?.querySelector('.w-card-rank-num')?.textContent).toBe('#1');
    expect(firstCard?.querySelector('.w-card-name')?.textContent).toBe('Alice');
    expect(firstCard?.textContent).toContain('Diamond');
    expect(firstCard?.textContent).toContain('W - L');
    expect(firstCard?.textContent).toContain('GP');
    expect(firstCard?.textContent).toContain('Win %');
    expect(firstCard?.textContent).toContain('Streak');
  });
});
