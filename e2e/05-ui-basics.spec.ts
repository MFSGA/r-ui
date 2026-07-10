import { test, expect } from '@playwright/test';

test.describe('UI Basics', () => {
  test('page loads with expected elements', async ({ page }) => {
    await page.goto('/');

    // Page title is visible
    await expect(page.locator('h4')).toBeVisible();

    // Chips are visible (React, Schema)
    await expect(page.getByText(/react/i)).toBeVisible();

    // Module selector is visible
    await expect(page.getByLabel(/模块|module|Module/i)).toBeVisible();

    // Config format selector is visible
    await expect(page.getByLabel(/配置格式|Config Format|Format/i)).toBeVisible();

    // Language selector is visible
    await expect(page.getByLabel(/语言|Language/i)).toBeVisible();

    // Key action buttons are visible
    await expect(page.getByRole('button', { name: /保存|Save/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /导入配置|Import Config/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /重置|Reset/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /导出|Export/i })).toBeVisible();

    // Preview pane is visible (the <pre> element is always rendered regardless of which module is selected)
    await expect(page.locator('pre')).toBeVisible();
  });

  test('module switching shows different form fields', async ({ page }) => {
    await page.goto('/');

    // The default config has 'inbounds' as the initial module.
    // Switching to inbounds confirms the UX works whether or not it changes.
    await page.getByLabel(/模块|module|Module/i).click();
    await page
      .getByRole('option', { name: /入站|Inbound/i })
      .first()
      .click();
    await page.waitForTimeout(500);

    // Preview should show inbounds
    await expect(page.getByText(/"inbounds"/i)).toBeVisible();

    // Switch to "log" module
    await page.getByLabel(/模块|module|Module/i).click();
    await page
      .getByRole('option', { name: /日志|Log/i })
      .first()
      .click();
    await page.waitForTimeout(500);

    // Preview should show log
    await expect(page.getByText(/"log"/i)).toBeVisible();

    // Switch to "dns" module
    await page.getByLabel(/模块|module|Module/i).click();
    await page.getByRole('option', { name: /DNS/i }).first().click();
    await page.waitForTimeout(500);

    // Preview should show dns
    await expect(page.getByText(/"dns"/i)).toBeVisible();
  });

  test('TCP Reality action is shown only once and adds one inbound', async ({ page }) => {
    await page.goto('/');

    const addTcpRealityButton = page.getByRole('button', {
      name: /新增 TCP Reality|Add TCP Reality/i,
    });
    const preview = page.locator('pre').first();

    await expect(addTcpRealityButton).toHaveCount(1);

    const initialConfig = JSON.parse((await preview.textContent()) ?? '{}') as {
      inbounds?: unknown[];
    };
    const initialInboundCount = initialConfig.inbounds?.length ?? 0;

    await addTcpRealityButton.click();

    await expect(addTcpRealityButton).toHaveCount(1);
    await expect
      .poll(async () => {
        const nextConfig = JSON.parse((await preview.textContent()) ?? '{}') as {
          inbounds?: unknown[];
        };
        return nextConfig.inbounds?.length ?? 0;
      })
      .toBe(initialInboundCount + 1);
  });

  test('locale switching changes UI language', async ({ page }) => {
    await page.goto('/');

    // Switch to English
    await page.getByLabel(/语言|Language/i).click();
    await page
      .getByRole('option', { name: /en|EN|English/i })
      .first()
      .click();
    await page.waitForTimeout(500);

    // After switching to English, verify English text appears
    await expect(page.getByText(/Save/i)).toBeVisible();

    // Switch back to Chinese
    await page.getByLabel(/语言|Language/i).click();
    await page
      .getByRole('option', { name: /zh|中文|Chinese/i })
      .first()
      .click();
    await page.waitForTimeout(500);

    // Verify Chinese text appears again
    await expect(page.getByText(/保存/i)).toBeVisible();
  });

  test('save module shows success alert', async ({ page }) => {
    await page.goto('/');

    // Click "Save Module" button
    await page.getByRole('button', { name: /保存|Save/i }).click();

    // Success alert should appear
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 5000 });

    // Alert should contain success text (distinct from the info/syncing alert)
    const alert = page.getByRole('alert');
    await expect(alert).toContainText(/已提交|synced/i);
  });

  test('full JSON dialog opens and closes', async ({ page }) => {
    await page.goto('/');

    // Click "Show Full JSON"
    await page.getByRole('button', { name: /完整.*JSON|Full JSON|完整配置/i }).click();

    // Dialog opens
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Dialog has JSON content
    const pre = dialog.locator('pre');
    await expect(pre).toBeVisible();
    const jsonText = await pre.textContent();
    expect(jsonText!.length).toBeGreaterThan(50);
    expect(jsonText).toContain('{');

    // Close dialog
    await page.getByRole('button', { name: /关闭|Close/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});
