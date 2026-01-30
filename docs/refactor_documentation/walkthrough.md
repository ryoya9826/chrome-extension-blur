# Walkthrough - Chrome Extension Refactoring

リファクタリング、バグ修正、および機能改善が完了しました。

## New Features
- **Continuous Selection (連続選択)**: 要素を選択してもモードが終了しません。続けて複数の要素を選択できます。
- **Control Panel**: 選択モード中、画面右下に「Done」ボタンが表示され、任意のタイミングで終了できます。
- **Instant Apply**: 選択したその瞬間にブラーが適用されます。
- **Domain Scoping**: フィルタ設定が「開いているWebサイト（ドメイン）」ごとに保存されるようになりました。Aサイトの設定がBサイトに影響することはありません。
- **Reset Button**: ポップアップに「Reset for this Domain」ボタンを追加しました。現在のサイトのフィルタを一発で全消去できます。

## Verification Steps (Updated)

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
3. "Reset all filters for [example.com]?" と聞かれるのでOKを押す。
4. **期待動作**: リストが空になり、ページ上のブラーが全て解除されること。

## Files
- `content.js`: [Modified] Added interactive UI, instant refresh callback, and domain-scoped storage logic.
- `popup.js`: [Modified] Logic updated to use `blurMap` per domain.
- `popup.html`: [Modified] Added reset button.
