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
  await page.getByRole('button', { name: 'Custom' }).click();
  const input = page.getByPlaceholder('e.g. 15');
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
    await plusA.click({ clickCount: 2 });
    await plusB.click({ clickCount: 2 });

    // At 2-2 in a game to 3, the next valid winning score is 4-2.
    await expect(host.locator('.score-limit-badge')).toHaveText('to 4');
    await expect(viewer.locator('.w-live-limit-badge')).toHaveText('to 4', { timeout: 20_000 });

    await host.reload();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('2', { timeout: 30_000 });
    await expect(host.locator('.score-side--b .score-display')).toHaveText('2');
    await expect(host.locator('.score-limit-badge')).toHaveText('to 4');

    const restoredPlusA = host.locator('.score-side--a .score-btn--plus');
    await restoredPlusA.click({ clickCount: 2 });
    await expect(host.getByText('Game Over!', { exact: true })).toBeVisible();
    await host.getByRole('button', { name: `Remove point from ${SINGLES[0]}` }).click();
    await expect(host.getByText('Game Over!', { exact: true })).not.toBeVisible();
    await expect(viewer.locator('.w-live-side').filter({ hasText: 'Team A' }).locator('.w-live-score-num'))
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
    await expect(viewer.locator('.w-live-side').filter({ hasText: 'Team A' }).locator('.w-live-score-num'))
      .toHaveText('7', { timeout: 30_000 });
    await expect(viewer.locator('.w-live-side').filter({ hasText: 'Team B' }).locator('.w-live-score-num'))
      .toHaveText('4');

    await hostContext.setOffline(true);
    await plusA.click();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('8');
    await hostContext.setOffline(false);
    await expect(viewer.locator('.w-live-side').filter({ hasText: 'Team A' }).locator('.w-live-score-num'))
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
    await expect(viewer.locator('.w-live-side').filter({ hasText: 'Team B' }).locator('.w-live-score-num'))
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
    await plusA.click({ clickCount: 3 });
    await expect(host.getByText('Game Over!', { exact: true })).toBeVisible();
    await host.locator('.score-side--a .score-btn--minus').click();
    await expect(host.getByText('Game Over!', { exact: true })).not.toBeVisible();
    await plusA.click();

    await host.getByRole('button', { name: /Confirm .* won, 3–0/ }).click();
    const confirmMatch = host.getByRole('button', { name: 'Confirm Match' });
    await confirmMatch.evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(host.getByRole('heading', { name: 'Match Result' })).toBeVisible();

    await viewer.getByRole('button', { name: 'View Performance & History' }).click();
    await expect(viewer.locator('.w-history-item')).toHaveCount(1, { timeout: 20_000 });
    await host.getByRole('button', { name: 'Close' }).click();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('0');
    await expect(host.locator('.score-side--b .score-display')).toHaveText('0');
    await expect(viewer.locator('.w-history-item')).toHaveCount(1);
  } finally {
    await viewerContext.close();
    await hostContext.close();
  }
});
