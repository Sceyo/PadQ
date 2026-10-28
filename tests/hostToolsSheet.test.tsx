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

  it('clears input and closes sheet when onAddPlayer succeeds', () => {
    const onAdd = vi.fn().mockReturnValue(true);
    const onClose = vi.fn();
    render(
      <HostToolsSheet
        isOpen={true}
        onClose={onClose}
        onAddPlayer={onAdd}
        scorePromptEnabled={true}
        onToggleScorePrompt={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Player name…') as HTMLInputElement;
    expect(input.maxLength).toBe(60);

    fireEvent.change(input, { target: { value: 'New Player' } });
    const addBtn = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addBtn);

    expect(onAdd).toHaveBeenCalledWith('New Player');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays inline error and keeps drawer open when onAddPlayer returns false', () => {
    const onAdd = vi.fn().mockReturnValue(false);
    const onClose = vi.fn();
    render(
      <HostToolsSheet
        isOpen={true}
        onClose={onClose}
        onAddPlayer={onAdd}
        scorePromptEnabled={true}
        onToggleScorePrompt={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('Player name…') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'Duplicate Player' } });
    const addBtn = screen.getByRole('button', { name: 'Add' });
    fireEvent.click(addBtn);

    expect(onAdd).toHaveBeenCalledWith('Duplicate Player');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeDefined();
    expect(screen.getByText(/"Duplicate Player" could not be added/)).toBeDefined();
    expect(input.value).toBe('Duplicate Player');
  });
});
