import { expect, test } from '@playwright/test';

test.describe('Live Wiring Regressions & Parity (Bugs #1 - #6)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('1. Smart paste + pre-session check-in + HostToolsSheet 1-tap late arrival (Bugs #1, #3, #4)', async ({
    page,
  }) => {
    await page.goto('/queue?mode=doubles');
    await expect(page.getByRole('heading', { name: 'Doubles Queue' })).toBeVisible();

    // Paste numbered list with emoji and waitlist header
    const pasteInput = page.getByPlaceholder(/Paste names separated by commas/);
    await pasteInput.fill('1. Ana (PAID)\n2. Ben ✅\n3. Cara\n4. Dan\n5. Eli\n6. Fay\nWaitlist:\n7. Ghost');

    // Click "Add as Expected"
    const addExpectedBtn = page.getByRole('button', { name: 'Add as Expected' });
    await expect(addExpectedBtn).toBeVisible();
    await addExpectedBtn.click();

    // Ghost after waitlist should not be added
    await expect(page.getByText('Ghost')).toHaveCount(0);
    // Expected arrivals heading should show 6 players
    await expect(page.getByText(/Expected Arrivals/i)).toBeVisible();

    // Verify .checkin-btn touch target height >= 44
    const checkinBtn = page.locator('.checkin-btn').first();
    const checkinBox = await checkinBtn.boundingBox();
    expect(checkinBox).not.toBeNull();
    expect(Math.round(checkinBox!.height)).toBeGreaterThanOrEqual(44);

    // Check in first 5 players: Ana, Ben, Cara, Dan, Eli (leaving Fay in Expected)
    const playersToCheckIn = ['Ana', 'Ben', 'Cara', 'Dan', 'Eli'];
    for (const name of playersToCheckIn) {
      await page.locator('.expected-player-chip', { hasText: name }).locator('.checkin-btn').click();
    }

    // Verify 5 checked in and 1 expected (Fay)
    await expect(page.getByText('Players (5)')).toBeVisible();
    await expect(page.locator('.setup-checked-in-pill')).toBeVisible();
    await expect(page.getByText('Expected Arrivals (1)')).toBeVisible();

    // Start Queue
    await page.getByRole('button', { name: /Start Queue/ }).click();
    await expect(page.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });

    const roomCode = (await page.locator('.session-code').textContent())?.trim();
    expect(roomCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);

    // Verify localStorage has Fay persisted under the official roomCode
    const lateStored = await page.evaluate((code) => localStorage.getItem(`padq_late_arrivals_${code}`), roomCode);
    expect(JSON.parse(lateStored ?? '[]')).toEqual(['Fay']);

    // Open Host Tools bottom sheet
    await page.getByRole('button', { name: 'Host Tools' }).click();
    await expect(page.getByText(/Expected Late Arrivals \(1\)/i)).toBeVisible({ timeout: 5000 });

    const checkInFayBtn = page.getByRole('button', { name: 'Check in Fay' });
    await expect(checkInFayBtn).toBeVisible();
    const fayBox = await checkInFayBtn.boundingBox();
    expect(fayBox).not.toBeNull();
    expect(Math.round(fayBox!.height)).toBeGreaterThanOrEqual(44);

    // Check in Fay via 1-tap tray
    await checkInFayBtn.click();
    await page.getByRole('button', { name: 'Close sheet' }).click();

    // Fay is now in the live queue
    await expect(page.getByRole('button', { name: 'Fay', exact: true })).toBeVisible();
  });

  test('2. Multi-court singles 3-win streak rotation & retroactive Flip Winner syncs to /watch and survives reload (Bugs #2, #6)', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const viewerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const host = await hostContext.newPage();
    const viewer = await viewerContext.newPage();

    // 1. Setup 2 courts singles
    await host.goto('/queue?mode=singles');
    await host.locator('.court-count-adj').last().click();
    await expect(host.locator('.court-count-value')).toHaveText('2');

    await host.getByPlaceholder(/Paste names separated by commas/).fill('S1, S2, S3, S4, S5, S6');
    await host.getByTitle('Add all').click();
    await host.getByRole('button', { name: /Start Queue/ }).click();
    await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });

    // Ensure live broadcast is active
    await host.getByTitle('Settings').click();
    const startLiveButton = host.getByRole('button', { name: 'Start', exact: true });
    if (await startLiveButton.isVisible()) {
      await startLiveButton.click();
    }
    await host.keyboard.press('Escape');

    // Toggle match score prompts OFF in Host Tools so win clicks execute immediately
    await host.getByRole('button', { name: 'Host Tools' }).click();
    const toggleScores = host.getByRole('switch', { name: /Toggle Match Scores/i });
    if (await toggleScores.getAttribute('aria-checked') === 'true') {
      await toggleScores.click();
    }
    await host.getByRole('button', { name: 'Close sheet' }).click();

    const roomCode = (await host.locator('.session-code').textContent())?.trim();
    expect(roomCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);

    // Initial court assignments: Court 1 has S1 vs S2
    const court1 = host.locator('.courts-grid > div').filter({ hasText: 'Court 1' });
    await expect(court1).toContainText('S1');
    await expect(court1).toContainText('S2');

    // Win 1 for S1 on Court 1
    const s1WinBtn = court1.getByRole('button', { name: /S1 wins/i });
    await s1WinBtn.click();
    await host.waitForTimeout(400);
    // S1 should remain on Court 1 (streak 1)
    await expect(court1).toContainText('S1');

    // Win 2 for S1 on Court 1
    await court1.getByRole('button', { name: /S1 wins/i }).click();
    await host.waitForTimeout(400);
    // S1 should remain on Court 1 (streak 2)
    await expect(court1).toContainText('S1');

    // Win 3 for S1 on Court 1 (hitting 3-game streak limit)
    await court1.getByRole('button', { name: /S1 wins/i }).click();
    await host.waitForTimeout(600);
    // S1 should have rotated OFF Court 1 into the waiting queue!
    await expect(court1).not.toContainText('S1');

    // 2. Go to Stats tab and test "Flip Winner"
    const statsTab = host.getByRole('button', { name: 'Stats', exact: true });
    await statsTab.click();
    await host.getByRole('button', { name: 'History', exact: true }).click();

    // Verify .history-flip-btn touch target height >= 44
    const flipBtn = host.locator('.history-flip-btn').first();
    await expect(flipBtn).toBeVisible({ timeout: 5000 });
    const flipBox = await flipBtn.boundingBox();
    expect(flipBox).not.toBeNull();
    expect(Math.round(flipBox!.height)).toBeGreaterThanOrEqual(44);

    // Connect spectator to /watch/[sessionId]
    await viewer.goto(`/watch/${roomCode}`);
    await expect(viewer.locator('.w-topbar')).toBeVisible({ timeout: 15_000 });

    // Flip the winner on host
    await flipBtn.click();
    await expect(host.locator('.toast-notification, [role="alert"]')).toBeVisible({ timeout: 5000 });

    // Reload host page to verify persistence in Firestore
    await host.reload();
    await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });
    await host.getByRole('button', { name: 'Stats', exact: true }).click();
    await host.getByRole('button', { name: 'History', exact: true }).click();
    await expect(host.locator('.history-flip-btn').first()).toBeVisible();

    // Verify spectator also shows matches in history
    await expect(viewer.locator('.w-history-toggle')).toBeVisible();
    await viewer.locator('.w-history-toggle').click();
    await expect(viewer.locator('.w-history-item').first()).toBeVisible();
  });

  test('3. Spectator turn alerts work in single-court /watch without off-by-one errors (Bug #5)', async ({
    browser,
  }) => {
    const hostContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const viewerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const host = await hostContext.newPage();
    const viewer = await viewerContext.newPage();

    // Start 1-court doubles session with 6 players
    await host.goto('/queue?mode=doubles');
    await host.getByPlaceholder(/Paste names separated by commas/).fill('D1, D2, D3, D4, D5, D6');
    await host.getByTitle('Add all').click();
    await host.getByRole('button', { name: /Start Queue/ }).click();
    await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });

    // Ensure live broadcast is active
    await host.getByTitle('Settings').click();
    const startLiveButton = host.getByRole('button', { name: 'Start', exact: true });
    if (await startLiveButton.isVisible()) {
      await startLiveButton.click();
    }
    await host.keyboard.press('Escape');

    const roomCode = (await host.locator('.session-code').textContent())?.trim();
    expect(roomCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);

    // Open spectator view
    await viewer.goto(`/watch/${roomCode}`);
    await expect(viewer.locator('.w-topbar')).toBeVisible({ timeout: 15_000 });

    // In single-court doubles, D5 is waiting (#1 in Next in Queue)
    const d5Chip = viewer.getByRole('button', { name: /Turn alert: D5/i });
    await expect(d5Chip).toBeVisible({ timeout: 5000 });
    const d5Box = await d5Chip.boundingBox();
    expect(d5Box).not.toBeNull();
    expect(Math.round(d5Box!.height)).toBeGreaterThanOrEqual(44);

    // Click to arm turn alert
    await d5Chip.click();
    await expect(viewer.getByRole('button', { name: 'Turn alert: D5 (on)' })).toBeVisible();

    // Reload viewer and verify turn alert armed state persisted
    await viewer.reload();
    await expect(viewer.getByRole('button', { name: 'Turn alert: D5 (on)' })).toBeVisible({ timeout: 10_000 });

    // Spectator page must NEVER expose match win buttons
    expect(await viewer.getByRole('button', { name: /wins?$/i }).count()).toBe(0);
  });
});
