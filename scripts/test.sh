#!/usr/bin/env bash
# 取り込み前の確認。型 → 単体テスト → ビルド → ソースの検査 → カタログの監査 → 配布から更新までの通し確認
set -euo pipefail
cd "$(dirname "$0")/.."

# 全件を毎回実行する。時間は整数秒で記録し、失敗した工程の終了値をそのまま返す。
stage=0
run() {
  local name="$1" title="$2" started=$SECONDS rc
  shift 2
  stage=$((stage + 1))
  printf 'devboard-progress: %s/8 %s\n' "$stage" "$title"
  if "$@"; then rc=0; else rc=$?; fi
  printf 'harness-metric: stage=%s seconds=%s status=%s\n' "$name" "$((SECONDS - started))" "$rc"
  return "$rc"
}

run harness '実行基盤の検査' node --test scripts/test-entry.test.mjs scripts/audit-runner.test.mjs scripts/serve-catalog.test.mjs scripts/release.test.mjs
run types '型の検査' npx tsc --noEmit
run unit '単体テスト' npx vitest run --dir tests --maxWorkers=2
run build '配布物のビルド' node scripts/build.mjs
run check 'ソースの検査' node dist/cli.js check
run browser '監査ブラウザの準備' npx playwright install chromium
run catalog 'カタログの全件監査' npm run audit:design
run smoke '配布から更新までの通し確認' node scripts/smoke.mjs
