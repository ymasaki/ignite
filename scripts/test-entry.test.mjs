// 実際の入口を偽コマンドで通し、計測で失敗が隠れず後続工程が止まることを確かめる。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const commands = [
  'node --test scripts/hooks.test.mjs scripts/test-entry.test.mjs scripts/health.test.mjs scripts/audit-cache.test.mjs scripts/audit-runner.test.mjs scripts/serve-catalog.test.mjs scripts/release.test.mjs',
  'npx tsc --noEmit',
  'npx vitest run --dir tests --maxWorkers=2',
  'node scripts/build.mjs',
  'node dist/cli.js check',
  'npx playwright install chromium',
  'npm run audit:design',
  'node scripts/smoke.mjs',
]
const stages = ['harness', 'types', 'unit', 'build', 'check', 'browser', 'catalog', 'smoke']

test('検査入口は全件を順番に実行し、どの工程の失敗でも終了値を保持して後続を止める', () => {
  const work = mkdtempSync(path.join(tmpdir(), 'ignite-test-entry-'))
  try {
    mkdirSync(path.join(work, 'scripts'))
    mkdirSync(path.join(work, 'bin'))
    copyFileSync(new URL('./test.sh', import.meta.url), path.join(work, 'scripts/test.sh'))
    for (const name of ['node', 'npx', 'npm']) writeFileSync(path.join(work, 'bin', name), `#!/bin/bash
command="$(basename "$0") $*"
printf '%s\\n' "$command" >> "$IGNITE_TEST_CALLS"
if [[ "$command" = "$IGNITE_TEST_FAIL" ]]; then exit 17; fi
`, { mode: 0o755 })
    const calls = path.join(work, 'calls')
    for (const failure of [-1, ...commands.keys()]) {
      writeFileSync(calls, '')
      const result = spawnSync('/bin/bash', ['scripts/test.sh'], {
        cwd: work, encoding: 'utf8',
        env: { ...process.env, PATH: `${path.join(work, 'bin')}:${process.env.PATH}`, IGNITE_TEST_CALLS: calls, IGNITE_TEST_FAIL: commands[failure] ?? '' },
      })
      assert.equal(result.error, undefined)
      assert.equal(result.status, failure < 0 ? 0 : 17, result.stdout + result.stderr)
      const count = failure < 0 ? commands.length : failure + 1
      assert.deepEqual(readFileSync(calls, 'utf8').trim().split('\n'), commands.slice(0, count))
      assert.equal((result.stdout.match(/^devboard-progress: /gm) ?? []).length, count)
      assert.equal((result.stdout.match(/^harness-metric: /gm) ?? []).length, count)
      for (let i = 0; i < count; i++) assert.match(result.stdout,
        new RegExp(`harness-metric: stage=${stages[i]} seconds=\\d+ status=${i === failure ? 17 : 0}\\n`))
    }
  } finally { rmSync(work, { recursive: true, force: true }) }
})

test('不明な軽量モードを空の成功にしない', () => {
  for (const args of [['--unknown'], ['--commit', 'extra']]) {
    const result = spawnSync('bash', [fileURLToPath(new URL('./test.sh', import.meta.url)), ...args], { encoding: 'utf8' })
    assert.equal(result.status, 2)
    assert.match(result.stderr, /使い方/)
  }
})
