import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HostToolsSheet } from '../app/queue/components/HostToolsSheet/HostToolsSheet';
import { applyLateArrivalCheckIn } from '../app/queue/lib/checkInState';

describe('HostToolsSheet & Late Arrivals Tray (Bug #4)', () => {
  it('renders Expected Late Arrivals tray with accessible 44px check-in and dismiss buttons', () => {
    const html = renderToStaticMarkup(
      React.createElement(HostToolsSheet, {
        isOpen: true,
        onClose: () => {},
        onAddPlayer: () => true,
        scorePromptEnabled: true,
        onToggleScorePrompt: () => {},
        lateArrivals: ['Carlos', 'Diana'],
        onCheckInLateArrival: () => true,
        onDismissLateArrival: () => {},
      })
    );

    expect(html).toContain('Expected Late Arrivals (2)');
    expect(html).toContain('aria-label="Check in Carlos"');
    expect(html).toContain('aria-label="Dismiss Carlos"');
    expect(html).toContain('aria-label="Check in Diana"');
    expect(html).toContain('aria-label="Dismiss Diana"');
    // Ensure 44px tap min height is enforced in inline style or CSS variable
    expect(html).toMatch(/var\(--tap-min,\s*44px\)|min-height:\s*44px/);
  });

  describe('applyLateArrivalCheckIn capacity guard', () => {
    it('removes the player case-insensitively when addition succeeds (didAdd = true)', () => {
      const before = ['Carlos', 'Diana'];
      const after = applyLateArrivalCheckIn(before, 'carlos', true);
      expect(after).toEqual(['Diana']);
    });

    it('preserves the player in lateArrivals when addition fails (didAdd = false)', () => {
      const before = ['Carlos', 'Diana'];
      const after = applyLateArrivalCheckIn(before, 'Carlos', false);
      expect(after).toEqual(['Carlos', 'Diana']);
    });
  });
});
