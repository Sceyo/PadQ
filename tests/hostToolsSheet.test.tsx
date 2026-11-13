/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { HostToolsSheet } from '@/app/queue/components/HostToolsSheet/HostToolsSheet';

afterEach(() => cleanup());

describe('HostToolsSheet — Match Scores slider toggle', () => {
  it('renders slider switch in ON state when scorePromptEnabled is true', () => {
    const onToggle = vi.fn();
    render(
      <HostToolsSheet
        isOpen={true}
        onClose={vi.fn()}
        onAddPlayer={vi.fn()}
        scorePromptEnabled={true}
        onToggleScorePrompt={onToggle}
      />
    );

    const toggle = screen.getByRole('switch', { name: /Toggle Match Scores/i });
    expect(toggle).toBeDefined();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.textContent).toContain('ON');

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders slider switch in OFF state when scorePromptEnabled is false', () => {
    const onToggle = vi.fn();
    render(
      <HostToolsSheet
        isOpen={true}
        onClose={vi.fn()}
        onAddPlayer={vi.fn()}
        scorePromptEnabled={false}
        onToggleScorePrompt={onToggle}
      />
    );

    const toggle = screen.getByRole('switch', { name: /Toggle Match Scores/i });
    expect(toggle).toBeDefined();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.textContent).toContain('OFF');

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('clears input and closes sheet when onAddPlayer succeeds', () => {
    const onAdd = vi.fn().mockReturnValue(true);
    const onClose = vi.fn();
    render(
      <HostToolsSheet
        isOpen={true}
        onClose={onClose}
        onAddPlayer={onAdd}
        scorePromptEnabled={true}
        onToggleScorePrompt={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Player name…') as HTMLInputElement;
    expect(input.maxLength).toBe(60);

    fireEvent.change(input, { target: { value: 'New Player' } });
    const addBtn = screen.getByRole('button', { name: 'Add Player' });
    fireEvent.click(addBtn);

    expect(onAdd).toHaveBeenCalledWith('New Player');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays inline error and keeps drawer open when onAddPlayer returns false', () => {
    const onAdd = vi.fn().mockReturnValue(false);
    const onClose = vi.fn();
    render(
      <HostToolsSheet
        isOpen={true}
        onClose={onClose}
        onAddPlayer={onAdd}
        scorePromptEnabled={true}
        onToggleScorePrompt={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Player name…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Duplicate Player' } });
    const addBtn = screen.getByRole('button', { name: 'Add Player' });
    fireEvent.click(addBtn);

    expect(onAdd).toHaveBeenCalledWith('Duplicate Player');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/"Duplicate Player" could not be added/)).toBeDefined();
    expect(input.value).toBe('Duplicate Player');
  });

  it('renders Expected Late Arrivals as a collapsible tab with Check In All inside the expanded dropdown', () => {
    const onCheckIn = vi.fn().mockReturnValue(true);
    const onCheckInAll = vi.fn().mockReturnValue(true);
    const onDismiss = vi.fn();
    render(
      <HostToolsSheet
        isOpen={true}
        onClose={vi.fn()}
        onAddPlayer={vi.fn()}
        scorePromptEnabled={true}
        onToggleScorePrompt={vi.fn()}
        lateArrivals={['Lee Chong', 'Anna Leigh Waters']}
        onCheckInLateArrival={onCheckIn}
        onCheckInAllLateArrivals={onCheckInAll}
        onDismissLateArrival={onDismiss}
      />
    );

    // Tab toggle button is visible with count, but content and Check In All button are hidden while collapsed
    const tabBtn = screen.getByRole('button', { name: /Expected Late Arrivals \(2\)/i });
    expect(tabBtn).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Check in Lee Chong' })).toBeNull();
    expect(screen.queryByRole('button', { name: /Check in all late arrivals/i })).toBeNull();

    // Expand tab
    fireEvent.click(tabBtn);

    // Filter is NOT shown when <= 6 late arrivals
    expect(screen.queryByPlaceholderText(/Filter late arrivals/i)).toBeNull();

    // Names are sanitized with formatDisplayName while full names remain in title & aria-label
    expect(screen.getByText('L. Chong').getAttribute('title')).toBe('Lee Chong');
    expect(screen.getByText('A.L. Waters').getAttribute('title')).toBe('Anna Leigh Waters');

    // Check In All button is now visible inside the expanded dropdown and triggers callback
    const checkInAllBtn = screen.getByRole('button', { name: /Check in all late arrivals/i });
    expect(checkInAllBtn).toBeDefined();
    fireEvent.click(checkInAllBtn);
    expect(onCheckInAll).toHaveBeenCalledTimes(1);

    const checkInBtn = screen.getByRole('button', { name: 'Check in Lee Chong' });
    fireEvent.click(checkInBtn);
    expect(onCheckIn).toHaveBeenCalledWith('Lee Chong');
  });

  it('shows smart filter inside Expected Late Arrivals dropdown when more than 6 late arrivals exist', () => {
    render(
      <HostToolsSheet
        isOpen={true}
        onClose={vi.fn()}
        onAddPlayer={vi.fn()}
        scorePromptEnabled={true}
        onToggleScorePrompt={vi.fn()}
        lateArrivals={['Lee Chong', 'Anna Leigh Waters', 'Ben Johns', 'Quang Dong', 'Luke', 'Jordan', 'Jebidiah']}
        onCheckInLateArrival={vi.fn()}
        onCheckInAllLateArrivals={vi.fn()}
        onDismissLateArrival={vi.fn()}
        initialSection="late"
      />
    );

    const filterInput = screen.getByPlaceholderText(/Filter late arrivals/i) as HTMLInputElement;
    expect(filterInput).toBeDefined();

    // Filter by raw first name "Lee" -> matches "Lee Chong" (displayed as "L. Chong")
    fireEvent.change(filterInput, { target: { value: 'lee' } });
    expect(screen.getByText('L. Chong')).toBeDefined();
    expect(screen.queryByText('Jebidiah')).toBeNull();

    // Clear filter button restores full list
    const clearBtn = screen.getByRole('button', { name: /Clear late arrival filter/i });
    fireEvent.click(clearBtn);
    expect(screen.getByText('Jebidiah')).toBeDefined();
  });
});
