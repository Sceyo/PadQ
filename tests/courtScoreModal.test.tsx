// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, fireEvent } from '@testing-library/react';
import { CourtScoreModal, type PendingCourtMatch } from '@/app/queue/components/CourtScoreModal/CourtScoreModal';

afterEach(() => cleanup());

const mockDoublesMatchA: PendingCourtMatch = {
  courtId: 'court-1',
  courtName: 'Court 1',
  side: 'A',
  teamA: ['Ben Johns', 'Anna Leigh Waters'],
  teamB: ['Tyson McGuffin', 'Catherine Parenteau'],
  mode: 'doubles',
};

const mockDoublesMatchB: PendingCourtMatch = {
  courtId: 'court-2',
  courtName: 'Court 2',
  side: 'B',
  teamA: ['Collin Johns', 'Jorja Johnson'],
  teamB: ['JW Johnson', 'Federico Staksrud'],
  mode: 'doubles',
};

describe('CourtScoreModal component', () => {
  it('does not render when isOpen is false', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <CourtScoreModal
        isOpen={false}
        match={mockDoublesMatchA}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders court name, teams, and default winner score 11 when open', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { getByText, getByLabelText } = render(
      <CourtScoreModal
        isOpen={true}
        match={mockDoublesMatchA}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    expect(getByText('Court 1')).toBeTruthy();
    expect(getByText('Record Final Score')).toBeTruthy();
    expect(getByText('Ben Johns & Anna Leigh Waters')).toBeTruthy();
    expect(getByText('Tyson McGuffin & Catherine Parenteau')).toBeTruthy();

    const winnerInput = getByLabelText('Score for Ben Johns & Anna Leigh Waters') as HTMLInputElement;
    expect(winnerInput.value).toBe('11');
  });

  it('submits score formatted in Team A vs Team B order when Side A wins', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { getByText, getByLabelText } = render(
      <CourtScoreModal
        isOpen={true}
        match={mockDoublesMatchA}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const loserInput = getByLabelText('Score for Tyson McGuffin & Catherine Parenteau');
    fireEvent.change(loserInput, { target: { value: '9' } });

    fireEvent.click(getByText(/Save Score & Continue/i));
    expect(onConfirm).toHaveBeenCalledWith('11 – 9');
  });

  it('submits score formatted in Team A vs Team B order when Side B wins', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { getByText, getByLabelText } = render(
      <CourtScoreModal
        isOpen={true}
        match={mockDoublesMatchB}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    // In mockDoublesMatchB, Side B won. Team A is Collin & Jorja (loser), Team B is JW & Federico (winner).
    const loserInput = getByLabelText('Score for Collin Johns & Jorja Johnson');
    fireEvent.change(loserInput, { target: { value: '7' } });

    fireEvent.click(getByText(/Save Score & Continue/i));
    // Since Side B won 11 to 7, scoreA (Team A) = 7, scoreB (Team B) = 11 -> "7 – 11"
    expect(onConfirm).toHaveBeenCalledWith('7 – 11');
  });

  it('applies quick score presets upon clicking', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { getByText } = render(
      <CourtScoreModal
        isOpen={true}
        match={mockDoublesMatchA}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    // Click 11 – 5 preset button
    const presetBtn = getByText('11 – 5');
    fireEvent.click(presetBtn);

    fireEvent.click(getByText(/Save Score & Continue/i));
    expect(onConfirm).toHaveBeenCalledWith('11 – 5');
  });

  it('calls onConfirm with undefined when Skip Score is tapped', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { getByText } = render(
      <CourtScoreModal
        isOpen={true}
        match={mockDoublesMatchA}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(getByText('Skip Score'));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('calls onCancel when Cancel button or Escape key is pressed', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { getByText } = render(
      <CourtScoreModal
        isOpen={true}
        match={mockDoublesMatchA}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    fireEvent.click(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('renders individual player names for singles matches and handles target presets', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const mockSinglesMatch: PendingCourtMatch = {
      courtId: 'court-1',
      courtName: 'Court 1',
      side: 'A',
      teamA: ['Alice'],
      teamB: ['Bob'],
      mode: 'singles',
    };

    const { getByText, getByRole, getByLabelText } = render(
      <CourtScoreModal
        isOpen={true}
        match={mockSinglesMatch}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    // Shows 1v1 names without ampersand
    expect(getByText('Alice')).toBeTruthy();
    expect(getByText('Bob')).toBeTruthy();

    // Select limit preset 15
    const limit15Btn = getByRole('button', { name: '15' });
    fireEvent.click(limit15Btn);

    const winnerInput = getByLabelText('Score for Alice') as HTMLInputElement;
    expect(winnerInput.value).toBe('15');

    // Tap quick preset '15 – 10'
    fireEvent.click(getByRole('button', { name: '15 – 10' }));

    // Confirm score
    fireEvent.click(getByRole('button', { name: 'Save Score & Continue' }));
    expect(onConfirm).toHaveBeenCalledWith('15 – 10');
  });

  it('enforces win-by-2 margin on deuce scores in CourtScoreModal', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const mockMatch: PendingCourtMatch = {
      courtId: 'court-1',
      courtName: 'Court 1',
      side: 'A',
      teamA: ['Alice'],
      teamB: ['Bob'],
      mode: 'singles',
    };

    const { getByRole, getByLabelText } = render(
      <CourtScoreModal
        isOpen={true}
        match={mockMatch}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    const loserInput = getByLabelText('Score for Bob') as HTMLInputElement;
    // Enter loser score 10 (target is 11) -> deuce triggers winner score to become 12
    fireEvent.change(loserInput, { target: { value: '10' } });

    const winnerInput = getByLabelText('Score for Alice') as HTMLInputElement;
    expect(winnerInput.value).toBe('12');

    // Save Score & Continue
    fireEvent.click(getByRole('button', { name: 'Save Score & Continue' }));
    expect(onConfirm).toHaveBeenCalledWith('12 – 10');
  });

  it('defaults blank opponent score to 0 when Save Score & Continue is clicked', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { getByRole } = render(
      <CourtScoreModal
        isOpen={true}
        match={mockDoublesMatchA}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    // Loser score is left blank -> defaults to 0 (11 - 0 victory for Team A)
    fireEvent.click(getByRole('button', { name: 'Save Score & Continue' }));
    expect(onConfirm).toHaveBeenCalledWith('11 – 0');
  });

  it('defaults blank opponent score to 0 when Side B wins', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    const { getByRole } = render(
      <CourtScoreModal
        isOpen={true}
        match={mockDoublesMatchB}
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    );

    // Loser score is left blank -> defaults to 0 (0 - 11 victory for Team B)
    fireEvent.click(getByRole('button', { name: 'Save Score & Continue' }));
    expect(onConfirm).toHaveBeenCalledWith('0 – 11');
  });
});
