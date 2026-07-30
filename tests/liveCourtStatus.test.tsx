import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  getNextPlayers,
  LiveCourtStatus,
  resolveSelectedCourt,
} from '@/app/watch/[sessionId]/LiveCourtStatus';
import type { CourtSlot } from '@/lib/sessionService';

const courts: CourtSlot[] = [
  { id: 'court-1', name: 'Court 1', onCourt: ['A', 'B', 'C', 'D'] },
  { id: 'court-2', name: 'Court 2', onCourt: ['E', 'F', 'G', 'H'] },
  { id: 'court-3', name: 'Court 3', onCourt: ['I', 'J', 'K', 'L'] },
];

describe('Live Court Status', () => {
  it('resolves a selected court and safely falls back to the first court', () => {
    expect(resolveSelectedCourt(courts, 'court-3')?.name).toBe('Court 3');
    expect(resolveSelectedCourt(courts, 'missing')?.name).toBe('Court 1');
    expect(resolveSelectedCourt([], 'court-1')).toBeNull();
  });

  it('shows only the selected court as the focused matchup', () => {
    const html = renderToStaticMarkup(
      <LiveCourtStatus
        courtSlots={courts}
        gameMode="doubles"
        queue={['A', 'B', 'M', 'N', 'O', 'P', 'Q']}
        selectedCourtId="court-3"
        onSelectCourt={() => undefined}
      />,
    );

    expect(html).toContain('aria-selected="true"');
    expect(html).toContain('Following');
    expect(html).toContain('I &amp; J');
    expect(html).toContain('K &amp; L');
    expect(html).toContain('Assignment is confirmed when the next court becomes available.');
    expect(html).toContain('#1</span> M');
    expect(html).toContain('+1 waiting');
  });

  it('uses the correct next-player group size for singles and doubles', () => {
    const queue = ['A', 'B', 'C', 'D', 'E'];
    expect(getNextPlayers(queue, 'singles')).toEqual(['A', 'B']);
    expect(getNextPlayers(queue, 'doubles')).toEqual(['A', 'B', 'C', 'D']);
  });
});
