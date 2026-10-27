import { expect, test } from '@playwright/test';

const CHAOS_PLAYERS = Array.from({ length: 12 }, (_, index) =>
  `Chaos Player ${String(index + 1).padStart(2, '0')}`,
);

test('Human Chaos 1: Mid-match break, late arrival, queue reorder, and departure', async ({ browser }) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const viewerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostContext.newPage();
  const viewer = await viewerContext.newPage();

  try {
    await host.goto('/queue?mode=doubles');
    await host.getByPlaceholder(/Paste names separated by commas/).fill(CHAOS_PLAYERS.slice(0, 8).join(', '));
    await host.getByTitle('Add all').click();
    await host.getByRole('button', { name: /Start Queue/ }).click();
    await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 30_000 });

    await host.getByTitle('Settings').click();
    const startLive = host.getByRole('button', { name: 'Start', exact: true });
    if (await startLive.isVisible()) await startLive.click();
    const roomCode = (await host.locator('.session-code').textContent())!.trim();

    // Spectator joins
    await viewer.goto(`/watch/${roomCode}`);
    await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
      .toBeVisible({ timeout: 30_000 });

    // 1. Host opens Host Tools sheet and marks Player 05 for a break
    await host.getByRole('button', { name: /Breaks/i }).first().click();
    const sheet = host.getByRole('dialog', { name: 'Host Tools' });
    await expect(sheet).toBeVisible();

    await sheet.getByRole('button', { name: 'Sit out Chaos Player 05' }).click();
    await expect(sheet.locator('.sitout-row').filter({ hasText: 'Chaos Player 05' })).toContainText('On break');

    // Spectator sees On Break section appear in real time
    await expect(viewer.getByText(/On Break/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(viewer.getByText('Chaos Player 05')).toBeVisible();

    // 2. Late walk-in arrival: Add "Late Arrival Zoe"
    await sheet.getByRole('button', { name: 'Close sheet' }).click();
    await expect(sheet).not.toBeVisible();

    await host.getByRole('button', { name: 'Add Player' }).first().click();
    await expect(sheet).toBeVisible();

    const addInput = sheet.getByPlaceholder(/Player name/);
    await addInput.fill('Late Arrival Zoe');
    await sheet.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(sheet).not.toBeVisible();
    await expect(host.locator('.waiting-players-list')).toContainText('Late Arrival Zoe');

    // 3. Early departure: remove Player 08 from queue
    await host.getByRole('button', { name: 'Manage Queue' }).first().click();
    await expect(sheet).toBeVisible();

    const removeBtn = sheet.locator('.mqp-btn--remove').filter({ hasText: 'Chaos Player 08' });
    await removeBtn.click();
    await expect(sheet.locator('.mqp-btn--remove').filter({ hasText: 'Chaos Player 08' })).toHaveCount(0);

    // 4. Return Player 05 from break
    await sheet.getByRole('button', { name: 'Close sheet' }).click();
    await expect(sheet).not.toBeVisible();

    await host.getByRole('button', { name: /Breaks/i }).first().click();
    await expect(sheet).toBeVisible();

    await sheet.getByRole('button', { name: 'Return Chaos Player 05', exact: true }).click();
    await expect(sheet.locator('.sitout-row').filter({ hasText: 'Chaos Player 05' })).not.toContainText('On break');
    await sheet.getByRole('button', { name: 'Close sheet' }).click();
    await expect(sheet).not.toBeVisible();

    // Verify Late Arrival Zoe is in waiting queue
    await expect(host.locator('.waiting-players-list')).toContainText('Late Arrival Zoe');
  } finally {
    await viewerContext.close();
    await hostContext.close();
  }
});

