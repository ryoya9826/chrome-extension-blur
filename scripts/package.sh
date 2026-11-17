#!/usr/bin/env bash
# Chrome ウェブストアへアップロードする zip を dist/ に作成する。
# 拡張機能の実行に必要なファイルだけを含め、テストや画像素材は除外する。
set -euo pipefail

cd "$(dirname "$0")/.."

FILES=(manifest.json background.js content.js popup.html popup.js icons LICENSE)

for f in "${FILES[@]}"; do
  if [ ! -e "$f" ]; then
    echo "必要なファイルがありません: $f" >&2
    exit 1
  fi
done

VERSION=$(python3 -c 'import json; print(json.load(open("manifest.json"))["version"])')
OUT="dist/blur-focus-${VERSION}.zip"

mkdir -p dist
rm -f "$OUT"
zip -qr -X "$OUT" "${FILES[@]}" -x '*.DS_Store'

echo "作成しました: $OUT"
unzip -l "$OUT"
