import { test, expect } from '@playwright/test';

/**
 * Share links used for batch import testing.
 * - VLESS link with REALITY-compatible parameters (pbk/sid/spx)
 * - VMess link (base64-encoded JSON configuration)
 * - Trojan link with TLS
 * Each link includes a distinct tag name (#VLESS-Batch / ps:VMess-Batch / #Trojan-Batch)
 * so we can verify all three appear after import.
 */
const BATCH_LINKS = [
  'vless://a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d@example.com:443?security=tls&flow=xtls-rprx-vision&type=tcp&headerType=none&encryption=none&sni=example.com&fp=chrome&pbk=testkey1234567890123456789012345678&sid=123456&spx=%2F#VLESS-Batch',
  'vmess://eyJ2IjoiMiIsInBzIjoiVk1lc3MtQmF0Y2giLCJhZGQiOiJleGFtcGxlLmNvbSIsInBvcnQiOiI0NDMiLCJpZCI6ImEyYjNjNGQ1LWU2ZjctOGE5Yi0wYzFkLTJlM2Y0YTViNmM3ZCIsImFpZCI6IjAiLCJzY3kiOiJhdXRvIiwibmV0Ijoid3MiLCJ0eXBlIjoibm9uZSIsInBhdGgiOiIvIiwidGxzIjoidGxzIiwic25pIjoiZXhhbXBsZS5jb20ifQ==',
  'trojan://batch-password@example.com:443?security=tls&type=tcp#Trojan-Batch',
] as const;

test.describe('Batch Import', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Select the "outbounds" module so the batch-import button appears.
    // The module <Select> uses label "第一级配置模块" (zh-CN) / "Top-level Module" (en-US).
    await page.getByLabel(/模块|module|Module/i).click();
    // Options are translated: "出站" (zh-CN) / "Outbound" (en-US).
    await page.getByRole('option', { name: /outbound|Outbound|出站/i }).first().click();
    await page.waitForTimeout(500);
  });

  test('import multiple share links at once', async ({ page }) => {
    // --- open batch-import dialog ---
    // Button text: 批量导入 (zh-CN) / Batch Import (en-US)
    const batchButton = page.getByRole('button', { name: /批量|batch/i });
    await expect(batchButton).toBeVisible();
    await batchButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // --- paste links into the multiline textarea ---
    const textarea = dialog.getByRole('textbox');
    await textarea.fill(BATCH_LINKS.join('\n'));

    // --- parse the links ---
    // Button: 解析并预览 (zh-CN) / Parse & Preview (en-US)
    await dialog.getByRole('button', { name: /parse|解析/i }).click();

    // Wait for the parsed-results preview section to render
    // Use a heading role to disambiguate from the "Parse & Preview" button
    await expect(dialog.getByRole('heading', { name: /preview|预览/i })).toBeVisible({ timeout: 3000 });

    // --- confirm the import ---
    // Button: 确认导入 (zh-CN) / Confirm Import (en-US)
    await dialog.getByRole('button', { name: /confirm|确认/i }).click();

    // Wait for the result alert: 导入完成 (zh-CN) / Import complete (en-US)
    await expect(dialog.getByText(/import complete|导入完成/i)).toBeVisible({ timeout: 5000 });

    // --- close the dialog ---
    // Button: 取消 (zh-CN) / Cancel (en-US)
    await dialog.getByRole('button', { name: /cancel|取消/i }).click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });

    // Let the page re-render with the updated outbound list
    await page.waitForTimeout(500);

    // --- verify all three imported tags appear in the export section ---
    // Use exact match to avoid false hits from the JSON preview panel
    await expect(page.getByText('VLESS-Batch', { exact: true })).toBeVisible();
    await expect(page.getByText('VMess-Batch', { exact: true })).toBeVisible();
    await expect(page.getByText('Trojan-Batch', { exact: true })).toBeVisible();
  });

  test('batch import with invalid link shows error state', async ({ page }) => {
    // --- open batch-import dialog ---
    await page.getByRole('button', { name: /批量|batch/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // --- enter an invalid link ---
    const textarea = dialog.getByRole('textbox');
    await textarea.fill('not-a-valid-share-link');

    // --- parse the invalid input ---
    await dialog.getByRole('button', { name: /parse|解析/i }).click();

    // The preview section appears showing the parse error
    await expect(dialog.getByRole('heading', { name: /preview|预览/i })).toBeVisible({ timeout: 3000 });

    // The Confirm button stays disabled because there are zero valid links
    const confirmButton = dialog.getByRole('button', { name: /confirm|确认/i });
    await expect(confirmButton).toBeDisabled();

    // Dialog remains open so the user can correct their input
    await expect(dialog).toBeVisible();
  });
});
