import { expect, test, type Page } from '@playwright/test';

const SINGLES = Array.from({ length: 8 }, (_, index) => `Resilience Singles ${index + 1}`);
const DOUBLES = Array.from({ length: 8 }, (_, index) => `Resilience Doubles ${index + 1}`);

async function startRoom(page: Page, mode: 'singles' | 'doubles', players: string[]) {
  await page.goto(`/queue?mode=${mode}`);
  await page.getByPlaceholder(/Paste names separated by commas/).fill(players.join(', '));
  await page.getByTitle('Add all').click();
  await page.getByRole('button', { name: /Start Queue/ }).click();
  await expect(page.locator('.session-bar--host')).toContainText('Connected', { timeout: 30_000 });

  await page.getByTitle('Settings').click();
  const startLive = page.getByRole('button', { name: 'Start', exact: true });
  if (await startLive.isVisible()) await startLive.click();

  const code = (await page.locator('.session-code').textContent())?.trim();
  expect(code).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  return code!;
}

async function setCustomLimit(page: Page, limit: number) {
  await page.getByRole('button', { name: /Custom|Special/ }).click();
  const input = page.getByPlaceholder(/e\.g\. (15|7)/);
  await input.fill(String(limit));
  await input.press('Enter');
}

test('deuce uses win-by-two, survives reload, and remains correctable', async ({ browser }) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const viewer = await viewerContext.newPage();

  try {
    const code = await startRoom(host, 'singles', SINGLES);
    await viewer.goto(`/watch/${code}`);
    await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
      .toBeVisible({ timeout: 30_000 });
    await setCustomLimit(host, 3);

    const plusA = host.locator('.score-side--a .score-btn--plus');
    const plusB = host.locator('.score-side--b .score-btn--plus');
    for (let point = 0; point < 2; point += 1) await plusA.click();
    for (let point = 0; point < 2; point += 1) await plusB.click();

    // At 2-2 in a game to 3, the next valid winning score is 4-2.
    await expect(host.locator('.score-limit-badge')).toHaveText('to 4');
    await expect(viewer.locator('.w-live-limit-badge')).toHaveText('to 4', { timeout: 20_000 });

    await host.reload();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('2', { timeout: 30_000 });
    await expect(host.locator('.score-side--b .score-display')).toHaveText('2');
    await expect(host.locator('.score-limit-badge')).toHaveText('to 4');

    const restoredPlusA = host.locator('.score-side--a .score-btn--plus');
    for (let point = 0; point < 2; point += 1) await restoredPlusA.click();
    await expect(host.getByText('Game Over!')).toBeVisible();
    await host.locator('.score-side--a .score-btn--minus').click();
    await expect(host.getByText('Game Over!')).not.toBeVisible();
    await expect(viewer.locator('.w-live-side').filter({ hasText: /Team A|Player 1/ }).locator('.w-live-score-num'))
      .toHaveText('3', { timeout: 20_000 });
  } finally {
    await viewerContext.close();
    await hostContext.close();
  }
});

test('rapid points and a temporary network loss converge without viewer refresh', async ({ browser }) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const viewer = await viewerContext.newPage();
  const syncErrors: string[] = [];
  host.on('console', message => {
    if (message.type() === 'error' && message.text().includes('[useSession]')) syncErrors.push(message.text());
  });

  try {
    const code = await startRoom(host, 'singles', SINGLES);
    await viewer.goto(`/watch/${code}`);
    await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
      .toBeVisible({ timeout: 30_000 });

    const plusA = host.locator('.score-side--a .score-btn--plus');
    const plusB = host.locator('.score-side--b .score-btn--plus');
    for (let point = 0; point < 7; point += 1) await plusA.click();
    for (let point = 0; point < 4; point += 1) await plusB.click();
    await expect(viewer.locator('.w-live-side').filter({ hasText: /Team A|Player 1/ }).locator('.w-live-score-num'))
      .toHaveText('7', { timeout: 30_000 });
    await expect(viewer.locator('.w-live-side').filter({ hasText: /Team B|Player 2/ }).locator('.w-live-score-num'))
      .toHaveText('4');

    await hostContext.setOffline(true);
    await plusA.click();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('8');
    await hostContext.setOffline(false);
    await expect(viewer.locator('.w-live-side').filter({ hasText: /Team A|Player 1/ }).locator('.w-live-score-num'))
      .toHaveText('8', { timeout: 30_000 });

    await host.reload();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('8', { timeout: 30_000 });
    await expect(host.locator('.score-side--b .score-display')).toHaveText('4');

    // A point followed immediately by navigation must not be replaced by the
    // previously saved score when the host page returns.
    await host.locator('.score-side--b .score-btn--plus').click();
    await host.reload();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('8', { timeout: 30_000 });
    await expect(host.locator('.score-side--b .score-display')).toHaveText('5');

    await viewer.reload();
    await expect(viewer.locator('.w-live-side').filter({ hasText: /Team B|Player 2/ }).locator('.w-live-score-num'))
      .toHaveText('5', { timeout: 30_000 });
    expect(syncErrors).toEqual([]);
  } finally {
    await viewerContext.close();
    await hostContext.close();
  }
});

