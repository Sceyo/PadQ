// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { SkilledView } from '../app/queue/components/SkilledView/SkilledView';

afterEach(() => cleanup());

describe('SkilledView — Skill dropdown brackets', () => {
  const players = [
    'Ben Johns',
    'Anna Leigh Waters',
    'Federico Staksrud',
    'Catherine Parenteau',
  ];

  it('shows Beginner, Intermediate, and Advanced brackets open with Add Player buttons immediately', () => {
    const { getAllByRole, getByText } = render(
      <SkilledView
        brackets={{ beginner: [], intermediate: [], advanced: [] }}
        players={players}
        roster={[]}
        isHost={true}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
        onAddNew={vi.fn()}
        compact
      />
    );

    expect(getByText('Beginner')).toBeTruthy();
    expect(getByText('Intermediate')).toBeTruthy();
    expect(getByText('Advanced')).toBeTruthy();
    expect(getAllByRole('button', { name: /Add Player/i })).toHaveLength(3);
  });

  it('supports multi-selecting unassigned players into a skill bracket', () => {
    const onAddNew = vi.fn();

    const { getAllByRole, getByRole } = render(
      <SkilledView
        brackets={{ beginner: [], intermediate: [], advanced: [] }}
        players={players}
        roster={[]}
        isHost={true}
        onAssign={vi.fn()}
        onUnassign={vi.fn()}
        onAddNew={onAddNew}
        compact
      />
    );

    // Click "+ Add Player" inside Beginner (first section)
    const addButtons = getAllByRole('button', { name: /Add Player/i });
    fireEvent.click(addButtons[0]);

    // Select 2 unassigned players from checklist
    const checkboxes = getAllByRole('button', { name: /Ben Johns|Anna Leigh Waters/i });
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);

    const confirmBtn = getByRole('button', { name: /Confirm Add \(2\)/i });
    fireEvent.click(confirmBtn);

    expect(onAddNew).toHaveBeenCalledTimes(1);
    expect(onAddNew).toHaveBeenCalledWith('beginner', ['Ben Johns', 'Anna Leigh Waters']);
  });

  it('allows 1-click quick bracket assignment from Unassigned Players card', () => {
    const onAssign = vi.fn();

    const { getAllByTitle } = render(
      <SkilledView
        brackets={{ beginner: [], intermediate: [], advanced: [] }}
        players={['Ben Johns']}
        roster={[]}
        isHost={true}
        onAssign={onAssign}
        onUnassign={vi.fn()}
        onAddNew={vi.fn()}
        compact
      />
    );

    const advBtn = getAllByTitle('Assign to Advanced')[0];
    fireEvent.click(advBtn);
    expect(onAssign).toHaveBeenCalledWith('advanced', 'Ben Johns');
  });
});
