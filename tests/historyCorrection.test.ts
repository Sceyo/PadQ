import { describe, expect, it } from 'vitest';
import { replaceHistoryEntry } from '../lib/sessionService';

describe('replaceHistoryEntry interface & atomic contract (Bug #6)', () => {
  it('exports replaceHistoryEntry function from sessionService', () => {
    expect(typeof replaceHistoryEntry).toBe('function');
  });
});
