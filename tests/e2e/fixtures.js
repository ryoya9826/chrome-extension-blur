// @ts-check
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test: base, chromium } = require('@playwright/test');

const ROOT = path.resolve(__dirname, '..', '..');

/**
 * 拡張機能の実行に必要なファイル。scripts/package.sh の同梱対象に合わせる。
 * 存在しないもの（例: 将来追加される _locales）は無視する。
 */
const EXTENSION_FILES = [
  'manifest.json', 'background.js', 'content.js', 'popup.html', 'popup.js', 'icons', '_locales',
];

/** テストページを返すダミーのオリジン。ctx.route で応答するため実在しなくてよい */
const TEST_ORIGIN = 'http://blur.test';
const TEST_HOST = 'blur.test';

const TEST_HTML = `<!doctype html><html><head><title>t</title></head><body>
<div class="secret" style="width:200px;height:100px">secret</div>
<div class="md:flex w-1/2" style="width:200px;height:100px">tw</div>
<div class="md:flex w-1/2" style="width:200px;height:100px">tw2</div>
</body></html>`;

/**
 * 拡張機能のファイルだけを一時ディレクトリへコピーする。
 * リポジトリ直下には node_modules などがあるため、ストアに提出する構成に近い形で読み込む。
 * @returns {string} コピー先ディレクトリ
 */
function prepareExtensionDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'blur-focus-ext-'));
  for (const f of EXTENSION_FILES) {
    const src = path.join(ROOT, f);
    if (fs.existsSync(src)) fs.cpSync(src, path.join(dir, f), { recursive: true });
  }
  return dir;
}

/**
 * 拡張機能を読み込んだ Chromium を提供するフィクスチャ。
 * - context: 拡張機能入りの永続コンテキスト（http://blur.test/** にテストページを返す）
 * - serviceWorker: 拡張機能の Service Worker（chrome.storage の操作に使う）
 * - extensionId: 拡張機能の ID（ポップアップを開くのに使う）
 * @type {import('@playwright/test').TestType<{
 *   context: import('@playwright/test').BrowserContext,
 *   serviceWorker: import('@playwright/test').Worker,
 *   extensionId: string,
 * }, {}>}
 */
const test = base.extend({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const extDir = prepareExtensionDir();
    const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'blur-focus-profile-'));
    const context = await chromium.launchPersistentContext(userDataDir, {
      // 拡張機能は新しいヘッドレスモード（channel: 'chromium'）でのみ読み込める
      channel: 'chromium',
      headless: true,
      args: [
        `--disable-extensions-except=${extDir}`,
        `--load-extension=${extDir}`,
      ],
    });
    await context.route(`${TEST_ORIGIN}/**`, route =>
      route.fulfill({ contentType: 'text/html', body: TEST_HTML }));
    await use(context);
    await context.close();
    fs.rmSync(extDir, { recursive: true, force: true });
    fs.rmSync(userDataDir, { recursive: true, force: true });
  },
  serviceWorker: async ({ context }, use) => {
    const sw = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    await use(sw);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },
});

/**
 * 要素の computed style の filter を返す。
 * @param {import('@playwright/test').Page} page
 * @param {string} selector
 */
function computedFilter(page, selector) {
  return page.locator(selector).evaluate(e => getComputedStyle(e).filter);
}

module.exports = { test, expect: base.expect, TEST_ORIGIN, TEST_HOST, computedFilter };
