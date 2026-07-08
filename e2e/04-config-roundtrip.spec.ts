import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_DIR = path.join(__dirname, 'fixtures');

test.describe('Config Round-Trip', () => {
  test('import JSON config file and verify form updates', async ({ page }) => {
    await page.goto('/');

    // Import config via hidden file input — handleImportFileChange is triggered
    // on the change event so setInputFiles on the hidden <input type="file"> works.
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURE_DIR, 'test-config.json'));

    // Wait for config to be parsed and the form to re-render
    await page.waitForTimeout(1000);

    // Select the "log" module in the top-level module selector
    // Label text: 第一级配置模块 (zh-CN) / Top-level Module (en-US)
    await page.getByLabel(/模块|Module|Top-level/i).click();
    await page
      .getByRole('option', { name: /log|日志|Log/i })
      .first()
      .click();
    await page.waitForTimeout(500);

    // The loglevel field was set to "warning" in our fixture
    // It should now be visible in the form select
    // Use combobox role to avoid matching "warning" in the JSON preview too
    await expect(page.getByRole('combobox').filter({ hasText: 'warning' })).toBeVisible();
  });

  test('show full JSON dialog and close it', async ({ page }) => {
    await page.goto('/');

    // Click "View Full JSON" button
    // Translation: 查看完整 JSON (zh-CN) / View Full JSON (en-US)
    await page.getByRole('button', { name: /完整 JSON|Full JSON/i }).click();

    // Dialog should appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify JSON content is shown inside a <pre> element
    const jsonContent = dialog.locator('pre');
    await expect(jsonContent).toBeVisible();
    const text = await jsonContent.textContent();
    expect(text).toContain('outbounds');

    // Close dialog in either supported locale.
    await page.getByRole('button', { name: /关闭|Close/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});
