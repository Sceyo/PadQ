// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { CourtCard } from '@/app/queue/components/CourtCard/CourtCard';
import { CourtScoreModal, type PendingCourtMatch } from '@/app/queue/components/CourtScoreModal/CourtScoreModal';
import { PartnerPanel, getPlayerLocationLabel, getCompatiblePartnerPlayers } from '@/app/queue/components/LiveManagement/LiveManagement';
import { AnalyticsDashboard } from '@/app/queue/components/AnalyticsDashboard/AnalyticsDashboard';
import type { CourtSlot } from '@/lib/sessionService';
import type { PlayerStat } from '@/app/queue/lib/types';

afterEach(() => cleanup());

const mockSlotComplete: CourtSlot = {
  id: 'court-1',
  name: 'Court 1',
  onCourt: ['Ben Johns', 'Anna Leigh Waters', 'Tyson McGuffin', 'Catherine Parenteau'],
};

const mockSlotIncomplete: CourtSlot = {
  id: 'court-2',
  name: 'Court 2',
  onCourt: ['Collin Johns', 'Jorja Johnson'], // only 2 players (waiting for 2 more)
};

const mockDoublesMatch: PendingCourtMatch = {
  courtId: 'court-1',
  courtName: 'Court 1',
  side: 'A',
  teamA: ['Ben Johns', 'Anna Leigh Waters'],
  teamB: ['Tyson McGuffin', 'Catherine Parenteau'],
  mode: 'doubles',
};

