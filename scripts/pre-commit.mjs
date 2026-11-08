// 部分stageを含め、コミットするindexだけを一時コピーで型検査する。
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFileSync, spawn } from 'node:child_process'

let temporary
let child
let interrupted = 0
const started = performance.now()
const handlers = new Map()
for (const [signal, code] of [['SIGINT', 130], ['SIGTERM', 143], ['SIGHUP', 129]]) {
  const handler = () => { interrupted ||= code; child?.kill(signal) }
  handlers.set(signal, handler)
  process.on(signal, handler)
}
try {
  // Gitにはフック起動時のGIT_INDEX_FILE等を渡し、対象indexを保つ。
  const git = args => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()
  const root = git(['rev-parse', '--show-toplevel'])
  process.chdir(root)
  const tree = git(['write-tree'])
  execFileSync('git', ['diff', '--cached', '--check'], { stdio: 'inherit' })
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'ignite-commit-'))
  git(['checkout-index', '--all', '--ignore-skip-worktree-bits', `--prefix=${temporary}/`])
  await fs.symlink(path.join(root, 'node_modules'), path.join(temporary, 'node_modules'), 'dir')
  const compiler = path.join(root, 'node_modules/typescript/bin/tsc')
  await fs.access(compiler)
  if (interrupted) throw new Error('コミット検査を中断しました')
  console.log('[ignite-hook] ステージした内容の型を検査します')
  const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')))
  const status = await new Promise((resolve, reject) => {
    child = spawn(process.execPath, [compiler, '--noEmit', '--project', path.join(temporary, 'tsconfig.json')], {
      cwd: temporary, env, stdio: 'inherit',
    })
    child.once('error', reject)
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)))
  })
  child = undefined
  if (interrupted || status !== 0) throw new Error(`コミットする内容の型検査が失敗しました（${interrupted || status}）`)
  if (git(['write-tree']) !== tree) throw new Error('検査中にindexが変わりました。もう一度コミットしてください')
} catch (error) {
  console.error(`[ignite-hook] ${error.message}`)
  process.exitCode = interrupted || 1
} finally {
  if (temporary) await fs.rm(temporary, { recursive: true, force: true })
  if (interrupted) process.exitCode = interrupted
  for (const [signal, handler] of handlers) process.removeListener(signal, handler)
  console.log(`harness-metric: stage=commit seconds=${((performance.now() - started) / 1000).toFixed(3)} status=${process.exitCode || 0}`)
}
