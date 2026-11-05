// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PlayerLabel } from '../app/queue/components/atoms/PlayerLabel';

describe('PlayerLabel', () => {
  it('renders single-word name unchanged', () => {
    const { container } = render(<PlayerLabel name="Ben" />);
    expect(container.textContent).toContain('Ben');
  });

  it('renders compact display name for two-word names while keeping full name in title', () => {
    const { container } = render(<PlayerLabel name="Quang Dong" />);
    expect(container.textContent).toContain('Q. Dong');
    const label = container.querySelector('.player-label');
    expect(label?.getAttribute('title')).toBe('Quang Dong');
  });

  it('renders compact display name for three-word names while keeping full name in title', () => {
    const { container } = render(<PlayerLabel name="Anna Leigh Waters" />);
    expect(container.textContent).toContain('A.L. Waters');
    const label = container.querySelector('.player-label');
    expect(label?.getAttribute('title')).toBe('Anna Leigh Waters');
  });
});
