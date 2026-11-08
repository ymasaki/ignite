#!/usr/bin/env bash
# worktree作成後の準備。既存hookに競合したら上書きせず止める。
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/install-hooks.mjs
npm ci --prefer-offline --no-audit --no-fund