describe('V1 Frontend Component & Interaction Release Stress Suite', () => {
  describe('Suite 1: CourtCard Component Layout & Interactive Scenarios', () => {
    it('renders team containers, player chips, & connectors, and triggers win callbacks for host', () => {
      const onWin = vi.fn();
      const onEdit = vi.fn();
      const { getByText, container } = render(
        <CourtCard
          slot={mockSlotComplete}
          statsMap={{}}
          isHost={true}
          onWin={onWin}
          onEdit={onEdit}
        />
      );

      // Header tokens
      expect(getByText('Court 1')).toBeTruthy();
      expect(container.querySelector('[class*="liveDot"]')).toBeTruthy();
      expect(getByText('VS')).toBeTruthy();

      // Team containers
      expect(getByText('Team 1')).toBeTruthy();
      expect(getByText('Team 2')).toBeTruthy();

      // Teammate names
      expect(getByText('Ben Johns')).toBeTruthy();
      expect(getByText('Anna Leigh Waters')).toBeTruthy();
      expect(getByText('Tyson McGuffin')).toBeTruthy();
      expect(getByText('Catherine Parenteau')).toBeTruthy();

      // Partner connector "&"
      const connectors = container.querySelectorAll('[class*="partnerConnector"]');
      expect(connectors.length).toBe(2);

      // Host win buttons
      const winBtnA = getByText(/Ben Johns & Anna Leigh Waters win/i);
      const winBtnB = getByText(/Tyson McGuffin & Catherine Parenteau win/i);
      expect(winBtnA).toBeTruthy();
      expect(winBtnB).toBeTruthy();

      // Click Team A win
      fireEvent.click(winBtnA);
      expect(onWin).toHaveBeenCalledWith('court-1', 'A');

      // Click Team B win
      fireEvent.click(winBtnB);
      expect(onWin).toHaveBeenCalledWith('court-1', 'B');

      // Click Edit positions button
      const editBtn = container.querySelector('[class*="editBtn"]');
      expect(editBtn).toBeTruthy();
      fireEvent.click(editBtn!);
      expect(onEdit).toHaveBeenCalledWith('court-1');
    });

    it('hides host win buttons and edit controls when rendered in spectator/viewer mode', () => {
      const onWin = vi.fn();
      const onEdit = vi.fn();
      const { queryByText, container } = render(
        <CourtCard
          slot={mockSlotComplete}
          statsMap={{}}
          isHost={false}
          onWin={onWin}
          onEdit={onEdit}
        />
      );

      // Player chips and teams still visible
      expect(queryByText('Ben Johns')).toBeTruthy();
      expect(queryByText('Anna Leigh Waters')).toBeTruthy();

      // Host win buttons and edit button MUST NOT exist
      expect(queryByText(/win$/i)).toBeNull();
      expect(container.querySelector('.editBtn')).toBeNull();
    });

    it('displays "Waiting for players…" when fewer than 4 players are on court', () => {
      const onWin = vi.fn();
      const { getByText, queryByText } = render(
        <CourtCard
          slot={mockSlotIncomplete}
          statsMap={{}}
          isHost={true}
          onWin={onWin}
        />
      );

      expect(getByText('Waiting for players…')).toBeTruthy();
      expect(queryByText(/win$/i)).toBeNull();
    });
  });

  describe('Suite 2: CourtScoreModal Interactive Lifecycle & Validation', () => {
    it('provides 1-tap quick score presets that apply immediately', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      const { getByText } = render(
        <CourtScoreModal
          isOpen={true}
          match={mockDoublesMatch}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      // Verify all 7 presets are present
      ['11 – 9', '11 – 8', '11 – 7', '11 – 6', '11 – 5', '11 – 3', '11 – 0'].forEach(preset => {
        expect(getByText(preset)).toBeTruthy();
      });

      // Tap 11 – 7 preset
      fireEvent.click(getByText('11 – 7'));
      fireEvent.click(getByText(/Save Score & Continue/i));
      expect(onConfirm).toHaveBeenCalledWith('11 – 7');
    });

    it('supports custom typing with auto-tab and supports skip/cancel actions', () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      const { getByText, getByLabelText } = render(
        <CourtScoreModal
          isOpen={true}
          match={mockDoublesMatch}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      );

      const loserInput = getByLabelText('Score for Tyson McGuffin & Catherine Parenteau');
      fireEvent.change(loserInput, { target: { value: '4' } });

      fireEvent.click(getByText(/Save Score & Continue/i));
      expect(onConfirm).toHaveBeenCalledWith('11 – 4');

      // Skip score calls onConfirm with undefined
      fireEvent.click(getByText('Skip Score'));
      expect(onConfirm).toHaveBeenCalledWith(undefined);

      // Cancel calls onCancel
      fireEvent.click(getByText('Cancel'));
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Suite 3: PartnerPanel (Option 2 Global Pairing UI) Lifecycle', () => {
    it('displays player location badges and permits pairing across courts and queue', () => {
      const players = ['Ben Johns', 'Anna Leigh Waters', 'Dylan Frazier', 'Collin Johns'];
      const playerGroups = [
        ['Dylan Frazier'], // Queue
        ['Ben Johns', 'Anna Leigh Waters'], // Court 1
        ['Collin Johns'], // Court 2
      ];
      const onChange = vi.fn();

      // Test location helpers directly
      expect(getPlayerLocationLabel('Dylan Frazier', playerGroups)).toBe('Queue');
      expect(getPlayerLocationLabel('Ben Johns', playerGroups)).toBe('Court 1');
      expect(getPlayerLocationLabel('Collin Johns', playerGroups)).toBe('Court 2');
      expect(getCompatiblePartnerPlayers(players, playerGroups, 'Ben Johns')).toEqual(players);

      const { getByText, container } = render(
        <PartnerPanel
          players={players}
          playerGroups={playerGroups}
          pairs={[]}
          onChange={onChange}
        />
      );

      // Open panel
      fireEvent.click(getByText(/Set Partners/i));

      // Verify updated Option 2 copy
      expect(getByText(/Pair any two players across courts or queue/i)).toBeTruthy();

      // Verify location tags in the UI
      expect(getByText('Queue')).toBeTruthy();
      expect(container.querySelectorAll('.partner-player-loc').length).toBe(4);
      expect(getByText('Court 2')).toBeTruthy();

      // Tap Ben Johns (Court 1)
      const benBtn = getByText('Ben Johns').closest('button')!;
      fireEvent.click(benBtn);
      expect(benBtn.className).toContain('partner-player-btn--selected');

      // Dylan Frazier (Queue) is visible and clickable!
      const dylanBtn = getByText('Dylan Frazier').closest('button')!;
      fireEvent.click(dylanBtn);

      // New partner chip is created!
      expect(getByText(/Ben Johns & Dylan Frazier/i)).toBeTruthy();

      // Save pairs
      fireEvent.click(getByText(/Save 1 pair/i));
      expect(onChange).toHaveBeenCalledWith([['Ben Johns', 'Dylan Frazier']]);
    });
  });

  describe('Suite 4: AnalyticsDashboard Standings Table Tiebreak Display', () => {
    it('renders Point Differential (Diff) and Opponent Win % (MS) with positive and negative indicators', () => {
      const statsWithDiff: PlayerStat[] = [
        {
          name: 'Ben Johns',
          rank: 'Diamond',
          wins: 4,
          losses: 0,
          gamesPlayed: 4,
          winRate: 100,
          streak: 4,
          pointDiff: 17,
          pointsScored: 44,
          pointsConceded: 27,
          scoredGames: 4,
          matchupStrength: 65,
        },
        {
          name: 'JW Johnson',
          rank: 'Silver',
          wins: 1,
          losses: 3,
          gamesPlayed: 4,
          winRate: 25,
          streak: 0,
          pointDiff: -12,
          pointsScored: 30,
          pointsConceded: 42,
          scoredGames: 4,
          matchupStrength: 42,
        },
      ];

      const { container } = render(<AnalyticsDashboard stats={statsWithDiff} />);

      // Headers exist
      const ths = Array.from(container.querySelectorAll('.analytics-table th')).map(th => th.textContent);
      expect(ths).toContain('Diff');
      expect(ths).toContain('MS');

      // Positive diff has + sign
      const rows = container.querySelectorAll('.analytics-table tbody tr');
      expect(rows[0].textContent).toContain('+17');
      expect(rows[0].textContent).toContain('65%');

      // Negative diff has - sign
      expect(rows[1].textContent).toContain('-12');
      expect(rows[1].textContent).toContain('42%');
    });
  });
});
