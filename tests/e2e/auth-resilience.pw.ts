import { test, expect } from '@playwright/test';

test.describe('Auth and Firestore Resilience', () => {
  test('recovers from unhandled Firestore internal assertion / invalid-refresh-token failure', async ({ page }) => {
    // 1. Visit homepage
    await page.goto('/');
    await expect(page.locator('.hp-brand')).toBeVisible();

    // 2. Inject an invalid refresh token in localStorage to simulate stale emulator/prod token
    await page.evaluate(() => {
      localStorage.setItem('firebase:authUser:fakeKey:[DEFAULT]', JSON.stringify({
        uid: 'stale-user-id',
        stsTokenManager: {
          refreshToken: 'INVALID_STALE_REFRESH_TOKEN',
          accessToken: 'EXPIRED_TOKEN',
          expirationTime: 0,
        },
      }));
      localStorage.setItem('padq_session_id', 'TEST99');
    });

    // 3. Trigger the exact Firestore internal assertion rejection
    await page.evaluate(() => {
      const err = new Error(
        'FIRESTORE INTERNAL ASSERTION FAILED: Unexpected state (ID: 3c6b) CONTEXT: {"code":"auth/invalid-refresh-token"}'
      );
      const event = new PromiseRejectionEvent('unhandledrejection', {
        promise: Promise.reject(err),
        reason: err,
        cancelable: true,
      });
      window.dispatchEvent(event);
    });

    // 4. Confirm the honest recovery UI is visible immediately — not a frozen tab
    const alertModal = page.locator('.auth-resilience-overlay');
    await expect(alertModal).toBeVisible();
    await expect(page.locator('.auth-resilience-title')).toContainText('Your session needs to refresh — tap to continue');

    // 5. Verify clicking "Refresh Session" clears the stale auth token
    const refreshBtn = page.locator('.auth-resilience-btn');
    await expect(refreshBtn).toBeVisible();

    // Click refresh (which reloads the page after clearing stale storage)
    await refreshBtn.click();

    // 6. After reload, stale auth token is gone and page loads clean
    await expect(page.locator('.hp-brand')).toBeVisible();
    const staleAuth = await page.evaluate(() => localStorage.getItem('firebase:authUser:fakeKey:[DEFAULT]'));
    expect(staleAuth).toBeNull();
    // But PADQ session is preserved
    const preservedSession = await page.evaluate(() => localStorage.getItem('padq_session_id'));
    expect(preservedSession).toBe('TEST99');
  });

  test('happy path: normal navigation and session setup shows no resilience dialog', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.hp-brand')).toBeVisible();

    // Resilience overlay must not be in DOM or visible
    await expect(page.locator('.auth-resilience-overlay')).toHaveCount(0);

    // Verify footer links on homepage include Privacy and Feedback & Issues
    const feedbackLink = page.locator('a[href="https://github.com/Sceyo/PadQ/issues"]');
    await expect(feedbackLink).toBeVisible();

    // Click "Doubles"
    await page.locator('.hp-card--doubles').click();
    await expect(page).toHaveURL(/\/queue\?mode=doubles/);

    // Confirm no resilience overlay appeared during normal navigation
    await expect(page.locator('.auth-resilience-overlay')).toHaveCount(0);
  });
});
