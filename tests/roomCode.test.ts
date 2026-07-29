import { describe, expect, it } from 'vitest';
import { generateRoomCode, ROOM_CODE_LENGTH, ROOM_CODE_PATTERN } from '../lib/roomCode';

describe('production room codes', () => {
  it('uses six cryptographically generated, unambiguous characters', () => {
    for (let i = 0; i < 100; i++) {
      const code = generateRoomCode();
      expect(code).toHaveLength(ROOM_CODE_LENGTH);
      expect(code).toMatch(ROOM_CODE_PATTERN);
    }
  });
});
