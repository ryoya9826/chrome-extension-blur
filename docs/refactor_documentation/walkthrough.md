# Walkthrough - Chrome Extension Refactoring

リファクタリング、バグ修正、セキュリティ対策、配布用ポリッシュが完了しました。

## Features
- **Continuous Selection (連続選択)**: 要素を選択してもモードが終了しません。続けて複数の要素を選択できます。
- **Control Panel**: 選択モード中、画面右下に「Done」ボタン付きのドラッグ可能なパネルを表示。
- **Instant Apply**: 選択したその瞬間にブラーが適用されます。
- **Domain Scoping**: フィルタ設定が「開いているWebサイト（ドメイン）」ごとに保存されるようになりました。Aサイトの設定がBサイトに影響することはありません。
- **Reset Button**: ポップアップに「Reset for this Domain」ボタンを追加しました。現在のサイトのフィルタを一発で全消去できます。
- **Active Filter Count**: ポップアップ右上に現在ドメインの有効フィルタ数を表示。
- **Enter キーで追加**: 入力欄で Enter キーを押すと選択を追加できます。
- **Auto-Analysis**: 広告 / 個人情報系キーワード（user, profile, private, name, email, avatar, account など）を含む候補を自動抽出。

## Security Hardening
- **CSS Injection 対策**: ユーザー入力のセレクタを `validateSelector` で検証し、`{`, `}`, `;`, `/* */`, `@import`, `expression(`, `url(` を含むものを拒否。
- **多層防御**: `popup.js` の入力時、`content.js` の保存時、`content.js` のスタイル適用時の **3 段階で検証**。レガシーデータが残っていても安全。
- **CSP 明示**: `manifest.json` に `script-src 'self'; object-src 'self'` を設定。
- **DOM API 化**: `popup.js` の `innerHTML` を `textContent` + `createElement` に置換し、XSS 経路を排除。

## Verification Steps

### Step 1: Reload Extension
拡張機能を更新した後は、必ず以下の手順を行ってください。
1. `chrome://extensions/` で更新ボタンを押す。
2. **検証したいWebページをリロードする**。

### Step 2: Domain Scope Test
1. サイトA（例: google.com）を開き、何かブラーを追加する。
2. サイトB（例: yahoo.co.jp）を開く。
    - **期待動作**: ポップアップのリストが空（またはB用の設定のみ）になっており、Aのブラー設定が適用されていないこと。
3. 再びサイトAに戻る。
    - **期待動作**: ポップアップにA用の設定が表示され、ブラーが適用されていること。

### Step 3: Reset Button Test
1. フィルタがいくつかあるサイトでポップアップを開く。
2. 「Reset for this Domain」ボタン（赤いボタン）を押す。
3. "Remove all filters for [example.com]?" と聞かれるのでOKを押す。
4. **期待動作**: リストが空になり、ページ上のブラーが全て解除されること。

### Step 4: Selector Validation Test
1. ポップアップの入力欄に `body { display: none; }` と入力して Add を押す。
    - **期待動作**: 「Selector contains forbidden characters」と赤字で表示され、追加されないこと。
2. `..foo` のような壊れたセレクタを入力。
    - **期待動作**: 「Invalid CSS selector syntax.」と表示されること。
3. `.normal-class` を入力。
    - **期待動作**: 通常通り追加されること。

## Files
- `manifest.json`: [Modified] アイコン定義 / CSP 追加。
- `content.js`: [Modified] `isSafeSelector`, null 安全性、キーワード拡張。
- `popup.js`: [Modified] 入力検証、DOM API 化、Enter キー対応、フィルタ数表示、エラー表示。
- `popup.html`: [Modified] エラー表示・フィルタ数表示用 UI 追加。
- `icons/icon{16,48,128}.png`: [Added] ブラーがかかった目のアイコン。
- `tools/generate_icons.py`: [Added] アイコン再生成用スクリプト（`uv run --with pillow` で実行）。
