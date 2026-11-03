#!/usr/bin/env bash
# main取り込み後のカタログ反映。常駐プロセスは起動しない。
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci
fi
node_modules/.bin/vite build catalog
