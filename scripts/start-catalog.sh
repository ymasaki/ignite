#!/usr/bin/env bash
# DevBoardのstaging.start。割り当てられたPORT・HOSTで停止まで動く（手動指定にも対応）。
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
# 初回起動にも対応する。通常の取り込み後はstaging.commandがビルド済み。
if [ ! -f catalog-dist/index.html ]; then
  bash scripts/build-catalog.sh
fi
exec node scripts/serve-catalog.mjs "$@"
