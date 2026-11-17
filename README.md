# Blur Focus

指定した要素にブラー（ぼかし）をかけ、ホバーで一時的に解除できるChrome拡張機能です。
広告やサイドバー、画面共有やスクリーンショットに映したくない個人情報など、画面上のノイズを隠したい時に便利です。

## 特徴

- **ショートカット対応**: <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> で要素選択モードを素早く切り替え（`chrome://extensions/shortcuts` からカスタマイズ可能）。
- **直感的な要素ピッカー**: ページ上の要素をクリックするだけでブラーを適用。連続選択にも対応しています。
- **クリックで切り替え**: 選択モード中に未選択の要素をクリックするとブラーを追加、すでにブラーがかかっている要素をクリックすると解除できます（赤枠=追加、橙枠=解除）。
- **ホバーで内容確認**: ブラーがかかった要素も、マウスを乗せている間だけ元の内容を確認できます。画面共有中に誤って表示しないよう、ポップアップの「Reveal on hover」でオフにできます。
- **読み込み直後から適用**: ページの読み込み開始時点でブラーを適用するため、隠したい内容が一瞬表示されることを抑えます。
- **ドメインごとの設定**: フィルタ設定はサイト（ホスト名）ごとに独立して保存されるため、他のサイトのレイアウトを崩しません。
- **自動候補表示**: ページ内の `ad`, `banner`, `sponsored`, `private` などを含む要素を自動的に分析し、ブラーの候補として提示します。
- **即時反映**: 追加・削除・トグルの操作は、開いているすべてのタブにリロード不要で反映されます。

## セキュリティとプライバシー

本拡張機能は安全にお使いいただけるよう、以下の設計に基づいています。

- **プライバシー保護**: すべてのフィルタ処理と設定の保存はブラウザ内（ローカル）で完結します。外部のサーバーへユーザーのデータを送信することは一切ありません。
- **安全な処理**: CSS Injectionなどの攻撃を防ぐため、厳格な入力検証と Manifest V3 に準拠した強固なセキュリティポリシー（CSP）を適用しています。

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

1. **要素を選ぶ**（インストール直後からブラーは有効です）
   - 「Select Element on Page」をクリックするか、<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> を押して選択モードに入ります。
   - ページ上でマウスを動かすと対象がハイライトされます。
   - 右下の「Done」ボタンをクリックするか、Escキーを押すと選択モードを終了します。
2. **セレクタの直接追加**
   ポップアップの「Manual Add」から `.ads` などのCSSセレクタを直接入力して追加できます。
3. **候補から追加**
   「Auto-Analysis Candidates」に表示された要素から「Add」ボタンで一括追加できます。
4. **設定のリセット**
   「Reset for this Domain」をクリックすると、現在のドメインの設定をすべて消去します。
5. **一時的に無効化**
   「Enable Blur」のチェックを外すと、すべてのサイトでブラーを解除します。

## プロジェクト構成

```
chrome-extension-blur/
├── manifest.json          # MV3マニフェスト (icons, CSP, content script)
├── popup.html             # ツールバーポップアップのUI
├── popup.js               # ポップアップのロジック・セレクタ検証
├── background.js          # MV3 Service Worker (ショートカットのハンドリング)
├── content.js             # ページ側のブラー処理・要素ピッカー
├── icons/                 # アイコン画像
├── scripts/package.sh     # ストア提出用 zip の作成
└── tests/                 # content.js の自動テスト（ブラウザで実行）
```

## 開発者向け情報

**テストの実行**
リポジトリのルートでローカルサーバーを起動し、ブラウザで `http://127.0.0.1:8765/tests/content.test.html` を開きます。全項目が `PASS` になれば成功です。
```bash
python3 -m http.server 8765 --bind 127.0.0.1
```

上記の単体テストと、拡張機能を読み込んだ E2E テスト（`tests/e2e/`）は、Node.js と Python 3 があれば以下のコマンドでまとめて実行できます。PR と `main` への push では GitHub Actions でも同じテストを実行します。
```bash
npm ci
npx playwright install chromium
npm test
```

**リリース**
`manifest.json` の `version` と一致するタグ（例: `v0.4`）を push すると、GitHub Actions が zip を作成して GitHub Release に添付します。

**ストア提出用 zip の作成**
以下のコマンドで、実行に必要なファイルだけを含む zip を `dist/` に作成します。
```bash
./scripts/package.sh
```

**デバッグログ**
`content.js` 冒頭の `BLUR_DEBUG` を `true` にすると、コンソールに動作ログを出力します。

**ストレージ構造**
```js
chrome.storage.local = {
  enabled: boolean,       // 未設定のときは true として扱う
  hoverReveal: boolean,   // 未設定のときは true として扱う
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
