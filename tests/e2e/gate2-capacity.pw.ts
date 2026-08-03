import { expect, test, type Page } from '@playwright/test';

const PLAYERS = Array.from({ length: 30 }, (_, index) =>
  `Load Player ${String(index + 1).padStart(2, '0')}`,
);

async function openInBatches(pages: Page[], roomCode: string) {
  for (let start = 0; start < pages.length; start += 3) {
    const batch = pages.slice(start, start + 3);
    await Promise.all(batch.map(async page => {
      await page.goto(`/watch/${roomCode}`);
      await expect(page.getByText('You are watching live. Only the host can make changes.'))
        .toBeVisible({ timeout: 30_000 });
    }));
  }
}

test('30 viewer tabs receive a three-court queue rotation in real time', async ({ browser }) => {
  test.setTimeout(180_000);
  const hostContext = await browser.newContext();
  const host = await hostContext.newPage();
  const viewerContexts = await Promise.all(
    Array.from({ length: 30 }, () => browser.newContext()),
  );
  const viewers = await Promise.all(viewerContexts.map(context => context.newPage()));

  try {
    await host.goto('/queue?mode=doubles');
    const increaseCourtCount = host.locator('.court-count-adj').last();
    await increaseCourtCount.click();
    await increaseCourtCount.click();
    await host.getByPlaceholder(/Paste names separated by commas/).fill(PLAYERS.join(', '));
    await host.getByTitle('Add all').click();
    await expect(host.getByText('Players (30)')).toBeVisible();
    await host.getByRole('button', { name: /Start Queue/ }).click();
    await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 30_000 });

    await host.getByTitle('Settings').click();
    const startLiveButton = host.getByRole('button', { name: 'Start', exact: true });
    if (await startLiveButton.isVisible()) await startLiveButton.click();
    const roomCode = (await host.locator('.session-code').textContent())!.trim();

    await openInBatches(viewers, roomCode);
    await Promise.all(viewers.map(async (page, index) => {
      const courtNumber = index % 3 + 1;
      await page.getByRole('tab', { name: new RegExp(`Court ${courtNumber}`) }).click();
      await expect(page.getByRole('tab', { name: new RegExp(`Court ${courtNumber}`) }))
        .toHaveAttribute('aria-selected', 'true');
    }));

    await host.reload();
    await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 30_000 });
    await expect(host.locator('.session-role-badge')).toHaveText('HOST');

    const queueBefore = await viewers[0].locator('.w-next-up').innerText();
    const courtOne = host.locator('.courts-grid > div').filter({ hasText: 'Court 1' });
    await courtOne.getByRole('button', { name: /win$/ }).first().evaluate(button => {
      (button as HTMLButtonElement).click();
      (button as HTMLButtonElement).click();
    });

    await Promise.all(viewers.map(page => expect.poll(
      async () => page.locator('.w-next-up').innerText(),
      { timeout: 30_000 },
    ).not.toBe(queueBefore)));

    await viewers[0].getByRole('button', { name: 'View Performance & History' }).click();
    await expect(viewers[0].locator('.w-history-item')).toHaveCount(1);

    for (const index of [0, 1, 2]) {
      await viewers[index].reload();
      await expect(viewers[index].getByRole('tab', { name: new RegExp(`Court ${index + 1}`) }))
        .toHaveAttribute('aria-selected', 'true');
    }
  } finally {
    await Promise.all(viewerContexts.map(context => context.close()));
    await hostContext.close();
  }
});
