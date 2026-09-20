// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { RecapModal } from '@/app/queue/components/RecapCard/RecapModal';
import type { PlayerStat, MatchHistoryEntry } from '@/app/queue/lib/types';

afterEach(() => cleanup());

const mockStats: PlayerStat[] = [
  { name: 'Alice', rank: 'Diamond', wins: 5, losses: 1, gamesPlayed: 6, winRate: 83, streak: 3 },
  { name: 'Bob', rank: 'Gold', wins: 4, losses: 2, gamesPlayed: 6, winRate: 67, streak: 2 },
  { name: 'Charlie', rank: 'Silver', wins: 3, losses: 3, gamesPlayed: 6, winRate: 50, streak: 0 },
  { name: 'Dave', rank: 'Bronze', wins: 1, losses: 5, gamesPlayed: 6, winRate: 17, streak: 0 },
];

const mockHistory: MatchHistoryEntry[] = [
  { id: 1, mode: 'doubles', timestamp: '10:00 AM', players: 'Alice & Bob vs Charlie & Dave', winner: 'Alice & Bob', score: '11–7' },
  { id: 2, mode: 'doubles', timestamp: '10:15 AM', players: 'Alice & Charlie vs Bob & Dave', winner: 'Alice & Charlie', score: '11–9' },
];

describe('RecapModal component', () => {
  it('does not render when isOpen is false', () => {
    const onClose = vi.fn();
    const { container } = render(
      <RecapModal
        isOpen={false}
        onClose={onClose}
        stats={mockStats}
        history={mockHistory}
      />
    );
    expect(container.querySelector('.recap-modal-overlay')).toBeNull();
  });

  it('renders correctly when open with default host variant', () => {
    const onClose = vi.fn();
    const { getByText, container } = render(
      <RecapModal
        isOpen={true}
        onClose={onClose}
        stats={mockStats}
        history={mockHistory}
        roomCode="ROOM99"
        mode="Doubles"
      />
    );

    expect(getByText('Shareable Session Recap')).toBeTruthy();
    expect(getByText(/1080×1080/)).toBeTruthy();
    expect(getByText(/ROOM99/)).toBeTruthy();

    // Check variant buttons
    const podiumBtn = getByText('Podium Edition');
    const standingsBtn = getByText('Full Standings');
    expect(podiumBtn.classList.contains('active')).toBe(true);
    expect(standingsBtn.classList.contains('active')).toBe(false);

    // Host variant has podium cards
    expect(container.querySelector('.recap-podium-row')).toBeTruthy();
  });

  it('allows switching to viewer full standings variant', () => {
    const onClose = vi.fn();
    const { getByText, container } = render(
      <RecapModal
        isOpen={true}
        onClose={onClose}
        stats={mockStats}
        history={mockHistory}
        roomCode="ROOM99"
      />
    );

    const standingsBtn = getByText('Full Standings');
    fireEvent.click(standingsBtn);

    expect(standingsBtn.classList.contains('active')).toBe(true);
    expect(container.querySelector('.recap-standings-table')).toBeTruthy();
    expect(container.querySelector('.recap-podium-row')).toBeNull();
  });

  it('initializes in viewer variant when defaultVariant is "viewer"', () => {
    const onClose = vi.fn();
    const { getByText, container } = render(
      <RecapModal
        isOpen={true}
        onClose={onClose}
        stats={mockStats}
        history={mockHistory}
        defaultVariant="viewer"
      />
    );

    const standingsBtn = getByText('Full Standings');
    expect(standingsBtn.classList.contains('active')).toBe(true);
    expect(container.querySelector('.recap-standings-table')).toBeTruthy();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <RecapModal
        isOpen={true}
        onClose={onClose}
        stats={mockStats}
        history={mockHistory}
      />
    );

    fireEvent.click(getByLabelText('Close modal'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <RecapModal
        isOpen={true}
        onClose={onClose}
        stats={mockStats}
        history={mockHistory}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside dialog on overlay', () => {
    const onClose = vi.fn();
    const { container } = render(
      <RecapModal
        isOpen={true}
        onClose={onClose}
        stats={mockStats}
        history={mockHistory}
      />
    );

    const overlay = container.querySelector('.recap-modal-overlay')!;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
