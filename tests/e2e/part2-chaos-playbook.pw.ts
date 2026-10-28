import { expect, test, type Page } from '@playwright/test';

const SCENARIO_PLAYERS = Array.from({ length: 16 }, (_, index) =>
  `Player ${String(index + 1).padStart(2, '0')}`,
);

async function startSession(
  page: Page,
  options: {
    mode: 'singles' | 'doubles';
    players: string[];
    courtCount?: number;
  },
) {
  await page.goto(`/queue?mode=${options.mode}`);
  const courtCount = options.courtCount ?? 1;
  const increaseCourtCount = page.locator('.court-count-adj').last();
  for (let c = 1; c < courtCount; c++) {
    await increaseCourtCount.click();
  }
  await page.getByPlaceholder(/Paste names separated by commas/).fill(options.players.join(', '));
  await page.getByTitle('Add all').click();
  await expect(page.getByText(`Players (${options.players.length})`)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: /Start Queue/ }).click();
  await expect(page.locator('.session-bar--host')).toContainText('Connected', { timeout: 30_000 });

  const roomCode = (await page.locator('.session-code').textContent())!.trim();
  return roomCode;
}

test.describe('Part 2: Real-World Human Chaos Stress Test Playbook', () => {
  test.setTimeout(180_000);

  // ── Scenario A: The Club Night Rush (16+ Players, 3 Courts) ──
  test('Scenario A: The Club Night Rush (16+ Players, 3 Courts)', async ({ browser }) => {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const host = await hostContext.newPage();
    try {
      await startSession(host, { mode: 'doubles', players: SCENARIO_PLAYERS, courtCount: 3 });

      // Verify Courts 1, 2, and 3 are immediately populated with 12 players (4 per court)
      const courts = host.locator('.courts-grid > div');
      await expect(courts).toHaveCount(3);
      await expect(courts.nth(0)).toContainText('Court 1');
      await expect(courts.nth(1)).toContainText('Court 2');
      await expect(courts.nth(2)).toContainText('Court 3');

      await expect(courts.nth(0)).toContainText('Player 01');
      await expect(courts.nth(0)).toContainText('Player 04');
      await expect(courts.nth(1)).toContainText('Player 05');
      await expect(courts.nth(1)).toContainText('Player 08');
      await expect(courts.nth(2)).toContainText('Player 09');
      await expect(courts.nth(2)).toContainText('Player 12');

      // Verify remaining 4 players in waiting queue (#13 to #16)
      await expect(host.locator('.pairing-table')).toContainText('Player 13');
      await expect(host.locator('.pairing-table')).toContainText('Player 16');

      // Rotate Court 1: Waiting players #1 and #2 take the court
      const courtOneBefore = await courts.nth(0).innerText();
      await courts.nth(0).getByRole('button', { name: /wins?$/i }).first().click();
      const skipScore = host.getByRole('button', { name: /Skip Score/i });
      if (await skipScore.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipScore.click();
      }

      // Modern MatchCompletionToast confirms win with undo
      await expect(host.locator('text=/won/i')).toBeVisible({ timeout: 5000 });

      // Waiting players #13 & #14 took Court 1
      await expect.poll(async () => courts.nth(0).innerText()).not.toBe(courtOneBefore);
      await expect(courts.nth(0)).toContainText('Player 13');
      await expect(courts.nth(0)).toContainText('Player 14');
    } finally {
      await hostContext.close();
    }
  });

  // ── Scenario B: The Accidental Winner ("Fat-Finger Recovery") ──
  test('Scenario B: The Accidental Winner ("Fat-Finger Recovery")', async ({ browser }) => {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const host = await hostContext.newPage();
    try {
      await startSession(host, { mode: 'doubles', players: SCENARIO_PLAYERS.slice(0, 10), courtCount: 2 });

      const courtOne = host.locator('.courts-grid > div').filter({ hasText: 'Court 1' });
      const courtOneBefore = await courtOne.innerText();

      // Host accidentally taps "Team 1 Wins" on Court 1
      await courtOne.getByRole('button', { name: /wins?$/i }).first().click();
      const skipScore = host.getByRole('button', { name: /Skip Score/i });
      if (await skipScore.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipScore.click();
      }

      // MatchCompletionToast confirms win
      await expect(host.locator('text=/won/i')).toBeVisible({ timeout: 5000 });

      // Tap Settings (Gear Icon) -> click "Undo Last Match"
      await host.getByTitle('Settings').click();
      const undoBtn = host.getByRole('menuitem', { name: 'Undo Last Match' });
      await expect(undoBtn).toBeVisible();
      await undoBtn.click();

      // Verify Court 1 restores the exact 4 players and state
      await expect.poll(async () => courtOne.innerText()).toBe(courtOneBefore);
      await expect(courtOne).toContainText('Player 01');
      await expect(courtOne).toContainText('Player 04');
    } finally {
      await hostContext.close();
    }
  });

  // ── Scenario C: The Marathon Deuce Battle ──
  test('Scenario C: The Marathon Deuce Battle', async ({ browser }) => {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const viewerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const host = await hostContext.newPage();
    const viewer = await viewerContext.newPage();
    try {
      const roomCode = await startSession(host, { mode: 'doubles', players: SCENARIO_PLAYERS.slice(0, 6), courtCount: 1 });

      await viewer.goto(`/watch/${roomCode}`);
      await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
        .toBeVisible({ timeout: 30_000 });

      // Set target limit to 3 for fast deuce verification
      const specialBtn = host.getByRole('button', { name: 'Special', exact: true });
      if (await specialBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await specialBtn.click();
        const input = host.getByPlaceholder('e.g. 7');
        await input.fill('3');
        await host.getByRole('button', { name: 'Set', exact: true }).click();
      }

      const plusA = host.locator('.score-side--a .score-btn--plus');
      const plusB = host.locator('.score-side--b .score-btn--plus');

      // Score up to 2-2 (Deuce on 3 point target)
      await plusA.click();
      await expect(host.locator('.score-side--a .score-display')).toHaveText('1', { timeout: 5000 });
      await plusA.click();
      await expect(host.locator('.score-side--a .score-display')).toHaveText('2', { timeout: 5000 });
      await plusB.click();
      await expect(host.locator('.score-side--b .score-display')).toHaveText('1', { timeout: 5000 });
      await plusB.click();
      await expect(host.locator('.score-side--b .score-display')).toHaveText('2', { timeout: 5000 });

      // Verify deuce dynamically increases target limit badge
      await expect(host.locator('.score-limit-badge')).toHaveText(/to 4/i, { timeout: 5000 });
      // Spectator sees DEUCE pill in real-time
      await expect(viewer.locator('.w-deuce-pill')).toBeVisible({ timeout: 10_000 });

      // Repeat deuce cycle: Team A leads (3-2) -> Team B equalizes (3-3, to 5)
      await plusA.click();
      await expect(host.locator('.score-side--a .score-display')).toHaveText('3', { timeout: 5000 });
      await expect(host.locator('.score-limit-badge')).toHaveText(/to 4/i, { timeout: 5000 });
      await plusB.click();
      await expect(host.locator('.score-side--b .score-display')).toHaveText('3', { timeout: 5000 });
      await expect(host.locator('.score-limit-badge')).toHaveText(/to 5/i, { timeout: 5000 });

      // Verify mobile viewport has no layout overflow
      const scrollWidth = await host.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await host.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
    } finally {
      await viewerContext.close();
      await hostContext.close();
    }
  });

  // ── Scenario D: Mid-Session Break & Bathroom Run ──
  test('Scenario D: Mid-Session Break & Bathroom Run', async ({ browser }) => {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const viewerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const host = await hostContext.newPage();
    const viewer = await viewerContext.newPage();
    try {
      const roomCode = await startSession(host, { mode: 'doubles', players: SCENARIO_PLAYERS.slice(0, 10), courtCount: 2 });

      await viewer.goto(`/watch/${roomCode}`);
      await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
        .toBeVisible({ timeout: 30_000 });

      // Player 09 is next up in queue (#1)
      // Host taps Host Tools -> Manage Players On Break -> sits out Player 09
      await host.getByRole('button', { name: 'Host Tools' }).click();
      const sheet = host.getByRole('dialog', { name: 'Host Tools' });
      await sheet.getByRole('button', { name: 'Manage Players On Break' }).click();
      await sheet.getByRole('button', { name: 'Sit out Player 09' }).click();
      await expect(sheet.locator('.sitout-row').filter({ hasText: 'Player 09' })).toContainText('On break');
      await sheet.getByRole('button', { name: 'Close sheet' }).click();

      // Spectator view displays Player 09 in dedicated On Break section
      await expect(viewer.getByText(/On Break/i).first()).toBeVisible({ timeout: 10_000 });
      await expect(viewer.getByText('Player 09')).toBeVisible();

      // Complete match on Court 1: Player 09 is skipped! Player 10 takes court instead
      const courtOne = host.locator('.courts-grid > div').filter({ hasText: 'Court 1' });
      await courtOne.getByRole('button', { name: /wins?$/i }).first().click();
      const skipScore = host.getByRole('button', { name: /Skip Score/i });
      if (await skipScore.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipScore.click();
      }
      await expect(host.locator('text=/won/i')).toBeVisible({ timeout: 5000 });

      // Court 1 has Player 10, but NOT Player 09!
      await expect(courtOne).toContainText('Player 10');
      await expect(courtOne).not.toContainText('Player 09');

      // Player returns: Host taps "Back in"
      await host.getByRole('button', { name: 'Host Tools' }).click();
      if (!await sheet.locator('.sitout-row').first().isVisible()) {
        await sheet.getByRole('button', { name: 'Manage Players On Break' }).click();
      }
      await sheet.getByRole('button', { name: /Return Player 09/ }).click();
      await sheet.getByRole('button', { name: 'Close sheet' }).click();

      // Player 09 returned to active queue
      await expect(host.locator('.pairing-table')).toContainText('Player 09');
    } finally {
      await viewerContext.close();
      await hostContext.close();
    }
  });

  // ── Scenario E: Fixed Duo / Partner Locking ──
  test('Scenario E: Fixed Duo / Partner Locking', async ({ browser }) => {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const viewerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const host = await hostContext.newPage();
    const viewer = await viewerContext.newPage();
    try {
      const roomCode = await startSession(host, { mode: 'doubles', players: SCENARIO_PLAYERS.slice(0, 10), courtCount: 2 });

      await viewer.goto(`/watch/${roomCode}`);
      await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
        .toBeVisible({ timeout: 30_000 });

      // Host taps Set Partners -> selects Player 09 and Player 10
      await host.getByRole('button', { name: 'Host Tools' }).click();
      const sheet = host.getByRole('dialog', { name: 'Host Tools' });
      await sheet.getByRole('button', { name: 'Set Partners' }).click();

      const p9 = sheet.locator('.partner-player-btn').filter({ hasText: 'Player 09' });
      const p10 = sheet.locator('.partner-player-btn').filter({ hasText: 'Player 10' });
      await p9.click();
      await p10.click();

      // Verify duo chip appears: Player 09 & Player 10
      await expect(sheet.locator('.partner-pair-chip')).toContainText('Player 09 & Player 10');
      await sheet.getByRole('button', { name: 'Close sheet' }).click();

      // Rotate Court 1: Locked duo enters court on the same team
      const courtOne = host.locator('.courts-grid > div').filter({ hasText: 'Court 1' });
      await courtOne.getByRole('button', { name: /wins?$/i }).first().click();
      const skipScore = host.getByRole('button', { name: /Skip Score/i });
      if (await skipScore.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipScore.click();
      }
      await expect(host.locator('text=/won/i')).toBeVisible({ timeout: 5000 });

      // Both players 09 and 10 are together on Court 1
      await expect(courtOne).toContainText('Player 09');
      await expect(courtOne).toContainText('Player 10');
    } finally {
      await viewerContext.close();
      await hostContext.close();
    }
  });

  // ── Scenario F: Late Walk-In & Sudden Departure ──
  test('Scenario F: Late Walk-In & Sudden Departure', async ({ browser }) => {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const host = await hostContext.newPage();
    try {
      await startSession(host, { mode: 'doubles', players: SCENARIO_PLAYERS.slice(0, 10), courtCount: 2 });

      // Host taps Add Player -> types Late Arrival Zoe -> taps Add
      await host.getByRole('button', { name: 'Host Tools' }).click();
      const sheet = host.getByRole('dialog', { name: 'Host Tools' });
      const addInput = sheet.getByPlaceholder(/Player name/);
      await addInput.fill('Late Arrival Zoe');
      await sheet.getByRole('button', { name: /Add/ }).click();
      await expect(sheet).not.toBeVisible();

      // Zoe appears in waiting queue
      await expect(host.locator('.pairing-table')).toContainText('Late Arrival Zoe');

      // Sudden Departure: Player 10 must leave early
      await host.getByRole('button', { name: 'Host Tools' }).click();
      await sheet.getByRole('button', { name: 'Manage Queue' }).click();
      const removeBtn = sheet.locator('.mqp-btn--remove').filter({ hasText: 'Player 10' });
      await removeBtn.click();
      await sheet.getByRole('button', { name: 'Close sheet' }).click();

      // Player 10 is purged from queue; active courts remain unaffected
      await expect(host.locator('.pairing-table')).not.toContainText('Player 10');
      const courtOne = host.locator('.courts-grid > div').filter({ hasText: 'Court 1' });
      await expect(courtOne).toContainText('Player 01');
      await expect(courtOne).toContainText('Player 04');
    } finally {
      await hostContext.close();
    }
  });

  // ── Scenario G: Staggered Multi-Court Finishes ──
  test('Scenario G: Staggered Multi-Court Finishes', async ({ browser }) => {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const viewerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const host = await hostContext.newPage();
    const viewer = await viewerContext.newPage();
    try {
      const roomCode = await startSession(host, { mode: 'doubles', players: SCENARIO_PLAYERS.slice(0, 10), courtCount: 2 });

      await viewer.goto(`/watch/${roomCode}`);
      await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
        .toBeVisible({ timeout: 30_000 });

      const court1 = host.locator('.courts-grid > div').filter({ hasText: 'Court 1' });
      const court2 = host.locator('.courts-grid > div').filter({ hasText: 'Court 2' });
      const court1Before = await court1.innerText();
      const court2Before = await court2.innerText();

      // Court 2 finishes match first
      await court2.getByRole('button', { name: /wins?$/i }).first().click();
      const skipScore = host.getByRole('button', { name: /Skip Score/i });
      if (await skipScore.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipScore.click();
      }
      await expect(host.locator('text=/won/i')).toBeVisible({ timeout: 5000 });

      // Court 2 immediately re-loads with waiting players
      await expect.poll(async () => court2.innerText()).not.toBe(court2Before);
      // Court 1 stays actively running with its lineup intact
      expect(await court1.innerText()).toBe(court1Before);
    } finally {
      await viewerContext.close();
      await hostContext.close();
    }
  });

  // ── Scenario H: Spectator Swarm & Live Theme Shift ──
  test('Scenario H: Spectator Swarm & Live Theme Shift', async ({ browser }) => {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const v1Context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const v2Context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const v3Context = await browser.newContext({ viewport: { width: 390, height: 844 } });

    const host = await hostContext.newPage();
    const v1 = await v1Context.newPage();
    const v2 = await v2Context.newPage();
    const v3 = await v3Context.newPage();

    try {
      const roomCode = await startSession(host, { mode: 'doubles', players: SCENARIO_PLAYERS.slice(0, 10), courtCount: 2 });

      await Promise.all([
        v1.goto(`/watch/${roomCode}`),
        v2.goto(`/watch/${roomCode}`),
        v3.goto(`/watch/${roomCode}`),
      ]);

      await expect(v1.getByText('You are watching live. Only the host can make changes.')).toBeVisible({ timeout: 30_000 });
      await expect(v2.getByText('You are watching live. Only the host can make changes.')).toBeVisible({ timeout: 30_000 });
      await expect(v3.getByText('You are watching live. Only the host can make changes.')).toBeVisible({ timeout: 30_000 });

      // Spectator 1: toggles theme Dark -> Light -> Dark
      const themeBtn = v1.locator('.w-theme-toggle');
      await themeBtn.click();
      await expect(v1.locator('html')).not.toHaveClass(/dark-mode/);
      await themeBtn.click();
      await expect(v1.locator('html')).toHaveClass(/dark-mode/);

      // Spectator 2: switches between Court 1 and Court 2 tabs
      const court2Tab = v2.getByRole('tab', { name: /Court 2/ });
      await court2Tab.click();
      await expect(court2Tab).toHaveAttribute('aria-selected', 'true');
      await expect(v2.getByRole('tabpanel')).toContainText('Court 2');

      // Spectator 3: opens Standings / Recap Modal
      const historyToggle = v3.locator('.w-history-toggle');
      await historyToggle.click();
      await expect(v3.getByText('Player Performance')).toBeVisible({ timeout: 15_000 });

      const shareRecapBtn = v3.getByRole('button', { name: 'Share Standings Card' });
      await shareRecapBtn.click();
      await expect(v3.locator('.recap-modal-dialog')).toBeVisible();
      await v3.locator('.recap-modal-close-btn').click();
      await expect(v3.locator('.recap-modal-dialog')).not.toBeVisible();

      // Host records match win
      const court1 = host.locator('.courts-grid > div').filter({ hasText: 'Court 1' });
      await court1.getByRole('button', { name: /wins?$/i }).first().click();
      const skipScore = host.getByRole('button', { name: /Skip Score/i });
      if (await skipScore.isVisible({ timeout: 2000 }).catch(() => false)) {
        await skipScore.click();
      }
      await expect(host.locator('text=/won/i')).toBeVisible({ timeout: 5000 });

      // All spectator tabs receive Firestore updates smoothly
      await expect(v1.getByRole('tabpanel')).toBeVisible({ timeout: 15_000 });
      await expect(v2.getByRole('tabpanel')).toBeVisible({ timeout: 15_000 });
      await expect(v3.getByRole('tabpanel')).toBeVisible({ timeout: 15_000 });
    } finally {
      await v3Context.close();
      await v2Context.close();
      await v1Context.close();
      await hostContext.close();
    }
  });

  // ── Scenario I: Flaky Wi-Fi & Hard Refresh ──
  test('Scenario I: Flaky Wi-Fi & Hard Refresh', async ({ browser }) => {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const host = await hostContext.newPage();
    try {
      const roomCode = await startSession(host, { mode: 'doubles', players: SCENARIO_PLAYERS.slice(0, 10), courtCount: 2 });

      const courtOne = host.locator('.courts-grid > div').filter({ hasText: 'Court 1' });
      await expect(courtOne).toContainText('Player 01');
      await expect(courtOne).toContainText('Player 04');

      // Hard refresh the host browser mid-game
      await host.reload();
      await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 30_000 });
      expect((await host.locator('.session-code').textContent())?.trim()).toBe(roomCode);

      // Active scores and court state match pre-refresh state
      await expect(courtOne).toContainText('Player 01');
      await expect(courtOne).toContainText('Player 04');
    } finally {
      await hostContext.close();
    }
  });
});
