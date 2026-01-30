# Requirements Definition (要件定義書)

これまでの指示および現状の実装に基づいた要件定義書です。

## 1. 概要
Chromeブラウザ上で、Webページごとの特定の要素に対して「ぼかし（Blur）」を適用し、視覚的なノイズ（広告、サイドバーなど）や個人情報が表示される部分を隠蔽する拡張機能。

## 2. 機能要件 (Functional Requirements)

### 2.1 ぼかし適用 (Blur Application)
- **FR-01**: 指定されたCSSセレクタに一致するHTML要素に対し、`filter: blur(10px)` を適用すること。
- **FR-02**: マウスオーバー時にはぼかしを解除し、内容を確認可能にすること (`hover` 効果)。
- **FR-03**: 拡張機能全体の有効/無効を切り替えられること。

### 2.2 要素選択 (Element Selection)
- **FR-04**: 「Select Element」ボタン押下により、ページ上の要素を選択モードに切り替えること。
- **FR-05 (Continuous Selection)**: 要素を選択してもモードを終了せず、連続して複数の要素を選択可能であること。
- **FR-06**: 選択モード中は、現在カーソルが乗っている要素を視覚的にハイライト（枠線表示等）すること。
- **FR-07**: 選択モード中は、画面上に「完了（Done）」等のコントロールパネルを表示し、明示的に終了できること。
- **FR-08 (Instant Apply)**: 要素を選択した直後に、リロードなしで即座にぼかし効果を適用すること。

### 2.3 自動解析 (Auto-Analysis)
- **FR-09**: ページ内の要素（IDやClass名）を解析し、隠すべき候補を自動抽出して提示すること。
    - **対象**: 広告 (`ad`, `banner`) に限らず、個人情報や特定コンテンツ (`user`, `profile`, `private`, `name`, `header`, `side`, etc.) も対象とする。
- **FR-10**: 提示された候補をワンクリックでフィルタリストに追加できること。

### 2.4 ドメイン管理 (Domain Scoping)
- **FR-11**: フィルタ設定は**Webサイト（ドメイン）単位**で保存・管理されること。
    - サイトAの設定がサイトBに適用されてはならない。
- **FR-12 (Reset)**: 現在のドメインに適用されているフィルタを一括削除（リセット）できること。

## 3. 非機能要件 (Non-Functional Requirements)
- **NFR-01 (Persistence)**: 設定は `chrome.storage.local` に保存され、ブラウザ再起動後も維持されること。
- **NFR-02 (Robustness)**: 無効なセレクタが含まれていても、他の有効なセレクタのぼかし適用が阻害されないこと（CSSルールの分離）。
- **NFR-03 (Performance)**: ページ読み込み時に遅延なくスタイルが適用されること (`document_idle` 等の適切なタイミング)。
- **NFR-04 (Security)**: `popup.html` 内にインラインスクリプト (`onclick="..."`) を記述せず、CSP (Content Security Policy) に準拠すること。

## 4. 実装状況一覧 (Feature Implementation Map)

| ID | 機能名 | 実装状況 | 担当ファイル / クラス | 備考 |
|:---|:---|:---|:---|:---|
| FR-01 | ぼかし適用 | ✅ 実装済 | `BlurManager` (content.js) | 個別CSSルール生成で堅牢化済 |
| FR-02 | ホバー解除 | ✅ 実装済 | `BlurManager` (content.js) | CSS `:hover` で実現 |
| FR-03 | 有効/無効 | ✅ 実装済 | `popup.js` / `BlurManager` | - |
| FR-04 | 要素選択ボタン | ✅ 実装済 | `popup.js` | - |
| FR-05 | 連続選択 | ✅ 実装済 | `InteractionManager` (content.js) | 右下パネルで完了操作 |
| FR-06 | ハイライト | ✅ 実装済 | `InteractionManager` (content.js) | 赤枠/緑枠表示 |
| FR-07 | コントロールパネル | ✅ 実装済 | `InteractionManager` (content.js) | - |
| FR-08 | **即時反映** | ✅ 実装済 | `InteractionManager` / `App` | `App.refresh` callback修正済 |
| FR-09 | 自動解析 | ✅ 実装済 | `PageAnalyzer` (content.js) | **個人情報系キーワードも含むように要確認** |
| FR-10 | 候補追加 | ✅ 実装済 | `popup.js` | - |
| FR-11 | **ドメイン管理** | ✅ 実装済 | `popup.js`, `content.js` | `popup.js` を修正し、`blurMap` を使用 |
| FR-12 | **リセット** | ✅ 実装済 | `popup.js` | `Reset for this Domain` ボタンの実装完了 |

