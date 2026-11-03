#!/usr/bin/env bash
# 公開せずローカルの検査済み配布物を準備する。
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
node scripts/release.mjs --prepare-only
