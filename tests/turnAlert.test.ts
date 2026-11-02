import { describe, it, expect, vi } from 'vitest';
import {
  getPlayerTurnZone,
  shouldTriggerTurnAlert,
  fireBrowserTurnAlert,
  getWatchedPlayer,
  setWatchedPlayer,
} from '../app/queue/lib/turnAlert';

describe('turnAlert', () => {
  const courts = [{ name: 'Court 1', onCourt: ['A', 'B', 'C', 'D'] }];
  const queue = ['E', 'F', 'G', 'H', 'I', 'J'];

  it('classifies player into on-court, on-deck, or waiting', () => {
    expect(getPlayerTurnZone('B', courts, queue, 4)).toEqual({ zone: 'on-court', courtName: 'Court 1' });
    expect(getPlayerTurnZone('F', courts, queue, 4)).toEqual({ zone: 'on-deck' });
    expect(getPlayerTurnZone('I', courts, queue, 4)).toEqual({ zone: 'waiting' });
    expect(getPlayerTurnZone('Z', courts, queue, 4)).toEqual({ zone: 'absent' });
  });

  it('triggers alert only on upward transition into on-deck or on-court', () => {
    expect(shouldTriggerTurnAlert('waiting', 'on-deck')).toBe(true);
    expect(shouldTriggerTurnAlert('on-deck', 'on-court')).toBe(true);
    expect(shouldTriggerTurnAlert('waiting', 'on-court')).toBe(true);
    expect(shouldTriggerTurnAlert('on-court', 'on-court')).toBe(false);
    expect(shouldTriggerTurnAlert('on-court', 'waiting')).toBe(false);
    expect(shouldTriggerTurnAlert('absent', 'waiting')).toBe(false);
    expect(shouldTriggerTurnAlert(null, 'on-deck')).toBe(false); // initial mount should not false-alarm
    expect(shouldTriggerTurnAlert(null, 'on-court')).toBe(false);
  });

  it('safely executes fireBrowserTurnAlert without throwing in headless environments', () => {
    expect(() => fireBrowserTurnAlert('You are on deck!')).not.toThrow();
  });

  it('persists and retrieves watched player per session in storage', () => {
    const sessionId = 'test-session-123';
    expect(getWatchedPlayer(sessionId)).toBeNull();

    setWatchedPlayer(sessionId, 'Alex');
    expect(getWatchedPlayer(sessionId)).toBe('Alex');

    setWatchedPlayer(sessionId, null);
    expect(getWatchedPlayer(sessionId)).toBeNull();
  });
});
