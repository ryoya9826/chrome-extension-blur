document.addEventListener('DOMContentLoaded', () => {
    const masterToggle = document.getElementById('masterToggle');
    const addBtn = document.getElementById('addBtn');
    const targetSelector = document.getElementById('targetSelector');
    const listContainer = document.getElementById('listContainer');
    const selectModeBtn = document.getElementById('selectModeBtn');
    const analysisList = document.getElementById('analysisList');
    const resetDomainBtn = document.getElementById('resetDomainBtn');
    const inputError = document.getElementById('inputError');
    const filterCount = document.getElementById('filterCount');

    let currentHost = '';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab && tab.url) {
            try {
                const url = new URL(tab.url);
                currentHost = url.hostname;
                loadState();
            } catch (e) {
                console.error("Invalid URL:", e);
                showFatal('Cannot access this page.');
            }
        } else {
            showFatal('No active tab found.');
        }
    });

    function loadState() {
        if (!currentHost) return;
        chrome.storage.local.get(['enabled', 'blurMap'], (res) => {
            masterToggle.checked = res.enabled || false;

            const map = res.blurMap || {};
            const list = map[currentHost] || [];

            renderBlurList(list);
        });
    }

    masterToggle.addEventListener('change', () => {
        chrome.storage.local.set({ enabled: masterToggle.checked }, () => {
            notifyContentScript("refresh");
        });
    });

    addBtn.addEventListener('click', () => {
        const selector = targetSelector.value.trim();
        if (!selector) {
            showInputError('Please enter a CSS selector.');
            return;
        }
        const validation = validateSelector(selector);
        if (!validation.ok) {
            showInputError(validation.message);
            return;
        }
        clearInputError();
        addSelector(selector);
        targetSelector.value = '';
    });

    targetSelector.addEventListener('input', clearInputError);
    targetSelector.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addBtn.click();
        }
    });

    if (resetDomainBtn) {
        resetDomainBtn.addEventListener('click', () => {
            if (!currentHost) return;
            if (confirm(`Remove all filters for ${currentHost}?`)) {
                chrome.storage.local.get(['blurMap'], (res) => {
                    const map = res.blurMap || {};
                    map[currentHost] = [];

                    chrome.storage.local.set({ blurMap: map }, () => {
                        loadState();
                        notifyContentScript("resetDomain");
                    });
                });
            }
        });
    }

    selectModeBtn.addEventListener('click', () => {
        selectModeBtn.textContent = "Connecting...";

        sendMessageToActiveTab({ action: "toggleSelectMode", enabled: true }, (res) => {
            if (res === null) {
                selectModeBtn.textContent = "🖱️ Select Element on Page";
                return;
            }
            window.close();
        });
    });

    // Display the actual user-configured shortcut (or the suggested default)
    // for the toggle-select-mode command.
    const shortcutKeysEl = document.getElementById('shortcutKeys');
    const shortcutEditLink = document.getElementById('shortcutEditLink');
    if (shortcutKeysEl && chrome.commands && chrome.commands.getAll) {
        chrome.commands.getAll((commands) => {
            const cmd = commands.find(c => c.name === 'toggle-select-mode');
            if (cmd && cmd.shortcut) {
                renderShortcut(cmd.shortcut);
            } else {
                renderShortcut(null);
            }
        });
    }

    if (shortcutEditLink) {
        shortcutEditLink.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
        });
    }

    function renderShortcut(combo) {
        const hint = document.getElementById('shortcutHint');
        if (!hint) return;
        hint.textContent = '';

        if (!combo) {
            const note = document.createElement('span');
            note.textContent = 'Shortcut not set. ';
            hint.appendChild(note);
        } else {
            const label = document.createElement('span');
            label.textContent = 'Shortcut: ';
            hint.appendChild(label);

            const parts = combo.split('+');
            parts.forEach((part, i) => {
                if (i > 0) hint.appendChild(document.createTextNode('+'));
                const kbd = document.createElement('kbd');
                kbd.textContent = part;
                hint.appendChild(kbd);
            });
        }

        const link = document.createElement('a');
        link.href = '#';
        link.textContent = combo ? 'change' : 'set';
        link.tabIndex = -1;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
        });
        hint.appendChild(document.createTextNode(' '));
        hint.appendChild(link);
    }

    sendMessageToActiveTab({ action: "analyzePage" }, (response) => {
        if (response === null) {
            return;
        }

        if (response && response.candidates && response.candidates.length > 0) {
            analysisList.textContent = '';
            response.candidates.forEach(c => {
                const item = document.createElement('div');
                item.className = 'analysis-item';

                const code = document.createElement('code');
                code.textContent = c.selector;

                const btn = document.createElement('button');
                btn.textContent = 'Add';
                btn.dataset.selector = c.selector;
                btn.addEventListener('click', () => {
                    const validation = validateSelector(c.selector);
                    if (!validation.ok) {
                        btn.textContent = 'Invalid';
                        btn.disabled = true;
                        return;
                    }
                    addSelector(c.selector);
                    btn.textContent = 'Added';
                    btn.disabled = true;
                });

                item.appendChild(code);
                item.appendChild(btn);
                analysisList.appendChild(item);
            });
        } else {
            analysisList.textContent = "No obvious candidates found.";
        }
    });

    function addSelector(selector) {
        if (!currentHost) return;
        chrome.storage.local.get(['blurMap'], (res) => {
            const map = res.blurMap || {};
            const list = map[currentHost] || [];

            if (!list.some(item => item.selector === selector)) {
                list.push({ selector: selector, createdAt: Date.now() });
                map[currentHost] = list;

                chrome.storage.local.set({ blurMap: map }, () => {
                    renderBlurList(list);
                    notifyContentScript("refresh");
                });
            }
        });
    }

    function removeSelector(selector) {
        if (!currentHost) return;
        chrome.storage.local.get(['blurMap'], (res) => {
            const map = res.blurMap || {};
            let list = map[currentHost] || [];

            list = list.filter(item => item.selector !== selector);
            map[currentHost] = list;

            chrome.storage.local.set({ blurMap: map }, () => {
                renderBlurList(list);
                notifyContentScript("refresh");
            });
        });
    }

    function renderBlurList(list) {
        listContainer.textContent = '';

        if (filterCount) {
            const count = list ? list.length : 0;
            filterCount.textContent = count > 0 ? `${count} active` : '';
        }

        if (!list || list.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#999; font-size:12px; padding:5px;';
            empty.textContent = 'No filters active for this domain.';
            listContainer.appendChild(empty);
            return;
        }

        list.forEach(item => {
            const el = document.createElement('div');
            el.className = 'list-item';

            const span = document.createElement('span');
            span.title = item.selector;
            span.textContent = formatSelector(item.selector);

            const removeBtn = document.createElement('span');
            removeBtn.className = 'remove-btn';
            removeBtn.textContent = '×';
            removeBtn.title = 'Remove this filter';
            removeBtn.addEventListener('click', () => {
                removeSelector(item.selector);
            });

            el.appendChild(span);
            el.appendChild(removeBtn);
            listContainer.appendChild(el);
        });
    }

    function formatSelector(selector) {
        if (!selector) return "";
        if (selector.length <= 40) return selector;

        const parts = selector.split(' > ');
        if (parts.length > 1) {
            const last = parts[parts.length - 1];
            if (last.length > 35) {
                return "... > " + truncateClass(last);
            }
            return "... > " + last;
        }

        return truncateClass(selector);
    }

    function truncateClass(str) {
        if (str.length <= 35) return str;
        return str.substring(0, 15) + "..." + str.substring(str.length - 15);
    }

    function sendMessageToActiveTab(msg, callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            if (!tab || !tab.id) {
                if (callback) callback(null);
                return;
            }

            if (tab.url && (tab.url.startsWith('chrome://') ||
                tab.url.startsWith('edge://') ||
                tab.url.startsWith('about:') ||
                tab.url.startsWith('chrome-extension://'))) {
                if (analysisList) analysisList.textContent = "Cannot run on this page.";
                if (callback) callback(null);
                return;
            }

            chrome.tabs.sendMessage(tab.id, msg, (response) => {
                if (chrome.runtime.lastError) {
                    if (msg.action === "analyzePage" && analysisList) {
                        analysisList.textContent = '';
                        const note = document.createElement('span');
                        note.style.color = '#dc3545';
                        note.textContent = 'Please reload the page (content script not ready).';
                        analysisList.appendChild(note);
                    }
                    if (callback) callback(null);
                } else {
                    if (callback) callback(response);
                }
            });
        });
    }

    function notifyContentScript(action) {
        sendMessageToActiveTab({ action: action });
    }

    function showInputError(message) {
        if (!inputError) return;
        inputError.textContent = message;
        inputError.style.display = 'block';
    }

    function clearInputError() {
        if (!inputError) return;
        inputError.textContent = '';
        inputError.style.display = 'none';
    }

    function showFatal(message) {
        listContainer.textContent = '';
        const div = document.createElement('div');
        div.style.cssText = 'color:#dc3545; font-size:12px;';
        div.textContent = message;
        listContainer.appendChild(div);
    }

    /**
     * Validates a CSS selector string.
     * Rejects selectors containing CSS block characters ({, }, ;, /*) which
     * could be used for CSS injection, and verifies syntactic validity by
     * attempting to query a detached document fragment.
     */
    function validateSelector(selector) {
        if (typeof selector !== 'string' || selector.length === 0) {
            return { ok: false, message: 'Selector must be a non-empty string.' };
        }
        if (selector.length > 500) {
            return { ok: false, message: 'Selector is too long (max 500 chars).' };
        }
        if (/[{};]|\/\*|\*\//.test(selector)) {
            return { ok: false, message: 'Selector contains forbidden characters ({ } ; /* */).' };
        }
        if (/@import|expression\s*\(|url\s*\(/i.test(selector)) {
            return { ok: false, message: 'Selector contains forbidden tokens.' };
        }
        try {
            document.createDocumentFragment().querySelector(selector);
        } catch (_e) {
            return { ok: false, message: 'Invalid CSS selector syntax.' };
        }
        return { ok: true };
    }
});
