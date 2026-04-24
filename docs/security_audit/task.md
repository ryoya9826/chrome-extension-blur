# Security Audit Task

- [x] Analyze codebase (`manifest.json`, `popup.js`, `content.js`)
- [x] Identify security vulnerabilities
- [x] Write Security Audit Report (`security_report.md`)
- [x] Review report with User
- [x] **【高】 入力検証を実装** (`popup.js#validateSelector`, `content.js#isSafeSelector`)
- [x] **【中】 スタイル適用の安全性向上**: 保存時・適用時の二重チェック
- [x] **【低】 textContent への置き換え**: `popup.js` の `innerHTML` を DOM API に移行
- [x] **CSP の明示**: `manifest.json` に `extension_pages` ポリシーを追加
