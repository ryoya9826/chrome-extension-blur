/**
 * 現在の UI 言語のメッセージを返す。_locales に無いキーはキー名をそのまま返す。
 * @param {string} key messages.json のキー
 * @param {string|string[]} [substitutions] プレースホルダーに入れる値
 * @returns {string}
 */
function t(key, substitutions) {
    return chrome.i18n.getMessage(key, substitutions) || key;
}

/** data-i18n / data-i18n-title / data-i18n-placeholder 属性を持つ要素の文言を差し替える。 */
function localizePage() {
    // 実際に表示している言語に合わせる。_locales に無い言語では default_locale（en）になる
    document.documentElement.lang = t('htmlLang');
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        el.title = t(el.dataset.i18nTitle);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        el.placeholder = t(el.dataset.i18nPlaceholder);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    localizePage();

    const masterToggle = document.getElementById('masterToggle');
    const hoverRevealToggle = document.getElementById('hoverRevealToggle');
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
                showFatal(t('cannotAccess'));
            }
        } else {
            showFatal(t('noActiveTab'));
        }
    });

    function loadState() {
        if (!currentHost) return;
        chrome.storage.local.get(['enabled', 'blurMap', 'hoverReveal'], (res) => {
            // 未設定（初回インストール直後）は有効として扱う。content.js と同じ規則
            masterToggle.checked = res.enabled !== false;
            if (hoverRevealToggle) hoverRevealToggle.checked = res.hoverReveal !== false;

            const map = res.blurMap || {};
            const list = map[currentHost] || [];

            renderBlurList(list);
        });
    }

    // 設定の変更は storage.onChanged 経由で全タブの content.js が自動反映する
    masterToggle.addEventListener('change', () => {
        chrome.storage.local.set({ enabled: masterToggle.checked });
    });

    if (hoverRevealToggle) {
        hoverRevealToggle.addEventListener('change', () => {
            chrome.storage.local.set({ hoverReveal: hoverRevealToggle.checked });
        });
    }

    addBtn.addEventListener('click', () => {
        const selector = targetSelector.value.trim();
        if (!selector) {
            showInputError(t('errEmpty'));
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
            if (confirm(t('confirmReset', currentHost))) {
                chrome.storage.local.get(['blurMap'], (res) => {
                    const map = res.blurMap || {};
                    map[currentHost] = [];

                    chrome.storage.local.set({ blurMap: map }, () => {
                        loadState();
                    });
                });
            }
        });
    }

    selectModeBtn.addEventListener('click', () => {
        selectModeBtn.textContent = t('connecting');

        sendMessageToActiveTab({ action: "toggleSelectMode", enabled: true }, (res) => {
            if (res === null) {
                selectModeBtn.textContent = t('selectElement');
                return;
            }
            window.close();
        });
    });

    // Display the actual user-configured shortcut (or the suggested default)
    // for the toggle-select-mode command.
    // 表示と「変更」リンクは renderShortcut がまとめて描画する
    if (document.getElementById('shortcutHint') && chrome.commands && chrome.commands.getAll) {
        chrome.commands.getAll((commands) => {
            const cmd = commands.find(c => c.name === 'toggle-select-mode');
            if (cmd && cmd.shortcut) {
                renderShortcut(cmd.shortcut);
            } else {
                renderShortcut(null);
            }
        });
    }

    function renderShortcut(combo) {
        const hint = document.getElementById('shortcutHint');
        if (!hint) return;
        hint.textContent = '';

        if (!combo) {
            const note = document.createElement('span');
            note.textContent = t('shortcutNotSet');
            hint.appendChild(note);
        } else {
            const label = document.createElement('span');
            label.textContent = t('shortcutLabel');
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
        link.textContent = combo ? t('shortcutChange') : t('shortcutSet');
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
                btn.textContent = t('add');
                btn.dataset.selector = c.selector;
                btn.addEventListener('click', () => {
                    const validation = validateSelector(c.selector);
                    if (!validation.ok) {
                        btn.textContent = t('invalid');
                        btn.disabled = true;
                        return;
                    }
                    addSelector(c.selector);
                    btn.textContent = t('added');
                    btn.disabled = true;
                });

                item.appendChild(code);
                item.appendChild(btn);
                analysisList.appendChild(item);
            });
        } else {
            analysisList.textContent = t('noCandidates');
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
            });
        });
    }

    function renderBlurList(list) {
        listContainer.textContent = '';

        if (filterCount) {
            const count = list ? list.length : 0;
            filterCount.textContent = count > 0 ? t('activeCount', String(count)) : '';
        }

        if (!list || list.length === 0) {
            const empty = document.createElement('div');
            empty.style.cssText = 'color:#999; font-size:12px; padding:5px;';
            empty.textContent = t('noFilters');
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
            removeBtn.title = t('removeFilter');
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
                if (analysisList) analysisList.textContent = t('cannotRun');
                if (callback) callback(null);
                return;
            }

            chrome.tabs.sendMessage(tab.id, msg, (response) => {
                if (chrome.runtime.lastError) {
                    if (msg.action === "analyzePage" && analysisList) {
                        analysisList.textContent = '';
                        const note = document.createElement('span');
                        note.style.color = '#dc3545';
                        note.textContent = t('reloadPage');
                        analysisList.appendChild(note);
                    }
                    if (callback) callback(null);
                } else {
                    if (callback) callback(response);
                }
            });
        });
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
            return { ok: false, message: t('errNotString') };
        }
        if (selector.length > 500) {
            return { ok: false, message: t('errTooLong') };
        }
        if (/[{};]|\/\*|\*\//.test(selector)) {
            return { ok: false, message: t('errForbiddenChars') };
        }
        if (/@import|expression\s*\(|url\s*\(/i.test(selector)) {
            return { ok: false, message: t('errForbiddenTokens') };
        }
        try {
            document.createDocumentFragment().querySelector(selector);
        } catch (_e) {
            return { ok: false, message: t('errSyntax') };
        }
        return { ok: true };
    }
});
