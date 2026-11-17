// @ts-check
const { test, expect } = require('@playwright/test');

// tests/content.test.html はページ内で content.js を検証し、
// 結果を #result の textContent と data-status（pass / fail）に書き込む。
test('content.test.html の全項目が PASS になる', async ({ page }) => {
  await page.goto('/tests/content.test.html');
  const result = page.locator('#result[data-status]');
  await expect(result).toBeAttached({ timeout: 15_000 });

  const status = await result.getAttribute('data-status');
  const text = await result.textContent();
  // 失敗時は各項目の PASS/FAIL 一覧をそのままメッセージに出す
  expect(status, `content.test.html の結果:\n${text}`).toBe('pass');
});
