export interface ParsedPlayerEntry {
  name: string;
  rating?: number;
  duprId?: string;
  raw: string;
}

const MAX_NAME_LENGTH = 60;

// Patterns for common chat noise and headers
const HEADER_PATTERN = /^(?:players?\s*(?:list)?|rsvp|waitlist|confirmed|attendees|names?|lineup)\s*:?\s*$/i;

// Leading numbers and bullets: "1.", "2)", "[3]", "#4", "-", "•", "*"
const LEADING_NUMBER_OR_BULLET_PATTERN = /^\s*(?:\[\d+\]|\d+[\.\)\-:]|\#\d+|\-\s*|•\s*|\*\s*)/i;

// Payment tags and status notes: "[PAID]", "(paid)", "[gcash]", "(via gcash)", "[confirmed]", "(late)", "guest", etc.
const STATUS_TAG_PATTERN = /[\(\[\{]\s*(?:paid|unpaid|gcash|cash|guest|sub|waitlist|confirmed|late|check(?:ed)?[\s-]?in|via\s+\w+|\d+k?|\₱?\d+)\s*[\)\]\}]/gi;
const STANDALONE_STATUS_PATTERN = /\b(?:paid|unpaid|gcash|cash)\b/gi;

// Phone numbers e.g. 09171234567 or +63917... or 555-1234
const PHONE_PATTERN = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{3,4}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

/**
 * Sanitizes a single player name string to alphanumeric / punctuation,
 * collapses redundant spaces, and clamps length to 60 characters.
 */
export function sanitizePlayerName(raw: string): string {
  if (!raw) return '';

  let cleaned = raw
    // Strip control characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    // Replace multiple spaces/tabs with single space
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading/trailing quotes or dashes
  cleaned = cleaned.replace(/^["'—–-]+|["'—–-]+$/g, '').trim();

  // Clamp to max length
  if (cleaned.length > MAX_NAME_LENGTH) {
    cleaned = cleaned.slice(0, MAX_NAME_LENGTH).trim();
  }

  return cleaned;
}

/**
 * Parses raw clipboard or textarea paste content into sanitized player entries.
 * Handles chat exports, Reclub lists, comma/semicolon separation, and pipe metadata.
 */
export function parsePlayerListPaste(rawText: string): ParsedPlayerEntry[] {
  if (!rawText || !rawText.trim()) {
    return [];
  }

  const lines = rawText.split(/\r?\n/);
  const rawSegments: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (HEADER_PATTERN.test(trimmed)) continue;

    // If line has comma or semicolon and no pipe metadata, split further
    if (!trimmed.includes('|') && (trimmed.includes(',') || trimmed.includes(';'))) {
      const parts = trimmed.split(/[,;]+/);
      for (const p of parts) {
        if (p.trim()) rawSegments.push(p.trim());
      }
    } else {
      rawSegments.push(trimmed);
    }
  }

  const results: ParsedPlayerEntry[] = [];
  const seenLowerNames = new Set<string>();

  for (const raw of rawSegments) {
    let text = raw;
    let rating: number | undefined;
    let duprId: string | undefined;

    // Check for pipe metadata: "Name | rating=4.5 | duprId=ABC1234"
    if (text.includes('|')) {
      const segments = text.split('|').map(s => s.trim());
      text = segments[0] || '';

      for (let i = 1; i < segments.length; i++) {
        const seg = segments[i];
        const ratingMatch = seg.match(/^rating\s*=\s*([0-9.]+)/i);
        if (ratingMatch) {
          const num = parseFloat(ratingMatch[1]);
          if (!Number.isNaN(num)) rating = num;
        }

        const duprMatch = seg.match(/^duprId\s*=\s*([a-zA-Z0-9]+)/i);
        if (duprMatch) {
          duprId = duprMatch[1];
        }
      }
    }

    // Strip leading number or bullets
    text = text.replace(LEADING_NUMBER_OR_BULLET_PATTERN, '');

    // Strip status tags in brackets/parentheses
    text = text.replace(STATUS_TAG_PATTERN, ' ');

    // Strip phone numbers
    text = text.replace(PHONE_PATTERN, ' ');

    // Strip trailing or standalone status words
    text = text.replace(STANDALONE_STATUS_PATTERN, ' ');

    // Strip trailing dashes or separators e.g. "Rafael Nadal - "
    text = text.replace(/\s*[-–—:]\s*$/, '');

    const name = sanitizePlayerName(text);
    if (!name) continue;

    const lower = name.toLowerCase();
    if (seenLowerNames.has(lower)) continue;
    seenLowerNames.add(lower);

    results.push({
      name,
      ...(rating !== undefined ? { rating } : {}),
      ...(duprId ? { duprId } : {}),
      raw,
    });
  }

  return results;
}
