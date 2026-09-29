// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { AuthResilienceBanner } from '../components/AuthResilience/AuthResilienceBanner';
import { triggerFatalAuthError, clearStaleFirebaseAuth } from '../lib/authResilience';

vi.mock('../lib/authResilience', async () => {
  const actual = await vi.importActual('../lib/authResilience');
  return {
    ...actual,
    clearStaleFirebaseAuth: vi.fn().mockResolvedValue(undefined),
  };
});

describe('AuthResilienceBanner component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders nothing in normal state', () => {
    const { container } = render(<AuthResilienceBanner />);
    expect(container.firstChild).toBeNull();
  });

  it('renders honest recovery UI when fatal assertion error triggers', async () => {
    render(<AuthResilienceBanner />);

    // Trigger fatal error
    act(() => {
      triggerFatalAuthError(
        new Error('FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state (ID: 3c6b) CONTEXT: {"code":"auth/invalid-refresh-token"}')
      );
    });

    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(screen.getByText('Your session needs to refresh — tap to continue')).toBeTruthy();
    expect(
      screen.getByText('A connection token expired or encountered an unexpected state. Your queue and score data are preserved.')
    ).toBeTruthy();

    const reloadMock = vi.fn();
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...window.location, reload: reloadMock },
    });

    const refreshBtn = screen.getByRole('button', { name: /Refresh Session/i });
    expect(refreshBtn).toBeTruthy();

    await act(async () => {
      fireEvent.click(refreshBtn);
    });

    expect(clearStaleFirebaseAuth).toHaveBeenCalled();
    expect(reloadMock).toHaveBeenCalled();
  });
});
