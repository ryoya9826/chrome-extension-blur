/**
 * Chrome Extension Blur - Content Script
 * Refactored into classes for better maintainability and selector precision.
 */

class SelectorGenerator {
  /**
   * Generates a unique CSS selector for a given element.
   * Strategies:
   * 1. ID (if unique)
   * 2. Classes (if specific enough)
   * 3. Tag + nth-of-type traversal
   */
  generate(element) {
    if (!element) return '';

    // 1. ID is usually the best bet
    if (element.id) {
      // Check if ID is unique in document just to be safe
      if (document.querySelectorAll(`#${element.id}`).length === 1) {
        return `#${element.id}`;
      }
    }

    // 2. Try generic path generation
    const path = [];
    let current = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break; // ID found, stop bubbling up
      } else {
        // Try using classes
        let hasUniqueClass = false;
        if (current.className && typeof current.className === 'string') {
          const classes = current.className.trim().split(/\s+/).filter(c => c);
          if (classes.length > 0) {
            selector += `.${classes.join('.')}`;
          }
        }

        // Add nth-of-type if it's not the only child or to ensure uniqueness
        const parent = current.parentNode;
        if (parent) {
          const siblings = Array.from(parent.children).filter(child => child.tagName === current.tagName);
          if (siblings.length > 1) {
            const index = siblings.indexOf(current) + 1;
            selector += `:nth-of-type(${index})`;
          }
        }
      }

      path.unshift(selector);
      current = current.parentNode;

      // Limit depth to avoid super long selectors
      if (path.length > 5) break;
      // Stop bubbling at BODY/HTML or when we run out of element parents
      if (!current || current.nodeType !== Node.ELEMENT_NODE) break;
      if (current.tagName === 'BODY' || current.tagName === 'HTML') break;
    }

    return path.join(' > ');
  }
}

/**
 * Shared validation used by both popup.js and content.js. Mirrors
 * the rules in popup.js#validateSelector to defend against malformed or
 * malicious entries that may have been written via legacy storage data.
 */
