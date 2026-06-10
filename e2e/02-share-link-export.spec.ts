import { test, expect } from '@playwright/test';

/**
 * E2E tests for the Share Link Export section.
 *
 * The export section appears below the form when "outbounds" module is selected
 * and config.outbounds.length > 0. For each outbound it shows either a
 * "Copy Link" button (for shareable protocols) or a "Not shareable" message.
 *
 * Default config outbounds: freedom, blackhole (both non-shareable).
 * To test copy-link we import a VLESS share link via the import dialog.
 */

test.describe('Share Link Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // Switch to the outbounds module so the multi-protocol export
    // section (and its import button) becomes visible.
    // MUI Select labelled by t('app.moduleSelect'):
    //   zh-CN: "第一级配置模块"
    //   en-US: "Top-level Module"
    const moduleSelect = page.getByLabel(/第一级配置模块|Top.level Module/i);
    await moduleSelect.click();

    // Dropdown options use translated labels from schemaLabelTranslations:
    //   zh-CN: "出站"
    //   en-US: "Outbound"
    await page.getByRole('option', { name: /出站|Outbound/i }).click();

    // Allow the form and export section to re-render
    await page.waitForTimeout(500);
  });

  test('non-shareable outbounds show not-shareable message', async ({ page }) => {
    // Default outbounds (freedom, blackhole) are not shareable.
    // t('app.vless.notShareable'): "不支持分享链接" (zh-CN) / "Not shareable" (en-US)
    const notShareable = page.getByText(/不支持分享|Not shareable/i);

    // Scroll the export section into view
    await notShareable.first().scrollIntoViewIfNeeded();

    await expect(notShareable.first()).toBeVisible();
    const count = await notShareable.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('copy link on imported shareable outbound shows copied state', async ({ page, context }) => {
    // Grant clipboard write permission so the copy operation succeeds
    // (headless Chrome denies clipboard API by default)
    await context.grantPermissions(['clipboard-write']);

    // ---- Step 1: Import a valid VLESS share link ----

    // t('app.share.importTitle'): "导入分享链接" (zh-CN) / "Import Share Link" (en-US)
    const importButton = page.getByRole('button', {
      name: /导入分享链接|Import Share Link/i,
    });
    await expect(importButton).toBeVisible({ timeout: 5000 });
    await importButton.click();

    // Wait for the import dialog
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Paste a minimal valid VLESS link
    // Format: vless://<uuid>@<host>:<port>?type=tcp&security=none&encryption=none
    const vlessLink =
      'vless://550e8400-e29b-41d4-a716-446655440000@example.com:443?type=tcp&security=none&encryption=none';
    // t('app.share.importLabel'): "分享链接" (zh-CN) / "Share Link" (en-US)
    await dialog.getByLabel(/分享链接|Share Link/i).fill(vlessLink);

    // Wait for auto-validation to complete.
    // A preview card appears when parsing succeeds.
    // Card title: t('app.share.parsedDataTitle'): "解析详情" (zh-CN) / "Parsed Details" (en-US)
    await expect(
      dialog.getByText(/解析详情|Parsed Details/i),
    ).toBeVisible({ timeout: 5000 });

    // Click confirm — this adds the shareable outbound to the config
    // t('app.share.importConfirm'): "确认导入" (zh-CN) / "Confirm Import" (en-US)
    await dialog.getByRole('button', { name: /确认导入|Confirm Import/i }).click();

    // Wait for dialog to close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // ---- Step 2: Click "Copy Link" and verify "Copied" state ----

    // The new vless outbound should now have a "Copy Link" button
    // t('app.share.copyLink'): "复制链接" (zh-CN) / "Copy Link" (en-US)
    const copyLinkBtn = page.getByRole('button', {
      name: /复制链接|Copy Link/i,
    });
    await expect(copyLinkBtn.first()).toBeVisible({ timeout: 5000 });

    // Click the first (and only) "Copy Link" button
    await copyLinkBtn.first().click();

    // Verify the button text changes to "Copied ✓"
    // t('app.share.copied'): "已复制 ✓" (zh-CN) / "Copied ✓" (en-US)
    const copiedBtn = page.getByRole('button', {
      name: /已复制|Copied/i,
    });
    await expect(copiedBtn.first()).toBeVisible({ timeout: 5000 });

    // The "Copied" state persists for 2 seconds, so it should still be visible
    await expect(copiedBtn.first()).toBeVisible({ timeout: 1500 });
  });
});
