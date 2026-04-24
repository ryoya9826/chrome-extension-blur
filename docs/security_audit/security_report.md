# セキュリティ監査レポート

**実施日:** 2026-02-01  
**対象プロジェクト:** chrome-extension-blur  
**監査対象ファイル:** manifest.json, popup.js, content.js

---

## 1. 概要
本レポートは、Chrome拡張機能「chrome-extension-blur」のソースコードに対するセキュリティレビューの結果をまとめたものです。
全体として、基本的な機能は実装されていますが、**CSSインジェクション**および**入力値検証の不備**に関する中程度のリスクが確認されました。また、コンテンツセキュリティポリシー（CSP）の明示的な定義が不足しています。

## 2. 監査詳細

### 2.1. 権限とスコープ (Manifest & Permissions)
*   **権限:** `storage`, `activeTab` が要求されています。
*   **コンテンツスクリプト:** `<all_urls>` (全Webサイト) で `content.js` が自動実行される設定になっています。
    *   **リスク:** 拡張機能が全サイトのDOMにアクセスできる権限を持っています。これは機能上必要（アクセスしただけでブラーを適用するため）と考えられますが、悪用された場合の影響範囲が広いため、コードの安全性確保が極めて重要です。
*   **CSP (Content Security Policy):** `manifest.json` にCSPの定義が含まれていません。Manifest V3のデフォルトが適用されますが、セキュリティ要件を明確にするため、明示的なポリシー設定が推奨されます。

### 2.2. CSSインジェクション (CSS Injection)
*   **対象:** `content.js` の `BlurManager` クラス
*   **詳細:** 
    `content.js` 内でスタイルシートを動的に生成する際、ユーザー保存されたセレクタ (`item.selector`) を直接CSSルール文字列に埋め込んでいます。
    ```javascript
    cssRules += `
        ${sel} {
            filter: blur(10px) !important;
            ...
        }
    `;
    ```
*   **脆弱性:**
    `popup.js` の `addSelector` 関数で入力値の厳密な検証が行われていません。悪意のあるユーザー（または自己破壊的な入力）が `body { display: none; }` のような文字列を入力・保存した場合、生成されるCSSは以下のようになります。
    ```css
    body { display: none; } {
        filter: blur(10px) !important;
        ...
    }
    ```
    これにより、ページ全体の非表示化や、意図しないスタイル変更（フィッシングサイトへの誘導のような見た目の変更など）が可能になります。これは一般に「Self-XSS」や「CSS Injection」に分類されます。

### 2.3. 入力検証 (Input Validation)
*   **対象:** `popup.js`
*   **詳細:** ユーザーが入力したセレクタ文字列について、単純な `trim()` 以外の検証が行われていません。
    *   有効なCSSセレクタであるかのチェックが欠如しています。
*   **リスク:** 無効なセレクタや悪意あるCSSコードの保存を許容してしまいます。

### 2.4. クロスサイトスクリプティング (XSS)
*   **対象:** `popup.js`
*   **詳細:** `innerHTML` を使用してリスト要素を描画していますが、`escapeHtml` 関数によるエスケープ処理が実装されています。
    ```javascript
    item.innerHTML = `<code>${escapeHtml(c.selector)}</code>...`;
    ```
*   **評価:** 基本的なXSS対策は行われています。ただし、ベストプラクティスとしては `textContent` の使用が推奨されます。

## 3. 推奨される修正案

### 【優先度: 高】 入力値の検証とサニタイズ
ユーザーがセレクタを追加する際 (`addSelector`)、その文字列が有効なCSSセレクタであるかを検証してください。
```javascript
// popup.js での検証例
function isValidSelector(selector) {
    try {
        document.createDocumentFragment().querySelector(selector);
        // ブロック区切り文字などが含まれていないかもチェック推奨
        return !/[{}]/.test(selector); 
    } catch {
        return false;
    }
}
```

### 【優先度: 中】 スタイル適用の安全性向上
`content.js` でCSSテキストを文字列結合する代わりに、可能であれば `CSSStyleSheet.insertRule` を使用するか、CSSエスケープを徹底してください。ただし、セレクタ自体はエスケープすべきでない（構造を表すため）ので、入力段階での検証が最も効果的です。

### 【優先度: 低】 textContent への置き換え
`popup.js` の `innerHTML` を使用している箇所を、可能な限り `document.createElement` と `textContent` の組み合わせにリファクタリングすることで、XSSのリスクを根絶できます。

### 【優先度: 低】 エラーハンドリングの強化
`popup.js` の `chrome.tabs.query` 部分などで、`activeTab` が取得できない場合や `chrome.runtime.lastError` が発生した場合のエラーハンドリングは実装されていますが、ユーザーへのフィードバック（「このページでは実行できません」など）をより明確にするとUXが向上します。

## 4. 結論
本拡張機能は、一般的なWeb閲覧における利便性ツールですが、入力値の検証不足により、意図しないページ破壊を引き起こすリスク（CSSインジェクション）が存在します。
外部へのデータ送信機能は見当たらないため、情報漏洩のリスクは低いですが、上記の「入力検証」を実装することで、堅牢性を大幅に高めることができます。
