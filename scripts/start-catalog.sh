#!/usr/bin/env bash
# カタログの開発サーバーを http://localhost:5199 で起動する（DevBoard の staging.start）。止めるまで動き続ける。
# カタログは dist ではなく src を直接読むので、依存の準備のほかにビルドは要らない
set -euo pipefail
cd "$(dirname "$0")/.."

# GUI のアプリから動かすとシェルの設定が読まれず、PATH に node がない
if ! command -v node > /dev/null; then
  export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
fi

# 依存がない、またはロックファイルより古いときだけ入れ直す
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci
fi

# ポートは catalog/vite.config.ts で固定している。localhost から開けるよう IPv4 でだけ待ち受け、LAN には出さない
exec node_modules/.bin/vite catalog --host 127.0.0.1
