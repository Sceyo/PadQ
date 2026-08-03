import { expect, test } from '@playwright/test';

const PLAYERS = Array.from({ length: 12 }, (_, index) =>
  `Scope Player ${String(index + 1).padStart(2, '0')}`,
);

test('deferred features stay sealed when URL parameters try to enable them', async ({ page }) => {
  await page.goto(
    '/queue?mode=doubles&queueMode=tournament&elimType=double&courts=99&pin=1234&skillMode=true',
  );

  await expect(page.getByRole('heading', { name: 'Doubles Queue' })).toBeVisible();
  await expect(page.getByText('Tournament', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Play-All', { exact: true })).toHaveCount(0);
  await expect(page.getByText('Skilled', { exact: true })).toHaveCount(0);
  await expect(page.getByText(/Access PIN/i)).toHaveCount(0);

  const increaseCourtCount = page.locator('.court-count-adj').last();
  await increaseCourtCount.click();
  await increaseCourtCount.click();
  await expect(page.locator('.court-count-value')).toHaveText('3');
  await expect(increaseCourtCount).toBeDisabled();

  await page.getByPlaceholder(/Paste names separated by commas/).fill(PLAYERS.join(', '));
  await page.getByTitle('Add all').click();
  await page.getByRole('button', { name: /Start Queue/ }).click();

  await expect(page.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Add Player' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Set Partners/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Enable Scoring' })).toHaveCount(0);

  await page.getByTitle('Settings').click();
  await expect(page.getByRole('menuitem', { name: /All Courts/i })).toHaveCount(0);
  await expect(page.getByRole('menuitem', { name: /Recover as Host/i })).toHaveCount(0);
});
