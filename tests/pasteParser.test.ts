import { describe, it, expect } from 'vitest';
import { parsePlayerListPaste, sanitizePlayerName } from '../app/queue/lib/pasteParser';

describe('pasteParser', () => {
  it('sanitizes noisy chat and Reclub exports into clean names', () => {
    const raw = `
      1. Carlos Alcaraz (PAID)
      2) Jannik Sinner [GCash]
      • Rafael Nadal - 09171234567
      [4] Novak Djokovic | rating=5.0
      Daniil Medvedev, Alexander Zverev
    `;
    const result = parsePlayerListPaste(raw);
    expect(result.map(p => p.name)).toEqual([
      'Carlos Alcaraz',
      'Jannik Sinner',
      'Rafael Nadal',
      'Novak Djokovic',
      'Daniil Medvedev',
      'Alexander Zverev',
    ]);
    expect(result[3].rating).toBe(5.0);
  });

  it('rejects empty lines, header lines, clamps to 60 chars, and deduplicates case-insensitively', () => {
    const raw = `
      Players list:
      1. Carlos Alcaraz
      2. carlos alcaraz
      Waitlist:
      3. Iga Swiatek
    `;
    const result = parsePlayerListPaste(raw);
    expect(result.map(p => p.name)).toEqual(['Carlos Alcaraz', 'Iga Swiatek']);
    expect(sanitizePlayerName('A'.repeat(80)).length).toBe(60);
  });

  it('extracts rating and duprId metadata correctly', () => {
    const raw = 'Juan Dela Cruz | rating=4.5 | duprId=ABC1234';
    const result = parsePlayerListPaste(raw);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Juan Dela Cruz');
    expect(result[0].rating).toBe(4.5);
    expect(result[0].duprId).toBe('ABC1234');
  });

  it('handles comma-separated and semicolon-separated lists', () => {
    const raw = 'Roger Federer, Pete Sampras; Andre Agassi';
    const result = parsePlayerListPaste(raw);
    expect(result.map(p => p.name)).toEqual([
      'Roger Federer',
      'Pete Sampras',
      'Andre Agassi',
    ]);
  });
});
