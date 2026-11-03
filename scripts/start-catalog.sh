#!/usr/bin/env bash
# DevBoardのmain取り込み後にカタログをWebDockへ反映する。
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[[ "$(git branch --show-current)" = main ]] || { echo '通常のカタログ登録はmainの作業場所で行ってください。worktreeは別名で登録してください' >&2; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || { echo '未コミットの変更があります' >&2; exit 1; }
[[ "${DEVBOARD_COMMIT:-$(git rev-parse HEAD)}" = "$(git rev-parse HEAD)" ]] || { echo '対象コミットとHEADが一致しません' >&2; exit 1; }
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  npm ci
fi
webdock="$HOME/.local/bin/webdock"
"$webdock" register "$PWD"
"$webdock" restart ignite-catalog
curl --fail --silent --show-error --retry 10 --retry-connrefused --retry-delay 1 \
  --resolve ignite-catalog.localhost:18480:127.0.0.1 \
  http://ignite-catalog.localhost:18480/ > /dev/null
