// @ts-check
const { test, expect, TEST_ORIGIN, TEST_HOST, computedFilter } = require('./fixtures');

// UI の文言（英語/日本語）には依存せず、要素 ID・chrome.storage・computed style で判定する。

const BLURRED = 'blur(10px)';

test.beforeEach(async ({ serviceWorker }) => {
  // enabled / hoverReveal は未設定（初回インストール直後）のまま、保存済みセレクタだけ用意する
  await serviceWorker.evaluate(host =>
    chrome.storage.local.set({ blurMap: { [host]: [{ selector: '.secret', createdAt: 0 }] } }),
  TEST_HOST);
});

test('初回（enabled 未設定）でも保存済みセレクタにブラーがかかる', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`${TEST_ORIGIN}/`, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => computedFilter(page, '.secret')).toBe(BLURRED);
});

test('無効化すると開いている他のタブにも即時反映される', async ({ context, serviceWorker }) => {
  const p1 = await context.newPage();
  await p1.goto(`${TEST_ORIGIN}/`);
  const p2 = await context.newPage();
  await p2.goto(`${TEST_ORIGIN}/`);
  await expect.poll(() => computedFilter(p1, '.secret')).toBe(BLURRED);
  await expect.poll(() => computedFilter(p2, '.secret')).toBe(BLURRED);

  await serviceWorker.evaluate(() => chrome.storage.local.set({ enabled: false }));
  await expect.poll(() => computedFilter(p1, '.secret')).toBe('none');
  await expect.poll(() => computedFilter(p2, '.secret')).toBe('none');

  await serviceWorker.evaluate(() => chrome.storage.local.set({ enabled: true }));
  await expect.poll(() => computedFilter(p1, '.secret')).toBe(BLURRED);
  await expect.poll(() => computedFilter(p2, '.secret')).toBe(BLURRED);
});

test('既定ではホバーするとブラーが解除される', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(`${TEST_ORIGIN}/`);
  await expect.poll(() => computedFilter(page, '.secret')).toBe(BLURRED);

  await page.hover('.secret');
  await expect.poll(() => computedFilter(page, '.secret')).toBe('blur(0px)');
});

test('hoverReveal=false ならホバーしても隠れたまま', async ({ context, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.storage.local.set({ hoverReveal: false }));
  const page = await context.newPage();
  await page.goto(`${TEST_ORIGIN}/`);
  await expect.poll(() => computedFilter(page, '.secret')).toBe(BLURRED);

  await page.hover('.secret');
  // ホバーで値が変わらないことを確認するため、transition が終わる程度の時間を待ってから判定する
  await page.waitForTimeout(500);
  expect(await computedFilter(page, '.secret')).toBe(BLURRED);
});

test('ピッカーで選んだ要素のセレクタがエスケープされて保存される', async ({ context, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto(`${TEST_ORIGIN}/`);
  await expect.poll(() => computedFilter(page, '.secret')).toBe(BLURRED);

  // tabs 権限がなく URL でタブを絞り込めないため、全タブへ送信を試みる
  await serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      try {
        await chrome.tabs.sendMessage(t.id, { action: 'toggleSelectMode', enabled: true });
      } catch (_e) {
        // コンテンツスクリプトのないタブ（about:blank 等）は無視する
      }
    }
  });
  await expect.poll(() => page.evaluate(() => document.body.style.cursor)).toBe('crosshair');

  // Tailwind 風クラス（md:flex w-1/2）を持つ 2 個目の要素を選ぶ
  await page.click('div:nth-of-type(3)');

  await expect.poll(async () => {
    const { blurMap } = await serviceWorker.evaluate(() => chrome.storage.local.get('blurMap'));
    return blurMap[TEST_HOST].length;
  }).toBe(2);
  const { blurMap } = await serviceWorker.evaluate(() => chrome.storage.local.get('blurMap'));
  const saved = blurMap[TEST_HOST][1].selector;

  // 保存されたセレクタは querySelectorAll で有効で、選んだ要素だけに一致する
  const matched = await page.evaluate(sel => {
    const els = [...document.querySelectorAll(sel)];
    return els.map(e => e.textContent);
  }, saved);
  expect(matched, `保存されたセレクタ: ${saved}`).toEqual(['tw2']);

  // クリック直後はマウスが要素上にありホバー解除されるため、要素の外へ動かしてから判定する
  await page.mouse.move(600, 700);
  await expect.poll(() => computedFilter(page, 'div:nth-of-type(3)')).toBe(BLURRED);
  expect(await computedFilter(page, 'div:nth-of-type(2)')).toBe('none');
});

test('ポップアップは初回で両方のトグルがオンになりエラーが出ない', async ({ context, serviceWorker, extensionId }) => {
  await serviceWorker.evaluate(() => chrome.storage.local.clear());
  const errors = [];
  const popup = await context.newPage();
  popup.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  popup.on('pageerror', e => errors.push(String(e)));

  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('#masterToggle')).toBeChecked();
  await expect(popup.locator('#hoverRevealToggle')).toBeChecked();
  expect(errors).toEqual([]);
});
