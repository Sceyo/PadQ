import { expect, test, type BrowserContext, type Page } from '@playwright/test';

const PLAYERS = Array.from({ length: 13 }, (_, index) =>
  `RC Player ${String(index + 1).padStart(2, '0')}`,
);

async function assertNoHorizontalOverflow(page: Page) {
  const hasOverflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  );
  expect(hasOverflow).toBe(false);
}

async function openViewer(
  context: BrowserContext,
  roomCode: string,
  delayDocument = false,
) {
  const page = await context.newPage();
  if (delayDocument) {
    await page.route('**/*', async route => {
      if (route.request().resourceType() === 'document') {
        await new Promise(resolve => setTimeout(resolve, 750));
      }
      await route.continue();
    });
  }
  await page.goto(`/watch/${roomCode}`);
  await expect(page.getByText('You are watching live. Only the host can make changes.'))
    .toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('tab')).toHaveCount(3);
  await assertNoHorizontalOverflow(page);
  return page;
}

test('release candidate supports responsive viewers and offline reconnection', async ({ browser }) => {
  const contexts: BrowserContext[] = [];
  const hostContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  contexts.push(hostContext);
  const host = await hostContext.newPage();

  try {
    await host.goto('/queue?mode=doubles');
    const increaseCourtCount = host.locator('.court-count-adj').last();
    await increaseCourtCount.click();
    await increaseCourtCount.click();
    await host.getByPlaceholder(/Paste names separated by commas/).fill(PLAYERS.join(', '));
    await host.getByTitle('Add all').click();
    await host.getByRole('button', { name: /Start Queue/ }).click();
    await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });
    await assertNoHorizontalOverflow(host);

    await host.getByTitle('Settings').click();
    const startLiveButton = host.getByRole('button', { name: 'Start', exact: true });
    if (await startLiveButton.isVisible()) await startLiveButton.click();

    const roomCode = (await host.locator('.session-code').textContent())?.trim();
    expect(roomCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);

    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const tabletContext = await browser.newContext({ viewport: { width: 820, height: 1180 } });
    const desktopContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    contexts.push(mobileContext, tabletContext, desktopContext);

    const mobile = await openViewer(mobileContext, roomCode!);
    await openViewer(tabletContext, roomCode!, true);
    await openViewer(desktopContext, roomCode!);

    const courtThreeTab = mobile.getByRole('tab', { name: /Court 3/ });
    await courtThreeTab.click();
    await expect(courtThreeTab).toHaveAttribute('aria-selected', 'true');
    const beforeResult = await mobile.getByRole('tabpanel').innerText();

    await mobileContext.setOffline(true);
    await expect(mobile.getByRole('tabpanel')).toContainText('Court 3');

    const courtThreeCard = host.locator('.courts-grid > div').filter({ hasText: 'Court 3' });
    const beforeHostResult = await courtThreeCard.innerText();
    await courtThreeCard.getByRole('button', { name: /win$/ }).first().click();
    await expect.poll(
      async () => courtThreeCard.innerText(),
      { timeout: 20_000 },
    ).not.toBe(beforeHostResult);
    expect(await mobile.getByRole('tabpanel').innerText()).toBe(beforeResult);

    await mobileContext.setOffline(false);
    await expect.poll(
      async () => mobile.getByRole('tabpanel').innerText(),
      { timeout: 20_000 },
    ).not.toBe(beforeResult);
  } finally {
    await Promise.all(contexts.reverse().map(context => context.close()));
  }
});

test('invalid room recovery remains usable on mobile', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  try {
    await page.goto('/');
    await assertNoHorizontalOverflow(page);
    await page.getByRole('button', { name: /Watch/ }).click();
    await page.getByRole('button', { name: 'Enter Code', exact: true }).click();
    const codeInput = page.getByPlaceholder('e.g. 7K3MQR');
    await codeInput.fill('ZZZZZZ');
    await codeInput.press('Enter');
    await expect(page.getByText('Session not found. Check the code and try again.'))
      .toBeVisible({ timeout: 15_000 });
    await expect(codeInput).toBeVisible();
  } finally {
    await context.close();
  }
});
