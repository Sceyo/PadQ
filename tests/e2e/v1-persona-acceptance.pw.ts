import { expect, test } from '@playwright/test';

const RUSH_PLAYERS = Array.from({ length: 25 }, (_, index) =>
  `Rush Player ${String(index + 1).padStart(2, '0')}`,
);

test('25-player rush preserves registration order and a middle departure', async ({ browser }) => {
  test.setTimeout(120_000);
  const hostContext = await browser.newContext();
  const viewerContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const host = await hostContext.newPage();
  const viewer = await viewerContext.newPage();

  try {
    await host.goto('/queue?mode=doubles');
    const increaseCourtCount = host.locator('.court-count-adj').last();
    await increaseCourtCount.click();
    await increaseCourtCount.click();

    await host.getByPlaceholder(/Paste names separated by commas/).fill(RUSH_PLAYERS.join(', '));
    await host.getByTitle('Add all').click();
    await expect(host.getByText('Players (25)')).toBeVisible();

    const setupOrder = await host.locator('.players-list li').allTextContents();
    expect(setupOrder.map(text => text.replace(/^#\d+/, '').trim())).toEqual(RUSH_PLAYERS);

    await host.getByRole('button', { name: /Start Queue/ }).click();
    await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 30_000 });

    const initialWaiting = await host.locator('.waiting-player-row').allTextContents();
    expect(initialWaiting.map(text => text.replace(/^#\d+/, '').trim())).toEqual(RUSH_PLAYERS.slice(12));

    await host.getByTitle('Settings').click();
    await host.getByRole('button', { name: 'Start', exact: true }).click();
    const roomCode = (await host.locator('.session-code').textContent())!.trim();

    await viewer.goto(`/watch/${roomCode}`);
    await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
      .toBeVisible({ timeout: 30_000 });
    await expect(viewer.locator('.w-next-up')).toContainText(RUSH_PLAYERS[12]);
    await expect(viewer.locator('.w-next-up')).toContainText(RUSH_PLAYERS[15]);
    await expect(viewer.locator('.w-next-up')).toContainText('+9 waiting');

    await host.getByRole('button', { name: 'Manage Queue' }).click();
    const departingPlayer = RUSH_PLAYERS[18];
    await host.locator('.mqp-btn--remove').filter({ hasText: departingPlayer }).click();

    const remainingWaiting = await host.locator('.waiting-player-row').allTextContents();
    expect(remainingWaiting.map(text => text.replace(/^#\d+/, '').trim())).toEqual([
      ...RUSH_PLAYERS.slice(12, 18),
      ...RUSH_PLAYERS.slice(19),
    ]);
    await expect(viewer.locator('.w-next-up')).toContainText('+8 waiting', { timeout: 30_000 });
  } finally {
    await viewerContext.close();
    await hostContext.close();
  }
});
