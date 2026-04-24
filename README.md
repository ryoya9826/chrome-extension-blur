# Blur Focus

指定した要素にブラー（ぼかし）をかけ、ホバーで一時的に解除できるChrome拡張機能です。
広告やサイドバー、画面共有やスクリーンショットに映したくない個人情報など、画面上のノイズを隠したい時に便利です。

![Blur Focus icon](icons/icon128.png)

## 特徴

- **ショートカット対応**: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> で要素選択モードを素早く切り替え（`chrome://extensions/shortcuts` からカスタマイズ可能）。
- **直感的な要素ピッカー**: ページ上の要素をクリックするだけでブラーを適用。連続選択にも対応しています。
- **クリックで切り替え**: 選択モード中に未選択の要素をクリックするとブラーを追加、すでにブラーがかかっている要素をクリックすると解除できます（赤枠=追加、橙枠=解除）。
- **ホバーで内容確認**: ブラーがかかった要素も、マウスを乗せている間だけ元の内容を確認できます。
- **ドメインごとの設定**: フィルタ設定はサイト（ホスト名）ごとに独立して保存されるため、他のサイトのレイアウトを崩しません。
- **自動候補表示**: ページ内の `ad`, `banner`, `sponsored`, `private` などを含む要素を自動的に分析し、ブラーの候補として提示します。
- **即時反映**: 追加・削除・トグルの操作はリロード不要で即座に反映されます。

## セキュリティ

本拡張機能は、ユーザーが任意のCSSセレクタを追加できる仕様上、以下のセキュリティ対策を行っています。

- CSS Injectionを防ぐため、入力・保存・適用の3段階でセレクタを検証しています。
- 危険な文字やトークン（`{`, `}`, `;`, `/* */`, `@import`, `expression(`, `url(`）を含むセレクタはブロックします。
- Manifest V3に準拠し、明示的なCSP（`script-src 'self'; object-src 'self'`）を設定しています。
- `popup.js` では `innerHTML` を使用せず、DOM APIのみで描画しています。

詳細は [Security Report](docs/security_audit/security_report.md) をご参照ください。

## インストール方法 (開発者モード)

1. このリポジトリをクローンまたはダウンロードします。
   ```bash
   git clone https://github.com/ryoya9826/chrome-extension-blur.git
   cd chrome-extension-blur
   ```
2. Chromeで `chrome://extensions/` を開きます。
3. 右上の「デベロッパーモード」をオンにします。
4. 「パッケージ化されていない拡張機能を読み込む」をクリックし、このフォルダを選択します。
5. ツールバーに拡張機能のアイコンが表示されれば完了です。

## 基本的な使い方

1. **ブラーを有効化**
   ポップアップを開き、「Enable Blur」にチェックを入れます。
2. **要素を選ぶ**
   - 「Select Element on Page」をクリックするか、<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> を押して選択モードに入ります。
   - ページ上でマウスを動かすと対象がハイライトされます。
   - 右下の「Done」ボタンをクリックするか、Escキーを押すと選択モードを終了します。
3. **セレクタの直接追加**
   ポップアップの「Manual Add」から `.ads` などのCSSセレクタを直接入力して追加できます。
4. **候補から追加**
   「Auto-Analysis Candidates」に表示された要素から「Add」ボタンで一括追加できます。
5. **設定のリセット**
   「Reset for this Domain」をクリックすると、現在のドメインの設定をすべて消去します。

## プロジェクト構成

```
chrome-extension-blur/
├── manifest.json          # MV3マニフェスト (icons, CSP, content script)
├── popup.html             # ツールバーポップアップのUI
├── popup.js               # ポップアップのロジック・セレクタ検証
├── background.js          # MV3 Service Worker (ショートカットのハンドリング)
├── content.js             # ページ側のブラー処理・要素ピッカー
├── icons/                 # アイコン画像
├── tools/                 # アイコン生成などのスクリプト
├── test_selector.html     # セレクタ生成ロジックの単体テスト用
└── docs/                  # ドキュメント・セキュリティレポート
```

## 開発者向け情報

**セレクタ生成のテスト**
`test_selector.html` をブラウザで開くと、セレクタ生成ロジックの動作検証ができます。

**アイコンの再生成**
[uv](https://github.com/astral-sh/uv) がインストールされている環境であれば、以下のコマンドで `fig/` 以下の画像からアイコンを再生成できます。
```bash
uv run --with pillow tools/generate_icons.py
```

**ストレージ構造**
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

## 著者

**Ryoya Ando (安藤遼哉)**
[https://ryoya9826.github.io/](https://ryoya9826.github.io/)

## ライセンス

[MIT License](LICENSE) © 2026 Ryoya Ando.
You are free to use, copy, modify, and redistribute this software with attribution.
