// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent, cleanup } from '@testing-library/react';
import { AddPlayerPanel } from '../app/queue/components/LiveManagement/LiveManagement';

afterEach(() => cleanup());

describe('LiveManagement — Late Arrival Tray', () => {
  it('renders late arrival tray and triggers onCheckInLateArrival on 1-tap check-in', () => {
    const onCheckIn = vi.fn();
    const onDismiss = vi.fn();

    const { getByText, getAllByText } = render(
      <AddPlayerPanel
        allPlayers={['Alice', 'Bob']}
        onAddPlayer={vi.fn()}
        lateArrivals={['Carlos Late', 'Dana Late']}
        onCheckInLateArrival={onCheckIn}
        onDismissLateArrival={onDismiss}
      />
    );

    expect(getByText(/Late Arrivals \(2\)/i)).toBeTruthy();
    expect(getByText('Carlos Late')).toBeTruthy();

    const checkInBtn = getAllByText('Check In')[0];
    fireEvent.click(checkInBtn);
    expect(onCheckIn).toHaveBeenCalledWith('Carlos Late');
  });

  it('triggers onDismissLateArrival when clicking dismiss on a late arrival chip', () => {
    const onDismiss = vi.fn();
    const { getByTitle } = render(
      <AddPlayerPanel
        allPlayers={['Alice']}
        onAddPlayer={vi.fn()}
        lateArrivals={['Carlos Late']}
        onDismissLateArrival={onDismiss}
      />
    );

    const dismissBtn = getByTitle(/Dismiss/i);
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledWith('Carlos Late');
  });
});