test('doubles score correction requires review and commits only once', async ({ browser }) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const viewer = await viewerContext.newPage();

  try {
    const code = await startRoom(host, 'doubles', DOUBLES);
    await viewer.goto(`/watch/${code}`);
    await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
      .toBeVisible({ timeout: 30_000 });
    await setCustomLimit(host, 3);

    const plusA = host.locator('.score-side--a .score-btn--plus');
    for (let point = 0; point < 3; point += 1) await plusA.click();
    await expect(host.getByText('Game Over!')).toBeVisible();
    await host.locator('.score-side--a .score-btn--minus').click();
    await expect(host.getByText('Game Over!')).not.toBeVisible();
    await plusA.click();

    const reviewBtn = host.getByRole('button', { name: /Confirm .* won, 3–0/ });
    if (await reviewBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
      await reviewBtn.click();
    }
    const confirmMatch = host.getByRole('button', { name: /Confirm result|Confirm Match/ });
    await confirmMatch.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });


    await viewer.getByRole('button', { name: 'View Performance & History' }).click();
    await expect(viewer.locator('.w-history-item')).toHaveCount(1, { timeout: 20_000 });

    await expect(host.locator('.score-side--a .score-display')).toHaveText('0');
    await expect(host.locator('.score-side--b .score-display')).toHaveText('0');
    await expect(viewer.locator('.w-history-item')).toHaveCount(1);
  } finally {
    await viewerContext.close();
    await hostContext.close();
  }
});

test('rapid point taps throttled at 100-150ms accumulate increments accurately from latest value', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  try {
    await startRoom(host, 'singles', SINGLES);
    const plusA = host.locator('.score-side--a .score-btn--plus');
    const displayA = host.locator('.score-side--a .score-display');

    for (let i = 0; i < 5; i += 1) {
      await plusA.click();
      await host.waitForTimeout(120);
    }

    await expect(displayA).toHaveText('5', { timeout: 10_000 });
  } finally {
    await hostContext.close();
  }
});

test('optimistic live-score reload mid-game and minus after win with deuce (Feedback Item C)', async ({ browser }) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const viewer = await viewerContext.newPage();

  try {
    const code = await startRoom(host, 'singles', SINGLES);
    await viewer.goto(`/watch/${code}`);
    await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
      .toBeVisible({ timeout: 30_000 });

    const plusA = host.locator('.score-side--a .score-btn--plus');
    const plusB = host.locator('.score-side--b .score-btn--plus');

    // 1. Tap several points (3-2) and let writes settle (after writes settle)
    for (let i = 0; i < 3; i += 1) await plusA.click();
    for (let i = 0; i < 2; i += 1) await plusB.click();
    await host.waitForTimeout(400); // let writes settle

    // Reload host and assert host and spectator equal last committed value
    await host.reload();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('3', { timeout: 30_000 });
    await expect(host.locator('.score-side--b .score-display')).toHaveText('2');
    await expect(viewer.locator('.w-live-side').filter({ hasText: /Team A|Player 1/ }).locator('.w-live-score-num'))
      .toHaveText('3', { timeout: 20_000 });
    await expect(viewer.locator('.w-live-side').filter({ hasText: /Team B|Player 2/ }).locator('.w-live-score-num'))
      .toHaveText('2');

    // 2. Tap a point and reload mid-game, asserting host and spectator equal committed value
    await host.locator('.score-side--a .score-btn--plus').click(); // now 4-2
    // Confirm spectator receives committed score update from Firestore
    await expect(viewer.locator('.w-live-side').filter({ hasText: /Team A|Player 1/ }).locator('.w-live-score-num'))
      .toHaveText('4', { timeout: 20_000 });
    await host.reload();
    // After reload, host recovers the committed Firestore score (4-2)
    await expect(host.locator('.score-side--a .score-display')).toHaveText('4', { timeout: 30_000 });
    await expect(viewer.locator('.w-live-side').filter({ hasText: /Team A|Player 1/ }).locator('.w-live-score-num'))
      .toHaveText('4', { timeout: 20_000 });

    // 3. Minus after the win:
    // Set custom limit to 5
    await setCustomLimit(host, 5);
    // Score is 4-2. Host taps point A to reach 5-2 (limit reached)
    const activePlusA = host.locator('.score-side--a .score-btn--plus');
    await activePlusA.click();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('5');

    // Assert + button is disabled/locked
    await expect(activePlusA).toBeDisabled();
    await expect(host.locator('.score-side--b .score-btn--plus')).toBeDisabled();
    await expect(host.getByRole('button', { name: /Confirm .* won, 5–2/ })).toBeVisible();

    // Press minus on winning side
    await host.locator('.score-side--a .score-btn--minus').click();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('4');
    // Assert + button is unlocked and Confirm button is removed
    await expect(activePlusA).toBeEnabled();
    await expect(host.getByRole('button', { name: /Confirm .* won/ })).toHaveCount(0);

    // 4. Deuce case: bring score to 4-4
    const activePlusB = host.locator('.score-side--b .score-btn--plus');
    await activePlusB.click();
    await activePlusB.click();
    await expect(host.locator('.score-side--b .score-display')).toHaveText('4');
    // At 4-4 in game to 5, deuce triggers (limit extends to 6)
    await expect(host.locator('.score-limit-badge')).toHaveText('to 6');

    // Score to 5-4 (still in deuce)
    await activePlusA.click();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('5');
    await expect(host.getByRole('button', { name: /Confirm/ })).toHaveCount(0);

    // Score to 6-4 (win by 2)
    await activePlusA.click();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('6');
    await expect(activePlusA).toBeDisabled();
    const deuceConfirm = host.getByRole('button', { name: /Confirm .* won, 6–4/ });
    await expect(deuceConfirm).toBeVisible();

    // Confirm match commits exactly once
    await deuceConfirm.click();
    const confirmCommit = host.getByRole('button', { name: /Confirm result|Confirm Match/ });
    if (await confirmCommit.isVisible({ timeout: 1000 }).catch(() => false)) {
      await confirmCommit.click();
    }

    // Verify exactly one match in history on spectator
    await viewer.getByRole('button', { name: 'View Performance & History' }).click();
    await expect(viewer.locator('.w-history-item')).toHaveCount(1, { timeout: 20_000 });
  } finally {
    await viewerContext.close();
    await hostContext.close();
  }
});
