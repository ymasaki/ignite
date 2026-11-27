#!/usr/bin/env bash
# main取り込み後のカタログ反映。固定コミットからビルドする。
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
commit="${IGNITE_COMMIT:-$(git rev-parse HEAD)}"
[[ "$commit" = "$(git rev-parse HEAD)" ]] || { echo '対象コミットとHEADが一致しません' >&2; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || { echo '未コミットの変更があります' >&2; exit 1; }
output="$PWD/catalog-dist"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
git archive "$commit" | tar -x -C "$work"
cd "$work"
npm ci --include=dev
# 資源を相対パスで参照する。配信のほか、index.html をファイルとして資源ごと読む表示（遠隔の端末での閲覧など）でも同じビルドを開ける
CATALOG_BASE=./ node_modules/.bin/vite build catalog --outDir "$output" --emptyOutDir
