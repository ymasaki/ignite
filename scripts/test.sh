#!/usr/bin/env bash
# 取り込み前の確認。型 → 単体テスト → ビルド → ソースの検査 → カタログの監査 → 配布から更新までの通し確認
set -euo pipefail
cd "$(dirname "$0")/.."

node --test scripts/audit-runner.test.mjs scripts/serve-catalog.test.mjs
npx tsc --noEmit
npx vitest run --dir tests
node scripts/build.mjs
node dist/cli.js check
npx playwright install chromium > /dev/null
npm run audit:design
node scripts/smoke.mjs
