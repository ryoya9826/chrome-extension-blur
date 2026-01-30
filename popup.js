document.addEventListener('DOMContentLoaded', () => {
    const masterToggle = document.getElementById('masterToggle');
    const addBtn = document.getElementById('addBtn');
    const targetSelector = document.getElementById('targetSelector');
    const listContainer = document.getElementById('listContainer');
    const selectModeBtn = document.getElementById('selectModeBtn');
    const analysisList = document.getElementById('analysisList');
    const resetDomainBtn = document.getElementById('resetDomainBtn');

    let currentHost = '';

    // 1. Get current tab and domain
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (tab && tab.url) {
            try {
                const url = new URL(tab.url);
                currentHost = url.hostname;
                loadState();
            } catch (e) {
                console.error("Invalid URL:", e);
                listContainer.innerHTML = '<div style="color:red; font-size:12px;">Cannot access this page.</div>';
            }
        } else {
            listContainer.innerHTML = '<div style="color:red; font-size:12px;">No active tab found.</div>';
        }
    });

    function loadState() {
        if (!currentHost) return;
        chrome.storage.local.get(['enabled', 'blurMap'], (res) => {
            masterToggle.checked = res.enabled || false;

            const map = res.blurMap || {};
            // Get list specific to this domain
            const list = map[currentHost] || [];

            renderBlurList(list);
        });
    }

    // 2. Master Toggle
    masterToggle.addEventListener('change', () => {
        chrome.storage.local.set({ enabled: masterToggle.checked }, () => {
            notifyContentScript("refresh");
        });
    });

    // 3. Add Manual Selector
    addBtn.addEventListener('click', () => {
        const selector = targetSelector.value.trim();
        if (!selector) return;
        addSelector(selector);
        targetSelector.value = '';
    });

    // 4. Reset Domain Filters
    if (resetDomainBtn) {
        resetDomainBtn.addEventListener('click', () => {
            if (!currentHost) return;
            if (confirm(`Remove all filters for ${currentHost}?`)) {
                chrome.storage.local.get(['blurMap'], (res) => {
                    const map = res.blurMap || {};
                    map[currentHost] = []; // Clear only this domain

                    chrome.storage.local.set({ blurMap: map }, () => {
                        loadState(); // Refresh UI
                        notifyContentScript("resetDomain");
                    });
                });
            }
        });
    }

    // 5. Toggle Selection Mode
    selectModeBtn.addEventListener('click', () => {
        // Change button text to indicate action
        selectModeBtn.textContent = "Connecting...";

        sendMessageToActiveTab({ action: "toggleSelectMode", enabled: true }, (res) => {
            window.close();
        });
    });

    // 6. Auto Analysis
    sendMessageToActiveTab({ action: "analyzePage" }, (response) => {
        if (chrome.runtime.lastError) {
            analysisList.textContent = "Could not connect to page. Refresh the page?";
            return;
        }

        if (response && response.candidates && response.candidates.length > 0) {
            analysisList.innerHTML = '';
            response.candidates.forEach(c => {
                const item = document.createElement('div');
                item.className = 'analysis-item';
                item.innerHTML = `
                    <code>${escapeHtml(c.selector)}</code>
                    <button data-selector="${escapeHtml(c.selector)}">Add</button>
                `;
                analysisList.appendChild(item);
            });

            // Event delegation for analysis buttons
            analysisList.querySelectorAll('button').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const sel = e.target.getAttribute('data-selector');
                    addSelector(sel);
                    e.target.textContent = "Added";
                    e.target.disabled = true;
                });
            });
        } else {
            analysisList.textContent = "No obvious candidates found.";
        }
    });

    // --- Helpers ---

    function addSelector(selector) {
        if (!currentHost) return;
        chrome.storage.local.get(['blurMap'], (res) => {
            const map = res.blurMap || {};
            const list = map[currentHost] || [];

            // Avoid duplicates
            if (!list.some(item => item.selector === selector)) {
                list.push({ selector: selector, createdAt: Date.now() });
                map[currentHost] = list; // Update map

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
        if (!list || list.length === 0) {
            listContainer.innerHTML = '<div style="color:#999; font-size:12px; padding:5px;">No filters active for this domain.</div>';
            return;
        }
        listContainer.innerHTML = '';
        list.forEach(item => {
            const el = document.createElement('div');
            el.className = 'list-item';

            const displaySelector = formatSelector(item.selector);

            el.innerHTML = `
                <span title="${escapeHtml(item.selector)}">${escapeHtml(displaySelector)}</span> 
                <span class="remove-btn">×</span>
            `;

            el.querySelector('.remove-btn').addEventListener('click', () => {
                removeSelector(item.selector);
            });

            listContainer.appendChild(el);
        });
    }

    function formatSelector(selector) {
        if (!selector) return "";
        if (selector.length <= 40) return selector;

        // Strategy 1: Show last part of ' > '
        const parts = selector.split(' > ');
        if (parts.length > 1) {
            const last = parts[parts.length - 1];
            // If last part is still too long, truncate it
            if (last.length > 35) {
                return "... > " + truncateClass(last);
            }
            return "... > " + last;
        }

        // Strategy 2: Just truncate
        return truncateClass(selector);
    }

    function truncateClass(str) {
        if (str.length <= 35) return str;
        return str.substring(0, 15) + "..." + str.substring(str.length - 15);
    }

    function sendMessageToActiveTab(msg, callback) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs[0];
            // 1. Check if tab exists
            if (!tab || !tab.id) {
                if (callback) callback(null);
                return;
            }

            // 2. Check if URL is supported
            if (tab.url && (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:'))) {
                const analysisList = document.getElementById('analysisList');
                if (analysisList) analysisList.textContent = "Cannot run on this page.";
                return;
            }

            // 3. Send message with error handling
            chrome.tabs.sendMessage(tab.id, msg, (response) => {
                if (chrome.runtime.lastError) {
                    const analysisList = document.getElementById('analysisList');
                    if (msg.action === "analyzePage" && analysisList) {
                        analysisList.innerHTML = `<span style="color:red;">Please reload the page.<br>(Content script not ready)</span>`;
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

    function escapeHtml(text) {
        if (!text) return text;
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});