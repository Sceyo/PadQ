export const ROOM_CODE_LENGTH = 6;
export const ROOM_CODE_PATTERN = /^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/;

const ROOM_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Generate a cryptographically random code without ambiguous 0/O/1/I characters. */
export function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, value => ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length]).join('');
}
