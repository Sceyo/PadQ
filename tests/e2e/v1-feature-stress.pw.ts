import { expect, test } from '@playwright/test';

const SINGLES_PLAYERS = Array.from({ length: 30 }, (_, index) =>
  `Singles Player ${String(index + 1).padStart(2, '0')}`,
);

const SCORE_PLAYERS = Array.from({ length: 8 }, (_, index) =>
  `Score Player ${String(index + 1).padStart(2, '0')}`,
);

async function startLiveSession(
  page: import('@playwright/test').Page,
  mode: 'singles' | 'doubles',
  players: string[],
  courtCount = 1,
) {
  await page.goto(`/queue?mode=${mode}`);
  const increaseCourtCount = page.locator('.court-count-adj').last();
  for (let court = 1; court < courtCount; court += 1) await increaseCourtCount.click();
  await page.getByPlaceholder(/Paste names separated by commas/).fill(players.join(', '));
  await page.getByTitle('Add all').click();
  await expect(page.getByText(`Players (${players.length})`)).toBeVisible();
  await page.getByRole('button', { name: /Start Queue/ }).click();
  await expect(page.locator('.session-bar--host')).toContainText('Connected', { timeout: 30_000 });

  await page.getByTitle('Settings').click();
  const startLiveButton = page.getByRole('button', { name: 'Start', exact: true });
  if (await startLiveButton.isVisible()) await startLiveButton.click();

  const roomCode = (await page.locator('.session-code').textContent())?.trim();
  expect(roomCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  return roomCode!;
}

test('30-player three-court singles rotates safely for host and viewer', async ({ browser }) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const viewer = await viewerContext.newPage();
  const synchronizationErrors: string[] = [];
  host.on('console', message => {
    if (message.type() === 'error' && message.text().includes('[useSession]')) {
      synchronizationErrors.push(message.text());
    }
  });

  try {
    const roomCode = await startLiveSession(host, 'singles', SINGLES_PLAYERS, 3);
    await expect(host.locator('.courts-grid > div')).toHaveCount(3);
    await expect(host.getByRole('button', { name: /wins$/ })).toHaveCount(6);

    await viewer.goto(`/watch/${roomCode}`);
    await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
      .toBeVisible({ timeout: 30_000 });
    await expect(viewer.getByRole('tab')).toHaveCount(3);

    const courtTwoTab = viewer.getByRole('tab', { name: /Court 2/ });
    await courtTwoTab.click();
    await expect(courtTwoTab).toHaveAttribute('aria-selected', 'true');
    const beforeCourt = await viewer.getByRole('tabpanel').innerText();

    const courtTwoCard = host.locator('.courts-grid > div').filter({ hasText: 'Court 2' });
    await courtTwoCard.getByRole('button', { name: /wins$/ }).first().click();
    await expect.poll(
      async () => viewer.getByRole('tabpanel').innerText(),
      { timeout: 20_000 },
    ).not.toBe(beforeCourt);

    await viewer.getByRole('button', { name: 'View Performance & History' }).click();
    await expect(viewer.locator('.w-history-item')).toHaveCount(1);
    await expect(viewer.getByText('Player Performance')).toBeVisible();
    expect(synchronizationErrors).toEqual([]);
  } finally {
    await viewerContext.close();
    await hostContext.close();
  }
});

