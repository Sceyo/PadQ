import { expect, test } from '@playwright/test';

test.describe('390px Mobile Viewport Touch Target Hardening', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('buttons in queue screen, host tools sheet, and recap modal satisfy touch target requirements on 390px viewport', async ({ page }) => {
    // 1. Setup room on 390px mobile viewport
    await page.goto('/queue?mode=doubles');
    await page.getByPlaceholder(/Paste names separated by commas/).fill('P1, P2, P3, P4, P5, P6, P7, P8');
    await page.getByTitle('Add all').click();
    await page.getByRole('button', { name: /Start Queue/ }).click();
    await expect(page.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });

    // 2. Measure Queue Screen Buttons
    // Tab navigation buttons
    const queueTab = page.getByRole('button', { name: 'Queue', exact: true });
    const statsTab = page.getByRole('button', { name: 'Stats', exact: true });
    const queueTabBox = await queueTab.boundingBox();
    const statsTabBox = await statsTab.boundingBox();
    expect(queueTabBox).not.toBeNull();
    expect(statsTabBox).not.toBeNull();
    expect(queueTabBox!.height).toBeGreaterThanOrEqual(44);
    expect(statsTabBox!.height).toBeGreaterThanOrEqual(44);

    // Host Tools and settings header buttons
    const hostToolsBtn = page.getByRole('button', { name: 'Host Tools' });
    const hostToolsBox = await hostToolsBtn.boundingBox();
    expect(hostToolsBox).not.toBeNull();
    expect(hostToolsBox!.height).toBeGreaterThanOrEqual(36);
    expect(hostToolsBox!.width).toBeGreaterThanOrEqual(36);

    // Score adjusting plus / minus buttons
    const plusBtn = page.locator('.score-btn--plus').first();
    const plusBox = await plusBtn.boundingBox();
    expect(plusBox).not.toBeNull();
    expect(plusBox!.height).toBeGreaterThanOrEqual(44);
    expect(plusBox!.width).toBeGreaterThanOrEqual(44);

    // On-court player buttons
    const playerCardBtn = page.locator('.player-card-btn').first();
    if (await playerCardBtn.isVisible().catch(() => false)) {
      const playerCardBox = await playerCardBtn.boundingBox();
      expect(playerCardBox).not.toBeNull();
      expect(playerCardBox!.height).toBeGreaterThanOrEqual(44);
    }

    // 3. Measure Host Tools Sheet Buttons
    await hostToolsBtn.click();
    const sheetCloseBtn = page.getByRole('button', { name: 'Close' });
    await expect(sheetCloseBtn).toBeVisible({ timeout: 5000 });
    const sheetCloseBox = await sheetCloseBtn.boundingBox();
    expect(sheetCloseBox).not.toBeNull();
    expect(sheetCloseBox!.height).toBeGreaterThanOrEqual(44);
    expect(sheetCloseBox!.width).toBeGreaterThanOrEqual(44);

    const addInput = page.getByPlaceholder('Player name…');
    await addInput.fill('Late Sub');
    const addBtn = page.getByRole('button', { name: 'Add', exact: true });
    const addBox = await addBtn.boundingBox();
    expect(addBox).not.toBeNull();
    expect(addBox!.height).toBeGreaterThanOrEqual(44);

    const switchToggle = page.getByRole('switch', { name: /Toggle Match Scores/i });
    const switchBox = await switchToggle.boundingBox();
    expect(switchBox).not.toBeNull();
    expect(switchBox!.height).toBeGreaterThanOrEqual(44);
    expect(switchBox!.width).toBeGreaterThanOrEqual(44);

    await sheetCloseBtn.click();
    await expect(sheetCloseBtn).toHaveCount(0);

    // 4. Complete a match to enable Recap Card
    const plusA = page.locator('.score-side--a .score-btn--plus');
    for (let i = 0; i < 11; i += 1) {
      await plusA.click();
      await page.waitForTimeout(60);
    }
    const confirmBtn = page.getByRole('button', { name: /Confirm result|Confirm Match/ });
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
    const confirmBox = await confirmBtn.boundingBox();
    expect(confirmBox).not.toBeNull();
    expect(confirmBox!.height).toBeGreaterThanOrEqual(44);
    await confirmBtn.click();

    // 5. Measure Recap Modal Buttons
    await statsTab.click();
    const recapBtn = page.getByRole('button', { name: /Share Recap Card/i });
    await expect(recapBtn).toBeVisible({ timeout: 10_000 });
    const recapBtnBox = await recapBtn.boundingBox();
    expect(recapBtnBox).not.toBeNull();
    expect(recapBtnBox!.height).toBeGreaterThanOrEqual(36);

    await recapBtn.click();
    const recapCloseBtn = page.locator('.recap-modal-close-btn');
    await expect(recapCloseBtn).toBeVisible({ timeout: 5000 });
    const recapCloseBox = await recapCloseBtn.boundingBox();
    expect(recapCloseBox).not.toBeNull();
    expect(recapCloseBox!.height).toBeGreaterThanOrEqual(44);
    expect(recapCloseBox!.width).toBeGreaterThanOrEqual(44);

    const actionBtns = page.locator('.recap-action-btn');
    const actionCount = await actionBtns.count();
    expect(actionCount).toBeGreaterThan(0);
    for (let i = 0; i < actionCount; i += 1) {
      const box = await actionBtns.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await recapCloseBtn.click();
    await expect(recapCloseBtn).toHaveCount(0);
  });
});
