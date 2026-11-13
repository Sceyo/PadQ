import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import {
  formatElapsedSeconds,
  buildCourtCalloutText,
  speakCourtCallout,
  getOrInitCourtStartTime,
} from '../app/queue/lib/courtSpeechAndTimer';
import { CourtCard } from '../app/queue/components/CourtCard/CourtCard';

describe('courtSpeechAndTimer', () => {
  it('formats elapsed seconds as mm:ss', () => {
    expect(formatElapsedSeconds(0)).toBe('00:00');
    expect(formatElapsedSeconds(-5)).toBe('00:00');
    expect(formatElapsedSeconds(65)).toBe('01:05');
    expect(formatElapsedSeconds(754)).toBe('12:34');
    expect(formatElapsedSeconds(3600)).toBe('60:00');
  });

  it('builds natural TTS callout phrasing for singles and doubles', () => {
    expect(
      buildCourtCalloutText('Court 1', ['Carlos', 'Jannik'], ['Rafael', 'Novak'], 'doubles'),
    ).toBe('Court 1: Carlos and Jannik, versus Rafael and Novak.');

    expect(
      buildCourtCalloutText('Court 2', ['Carlos'], ['Jannik'], 'singles'),
    ).toBe('Court 2: Carlos versus Jannik.');
  });

  it('safely handles speakCourtCallout when speechSynthesis is missing or supported', () => {
    // In headless test environment without window.speechSynthesis
    expect(speakCourtCallout('Testing callout')).toBe(false);

    // Mock speechSynthesis
    const mockSpeak = vi.fn();
    (globalThis as unknown as { speechSynthesis?: unknown }).speechSynthesis = {
      speak: mockSpeak,
      cancel: vi.fn(),
    };
    (globalThis as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = class {
      text: string;
      constructor(text: string) {
        this.text = text;
      }
    };

    expect(speakCourtCallout('Court 1 match')).toBe(true);
    expect(mockSpeak).toHaveBeenCalled();
  });

  it('tracks court match start timestamp across identical lineup and resets on changed lineup', () => {
    const courtId = 'court-1';
    const lineupA = 'P1,P2,P3,P4';
    const lineupB = 'P5,P6,P7,P8';

    const t0 = getOrInitCourtStartTime(courtId, lineupA);
    expect(t0).toBeGreaterThan(0);

    const tSame = getOrInitCourtStartTime(courtId, lineupA);
    expect(tSame).toBe(t0);

    // Change lineup
    const tNext = getOrInitCourtStartTime(courtId, lineupB);
    expect(tNext).toBeGreaterThanOrEqual(t0);
  });

  it('renders elapsed timer and voice callout button when court is ready', () => {
    const slot = {
      id: 'court-1',
      name: 'Court 1',
      onCourt: ['A', 'B', 'C', 'D'],
    };
    const html = renderToStaticMarkup(
      <CourtCard
        slot={slot}
        statsMap={{}}
        isHost={true}
        onWin={() => undefined}
      />
    );

    expect(html).toContain('00:00');
    expect(html).toContain('Announce Court 1 matchup');
  });
});
