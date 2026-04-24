/**
 * Blur Focus - Background Service Worker
 *
 * Handles the keyboard-shortcut command declared in manifest.json
 * and forwards a toggle request to the active tab's content script.
 *
 * The `scripting` permission is requested so we can re-inject the content
 * script if the user installed/updated the extension after a tab was already
 * loaded (in which case the static content_scripts entry never ran).
 */

const RESTRICTED_URL_PREFIXES = [
  'chrome://',
  'edge://',
  'about:',
  'chrome-extension://',
  'chrome.google.com/webstore',
  'chromewebstore.google.com',
];

function isRestrictedUrl(url) {
  if (!url) return true;
  return RESTRICTED_URL_PREFIXES.some(prefix => url.startsWith(prefix) || url.includes(prefix));
}

async function ensureContentScript(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content.js'],
    });
  } catch (err) {
    // Already injected or page disallows injection — both are fine.
    console.debug('[Blur BG] executeScript skipped:', err && err.message);
  }
}

async function sendToggle(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { action: 'toggleSelectMode', toggle: true });
  } catch (err) {
    console.debug('[Blur BG] first sendMessage failed, retrying after inject:', err && err.message);
    await ensureContentScript(tabId);
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'toggleSelectMode', toggle: true });
    } catch (err2) {
      console.warn('[Blur BG] sendMessage failed after inject:', err2 && err2.message);
    }
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'toggle-select-mode') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  if (isRestrictedUrl(tab.url)) {
    console.info('[Blur BG] Ignoring shortcut on restricted URL:', tab.url);
    return;
  }

  await sendToggle(tab.id);
});
