// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, afterEach } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { AnalyticsDashboard } from '@/app/queue/components/AnalyticsDashboard/AnalyticsDashboard';
import type { PlayerStat } from '@/app/queue/lib/types';

afterEach(() => cleanup());

const mockStats: PlayerStat[] = [
  { name: 'Alice', rank: 'Diamond', wins: 5, losses: 1, gamesPlayed: 6, winRate: 83, streak: 3 },
  { name: 'Bob', rank: 'Gold', wins: 4, losses: 2, gamesPlayed: 6, winRate: 67, streak: 2 },
  { name: 'Charlie', rank: 'Silver', wins: 3, losses: 3, gamesPlayed: 6, winRate: 50, streak: 0 },
];

describe('AnalyticsDashboard component', () => {
  it('renders both desktop table and mobile player cards for session leaderboard', () => {
    const { container } = render(
      <AnalyticsDashboard stats={mockStats} />
    );

    // Desktop table container exists
    const desktopTable = container.querySelector('.analytics-table-scroll.analytics-desktop-only');
    expect(desktopTable).not.toBeNull();
    expect(desktopTable?.querySelectorAll('tbody tr').length).toBe(3);

    // Mobile cards container exists
    const mobileCards = container.querySelector('.analytics-mobile-cards');
    expect(mobileCards).not.toBeNull();

    const cards = mobileCards?.querySelectorAll('.analytics-player-card');
    expect(cards?.length).toBe(3);

    // Top player card has accent class
    expect(cards?.[0].classList.contains('analytics-top-card')).toBe(true);

    // Card contains rank, name, and stat labels
    const firstCard = cards?.[0];
    expect(firstCard?.querySelector('.analytics-card-rank-num')?.textContent).toBe('#1');
    expect(firstCard?.querySelector('.analytics-card-name')?.textContent).toBe('Alice');
    expect(firstCard?.textContent).toContain('Diamond');
    expect(firstCard?.textContent).toContain('W - L');
    expect(firstCard?.textContent).toContain('GP');
    expect(firstCard?.textContent).toContain('Win %');
    expect(firstCard?.textContent).toContain('Streak');
    expect(firstCard?.textContent).toContain('Diff');
    expect(firstCard?.textContent).toContain('Matchup');
  });

  it('renders Point Differential (Diff) and Matchup Strength (MS) columns in desktop table and mobile cards', () => {
    const statsWithDiff: PlayerStat[] = [
      { name: 'Alice', rank: 'Diamond', wins: 5, losses: 1, gamesPlayed: 6, winRate: 83, streak: 3, pointDiff: 14, pointsScored: 60, pointsConceded: 46, scoredGames: 6, matchupStrength: 58 },
      { name: 'Bob', rank: 'Gold', wins: 4, losses: 2, gamesPlayed: 6, winRate: 67, streak: 2, pointDiff: -4, pointsScored: 45, pointsConceded: 49, scoredGames: 6, matchupStrength: 45 },
    ];
    const { container } = render(<AnalyticsDashboard stats={statsWithDiff} />);
    const ths = Array.from(container.querySelectorAll('.analytics-table th')).map(th => th.textContent);
    expect(ths).toContain('Diff');
    expect(ths).toContain('MS');

    // Values in desktop row
    const firstRow = container.querySelector('.analytics-table tbody tr');
    expect(firstRow?.textContent).toContain('+14');
    expect(firstRow?.textContent).toContain('58%');

    // Values in mobile card
    const firstCard = container.querySelector('.analytics-mobile-cards .analytics-player-card');
    expect(firstCard?.textContent).toContain('Diff');
    expect(firstCard?.textContent).toContain('+14');
    expect(firstCard?.textContent).toContain('Matchup');
    expect(firstCard?.textContent).toContain('58%');
  });

  it('renders frequency chart with clear GP units', () => {
    const { container } = render(
      <AnalyticsDashboard stats={mockStats} />
    );

    const freqChart = container.querySelector('.frequency-chart');
    expect(freqChart).not.toBeNull();

    const rows = freqChart?.querySelectorAll('.freq-row');
    expect(rows?.length).toBe(3);

    const firstRow = rows?.[0];
    expect(firstRow?.querySelector('.freq-name')?.textContent).toBe('Alice');
    expect(firstRow?.querySelector('.freq-count')?.textContent).toContain('6 GP');
  });

  it('renders match history items when switching to History tab', () => {
    const history = [
      { id: 1, mode: 'doubles (Court 1)', players: 'Alice & Bob vs Charlie & Dave', winner: 'Alice & Bob', score: '11-7', timestamp: '4:20 PM' },
      { id: 2, mode: 'doubles (Court 2)', players: 'Eve & Frank vs Grace & Heidi', winner: 'Eve & Frank', score: '11-5', timestamp: '4:25 PM' },
    ];

    const { getByText, container } = render(
      <AnalyticsDashboard stats={mockStats} history={history} />
    );

    // Switch to History tab
    const historyTabBtn = getByText('History');
    fireEvent.click(historyTabBtn);

    expect(getByText('Alice & Bob vs Charlie & Dave')).toBeDefined();
    expect(getByText('11-7')).toBeDefined();
    const historyItems = container.querySelectorAll('.history-item');
    expect(historyItems.length).toBe(2);
  });

  it('renders mobile cards for skill bracket standings', () => {
    const skilledBrackets = {
      beginner: ['Charlie'],
      intermediate: ['Bob'],
      advanced: ['Alice'],
    };

    const { container } = render(
      <AnalyticsDashboard
        stats={mockStats}
        skilledBrackets={skilledBrackets}
      />
    );

    const mobileCards = container.querySelectorAll('.analytics-mobile-cards');
    expect(mobileCards.length).toBeGreaterThan(0);
    const firstCard = mobileCards[0].querySelector('.analytics-player-card');
    expect(firstCard).not.toBeNull();
  });
});
