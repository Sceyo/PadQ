import { expect, test, type Page, type Locator } from '@playwright/test';

async function assertAllVisibleButtonsTouchTarget(root: Page | Locator, contextName: string) {
  const buttons = await root.locator('button:visible').all();
  expect(buttons.length, `Expected visible buttons in ${contextName}`).toBeGreaterThan(0);
  for (const btn of buttons) {
    const isAllowlisted = await btn.evaluate((el) => {
      return (
        el.closest('[data-nextjs-dev-tools], nextjs-portal') !== null ||
        el.matches(
          '.absent-mini-btn, .partner-pair-chip button, [aria-label*="Remove partner pair"], .toast-dismiss, .scoreboard-toggle, [title*="Play to"], [title*="Set a special score limit"], [title*="Reset score"], .score-reset-btn, [aria-label*="Next.js"], .recap-variant-btn, [title*="Edit player positions"], [class*="editBtn"]'
        )
      );
    });
    if (isAllowlisted) continue;

    const box = await btn.boundingBox();
    if (!box) continue;

    const label =
      (await btn.getAttribute('aria-label')) ||
      (await btn.getAttribute('title')) ||
      (await btn.innerText()).trim().replace(/\s+/g, ' ') ||
      'unnamed-button';

    // Buttons must have at least 44px in their primary interactive dimension (height >= 44px, rounding subpixel floats)
    expect(
      Math.round(box.height),
      `Button "${label}" in ${contextName} height should be >= 44px (got ${box.height}px)`
    ).toBeGreaterThanOrEqual(44);
  }
}

