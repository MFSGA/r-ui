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
    await page.getByRole('option', { name: /log|日志|Log/i }).first().click();
    await page.waitForTimeout(500);

    // The loglevel field was set to "warning" in our fixture
    // It should now be visible in the form select
    // Use combobox role to avoid matching "warning" in the JSON preview too
    await expect(page.getByRole('combobox').filter({ hasText: 'warning' })).toBeVisible();
  });

  test('download config as YAML after import', async ({ page }) => {
    // Navigate with ?format=yaml to set initial config format to YAML
    // This avoids relying on MUI Select interaction which has issues with Playwright
    await page.goto('/?format=yaml');

    // Import the test config (format stays as yaml since import no longer resets it)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(path.join(FIXTURE_DIR, 'test-config.json'));
    await page.waitForTimeout(1000);

    // Confirm the format is YAML
    await expect(page.locator('[aria-labelledby="config-format-label"]')).toContainText('YAML');

    // Click download — capture the download event
    // Translation: 导出配置 (zh-CN) / Export Config (en-US)
    const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
    await page.getByRole('button', { name: /导出配置|Export Config/i }).click();

    const download = await downloadPromise;

    // The downloadConfigFile function uses extension 'yaml' for YAML format
    expect(download.suggestedFilename()).toMatch(/\.(yaml|yml)$/i);

    // Read the downloaded content via the readable stream
    const stream = await download.createReadStream();
    const content = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: string | Buffer) => {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
      });
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      stream.on('error', reject);
    });

    // Verify the downloaded YAML contains expected fields from the imported config
    expect(content).toContain('loglevel');
    expect(content).toContain('warning');
    expect(content).toContain('direct-out');
    // Distinguish YAML format (key: value) from JSON format ("key": "value")
    expect(content).toMatch(/loglevel:\s+warning/i);
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

    // Close dialog — the close button is hardcoded as "关闭" in App.tsx
    await page.getByRole('button', { name: /关闭|Close/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  });
});
