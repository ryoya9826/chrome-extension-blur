# Implementation Plan - Domain Scoping & UX Improvements

## Goal
- **Domain Specificity**: フィルタ設定をドメイン（ホスト名）ごとに管理し、別のサイトの設定が干渉しないようにする。
- **Reset Feature**: 現在のドメインのフィルタを一括削除するボタンを追加する。
- **Instant Apply Fix**: 即時反映が動作していないバグ（前回の編集適用ミス）を修正する。

## Proposed Changes

### 1. Data Structure Migration
`chrome.storage.local` のデータ構造を変更します。
- Before: `blurList: [{ selector, createdAt }]` (Global)
- After: `blurMap: { "example.com": [{ selector, createdAt }] }`

### 2. `content.js`
- **`App.refresh()` / `BlurManager`**:
    - `window.location.hostname` をキーにして、`blurMap` から現在のドメイン用のリストを取得して適用する。
- **`InteractionManager`**:
    - 前回の修正で適用されなかった `App` クラスへのコールバック渡しを確実に実装する。
    - 保存時に `blurMap` の現在のドメインの配列に push するようにロジック変更。

### 3. `popup.js`
- **リスト表示**: 現在のタブのURLを取得し、そのドメインのリストだけを表示する。
- **Reset Button**: "Reset Filters" ボタンを追加し、現在のドメインのエントリを空にする機能を追加。

## Verification Plan
1. Aサイトで要素を追加 -> Bサイトを開く -> Aサイトのフィルタが適用されていないことを確認。
2. Bサイトで要素を追加 -> Bサイトのみに適用されることを確認。
3. "Reset" ボタンで現在のサイトのフィルタだけが消えることを確認。
