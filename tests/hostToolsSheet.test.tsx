/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { HostToolsSheet } from '@/app/queue/components/HostToolsSheet/HostToolsSheet';

afterEach(() => cleanup());

describe('HostToolsSheet — Match Scores slider toggle', () => {
  it('renders slider switch in ON state when scorePromptEnabled is true', () => {
    const onToggle = vi.fn();
    render(
      <HostToolsSheet
        isOpen={true}
        onClose={vi.fn()}
        onAddPlayer={vi.fn()}
        scorePromptEnabled={true}
        onToggleScorePrompt={onToggle}
      />
    );

    const toggle = screen.getByRole('switch', { name: /Toggle Match Scores/i });
    expect(toggle).toBeDefined();
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    expect(toggle.textContent).toContain('ON');

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('renders slider switch in OFF state when scorePromptEnabled is false', () => {
    const onToggle = vi.fn();
    render(
      <HostToolsSheet
        isOpen={true}
        onClose={vi.fn()}
        onAddPlayer={vi.fn()}
        scorePromptEnabled={false}
        onToggleScorePrompt={onToggle}
      />
    );

    const toggle = screen.getByRole('switch', { name: /Toggle Match Scores/i });
    expect(toggle).toBeDefined();
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.textContent).toContain('OFF');

    fireEvent.click(toggle);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