test.describe('390px Mobile Viewport Touch Target Hardening', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('buttons in single-court queue screen, host tools sheet, and recap modal satisfy touch targets', async ({
    page,
  }) => {
    // ══════════════════════════════════════════════════════════════
    // 1. Single Court Queue Screen & Host Tools
    // ══════════════════════════════════════════════════════════════
    await page.goto('/queue?mode=doubles');
    await page.getByPlaceholder(/Paste names separated by commas/).fill('P1, P2, P3, P4, P5, P6, P7, P8');
    await page.getByTitle('Add all').click();
    await page.getByRole('button', { name: /Start Queue/ }).click();
    await expect(page.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });

    // Host Tools header button raised to 44x44
    const hostToolsBtn = page.getByRole('button', { name: 'Host Tools' });
    const hostToolsBox = await hostToolsBtn.boundingBox();
    expect(hostToolsBox).not.toBeNull();
    expect(hostToolsBox!.height).toBeGreaterThanOrEqual(44);
    expect(hostToolsBox!.width).toBeGreaterThanOrEqual(44);

    // Tab buttons
    const queueTab = page.getByRole('button', { name: 'Queue', exact: true });
    const statsTab = page.getByRole('button', { name: 'Stats', exact: true });
    const queueTabBox = await queueTab.boundingBox();
    const statsTabBox = await statsTab.boundingBox();
    expect(queueTabBox!.height).toBeGreaterThanOrEqual(44);
    expect(statsTabBox!.height).toBeGreaterThanOrEqual(44);

    // Plus/Minus score buttons
    const plusBtn = page.locator('.score-btn--plus').first();
    const plusBox = await plusBtn.boundingBox();
    expect(plusBox!.height).toBeGreaterThanOrEqual(44);
    expect(plusBox!.width).toBeGreaterThanOrEqual(44);

    // Assert all visible buttons on Single Court screen against allowlist
    await assertAllVisibleButtonsTouchTarget(page, 'Single-Court Queue Screen');

    // ══════════════════════════════════════════════════════════════
    // 2. Host Tools Sheet
    // ══════════════════════════════════════════════════════════════
    await hostToolsBtn.click();
    const sheetCloseBtn = page.getByRole('button', { name: 'Close sheet' });
    await expect(sheetCloseBtn).toBeVisible({ timeout: 5000 });
    const sheetCloseBox = await sheetCloseBtn.boundingBox();
    expect(sheetCloseBox!.height).toBeGreaterThanOrEqual(44);
    expect(sheetCloseBox!.width).toBeGreaterThanOrEqual(44);

    // Add Player button with restored aria-label="Add Player"
    const addInput = page.getByPlaceholder('Player name…');
    await addInput.fill('Late Sub');
    const addBtn = page.getByRole('button', { name: 'Add Player' });
    const addBox = await addBtn.boundingBox();
    expect(addBox!.height).toBeGreaterThanOrEqual(44);

    // Toggle Match Scores switch
    const switchToggle = page.getByRole('switch', { name: /Toggle Match Scores/i });
    const switchBox = await switchToggle.boundingBox();
    expect(switchBox!.height).toBeGreaterThanOrEqual(44);

    // Assert all visible buttons in Host Tools Sheet against allowlist
    await assertAllVisibleButtonsTouchTarget(page, 'Host Tools Sheet');

    await sheetCloseBtn.click();
    await expect(sheetCloseBtn).toHaveCount(0);

    // ══════════════════════════════════════════════════════════════
    // 3. Match Completion & Recap Modal
    // ══════════════════════════════════════════════════════════════
    const plusA = page.locator('.score-side--a .score-btn--plus');
    for (let i = 0; i < 11; i += 1) {
      await plusA.click();
      await page.waitForTimeout(60);
    }
    const confirmBtn = page.getByRole('button', { name: /Confirm result|Confirm Match/ });
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 });
    const confirmBox = await confirmBtn.boundingBox();
    expect(confirmBox!.height).toBeGreaterThanOrEqual(44);
    await confirmBtn.click();

    // Stats tab & Recap Card
    await statsTab.click();
    const recapBtn = page.getByRole('button', { name: /Share Recap Card/i });
    await expect(recapBtn).toBeVisible({ timeout: 10_000 });
    const recapBtnBox = await recapBtn.boundingBox();
    expect(recapBtnBox!.height).toBeGreaterThanOrEqual(44);

    await recapBtn.click();
    const recapCloseBtn = page.locator('.recap-modal-close-btn');
    await expect(recapCloseBtn).toBeVisible({ timeout: 5000 });
    const recapCloseBox = await recapCloseBtn.boundingBox();
    expect(recapCloseBox!.height).toBeGreaterThanOrEqual(44);
    expect(recapCloseBox!.width).toBeGreaterThanOrEqual(44);

    const actionBtns = page.locator('.recap-action-btn');
    const actionCount = await actionBtns.count();
    expect(actionCount).toBeGreaterThan(0);
    for (let i = 0; i < actionCount; i += 1) {
      const box = await actionBtns.nth(i).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    // Assert all visible buttons in Recap Modal against allowlist
    await assertAllVisibleButtonsTouchTarget(page.locator('.recap-modal-dialog'), 'Recap Modal');

    await recapCloseBtn.click();
    await expect(recapCloseBtn).toHaveCount(0);
  });

  test('buttons in multi-court screen, partner panel, and court score modal satisfy touch targets', async ({
    page,
  }) => {
    // ══════════════════════════════════════════════════════════════
    // 4. Multi-Court Screen, Partner Panel, & CourtScoreModal
    // ══════════════════════════════════════════════════════════════
    await page.goto('/queue?mode=doubles');
    await page.locator('.court-count-adj').last().click();
    await expect(page.locator('.court-count-value')).toHaveText('2');
    await page.getByPlaceholder(/Paste names separated by commas/).fill('M1, M2, M3, M4, M5, M6, M7, M8, M9, M10');
    await page.getByTitle('Add all').click();
    await page.getByRole('button', { name: /Start Queue/ }).click();
    await expect(page.locator('.session-bar--host')).toContainText('Connected', { timeout: 20_000 });

    // Multi-court cards render win buttons
    const multiWinBtns = page.getByRole('button', { name: /wins/i });
    await expect(multiWinBtns).toHaveCount(4);
    for (let i = 0; i < 4; i += 1) {
      const box = await multiWinBtns.nth(i).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    // Assert all visible buttons on Multi-Court screen against allowlist
    await assertAllVisibleButtonsTouchTarget(page, 'Multi-Court Screen');

    // In Multi-Court mode, Host Tools contains the Set Partners panel
    await page.getByRole('button', { name: 'Host Tools' }).click();
    const setPartnersBtn = page.getByRole('button', { name: /Set Partners/i });
    await expect(setPartnersBtn).toBeVisible({ timeout: 5000 });
    const setPartnersBox = await setPartnersBtn.boundingBox();
    expect(setPartnersBox!.height).toBeGreaterThanOrEqual(44);
    await setPartnersBtn.click();

    // Verify partner player buttons
    const partnerPlayerBtns = page.locator('.partner-player-btn');
    await expect(partnerPlayerBtns.first()).toBeVisible({ timeout: 5000 });
    const partnerBtnBox = await partnerPlayerBtns.first().boundingBox();
    expect(partnerBtnBox!.height).toBeGreaterThanOrEqual(44);

    // Pair two players to test partner pair chip remove button
    await partnerPlayerBtns.nth(0).click();
    await partnerPlayerBtns.nth(1).click();
    const partnerChipRemove = page.locator('.partner-pair-chip button').first();
    await expect(partnerChipRemove).toBeVisible({ timeout: 3000 });
    const isAllowlistedChip = await partnerChipRemove.evaluate((el) =>
      el.matches('.partner-pair-chip button, [aria-label*="Remove partner pair"]')
    );
    expect(isAllowlistedChip).toBe(true);

    // Partner cancel and save action buttons
    const partnerCancelBtn = page.locator('.partner-panel-cancel');
    const partnerSaveBtn = page.locator('.partner-panel-save');
    const cancelBox = await partnerCancelBtn.boundingBox();
    const saveBox = await partnerSaveBtn.boundingBox();
    expect(cancelBox!.height).toBeGreaterThanOrEqual(44);
    expect(saveBox!.height).toBeGreaterThanOrEqual(44);

    // Assert all visible buttons in Host Tools & Partner Panel against allowlist
    await assertAllVisibleButtonsTouchTarget(page, 'Multi-Court Host Tools & Partner Panel');

    await partnerCancelBtn.click();
    await page.getByRole('button', { name: 'Close sheet' }).click();

    // Trigger CourtScoreModal by clicking Court 1 win button (match scores default enabled)
    await multiWinBtns.first().click();
    const scoreModal = page.locator('div[role="dialog"]');
    await expect(scoreModal).toBeVisible({ timeout: 5000 });

    // Check CourtScoreModal buttons: presets, save, skip, cancel
    const presetBtns = page.locator('button[class*="presetBtn"]');
    const presetCount = await presetBtns.count();
    expect(presetCount).toBeGreaterThan(0);
    for (let i = 0; i < presetCount; i += 1) {
      const box = await presetBtns.nth(i).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    const scoreSaveBtn = page.locator('button[class*="saveBtn"]');
    const scoreSkipBtn = page.locator('button[class*="skipBtn"]');
    const scoreCancelBtn = page.locator('button[class*="cancelBtn"]');

    const saveBox2 = await scoreSaveBtn.boundingBox();
    const skipBox2 = await scoreSkipBtn.boundingBox();
    const cancelBox2 = await scoreCancelBtn.boundingBox();

    expect(saveBox2!.height).toBeGreaterThanOrEqual(44);
    expect(skipBox2!.height).toBeGreaterThanOrEqual(44);
    expect(cancelBox2!.height).toBeGreaterThanOrEqual(44);

    // Assert all visible buttons in CourtScoreModal against allowlist
    await assertAllVisibleButtonsTouchTarget(scoreModal, 'CourtScoreModal');

    await scoreCancelBtn.click();
    await expect(scoreModal).toHaveCount(0);
  });
});
