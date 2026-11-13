// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { WaitingQueueChips } from '../app/watch/[sessionId]/LiveCourtStatus';
import { AnalyticsDashboard } from '../app/queue/components/AnalyticsDashboard/AnalyticsDashboard';

describe('Spectator & Analytics compact player names', () => {
  it('renders compact display names in WaitingQueueChips while keeping raw names in aria-label and callbacks', () => {
    const onToggle = vi.fn();
    const { container } = render(
      <WaitingQueueChips
        waitingQueue={['Quang Dong', 'Anna Leigh Waters']}
        playersPerMatch={4}
        activeCourtCount={1}
        watchedPlayer={null}
        onToggleWatchPlayer={onToggle}
      />
    );

    // Visible text should be shortened
    expect(container.textContent).toContain('Q. Dong');
    expect(container.textContent).toContain('A.L. Waters');

    // Button aria-label should retain the full name
    const buttons = container.querySelectorAll('button');
    expect(buttons[0].getAttribute('aria-label')).toBe('Turn alert: Quang Dong (off)');
    expect(buttons[1].getAttribute('aria-label')).toBe('Turn alert: Anna Leigh Waters (off)');

    // Clicking dispatches the raw full name
    fireEvent.click(buttons[0]);
    expect(onToggle).toHaveBeenCalledWith('Quang Dong');
  });

  it('renders compact display names in AnalyticsDashboard table rows and cards with title attribute', () => {
    const stats = [
      {
        name: 'Anna Leigh Waters',
        wins: 3,
        losses: 0,
        gamesPlayed: 3,
        pointsScored: 33,
        pointsConceded: 12,
        pointDiff: 21,
        winRate: 100,
        streak: 3,
        rank: 'Diamond' as const,
        matchupStrength: 50,
      },
    ];

    const { container } = render(
      <AnalyticsDashboard stats={stats} />
    );

    expect(container.textContent).toContain('A.L. Waters');
    const nameEl = container.querySelector('strong');
    expect(nameEl?.getAttribute('title')).toBe('Anna Leigh Waters');
  });
});
