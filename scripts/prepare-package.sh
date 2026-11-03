#!/usr/bin/env bash
# 固定コミットから検査済みの配布物を作る。レジストリには発行しない。
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
commit="${DEVBOARD_COMMIT:-$(git rev-parse HEAD)}"
[[ "$commit" = "$(git rev-parse HEAD)" ]] || { echo '対象コミットとHEADが一致しません' >&2; exit 1; }
[[ -z "$(git status --porcelain --untracked-files=all)" ]] || { echo '未コミットの変更があります' >&2; exit 1; }
# 以後は作業場所が変わっても影響しない固定コピーで実行する。
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
git archive "$commit" | tar -x -C "$work"
output="$PWD/releases"
cd "$work"
npm ci --include=dev
bash scripts/test.sh
mkdir artifacts
npm pack --pack-destination artifacts
version=$(node -p "JSON.parse(require('fs').readFileSync('package.json')).version")
cd artifacts
shasum -a 256 ./*.tgz > SHA256SUMS
printf '%s\n' "$commit" > COMMIT
mkdir -p "$output"
# mkdirの成功した実行だけが保存する。同じ版を上書きしない。
mkdir "$output/$version" || { echo '同じ版の成果物が存在します。版と変更履歴を確認してください' >&2; exit 1; }
cp ./* "$output/$version/"
printf '配布物: %s/%s\n' "$output" "$version"
