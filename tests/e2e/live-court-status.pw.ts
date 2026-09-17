import { expect, test } from '@playwright/test';

const PLAYERS = Array.from({ length: 13 }, (_, index) =>
  `Player ${String(index + 1).padStart(2, '0')}`,
);

test('host and viewer share three live courts with refresh-safe selection', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const viewer = await viewerContext.newPage();

  try {
    await host.goto('/queue?mode=doubles');
    await expect(host.getByRole('heading', { name: 'Doubles Queue' })).toBeVisible();

    const increaseCourtCount = host.locator('.court-count-adj').last();
    await increaseCourtCount.click();
    await increaseCourtCount.click();
    await expect(host.locator('.court-count-value')).toHaveText('3');

    await host.getByPlaceholder(/Paste names separated by commas/).fill(PLAYERS.join(', '));
    await host.getByTitle('Add all').click();
    await expect(host.getByText('Players (13)')).toBeVisible();

    await host.getByRole('button', { name: /Start Queue/ }).click();
    await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });
    await expect(host.locator('.session-role-badge')).toHaveText('HOST');
    await expect(host.getByRole('button', { name: 'Add Player' })).toBeVisible();
    await expect(host.getByRole('button', { name: /Set Partners/ })).toBeVisible();

    await host.getByTitle('Settings').click();
    const startLiveButton = host.getByRole('button', { name: 'Start', exact: true });
    if (await startLiveButton.isVisible()) {
      await startLiveButton.click();
    }

    const roomCode = (await host.locator('.session-code').textContent())?.trim();
    expect(roomCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);

    await viewer.goto('/');
    await viewer.getByRole('button', { name: /Watch/ }).click();
    await viewer.getByRole('button', { name: 'Enter Code' }).click();
    await viewer.getByPlaceholder('e.g. 7K3MQR').fill(roomCode!);
    await viewer.getByPlaceholder('e.g. 7K3MQR').press('Enter');

    await expect(viewer).toHaveURL(`/watch/${roomCode}`);
    await expect(viewer.getByText('You are watching live. Only the host can make changes.')).toBeVisible();
    await expect(viewer.getByRole('tab')).toHaveCount(3);
    await expect(viewer.getByRole('button', { name: 'Add Player' })).toHaveCount(0);
    await expect(viewer.getByRole('button', { name: /win$/ })).toHaveCount(0);

    const courtThreeTab = viewer.getByRole('tab', { name: /Court 3/ });
    await courtThreeTab.click();
    await expect(courtThreeTab).toHaveAttribute('aria-selected', 'true');
    await expect(viewer.getByRole('tabpanel')).toContainText('Court 3');
    await expect(viewer.getByRole('tabpanel')).toContainText('Player 09 & Player 10');
    await expect(viewer.getByText('Player 13')).toBeVisible();

    await viewer.reload();
    await expect(viewer.getByText('You are watching live. Only the host can make changes.')).toBeVisible();
    await expect(viewer.getByRole('tab', { name: /Court 3/ })).toHaveAttribute('aria-selected', 'true');

    const beforeResult = await viewer.getByRole('tabpanel').innerText();
    const courtThreeCard = host.locator('.courts-grid > div').filter({ hasText: 'Court 3' });
    await courtThreeCard.getByRole('button', { name: /win$/ }).first().click();

    await expect.poll(
      async () => viewer.getByRole('tabpanel').innerText(),
      { timeout: 15_000 },
    ).not.toBe(beforeResult);

    await viewer.getByRole('button', { name: 'View Performance & History' }).click();
    await expect(viewer.getByText('Player Performance')).toBeVisible();
    await expect(viewer.getByText('Court 3', { exact: true }).last()).toBeVisible();
  } finally {
    await viewerContext.close();
    await hostContext.close();
  }
});

test('multi-court mode reveals Undo Last Match in settings and restores court and queue', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();

  try {
    await host.goto('/queue?mode=doubles');
    await expect(host.getByRole('heading', { name: 'Doubles Queue' })).toBeVisible();

    const increaseCourtCount = host.locator('.court-count-adj').last();
    await increaseCourtCount.click();
    await expect(host.locator('.court-count-value')).toHaveText('2');

    await host.getByPlaceholder(/Paste names separated by commas/).fill(PLAYERS.slice(0, 10).join(', '));
    await host.getByTitle('Add all').click();
    await expect(host.getByText('Players (10)')).toBeVisible();

    await host.getByRole('button', { name: /Start Queue/ }).click();
    await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });

    // Initial court assignments: Court 1 has Player 01 & 02 vs Player 03 & 04.
    // Court 2 has Player 05 & 06 vs Player 07 & 08.
    // Waiting queue has Player 09, Player 10.
    const courtOneCard = host.locator('.courts-grid > div').filter({ hasText: 'Court 1' });
    await expect(courtOneCard).toContainText('Player 01 & Player 02');
    await expect(courtOneCard).toContainText('Player 03 & Player 04');
    await expect(host.locator('.waiting-players-list')).toContainText('Player 09');
    await expect(host.locator('.waiting-players-list')).toContainText('Player 10');

    // Before any match finishes, gear menu has no Undo button
    await host.getByTitle('Settings').click();
    await expect(host.getByRole('menuitem', { name: 'Undo Last Match' })).toHaveCount(0);
    await host.keyboard.press('Escape');

    // Complete match on Court 1 (Team A win)
    await courtOneCard.getByRole('button', { name: /win$/ }).first().click();

    // WinnerModal opens after a win; autoClose is false by default, so dismiss it.
    await expect(host.locator('.modal-overlay')).toBeVisible({ timeout: 5_000 });
    await host.keyboard.press('Escape');
    await expect(host.locator('.modal-overlay')).not.toBeVisible({ timeout: 3_000 });

    // Now Court 1 rotated: Player 09 and Player 10 were pulled onto Court 1
    await expect(courtOneCard).not.toContainText('Player 01 & Player 02');

    // Gear menu MUST now reveal Undo Last Match!
    await host.getByTitle('Settings').click();
    const undoBtn = host.getByRole('menuitem', { name: 'Undo Last Match' });
    await expect(undoBtn).toBeVisible();

    // Click Undo Last Match
    await undoBtn.click();

    // Verify Court 1 has Player 01 & 02 vs Player 03 & 04 restored!
    await expect(courtOneCard).toContainText('Player 01 & Player 02');
    await expect(courtOneCard).toContainText('Player 03 & Player 04');
    // Waiting queue has Player 09 and Player 10 back!
    await expect(host.locator('.waiting-players-list')).toContainText('Player 09');
    await expect(host.locator('.waiting-players-list')).toContainText('Player 10');
  } finally {
    await hostContext.close();
  }
});