function isSafeSelector(selector) {
  if (typeof selector !== 'string') return false;
  const s = selector.trim();
  if (s.length === 0 || s.length > 500) return false;
  if (/[{};]|\/\*|\*\//.test(s)) return false;
  if (/@import|expression\s*\(|url\s*\(/i.test(s)) return false;
  try {
    document.createDocumentFragment().querySelector(s);
  } catch (_e) {
    return false;
  }
  return true;
}

class BlurManager {
  constructor() {
    this.styleId = 'chrome-ext-blur-style';
  }

  apply(enabled, blurList) {
    console.log(`[Blur Manager] Applying styles. Enabled: ${enabled}, Count: ${blurList ? blurList.length : 0}`);

    // Remove existing styles first
    const existing = document.getElementById(this.styleId);
    if (existing) existing.remove();

    if (!enabled || !blurList || blurList.length === 0) {
      console.log("[Blur Manager] No filters to apply.");
      return;
    }

    let cssRules = '';
    let skipped = 0;

    // Generate separate rules for each selector — one bad selector won't break the rest.
    blurList.forEach(item => {
      if (!item || !isSafeSelector(item.selector)) {
        skipped++;
        return;
      }

      const sel = item.selector.trim();
      cssRules += `
                ${sel} {
                    filter: blur(10px) !important;
                    transition: filter 0.3s ease;
                    cursor: alias !important;
                }
                ${sel}:hover {
                    filter: blur(0px) !important;
                }
            `;
    });

    if (skipped > 0) {
      console.warn(`[Blur Manager] Skipped ${skipped} unsafe/invalid selector(s).`);
    }

    if (cssRules) {
      const style = document.createElement('style');
      style.id = this.styleId;
      style.textContent = cssRules;

      // Try explicit append to documentElement or head
      const target = document.head || document.documentElement;
      if (target) {
        target.appendChild(style);
        console.log("[Blur Manager] Styles injected successfully.");
      } else {
        console.error("[Blur Manager] Could not find head or documentElement to inject styles.");
      }
    }
  }
}

class PageAnalyzer {
  constructor(selectorGenerator) {
    this.generator = selectorGenerator;
  }

  analyze() {
    const keywords = [
      'ad', 'banner', 'sp-ad', 'promo', 'recommend', 'sponsored',
      'side', 'header', 'footer', 'comment',
      'user', 'profile', 'private', 'name', 'email', 'avatar', 'account'
    ];
    const results = [];

    // Use a set to avoid duplicate selectors
    const uniqueSelectors = new Set();

    // Scan common structural elements and divs
    const elements = document.querySelectorAll('div, section, aside, header, footer, iframe');

    elements.forEach(el => {
      // Check ID and Class names
      const id = (el.id || '').toLowerCase();
      const className = (el.className && typeof el.className === 'string' ? el.className : '').toLowerCase();

      const matchesKeyword = keywords.some(key => id.includes(key) || className.includes(key));

      if (matchesKeyword && el.offsetWidth > 50 && el.offsetHeight > 50) { // Filter out tiny invisible elements
        const selector = this.generator.generate(el);

        // Only suggest selectors we trust to be safe & syntactically valid.
        if (selector && !uniqueSelectors.has(selector) && isSafeSelector(selector)) {
          uniqueSelectors.add(selector);
          results.push({
            label: `Found candidate (${el.tagName})`,
            selector: selector,
            element: el
          });
        }
      }
    });

    // Return top unique results
    return results.slice(0, 10).map(r => ({ selector: r.selector }));
  }
}

class InteractionManager {
  // Visual state for the hover overlay.
  static ADD_COLOR = '#ff4757';     // red — "click to add blur"
  static REMOVE_COLOR = '#ffa502';   // orange — "click to remove blur"

  constructor(selectorGenerator, onSelectionSaved) {
    this.selectorGenerator = selectorGenerator;
    this.onSelectionSaved = onSelectionSaved; // Callback to refresh app
    this.isSelectionMode = false;
    this.hoverOverlay = null;
    this.controlPanel = null;
    this.panelLabel = null;
    // Cached snapshot of the current domain's selector list, refreshed on
    // toggle(true) and after every storage write. Used to colour the hover
    // overlay synchronously without re-querying chrome.storage every time.
    this.cachedList = [];

    this._boundMouseOver = this.handleMouseOver.bind(this);
    this._boundClick = this.handleClick.bind(this);
    this._boundKeyDown = this.handleKeyDown.bind(this);
    this._boundStorageChange = this.handleStorageChange.bind(this);

    this.createOverlay();
    this.createControlPanel();
  }

  handleStorageChange(changes, areaName) {
    if (areaName !== 'local' || !changes.blurMap) return;
    const map = changes.blurMap.newValue || {};
    this.cachedList = map[window.location.hostname] || [];
  }

  refreshCache() {
    return new Promise(resolve => {
      chrome.storage.local.get(['blurMap'], (res) => {
        const map = res.blurMap || {};
        this.cachedList = map[window.location.hostname] || [];
        resolve();
      });
    });
  }

  createOverlay() {
    this.hoverOverlay = document.createElement('div');
    this.hoverOverlay.style.cssText = `
            position: fixed;
            pointer-events: none;
            z-index: 2147483646;
            border: 2px solid #ff4757;
            background: rgba(255, 71, 87, 0.1);
            transition: all 0.1s;
            display: none;
            box-sizing: border-box;
            border-radius: 4px;
        `;
    document.body.appendChild(this.hoverOverlay);
  }

  createControlPanel() {
    this.controlPanel = document.createElement('div');
    this.controlPanel.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 2147483647;
            background: #333;
            color: white;
            padding: 10px 15px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            font-family: sans-serif;
            font-size: 14px;
            display: none;
            align-items: center;
            gap: 10px;
            cursor: move; /* Indicate draggable */
            user-select: none;
        `;

    const label = document.createElement('span');
    label.textContent = "🔍 Click to add · Click blurred to remove";
    this.panelLabel = label;

    const doneBtn = document.createElement('button');
    doneBtn.textContent = "Done";
    doneBtn.style.cssText = `
            background: #28a745;
            color: white;
            border: none;
            padding: 5px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        `;
    // Prevent drag when clicking button
    doneBtn.onmousedown = (e) => e.stopPropagation();
    doneBtn.onclick = (e) => {
      e.stopPropagation();
      this.toggle(false);
    };

    this.controlPanel.appendChild(label);
    this.controlPanel.appendChild(doneBtn);
    document.body.appendChild(this.controlPanel);

    // --- Drag Logic ---
    let isDragging = false;
    let offsetX, offsetY;

    this.controlPanel.addEventListener('mousedown', (e) => {
      isDragging = true;
      const rect = this.controlPanel.getBoundingClientRect();
      // Calculate offset from top-left corner
      offsetX = e.clientX - rect.left;
      offsetY = e.clientY - rect.top;
      this.controlPanel.style.cursor = 'grabbing';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      e.preventDefault(); // Prevent text selection etc

      let x = e.clientX - offsetX;
      let y = e.clientY - offsetY;

      // Unset bottom/right to allow free positioning via top/left
      this.controlPanel.style.bottom = 'auto';
      this.controlPanel.style.right = 'auto';
      this.controlPanel.style.top = `${y}px`;
      this.controlPanel.style.left = `${x}px`;
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.controlPanel.style.cursor = 'move';
      }
    });
  }

  toggle(enabled) {
    this.isSelectionMode = enabled;
    if (enabled) {
      document.addEventListener('mouseover', this._boundMouseOver);
      document.addEventListener('click', this._boundClick, true); // Capture phase
      document.addEventListener('keydown', this._boundKeyDown);
      try {
        chrome.storage.onChanged.addListener(this._boundStorageChange);
      } catch (_e) { /* ignore */ }
      this.refreshCache();
      document.body.style.cursor = 'crosshair';
      if (this.controlPanel) {
        this.controlPanel.style.display = 'flex';
      }
    } else {
      document.removeEventListener('mouseover', this._boundMouseOver);
      document.removeEventListener('click', this._boundClick, true);
      document.removeEventListener('keydown', this._boundKeyDown);
      try {
        chrome.storage.onChanged.removeListener(this._boundStorageChange);
      } catch (_e) { /* ignore */ }
      document.body.style.cursor = '';
      this.hideOverlay();
      if (this.controlPanel) this.controlPanel.style.display = 'none';
    }
  }

  hideOverlay() {
    if (this.hoverOverlay) this.hoverOverlay.style.display = 'none';
  }

  handleMouseOver(e) {
    if (!this.isSelectionMode) return;
    const target = e.target;
    // Ignore overlay and control panel
    if (target === document.body || target === document.documentElement ||
      this.controlPanel.contains(target) || target === this.hoverOverlay) {
      this.hideOverlay();
      return;
    }

    const rect = target.getBoundingClientRect();
    this.hoverOverlay.style.display = 'block';
    this.hoverOverlay.style.top = rect.top + 'px';
    this.hoverOverlay.style.left = rect.left + 'px';
    this.hoverOverlay.style.width = rect.width + 'px';
    this.hoverOverlay.style.height = rect.height + 'px';

    // Colour the overlay based on whether this element is already covered
    // by a stored selector: orange = "click to remove", red = "click to add".
    const covering = this.findCoveringSelector(target, this.cachedList);
    const isRemove = !!covering;
    const color = isRemove
      ? InteractionManager.REMOVE_COLOR
      : InteractionManager.ADD_COLOR;
    this.hoverOverlay.style.borderColor = color;
    this.hoverOverlay.style.background = isRemove
      ? 'rgba(255, 165, 2, 0.15)'
      : 'rgba(255, 71, 87, 0.10)';
  }

  handleClick(e) {
    if (!this.isSelectionMode) return;
    if (this.controlPanel.contains(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    const target = e.target;

    // Always re-read storage in case the cache is stale (other tab edits etc).
    chrome.storage.local.get(['blurMap'], (res) => {
      const map = res.blurMap || {};
      const domain = window.location.hostname;
      const list = map[domain] || [];

      const existing = this.findCoveringSelector(target, list);

      if (existing) {
        this.flashOverlay('#2ed573'); // green flash on successful removal
        this.removeSelectorFromList(existing, list, map, domain);
      } else {
        const selector = this.selectorGenerator.generate(target);
        this.flashOverlay('#2ed573'); // green flash on successful add
        this.saveSelector(selector);
      }
    });
  }

  /**
   * Returns the stored selector string that currently matches the clicked
   * element (or any of its ancestors), or null if none does.
   */
  findCoveringSelector(target, list) {
    if (!Array.isArray(list) || list.length === 0) return null;
    for (const item of list) {
      if (!item || !isSafeSelector(item.selector)) continue;
      let matches;
      try {
        matches = document.querySelectorAll(item.selector);
      } catch (_e) {
        continue;
      }
      for (const node of matches) {
        if (node === target || node.contains(target)) {
          return item.selector;
        }
      }
    }
    return null;
  }

  removeSelectorFromList(selector, list, map, domain) {
    const next = list.filter(item => item.selector !== selector);
    map[domain] = next;
    this.cachedList = next;
    chrome.storage.local.set({ blurMap: map }, () => {
      console.log(`[Interaction] Removed ${selector} for ${domain}`);
      if (this.onSelectionSaved) this.onSelectionSaved();
    });
  }

  flashOverlay(color) {
    if (!this.hoverOverlay) return;
    const originalBorder = this.hoverOverlay.style.borderColor;
    this.hoverOverlay.style.borderColor = color;
    setTimeout(() => {
      if (this.hoverOverlay) this.hoverOverlay.style.borderColor = originalBorder;
    }, 300);
  }

  handleKeyDown(e) {
    if (e.key === 'Escape') {
      this.toggle(false);
    }
  }

  saveSelector(selector) {
    if (!isSafeSelector(selector)) {
      console.warn(`[Interaction] Refused to save unsafe selector: ${selector}`);
      return;
    }
    chrome.storage.local.get(['blurMap'], (res) => {
      const map = res.blurMap || {};
      const domain = window.location.hostname;
      const list = map[domain] || [];

      if (!list.some(item => item.selector === selector)) {
        list.push({ selector: selector, createdAt: Date.now() });
        map[domain] = list;
        this.cachedList = list;

        chrome.storage.local.set({ blurMap: map }, () => {
          console.log(`[Interaction] Saved ${selector} for ${domain}`);
          if (this.onSelectionSaved) this.onSelectionSaved();
        });
      }
    });
  }
}

// --- Main Application Entry ---

class App {
  constructor() {
    console.log("[Blur Extension] initializing...");
    try {
      this.selectorGenerator = new SelectorGenerator();
      this.blurManager = new BlurManager();
      this.pageAnalyzer = new PageAnalyzer(this.selectorGenerator);
      // Pass refresh callback for instant apply
      this.interactionManager = new InteractionManager(this.selectorGenerator, () => this.refresh());
      this.init();
      console.log("[Blur Extension] ready.");
    } catch (e) {
      console.error("[Blur Extension] Init failed:", e);
    }
  }

  init() {
    // Initial Load
    this.refresh();

    // Message Listener
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      console.log("[Blur Extension] msg received:", msg.action);

      try {
        if (msg.action === "refresh") {
          this.refresh();
          sendResponse({ status: "ok" });
        } else if (msg.action === "toggleSelectMode") {
          // `toggle: true` (from background shortcut) flips current state;
          // explicit `enabled: bool` (from popup) sets it directly.
          if (msg.toggle === true) {
            this.interactionManager.toggle(!this.interactionManager.isSelectionMode);
          } else {
            this.interactionManager.toggle(!!msg.enabled);
          }
          sendResponse({ status: "ok", isSelectionMode: this.interactionManager.isSelectionMode });
        } else if (msg.action === "analyzePage") {
          const candidates = this.pageAnalyzer.analyze();
          sendResponse({ candidates: candidates });
        } else if (msg.action === "resetDomain") { // New reset action
          this.refresh(); // Storage clears happens in popup, we just refresh
          sendResponse({ status: "ok" });
        }
      } catch (err) {
        console.error("[Blur Extension] Error handling message:", err);
      }
      return true;
    });
  }

  refresh() {
    chrome.storage.local.get(['enabled', 'blurMap'], (res) => {
      const map = res.blurMap || {};
      const domain = window.location.hostname;
      const list = map[domain] || [];
      // If we have legacy "blurList", maybe migrate or ignore. Ignoring for now as we are moving forward.

      this.blurManager.apply(res.enabled, list);
    });
  }
}

// Start
try {
  window.blurExtensionApp = new App();
} catch (e) {
  console.error("[Blur Extension] Fatal error:", e);
}