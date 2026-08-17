import { expect, test, type Page } from '@playwright/test';

const PLAYERS = Array.from({ length: 8 }, (_, index) => `Delete Player ${index + 1}`);

async function startLiveDoublesRoom(page: Page) {
  await page.goto('/queue?mode=doubles');
  await page.getByPlaceholder(/Paste names separated by commas/).fill(PLAYERS.join(', '));
  await page.getByTitle('Add all').click();
  await page.getByRole('button', { name: /Start Queue/ }).click();
  await expect(page.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });
  await page.getByTitle('Settings').click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  const roomCode = (await page.locator('.session-code').textContent())?.trim();
  expect(roomCode).toMatch(/^[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{6}$/);
  return roomCode!;
}

test('watch defaults to room code and camera starts only after explicit consent', async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as typeof window & { BarcodeDetector?: unknown }).BarcodeDetector;
    const mediaDevices = navigator.mediaDevices ?? ({} as MediaDevices);
    Object.defineProperty(mediaDevices, 'getUserMedia', {
      configurable: true,
      value: async () => {
        (window as typeof window & { __cameraRequests?: number }).__cameraRequests =
          ((window as typeof window & { __cameraRequests?: number }).__cameraRequests ?? 0) + 1;
        throw new Error('Camera should not be requested when QR detection is unavailable.');
      },
    });
    Object.defineProperty(navigator, 'mediaDevices', { value: mediaDevices, configurable: true });
  });

  await page.goto('/');
  await page.getByRole('button', { name: /Watch/ }).click();
  await expect(page.getByRole('dialog', { name: 'Watch a Session' })).toBeVisible();
  await expect(page.getByPlaceholder('e.g. 7K3MQR')).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { __cameraRequests?: number }).__cameraRequests ?? 0)).toBe(0);

  await page.getByRole('button', { name: 'Scan QR' }).click();
  await expect(page.getByRole('button', { name: 'Start QR scanner' })).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { __cameraRequests?: number }).__cameraRequests ?? 0)).toBe(0);

  await page.getByRole('button', { name: 'Start QR scanner' }).click();
  await expect(page.getByText(/QR scanning is not supported/)).toBeVisible();
  expect(await page.evaluate(() => (window as typeof window & { __cameraRequests?: number }).__cameraRequests ?? 0)).toBe(0);
});

test('device-data deletion preserves the active room reference', async ({ page }) => {
  await page.goto('/privacy');
  await page.evaluate(() => {
    localStorage.setItem('padq_roster', JSON.stringify([{ name: 'Private Player' }]));
    localStorage.setItem('padq_career_stats', JSON.stringify({ 'Private Player': { games: 1 } }));
    localStorage.setItem('padq_skilled_brackets', JSON.stringify({ beginner: ['Private Player'] }));
    localStorage.setItem('padq_session_id', 'KEEP42');
  });

  await page.getByRole('button', { name: 'Delete saved player data' }).click();
  await expect(page.getByText(/does not delete an active event/)).toBeVisible();
  await page.getByRole('button', { name: 'Delete from this device' }).click();
  await expect(page.getByRole('status')).toHaveText('Saved player data was deleted from this device.');

  const stored = await page.evaluate(() => ({
    roster: localStorage.getItem('padq_roster'),
    career: localStorage.getItem('padq_career_stats'),
    brackets: localStorage.getItem('padq_skilled_brackets'),
    session: localStorage.getItem('padq_session_id'),
  }));
  expect(stored).toEqual({ roster: null, career: null, brackets: null, session: 'KEEP42' });
});

test('owner permanently deletes the live event and its history', async ({ browser }) => {
  const hostContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const host = await hostContext.newPage();
  const viewer = await viewerContext.newPage();

  try {
    const roomCode = await startLiveDoublesRoom(host);
    await viewer.goto(`/watch/${roomCode}`);
    await expect(viewer.getByText('You are watching live. Only the host can make changes.'))
      .toBeVisible({ timeout: 20_000 });

    await host.getByRole('button', { name: 'Team A', exact: true }).click();
    await host.getByRole('button', { name: 'Confirm Match' }).click();
    await expect(host.getByRole('button', { name: 'Close' })).toBeVisible({ timeout: 20_000 });
    await host.getByRole('button', { name: 'Close' }).click();
    await viewer.getByRole('button', { name: 'View Performance & History' }).click();
    await expect(viewer.locator('.w-history-item')).toHaveCount(1, { timeout: 20_000 });

    await host.getByTitle('Settings').click();
    await host.getByRole('menuitem', { name: 'End & Delete Event' }).click();
    await expect(host.getByRole('dialog')).toContainText('Permanently delete this event and all match history');
    await host.getByRole('button', { name: 'Confirm', exact: true }).click();
    await expect(host).toHaveURL('/', { timeout: 20_000 });

    await expect(viewer.getByRole('heading', { name: 'Session Ended' })).toBeVisible({ timeout: 20_000 });
    await viewer.reload();
    await expect(viewer.getByRole('heading', { name: 'Session Not Found' })).toBeVisible({ timeout: 20_000 });
  } finally {
    await viewerContext.close();
    await hostContext.close();
  }
});

test('an offline match save restores the prior queue and can be retried', async ({ browser }) => {
  const context = await browser.newContext();
  const host = await context.newPage();
  try {
    await startLiveDoublesRoom(host);
    const beforeQueue = await host.locator('.pairing-table').innerText();

    await context.setOffline(true);
    await host.getByRole('button', { name: 'Team A', exact: true }).click();
    await host.getByRole('button', { name: 'Confirm Match' }).click();

    await expect(host.locator('.toast-notification')).toContainText(/could not reach Firebase|could not be saved/, { timeout: 20_000 });
    await expect(host.getByRole('button', { name: 'Confirm Match' })).toBeEnabled();
    expect(await host.locator('.pairing-table').innerText()).toBe(beforeQueue);
    await expect(host.getByRole('button', { name: 'Close' })).toHaveCount(0);

    await context.setOffline(false);
    await expect(host.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });
  } finally {
    await context.close();
  }
});

test('responses include the public-release security headers', async ({ request }) => {
  const response = await request.get('/');
  expect(response.ok()).toBe(true);
  const headers = response.headers();
  expect(headers['content-security-policy']).toContain("default-src 'self'");
  expect(headers['x-content-type-options']).toBe('nosniff');
  expect(headers['x-frame-options']).toBe('DENY');
  expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  expect(headers['permissions-policy']).toContain('camera=(self)');
});