test('Human Chaos 2: Multi-court partner locking, match rotation, undo, and live theme toggle', async ({ browser }) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const viewerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostContext.newPage();
  const viewer = await viewerContext.newPage();

  try {
    await host.goto('/queue?mode=doubles');
    const plusCourt = host.locator('.court-count-adj').last();
    await plusCourt.click(); // 2 courts
    await expect(host.locator('.court-count-value')).toHaveText('2');

    await host.getByPlaceholder(/Paste names separated by commas/).fill(CHAOS_PLAYERS.slice(0, 10).join(', '));
    await host.getByTitle('Add all').click();
    await host.getByRole('button', { name: /Start Queue/ }).click();
    await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 30_000 });

    await host.getByTitle('Settings').click();
    const startLive = host.getByRole('button', { name: 'Start', exact: true });
    if (await startLive.isVisible()) await startLive.click();
    const roomCode = (await host.locator('.session-code').textContent())!.trim();

    // Spectator joins on mobile
    await viewer.goto(`/watch/${roomCode}`);
    await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
      .toBeVisible({ timeout: 30_000 });
    await expect(viewer.getByRole('tab')).toHaveCount(2);

    // 1. Spectator toggles between Dark Mode and Light Mode
    const themeBtn = viewer.locator('.w-theme-toggle');
    await expect(themeBtn).toBeVisible();
    await themeBtn.click(); // Switch to light
    await expect(viewer.locator('html')).not.toHaveClass(/dark-mode/);
    await themeBtn.click(); // Switch back to dark
    await expect(viewer.locator('html')).toHaveClass(/dark-mode/);

    // 2. Spectator switches court tabs
    const court2Tab = viewer.getByRole('tab', { name: /Court 2/ });
    await court2Tab.click();
    await expect(court2Tab).toHaveAttribute('aria-selected', 'true');
    await expect(viewer.getByRole('tabpanel')).toContainText('Court 2');

    // 3. Host locks partners for Chaos Player 09 & Chaos Player 10
    await host.getByRole('button', { name: 'Host Tools' }).click();
    const sheet = host.getByRole('dialog', { name: 'Host Tools' });
    await expect(sheet).toBeVisible();

    await sheet.getByRole('button', { name: 'Set Partners' }).click();

    const p9 = sheet.locator('.partner-player-btn').filter({ hasText: 'Chaos Player 09' });
    const p10 = sheet.locator('.partner-player-btn').filter({ hasText: 'Chaos Player 10' });
    await expect(p9).toBeVisible();
    await p9.click();
    await p10.click();
    await expect(sheet.locator('.partner-pair-chip')).toContainText('Chaos Player 09 & Chaos Player 10');
    await sheet.getByRole('button', { name: 'Close sheet' }).click();
    await expect(sheet).not.toBeVisible();

    // 4. Complete match on Court 1 (Team A win)
    const courtOneCard = host.locator('.courts-grid > div').filter({ hasText: 'Court 1' });
    const courtOneBefore = await courtOneCard.innerText();
    await courtOneCard.getByRole('button', { name: /wins?$/i }).first().click();

    const skipScore = host.getByRole('button', { name: /Skip Score/i });
    if (await skipScore.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipScore.click();
    }

    // Dismiss WinnerModal
    await expect(host.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    await host.keyboard.press('Escape');
    await expect(host.locator('.modal-overlay')).not.toBeVisible({ timeout: 3000 });

    // Court 1 rotated: waiting duo (09 & 10) was pulled onto court
    await expect.poll(async () => courtOneCard.innerText()).not.toBe(courtOneBefore);

    // 5. Host uses Undo Last Match
    await host.getByTitle('Settings').click();
    const undoBtn = host.getByRole('menuitem', { name: 'Undo Last Match' });
    await expect(undoBtn).toBeVisible();
    await undoBtn.click();

    // Verify Court 1 restored to original lineup
    await expect.poll(async () => courtOneCard.innerText()).toBe(courtOneBefore);

    // Re-complete Court 1 match so spectator has match history & performance data
    await courtOneCard.getByRole('button', { name: /wins?$/i }).first().click();
    if (await skipScore.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipScore.click();
    }
    await expect(host.locator('.modal-overlay')).toBeVisible({ timeout: 5000 });
    await host.keyboard.press('Escape');
    await expect(host.locator('.modal-overlay')).not.toBeVisible({ timeout: 3000 });

    // 6. Spectator checks Standings and opens Recap Modal
    const historyToggle = viewer.locator('.w-history-toggle');
    await expect(historyToggle).toBeVisible();
    await historyToggle.click();
    await expect(viewer.getByText('Player Performance')).toBeVisible({ timeout: 15_000 });

    const shareRecapBtn = viewer.getByRole('button', { name: 'Share Standings Card' });
    await expect(shareRecapBtn).toBeVisible({ timeout: 10_000 });
    await shareRecapBtn.click();
    await expect(viewer.locator('.recap-modal-dialog')).toBeVisible();
    await viewer.locator('.recap-modal-close-btn').click();
    await expect(viewer.locator('.recap-modal-dialog')).not.toBeVisible();
  } finally {
    await viewerContext.close();
    await hostContext.close();
  }
});
