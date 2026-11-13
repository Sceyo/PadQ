// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { SetupView, type SetupViewProps } from '../app/queue/components/SetupView/SetupView';

afterEach(() => cleanup());

const defaultProps: SetupViewProps = {
  gameMode: 'doubles',
  darkMode: true,
  onToggleDark: vi.fn(),
  courtCount: 1,
  onCourtCountChange: vi.fn(),
  maxCourts: 3,
  showAccessPin: false,
  showSkillTagging: false,
  setupPin: '',
  onPinChange: vi.fn(),
  roster: [],
  showRoster: false,
  onToggleRoster: vi.fn(),
  rosterSelected: new Set(),
  onRosterToggle: vi.fn(),
  onSelectAllRoster: vi.fn(),
  onAddFromRoster: vi.fn(),
  onSaveToRoster: vi.fn(),
  onRemoveFromRoster: vi.fn(),
  onSetRosterSkill: vi.fn(),
  tempPlayers: ['Player 1', 'Player 2'],
  currentName: '',
  onCurrentNameChange: vi.fn(),
  pasteInput: '',
  onPasteInputChange: vi.fn(),
  onAddPlayer: vi.fn(),
  onRemoveTempPlayer: vi.fn(),
  onAddFromPaste: vi.fn(),
  onStartQueue: vi.fn(),
  isSaving: false,
  onBack: vi.fn(),
};

describe('SetupView — Check-in & Expected Arrivals', () => {
  it('renders Expected Arrivals section with Check In and Check In All buttons and hides filter at <= 6 players', () => {
    const onCheckInPlayer = vi.fn();
    const onCheckInAll = vi.fn();

    const { getByText, queryByLabelText } = render(
      <SetupView
        {...defaultProps}
        expectedPlayers={['Late Arrival 1', 'Late Arrival 2', 'Late 3', 'Late 4', 'Late 5', 'Late 6']}
        onCheckInPlayer={onCheckInPlayer}
        onCheckInAll={onCheckInAll}
      />
    );

    expect(getByText(/Expected Arrivals \(6\)/i)).toBeTruthy();
    expect(getByText('Late Arrival 1')).toBeTruthy();
    expect(queryByLabelText('Filter expected arrivals')).toBeNull();

    const checkInBtn = getByText('Check In All');
    fireEvent.click(checkInBtn);
    expect(onCheckInAll).toHaveBeenCalledTimes(1);
  });

  it('shows smart search filter when > 6 expected players exist and filters by raw or compact name', () => {
    const expectedPlayers = [
      'Lee Chong',
      'Diana',
      'Quang Dong',
      'Ben Johns',
      'Dylan Frazier',
      'Anna Leigh Waters',
      'Jebidiah',
    ];

    const { getByLabelText, queryByText, getByText } = render(
      <SetupView
        {...defaultProps}
        expectedPlayers={expectedPlayers}
        onCheckInPlayer={vi.fn()}
      />
    );

    const filterInput = getByLabelText('Filter expected arrivals') as HTMLInputElement;
    expect(filterInput.style.fontSize).toBe('16px');

    fireEvent.change(filterInput, { target: { value: 'l. chong' } });
    expect(getByText('Lee Chong')).toBeTruthy();
    expect(queryByText('Diana')).toBeNull();

    const clearBtn = getByLabelText('Clear expected arrivals filter');
    fireEvent.click(clearBtn);
    expect(getByText('Diana')).toBeTruthy();
    expect(getByText('Jebidiah')).toBeTruthy();
  });

  it('keeps Start Queue disabled when checked-in count is below minPlayers regardless of expected count', () => {
    const { getByRole } = render(
      <SetupView
        {...defaultProps}
        tempPlayers={['P1', 'P2', 'P3']} // min is 5 for singles/1-court or 4 for doubles
        expectedPlayers={['P4', 'P5', 'P6', 'P7']}
      />
    );

    const startBtn = getByRole('button', { name: /Start Queue/i });
    expect((startBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
