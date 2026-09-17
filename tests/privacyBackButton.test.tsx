// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PrivacyBackButton } from '@/app/privacy/PrivacyBackButton';

const mockBack = vi.fn();
const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    back: mockBack,
    push: mockPush,
  }),
}));

describe('PrivacyBackButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  it('renders "← Back to Queue" and calls router.back() when coming from queue', () => {
    sessionStorage.setItem('padq_privacy_from', '/queue?mode=doubles');
    Object.defineProperty(window, 'history', {
      value: { length: 2 },
      writable: true,
    });

    render(<PrivacyBackButton />);

    const button = screen.getByRole('button', { name: 'Back to Queue' });
    expect(button).toBeDefined();
    expect(button.textContent).toBe('← Back to Queue');

    fireEvent.click(button);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('padq_privacy_from')).toBeNull();
  });

  it('renders "← Back to Watch" and calls router.back() when coming from watch', () => {
    sessionStorage.setItem('padq_privacy_from', '/watch/VYR2CH');
    Object.defineProperty(window, 'history', {
      value: { length: 2 },
      writable: true,
    });

    render(<PrivacyBackButton />);

    const button = screen.getByRole('button', { name: 'Back to Watch' });
    expect(button).toBeDefined();
    expect(button.textContent).toBe('← Back to Watch');

    fireEvent.click(button);
    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('renders "← Back to PADQ" and pushes to "/" when history is empty', () => {
    Object.defineProperty(window, 'history', {
      value: { length: 1 },
      writable: true,
    });

    render(<PrivacyBackButton />);

    const button = screen.getByRole('button', { name: 'Back to PADQ' });
    expect(button).toBeDefined();
    expect(button.textContent).toBe('← Back to PADQ');

    fireEvent.click(button);
    expect(mockPush).toHaveBeenCalledWith('/');
    expect(mockBack).not.toHaveBeenCalled();
  });
});
