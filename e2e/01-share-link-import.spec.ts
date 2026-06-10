import { test, expect } from '@playwright/test';

/**
 * Share links for all 5 protocols
 *
 * Tag derivation (verified against source code):
 * - VLESS: fragment (#VLESS-TCP-Vision) → share.name → outbound.tag
 * - VMess: base64 payload's ps field → share.name → outbound.tag
 * - Trojan: fragment (#Trojan-TCP) → share.name → outbound.tag
 * - Shadowsocks: fragment (#SS-Obfs) → share.name → outbound.tag
 * - Hysteria2: fragment (#Hysteria2) → share.name → outbound.tag
 */
const SHARE_LINKS: Record<string, string> = {
  vless:
    'vless://a2b3c4d5-e6f7-8a9b-0c1d-2e3f4a5b6c7d@example.com:443?security=tls&flow=xtls-rprx-vision&type=tcp&headerType=none&encryption=none&sni=example.com&fp=chrome&pbk=testkey1234567890123456789012345678&sid=123456&spx=%2F#VLESS-TCP-Vision',
  vmess:
    'vmess://eyJ2IjoiMiIsInBzIjoiVk1lc3MtV2ViU29ja2V0IiwiYWRkIjoiZXhhbXBsZS5jb20iLCJwb3J0IjoiNDQzIiwiaWQiOiJhMmIzYzRkNS1lNmY3LThhOWItMGMxZC0yZTNmNGE1YjZjN2QiLCJhaWQiOiIwIiwic2N5IjoiYXV0byIsIm5ldCI6IndzIiwidHlwZSI6Im5vbmUiLCJwYXRoIjoiLyIsInRscyI6InRscyIsInNuaSI6ImV4YW1wbGUuY29tIn0=',
  trojan:
    'trojan://password123@example.com:443?security=tls&type=tcp&headerType=none&sni=example.com#Trojan-TCP',
  shadowsocks:
    'ss://YWVzLTI1Ni1nY206cGFzc3dvcmRAZXhhbXBsZS5jb206NDQz?plugin=obfs-local%3Bobfs%3Dhttp%3Bobfs-host%3Dexample.com#SS-Obfs',
  hysteria2:
    'hysteria2://password@example.com:443?insecure=0&sni=example.com#Hysteria2',
};

const EXPECTED_TAGS: Record<string, string> = {
  vless: 'VLESS-TCP-Vision',
  vmess: 'VMess-WebSocket',
  trojan: 'Trojan-TCP',
  shadowsocks: 'SS-Obfs',
  hysteria2: 'Hysteria2',
};

test.describe('Share Link Import - All Protocols', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');

    // The page loads with a default module selected (e.g. "inbounds").
    // We must switch to the "outbounds" module so the multi-protocol
    // export section (and its import button) becomes visible.
    //
    // MUI Select labelled by t('app.moduleSelect'):
    //   zh-CN: "第一级配置模块"
    //   en-US: "Top-level Module"
    const moduleSelect = page.getByLabel(/第一级配置模块|Top.level Module/i);
    await moduleSelect.click();

    // The dropdown options use translated labels from schemaLabelTranslations:
    //   zh-CN: "出站"
    //   en-US: "Outbound"
    await page.getByRole('option', { name: /出站|Outbound/i }).click();

    // Allow the form and right-panel to re-render after switching modules
    await page.waitForTimeout(500);
  });

  for (const [protocol, link] of Object.entries(SHARE_LINKS)) {
    test(`import ${protocol} share link`, async ({ page }) => {
      // --- Click the import button ---
      // t('app.share.importTitle'): "导入分享链接" (zh-CN) / "Import Share Link" (en-US)
      const importButton = page.getByRole('button', {
        name: /导入分享链接|Import Share Link/i,
      });
      await expect(importButton).toBeVisible({ timeout: 5000 });
      await importButton.click();

      // --- Wait for the import dialog ---
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 5000 });

      // --- Paste the share link ---
      // t('app.share.importLabel'): "分享链接" (zh-CN) / "Share Link" (en-US)
      const linkInput = dialog.getByLabel(/分享链接|Share Link/i);
      await linkInput.fill(link);

      // Wait for auto-validation to complete.
      // A preview card appears when parsing succeeds.
      // Card title: t('app.share.parsedDataTitle'): "解析详情" (zh-CN) / "Parsed Details" (en-US)
      await expect(
        dialog.getByText('Parsed Details').or(dialog.getByText('解析详情')),
      ).toBeVisible({ timeout: 5000 });

      // --- Click confirm ---
      // t('app.share.importConfirm'): "确认导入" (zh-CN) / "Confirm Import" (en-US)
      const confirmButton = dialog.getByRole('button', {
        name: /确认导入|Confirm Import/i,
      });
      await confirmButton.click();

      // --- Wait for dialog to close ---
      await expect(dialog).not.toBeVisible({ timeout: 5000 });

      // --- Verify the imported outbound appears in the export section ---
      const expectedTag = EXPECTED_TAGS[protocol];
      await expect(
        page.getByText(expectedTag).first(),
      ).toBeVisible({ timeout: 5000 });
    });
  }
});
