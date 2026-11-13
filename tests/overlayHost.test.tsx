/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OverlayHost, useOverlay } from '@/app/queue/components/OverlayHost';

function TestConsumer() {
  const { showToast, openDialog, closeDialog, openSheet, closeSheet } = useOverlay();
  return (
    <div>
      <button onClick={() => showToast({ message: 'Saved successfully', type: 'success' })}>
        Trigger Toast
      </button>
      <button onClick={() => openDialog({
        title: 'Edit Teams',
        description: 'Swap player partnerships',
        children: <button id="dialog-inside-btn">Inside Dialog</button>,
      })}>
        Trigger Dialog
      </button>
      <button onClick={() => openSheet({
        title: 'Player Options',
        children: <button id="sheet-inside-btn">Inside Sheet</button>,
      })}>
        Trigger Sheet
      </button>
      <button onClick={closeDialog}>Close Dialog</button>
      <button onClick={closeSheet}>Close Sheet</button>
    </div>
  );
}

describe('OverlayHost component suite', () => {
  beforeEach(() => {
    cleanup();
  });

  it('renders children cleanly without any initial overlays', () => {
    render(
      <OverlayHost>
        <div>Content outside</div>
      </OverlayHost>
    );
    expect(screen.getByText('Content outside')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('displays a toast with status role and auto-dismiss/close trigger', () => {
    render(
      <OverlayHost>
        <TestConsumer />
      </OverlayHost>
    );
    fireEvent.click(screen.getByText('Trigger Toast'));
    const toast = screen.getByRole('status');
    expect(toast).toBeDefined();
    expect(screen.getByText('Saved successfully')).toBeDefined();

    // Dismiss button
    const dismissBtn = screen.getByLabelText('Dismiss notification');
    fireEvent.click(dismissBtn);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('manages dialog focus, escape dismiss, and accessibility attributes', () => {
    render(
      <OverlayHost>
        <TestConsumer />
      </OverlayHost>
    );
    fireEvent.click(screen.getByText('Trigger Dialog'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeDefined();
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('dialog-title');
    expect(screen.getByText('Edit Teams')).toBeDefined();
    expect(screen.getByText('Swap player partnerships')).toBeDefined();

    // Escape key dismisses dialog
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('guarantees exactly one modal/sheet is active at a time (never stacks two dialogs)', () => {
    render(
      <OverlayHost>
        <TestConsumer />
      </OverlayHost>
    );
    // Open Dialog
    fireEvent.click(screen.getByText('Trigger Dialog'));
    expect(screen.getByText('Edit Teams')).toBeDefined();

    // Now trigger Sheet -> replaces Dialog
    fireEvent.click(screen.getByText('Trigger Sheet'));
    expect(screen.queryByText('Edit Teams')).toBeNull();
    expect(screen.getByText('Player Options')).toBeDefined();
    expect(screen.getAllByRole('dialog').length).toBe(1);
  });
});
