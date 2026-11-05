/**
 * Formats multi-word player names into a compact display format:
 * - 1 word: "Ben" -> "Ben"
 * - 2 words: "Quang Dong" -> "Q. Dong"
 * - 3+ words: "Anna Leigh Waters" -> "A.L. Waters"
 *
 * Normalizes extra whitespace and preserves raw names in HTML tooltips/aria-labels.
 */
export function formatDisplayName(fullName: string): string {
  if (!fullName || typeof fullName !== 'string') return '';
  const trimmed = fullName.trim();
  if (!trimmed) return '';
  const tokens = trimmed.split(/\s+/);
  if (tokens.length <= 1) return tokens[0];
  if (tokens.length === 2) {
    const firstInitial = tokens[0][0].toUpperCase();
    return `${firstInitial}. ${tokens[1]}`;
  }
  const surname = tokens[tokens.length - 1];
  const givenInitials = tokens.slice(0, -1).map(t => `${t[0].toUpperCase()}.`).join('');
  return `${givenInitials} ${surname}`;
}
