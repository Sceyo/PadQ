// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SitOutPanel } from '@/app/queue/components/SitOutPanel/SitOutPanel';
import { DoublesMatch } from '@/app/queue/components/DoublesMatch/DoublesMatch';
import { CourtCard } from '@/app/queue/components/CourtCard/CourtCard';

describe('SitOutPanel (Phase 2 Visibility & Return)', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders on-break strip with 1-tap return button and status pill when players are sitting out', () => {
    const handleToggle = vi.fn();
    render(
      <SitOutPanel
        players={['Alice', 'Bob', 'Charlie']}
        sittingOut={['Bob']}
        onToggle={handleToggle}
      />,
    );

    // On Break strip is visible immediately
    const strip = screen.getByRole('region', { name: /players on break/i });
    expect(strip).toBeDefined();
    expect(strip.textContent).toContain('On Break (1)');
    expect(strip.textContent).toContain('Bob');

    // Exception status pill exists
    const pill = strip.querySelector('.status-pill--on-break');
    expect(pill).toBeDefined();
    expect(pill?.textContent).toBe('On break');

    // 1-tap Return button triggers onToggle with 44px min target accessible label
    const returnBtn = screen.getByRole('button', { name: /return bob to queue/i });
    expect(returnBtn).toBeDefined();
    fireEvent.click(returnBtn);
    expect(handleToggle).toHaveBeenCalledWith('Bob');
  });

  it('omits on-break strip when no players are sitting out', () => {
    const handleToggle = vi.fn();
    render(
      <SitOutPanel
        players={['Alice', 'Bob', 'Charlie']}
        sittingOut={[]}
        onToggle={handleToggle}
      />,
    );

    expect(screen.queryByRole('region', { name: /players on break/i })).toBeNull();
    const toggleBtn = screen.getByRole('button', { name: /manage sit out/i });
    expect(toggleBtn.textContent).toContain('Manage Sit Out');
  });

  it('expands full roster management drawer to sit out or return any player', () => {
    const handleToggle = vi.fn();
    render(
      <SitOutPanel
        players={['Alice', 'Bob']}
        sittingOut={['Bob']}
        onToggle={handleToggle}
      />,
    );

    const toggleBtn = screen.getByRole('button', { name: /manage sit out/i });
    fireEvent.click(toggleBtn);

    // Alice is active, button says "Sit Out"
    const sitOutAlice = screen.getByRole('button', { name: /sit out alice/i });
    expect(sitOutAlice).toBeDefined();
    fireEvent.click(sitOutAlice);
    expect(handleToggle).toHaveBeenCalledWith('Alice');

    // Bob is sitting out, button says "Return"
    const returnBob = screen.getByRole('button', { name: /return bob$/i });
    expect(returnBob).toBeDefined();
    fireEvent.click(returnBob);
    expect(handleToggle).toHaveBeenCalledWith('Bob');
  });

  it('disables replace button on single-court DoublesMatch when scoring has started (F5 guard)', () => {
    const handleMarkAbsent = vi.fn();
    const { rerender } = render(
      <DoublesMatch
        firstFour={['P1', 'P2', 'P3', 'P4']}
        statsMap={{}}
        isHost={true}
        onMatch={vi.fn()}
        onMarkAbsent={handleMarkAbsent}
        replaceDisabled={false}
      />,
    );

    const absentBtns = screen.getAllByTitle(/can't play now|mark absent/i);
    expect(absentBtns).toHaveLength(4);
    expect((absentBtns[0] as HTMLButtonElement).disabled).toBe(false);

    // Now simulate scoring started via replaceDisabled={true}
    rerender(
      <DoublesMatch
        firstFour={['P1', 'P2', 'P3', 'P4']}
        statsMap={{}}
        isHost={true}
        onMatch={vi.fn()}
        onMarkAbsent={handleMarkAbsent}
        replaceDisabled={true}
      />,
    );

    const blockedBtns = screen.getAllByTitle('Cannot replace player after scoring has started');
    expect(blockedBtns).toHaveLength(4);
    expect((blockedBtns[0] as HTMLButtonElement).disabled).toBe(true);
  });

  it('renders replace called player action on multi-court CourtCard for host (Phase 5b-4)', () => {
    const handleMarkAbsent = vi.fn();
    render(
      <CourtCard
        slot={{ id: 'c1', name: 'Court 1', onCourt: ['P1', 'P2', 'P3', 'P4'] }}
        statsMap={{}}
        isHost={true}
        onWin={vi.fn()}
        onMarkAbsent={handleMarkAbsent}
      />,
    );

    const replaceP1 = screen.getByRole('button', { name: /can't play now.*replace p1|replace p1/i });
    expect(replaceP1).toBeDefined();
    fireEvent.click(replaceP1);
    expect(handleMarkAbsent).toHaveBeenCalledWith('P1');
  });
});
