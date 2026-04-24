# Blur Focus

> Chrome 拡張機能：指定した要素にいい感じにブラーをかけ、ホバーで一時的に解除します。広告・サイドバー・個人情報など、画面上のノイズを隠したい時に使えます。

![Blur Focus icon](icons/icon128.png)

---

## ✨ Features

| 機能 | 説明 |
|---|---|
| **Keyboard Shortcut** | <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> で選択モードを ON/OFF（カスタマイズは `chrome://extensions/shortcuts`）。 |
| **Element Picker** | ボタン一発でページ上の要素を視覚的に連続選択。Esc または「Done」パネルで終了。 |
| **Click-to-Toggle** | 選択モードで未対象の要素をクリック → 追加。**ブラー中の要素を再クリック → 解除。** ハイライト色（赤=追加 / 橙=解除）で操作内容が一目で分かります。 |
| **Hover to Reveal** | ブラーがかかった要素はマウスを乗せると一瞬で内容が見えます。 |
| **Domain Scoping** | フィルタはサイト（ホスト名）単位で管理。サイト A の設定が B に漏れません。 |
| **Auto-Analysis** | ページ内の `ad`, `banner`, `sponsored`, `user`, `profile`, `private`, `name`, `email`, `avatar`, `account` 等を含む要素を候補として提示。 |
| **Manual Add** | CSS セレクタを直接入力して追加。Enter キー対応。 |
| **Reset per Domain** | 現在のドメインのフィルタをワンクリックで全消去。 |
| **Instant Apply** | 追加・削除・トグルが即座に反映、リロード不要。 |
| **Robust Storage** | `chrome.storage.local` に保存され、ブラウザ再起動後も維持。 |

---

## 🛡️ Security

- **3 段階のセレクタ検証**（popup 入力 / content 保存 / スタイル適用）で CSS Injection を防止。
- 危険なトークン（`{`, `}`, `;`, `/* */`, `@import`, `expression(`, `url(`）を含むセレクタは拒否。
- Manifest V3 + 明示的な CSP（`script-src 'self'; object-src 'self'`）。
- `popup.js` は `innerHTML` を使わず DOM API のみで描画。

詳細は [`docs/security_audit/security_report.md`](docs/security_audit/security_report.md) を参照。

---

## 🚀 Installation (開発者モード)

1. このリポジトリをクローン

   ```bash
   git clone <this-repo-url>
   cd chrome-extension-blur
   ```

2. Chrome で `chrome://extensions/` を開く
3. 右上の **「デベロッパーモード」** を ON
4. **「パッケージ化されていない拡張機能を読み込む」** をクリックし、このフォルダを選択
5. ツールバーに青い目のアイコンが表示されれば OK

---

## 📖 Usage

### 1. ブラーを有効化
ポップアップを開いて **「Enable Blur」** にチェック。

### 2. 要素を選ぶ
- **🖱️ Select Element on Page** をクリック、または <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> を押す（もう一度押すと終了）
- ページ上をマウスで動かすとハイライト
  - **赤枠**: 未対象 → クリックで追加
  - **橙枠**: すでにブラー中 → クリックで解除
- 連続選択モードなので何度でも追加・解除が可能
- 右下の **Done** ボタン（または Esc キー）で選択モード終了

### 3. CSS セレクタを直接追加
- ポップアップの「Manual Add」に `.ads`, `#sidebar`, `div.user-info` などを入力
- Enter キーまたは「Add Selector」ボタンで追加

### 4. 自動候補を使う
- ポップアップ下部の「Auto-Analysis Candidates」から **Add** ボタンで一括追加

### 5. 解除
- 個別: 「Active Filters」リストの **×** ボタン
- 全消去: **Reset for this Domain** ボタン

---

## 🗂️ Project Structure

```
chrome-extension-blur/
├── manifest.json          # MV3 manifest (icons, CSP, content script)
├── popup.html             # Toolbar popup UI
├── popup.js               # Popup logic + selector validation
├── background.js          # MV3 service worker (keyboard-shortcut handler)
├── content.js             # Page-side blur engine + element picker
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── fig/
│   └── Gemini_Generated_Image_*.png  # Source artwork (icon set mock-up)
├── tools/
│   ├── generate_icons.py  # Crops puzzle from fig/ and emits icons/*.png
│   └── crop_preview.py    # Helper to iterate on crop coordinates
├── test_selector.html     # Standalone bench for SelectorGenerator
└── docs/
    ├── refactor_documentation/
    │   ├── requirements.md
    │   ├── implementation_plan.md
    │   ├── walkthrough.md
    │   └── task.md
    └── security_audit/
        ├── security_report.md
        └── task.md
```

---

## 🔧 Development

### Testing the selector generator
ロジック単体は `test_selector.html` をブラウザで開けば検証できます。要素をクリックすると生成されたセレクタとマッチ件数（一意かどうか）が下部コンソールに表示されます。

### Regenerating icons
[uv](https://github.com/astral-sh/uv) があれば、ワンライナーで再生成できます。

```bash
uv run --with pillow tools/generate_icons.py
```

### Storage schema

```js
chrome.storage.local = {
  enabled: boolean,
  blurMap: {
    "example.com": [
      { selector: ".ad-banner", createdAt: 1714000000000 },
      ...
    ],
    "another.com": [...]
  }
}
```

---

## 🧪 Verification Checklist

- [ ] サイト A でフィルタ追加 → サイト B に影響しない
- [ ] サイト B のリストはサイト A と独立して表示される
- [ ] **Reset for this Domain** で現在のドメインだけ空になる
- [ ] `body { display: none; }` を入力 → 赤字エラーで拒否される
- [ ] ホバーするとブラーが解除される
- [ ] 選択モードでブラー中の要素にホバー → 橙枠になり、クリックで解除される
- [ ] <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> を押すと選択モードが ON/OFF される

---

## 👤 Author

**Ryoya Ando (安藤遼哉)**
[https://ryoya9826.github.io/](https://ryoya9826.github.io/)

## 📝 License

[MIT License](LICENSE) © 2026 Ryoya Ando (安藤遼哉).
You are free to use, copy, modify, and redistribute this software with attribution.
