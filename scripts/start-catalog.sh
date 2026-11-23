#!/usr/bin/env bash
# ステージングのカタログを配信する。PORT・HOSTを渡されればそこで、なければ既定で停止まで動く。
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
# 初回起動にも対応する。通常の取り込み後はbuild-catalog.shでビルド済み。
if [ ! -f catalog-dist/index.html ]; then
  bash scripts/build-catalog.sh
fi
exec node scripts/serve-catalog.mjs "$@"