test('single-court live scoring, management, stats, history, and undo stay consistent', async ({ browser }) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const viewer = await viewerContext.newPage();
  const synchronizationErrors: string[] = [];
  host.on('console', message => {
    if (message.type() === 'error' && message.text().includes('[useSession]')) {
      synchronizationErrors.push(message.text());
    }
  });

  try {
    const roomCode = await startLiveSession(host, 'singles', SCORE_PLAYERS);
    await viewer.goto(`/watch/${roomCode}`);
    await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
      .toBeVisible({ timeout: 30_000 });

    await expect(host.getByRole('button', { name: 'Scoring ON' })).toBeVisible();
    await host.getByRole('button', { name: 'Custom' }).click();
    const customLimit = host.getByPlaceholder('e.g. 15');
    await customLimit.fill('3');
    await customLimit.press('Enter');
    await expect(viewer.locator('.w-live-limit-badge')).toHaveText('to 3', { timeout: 20_000 });

    const scoreAPlus = host.locator('.score-side--a .score-btn--plus');
    const scoreBPlus = host.locator('.score-side--b .score-btn--plus');
    await scoreAPlus.click();
    await scoreAPlus.click();
    await scoreBPlus.click();
    await expect(viewer.locator('.w-live-side').filter({ hasText: 'Team A' }).locator('.w-live-score-num'))
      .toHaveText('2');
    await expect(viewer.locator('.w-live-side').filter({ hasText: 'Team B' }).locator('.w-live-score-num'))
      .toHaveText('1');

    // A host refresh must restore the last Firebase score instead of replacing
    // it with a new 0-0 scoreboard.
    await host.reload();
    await expect(host.getByRole('button', { name: 'Scoring ON' })).toBeVisible({ timeout: 30_000 });
    await expect(host.locator('.score-side--a .score-display')).toHaveText('2');
    await expect(host.locator('.score-side--b .score-display')).toHaveText('1');

    const restoredScoreAPlus = host.locator('.score-side--a .score-btn--plus');
    const restoredScoreAMinus = host.locator('.score-side--a .score-btn--minus');
    await restoredScoreAPlus.click();
    await expect(host.getByText('Game Over!', { exact: true })).toBeVisible();
    await expect(host.getByRole('heading', { name: 'Match Result' })).not.toBeVisible();

    // Reaching the limit is reviewable: a mistaken winning point can be
    // removed before the result is explicitly confirmed.
    await restoredScoreAMinus.click();
    await expect(host.locator('.score-side--a .score-display')).toHaveText('2');
    await expect(host.getByText('Game Over!', { exact: true })).not.toBeVisible();
    await expect(viewer.locator('.w-live-side').filter({ hasText: 'Team A' }).locator('.w-live-score-num'))
      .toHaveText('2');

    await restoredScoreAPlus.click();
    await host.getByRole('button', { name: /Confirm Score Player 01 won, 3/ }).evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
    });
    await expect(host.getByRole('heading', { name: 'Match Result' })).toBeVisible();
    const resultModal = host.locator('.modal-content').filter({ hasText: 'Match Result' });
    await expect(resultModal.getByText(/3.*1/, { exact: true })).toBeVisible();
    await host.getByRole('button', { name: 'Close' }).click();

    await viewer.getByRole('button', { name: 'View Performance & History' }).click();
    await expect(viewer.locator('.w-history-item')).toHaveCount(1);
    await expect(viewer.getByText('Player Performance')).toBeVisible();

    await host.getByRole('button', { name: 'Stats' }).click();
    await expect(host.getByText('Leaderboard', { exact: true })).toBeVisible();
    await expect(host.getByRole('row', { name: /Score Player 01 Bronze 1 0 1 100% 1/ }))
      .toBeVisible();
    await host.getByRole('button', { name: 'Queue' }).click();

    await host.getByRole('button', { name: 'Add Player' }).click();
    await host.getByPlaceholder('Player name').fill('Late Arrival');
    await host.getByPlaceholder('Player name').press('Enter');

    await host.getByRole('button', { name: 'Sit Out' }).click();
    const lateArrivalRow = host.locator('.sitout-row').filter({ hasText: 'Late Arrival' });
    await expect(lateArrivalRow).toBeVisible();
    await lateArrivalRow.getByRole('button', { name: 'Sit Out' }).click();
    await expect(host.getByRole('button', { name: 'Sit Out (1)' })).toBeVisible();
    await lateArrivalRow.getByRole('button', { name: 'Return' }).click();
    await expect(host.locator('.sitout-toggle-btn')).not.toContainText('(1)');

    await host.getByTitle('Settings').click();
    await host.getByRole('menuitem', { name: 'Undo Last Match' }).click();
    await expect(viewer.locator('.w-history-item')).toHaveCount(0, { timeout: 20_000 });
    // Allow any final queued Firebase work to settle before checking that no
    // background synchronization write was rejected.
    await host.waitForTimeout(500);
    expect(synchronizationErrors).toEqual([]);
  } finally {
    await viewerContext.close();
    await hostContext.close();
  }
});
