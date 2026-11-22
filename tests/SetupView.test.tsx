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

  it('does not render inline skill badges or pickers on checked-in players or roster items', () => {
    const { queryByText, getByText, container } = render(
      <SetupView
        {...defaultProps}
        showSkillTagging={true}
        showRoster={true}
        roster={[
          { name: 'Ben Johns', skill: 'advanced' },
          { name: 'Anna Leigh Waters', skill: 'intermediate' },
        ]}
        tempPlayers={['Federico Staksrud', 'Catherine Parenteau']}
      />
    );

    expect(getByText('Federico Staksrud')).toBeTruthy();
    expect(getByText('Ben Johns')).toBeTruthy();
    expect(queryByText('?')).toBeNull();
    expect(queryByText('Beginner')).toBeNull();
    expect(container.querySelector('.skill-badge')).toBeNull();
    expect(container.querySelector('.skill-picker')).toBeNull();
  });

  it('uses Expected Arrivals actions for paste and consolidated roster import', () => {
    const onAddFromPaste = vi.fn();
    const onAddFromRoster = vi.fn();
    const onAddExpectedFromRoster = vi.fn();

    const { getByTitle, getByRole, queryByTitle } = render(
      <SetupView
        {...defaultProps}
        showRoster={true}
        roster={[{ name: 'Riley Newman' }]}
        rosterSelected={new Set(['Riley Newman'])}
        pasteInput="Ben Johns, Anna Leigh Waters"
        onAddFromPaste={onAddFromPaste}
        onAddFromRoster={onAddFromRoster}
        onAddExpectedFromRoster={onAddExpectedFromRoster}
      />
    );

    expect(queryByTitle('Add as Expected')).toBeNull();
    fireEvent.click(getByTitle('Add all to Expected Arrivals'));
    expect(onAddFromPaste).toHaveBeenCalledTimes(1);

    fireEvent.click(getByRole('button', { name: /Add Selected \(1\)/i }));
    expect(onAddExpectedFromRoster).toHaveBeenCalledTimes(1);
    expect(onAddFromRoster).not.toHaveBeenCalled();
  });

  it('opens MODE modal on Start Queue in doubles mode and starts selected mode', () => {
    const onStartQueue = vi.fn();

    const { getByRole, queryByRole } = render(
      <SetupView
        {...defaultProps}
        gameMode="doubles"
        tempPlayers={['P1', 'P2', 'P3', 'P4', 'P5']}
        onStartQueue={onStartQueue}
      />
    );

    expect(queryByRole('dialog')).toBeNull();
    fireEvent.click(getByRole('button', { name: /Start Queue/i }));
    expect(onStartQueue).not.toHaveBeenCalled();
    expect(getByRole('dialog', { name: /MODE/i })).toBeTruthy();

    fireEvent.click(getByRole('button', { name: /Default/i }));
    expect(onStartQueue).toHaveBeenNthCalledWith(1, 'default');
    expect(queryByRole('dialog')).toBeNull();

    fireEvent.click(getByRole('button', { name: /Start Queue/i }));
    fireEvent.click(getByRole('button', { name: /Matchmaking/i }));
    expect(onStartQueue).toHaveBeenNthCalledWith(2, 'skilled');
    expect(queryByRole('dialog')).toBeNull();

    fireEvent.click(getByRole('button', { name: /Start Queue/i }));
    fireEvent.click(getByRole('button', { name: /Close mode selector/i }));
    expect(queryByRole('dialog')).toBeNull();
    expect(onStartQueue).toHaveBeenCalledTimes(2);
  });

  it('calls onStartQueue directly in singles mode without opening MODE modal', () => {
    const onStartQueue = vi.fn();

    const { getByRole, queryByRole } = render(
      <SetupView
        {...defaultProps}
        gameMode="singles"
        tempPlayers={['P1', 'P2', 'P3', 'P4', 'P5']}
        onStartQueue={onStartQueue}
      />
    );

    fireEvent.click(getByRole('button', { name: /Start Queue/i }));
    expect(queryByRole('dialog')).toBeNull();
    expect(onStartQueue).toHaveBeenCalledWith('default');
  });

  it('portals MODE modal to document.body outside .setup-page so it stays viewport-centered', () => {
    const { container, getByRole } = render(
      <SetupView
        {...defaultProps}
        gameMode="doubles"
        tempPlayers={['P1', 'P2', 'P3', 'P4', 'P5']}
      />
    );

    fireEvent.click(getByRole('button', { name: /Start Queue/i }));
    const dialog = getByRole('dialog', { name: /MODE/i });
    const setupPage = container.querySelector('.setup-page');

    expect(setupPage).toBeTruthy();
    expect(setupPage!.contains(dialog)).toBe(false);
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(dialog.parentElement?.style.position).toBe('fixed');
  });
});
