/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { QueuePanel } from '@/app/queue/components/QueuePanel/QueuePanel';
import type { QueueViewModel } from '@/app/queue/lib/viewModels';

describe('QueuePanel Accordion suite (Option A)', () => {
  beforeEach(() => {
    cleanup();
  });

  const mockQueue: QueueViewModel = {
    nextUp: [{ name: 'Player 1' }, { name: 'Player 2' }, { name: 'Player 3' }, { name: 'Player 4' }],
    waiting: [{ name: 'Player 11', etaLabel: '~10m' }, { name: 'Player 12' }, { name: 'Player 13' }],
    onBreak: [],
  };

  it('renders UP NEXT players always visible', () => {
    render(<QueuePanel queue={mockQueue} onSelectPlayer={vi.fn()} />);

    expect(screen.getByText('UP NEXT')).toBeDefined();
    expect(screen.getByText('Player 1')).toBeDefined();
    expect(screen.getByText('Player 2')).toBeDefined();
    expect(screen.getByText('Player 3')).toBeDefined();
    expect(screen.getByText('Player 4')).toBeDefined();
  });

  it('keeps WAITING collapsed by default with compact summary and expands on click', () => {
    const onSelectPlayer = vi.fn();
    render(<QueuePanel queue={mockQueue} onSelectPlayer={onSelectPlayer} />);

    // Header displays collapsed summary
    expect(screen.getByText('WAITING · 3')).toBeDefined();
    expect(screen.getByText(/\(Player 11, Player 12, Player 13\)/i)).toBeDefined();

    // Player 11 button chip is not rendered when collapsed
    expect(screen.queryByRole('button', { name: /Player 11/i })).toBeNull();

    // Click "Expand waiting queue" button
    const expandBtn = screen.getByRole('button', { name: /Expand waiting queue/i });
    fireEvent.click(expandBtn);

    // Now Player 11, 12, 13 button chips are rendered
    expect(screen.getByRole('button', { name: /Player 11/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Player 12/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Player 13/i })).toBeDefined();

    // Click Player 11
    fireEvent.click(screen.getByRole('button', { name: /Player 11/i }));
    expect(onSelectPlayer).toHaveBeenCalledWith('Player 11', 'waiting');

    // Click "Hide" collapses it back
    const collapseBtn = screen.getByRole('button', { name: /Collapse waiting queue/i });
    fireEvent.click(collapseBtn);
    expect(screen.queryByRole('button', { name: /Player 11/i })).toBeNull();
  });

  it('completely hides ON BREAK section when 0 players are on break', () => {
    render(<QueuePanel queue={mockQueue} onSelectPlayer={vi.fn()} />);

    expect(screen.queryByText(/ON BREAK/i)).toBeNull();
    expect(screen.queryByText(/No players on break/i)).toBeNull();
  });

  it('renders ON BREAK as collapsible accordion when players are on break', () => {
    const queueWithBreak: QueueViewModel = {
      ...mockQueue,
      onBreak: [{ name: 'Player X' }, { name: 'Player Y' }],
    };

    render(<QueuePanel queue={queueWithBreak} onSelectPlayer={vi.fn()} />);

    expect(screen.getByText('ON BREAK · 2')).toBeDefined();
    expect(screen.getByText(/\(Player X, Player Y\)/i)).toBeDefined();

    // Expands on click
    const breakExpandBtn = screen.getByRole('button', { name: /Expand break list/i });
    fireEvent.click(breakExpandBtn);

    expect(screen.getByRole('button', { name: /Player X/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /Player Y/i })).toBeDefined();
  });
});
