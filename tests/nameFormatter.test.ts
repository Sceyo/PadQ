import { describe, it, expect } from 'vitest';
import { formatDisplayName, matchesPlayerFilter } from '../app/queue/lib/nameFormatter';

describe('formatDisplayName', () => {
  it('returns single-word names unchanged', () => {
    expect(formatDisplayName('Ben')).toBe('Ben');
    expect(formatDisplayName('Madonna')).toBe('Madonna');
    expect(formatDisplayName('P1')).toBe('P1');
  });

  it('formats two-part names as FirstInitial. LastName', () => {
    expect(formatDisplayName('Quang Dong')).toBe('Q. Dong');
    expect(formatDisplayName('John Doe')).toBe('J. Doe');
    expect(formatDisplayName('Carlos Alcaraz')).toBe('C. Alcaraz');
  });

  it('formats three-part names as Initials. LastName without space between initials', () => {
    expect(formatDisplayName('Anna Leigh Waters')).toBe('A.L. Waters');
    expect(formatDisplayName('Ben Johns Smith')).toBe('B.J. Smith');
    expect(formatDisplayName('Mary Jane Watson')).toBe('M.J. Watson');
  });

  it('formats four-part names as Initials. LastName', () => {
    expect(formatDisplayName('John Fitzgerald Kennedy Junior')).toBe('J.F.K. Junior');
  });

  it('handles irregular and extra whitespace correctly', () => {
    expect(formatDisplayName('   Quang    Dong   ')).toBe('Q. Dong');
    expect(formatDisplayName('  Anna   Leigh   Waters  ')).toBe('A.L. Waters');
  });

  it('handles empty and whitespace-only strings gracefully', () => {
    expect(formatDisplayName('')).toBe('');
    expect(formatDisplayName('   ')).toBe('');
    expect(formatDisplayName(null as unknown as string)).toBe('');
    expect(formatDisplayName(undefined as unknown as string)).toBe('');
  });
});

describe('matchesPlayerFilter', () => {
  it('matches empty or whitespace query for any player', () => {
    expect(matchesPlayerFilter('Lee Chong', '')).toBe(true);
    expect(matchesPlayerFilter('Lee Chong', '   ')).toBe(true);
  });

  it('matches case-insensitively against raw full name and compact display name', () => {
    expect(matchesPlayerFilter('Lee Chong', 'lee')).toBe(true);
    expect(matchesPlayerFilter('Lee Chong', 'CHONG')).toBe(true);
    expect(matchesPlayerFilter('Lee Chong', 'l. chong')).toBe(true);
    expect(matchesPlayerFilter('Anna Leigh Waters', 'a.l.')).toBe(true);
    expect(matchesPlayerFilter('Anna Leigh Waters', 'leigh')).toBe(true);
    expect(matchesPlayerFilter('Lee Chong', 'jordan')).toBe(false);
  });
});
