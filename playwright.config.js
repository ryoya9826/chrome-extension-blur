// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/** 単体テスト用の静的サーバーのポート */
const PORT = 8765;

/**
 * Playwright Test の設定。
 * - unit: tests/content.test.html を静的サーバー経由で開き、ページ内テストの結果を検証する
 * - e2e: 拡張機能を読み込んだ Chromium で実際の動作を検証する（tests/e2e/fixtures.js 参照）
 */
module.exports = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'unit',
      testMatch: 'unit/**/*.spec.js',
      use: { ...devices['Desktop Chrome'], baseURL: `http://127.0.0.1:${PORT}` },
    },
    {
      name: 'e2e',
      testMatch: 'e2e/**/*.spec.js',
    },
  ],
  webServer: {
    command: `python3 -m http.server ${PORT} --bind 127.0.0.1`,
    url: `http://127.0.0.1:${PORT}/tests/content.test.html`,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
