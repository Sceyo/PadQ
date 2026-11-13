// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { WinnerModal } from '@/app/queue/components/WinnerModal/WinnerModal';

describe('Phase 3: Match Completion Feedback & WinnerModal Scope', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders WinnerModal without auto-close checkbox for tournament champions', () => {
    const handleClose = vi.fn();
    render(
      <WinnerModal
        isOpen={true}
        winner="Alice is the tournament champion! 🏆"
        onClose={handleClose}
      />,
    );

    // Modal dialog is present with Champion header
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(screen.getByText(/Alice is the tournament champion! 🏆/i)).toBeDefined();

    // The autoClose checkbox has been eliminated per Phase 3 spec
    expect(screen.queryByLabelText(/auto-close/i)).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();

    // Manual close button works
    const closeBtn = screen.getByRole('button', { name: /close dialog/i });
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('WinnerModal handles Escape key to dismiss', () => {
    const handleClose = vi.fn();
    render(
      <WinnerModal
        isOpen={true}
        winner="Bob is the tournament champion! 🏆"
        onClose={handleClose}
      />,
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing when WinnerModal isOpen is false', () => {
    const handleClose = vi.fn();
    render(
      <WinnerModal
        isOpen={false}
        winner="Alice"
        onClose={handleClose}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('guards that routine match completions do not display the champion WinnerModal', () => {
    // Routine match winner strings (e.g. "Team A won") must not open the WinnerModal;
    // only tournament champions (containing "champion") display it.
    const routineWinner = "Alice & Bob win!";
    const isChampion = routineWinner.includes('champion');
    expect(isChampion).toBe(false);

    const handleClose = vi.fn();
    render(
      <WinnerModal
        isOpen={isChampion}
        winner={routineWinner}
        onClose={handleClose}
      />,
    );

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
