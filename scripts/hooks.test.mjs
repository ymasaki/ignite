// 実際のGit commitと型検査で、indexの境界と共有hookの導入を確認する。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { execFileSync, spawnSync, spawn } from 'node:child_process'
import { once } from 'node:events'
import { hook, installHook } from './install-hooks.mjs'

const dependencies = path.resolve('node_modules')
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')))
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'ignite-hook-test-'))
  t.after(() => fs.rm(root, { recursive: true, force: true }))
  await fs.mkdir(path.join(root, 'scripts'))
  await fs.mkdir(path.join(root, 'scratch'))
  await fs.mkdir(path.join(root, 'src'))
  for (const name of ['test.sh', 'pre-commit.mjs', 'install-hooks.mjs']) await fs.copyFile(new URL(name, import.meta.url), path.join(root, 'scripts', name))
  await fs.symlink(dependencies, path.join(root, 'node_modules'), 'dir')
  await fs.writeFile(path.join(root, '.gitignore'), 'node_modules/\nscratch/\n')
  await fs.writeFile(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, types: [], skipLibCheck: true }, include: ['src'] }))
  await fs.writeFile(path.join(root, 'src/value.ts'), 'const value: number = 1\n')
  const env = { ...cleanEnv, TMPDIR: path.join(root, 'scratch') }
  const git = (...args) => execFileSync('git', args, { cwd: root, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  git('init', '-q'); git('config', 'user.name', 'Test'); git('config', 'user.email', 'test@example.invalid')
  return { root, env, git, commit: () => spawnSync('git', ['commit', '-qm', 'test'], { cwd: root, env, encoding: 'utf8' }) }
}
const output = result => result.stdout + result.stderr
async function unchangedOnFailure(f, pattern) {
  const before = f.git('status', '--porcelain=v1')
  const result = f.commit()
  assert.notEqual(result.status, 0, output(result))
  assert.match(output(result), pattern)
  assert.equal(f.git('status', '--porcelain=v1'), before)
  assert.deepEqual((await fs.readdir(path.join(f.root, 'scratch'))).filter(name => name.startsWith('ignite-commit-')), [])
  assert.equal(await fs.stat(path.join(f.root, '.git/wt-tests-passed')).catch(() => null), null)
}

test('コミットする型・空白を検査し、部分stageとskip-worktreeで検査対象を隠せない', { timeout: 60000 }, async t => {
  const f = await fixture(t)
  await installHook(f.root)
  f.git('add', '.gitignore', 'tsconfig.json', 'src/value.ts', 'scripts/test.sh', 'scripts/pre-commit.mjs', 'scripts/install-hooks.mjs')
  assert.equal(f.commit().status, 0)
  const source = path.join(f.root, 'src/value.ts')
  await fs.writeFile(source, "const value: number = 'bad'\n")
  f.git('add', 'src/value.ts')
  await fs.writeFile(source, 'const value: number = 2\n')
  await unchangedOnFailure(f, /TS2322/)
  // 逆に、未stageの型エラーと未追跡の型エラーはコミット対象へ混ぜない。
  f.git('add', 'src/value.ts')
  await fs.writeFile(source, "const value: number = 'unstaged'\n")
  await fs.writeFile(path.join(f.root, 'src/untracked.ts'), "const untracked: number = 'bad'\n")
  assert.equal(f.commit().status, 0)
  await fs.rm(path.join(f.root, 'src/untracked.ts'))
  await fs.writeFile(source, 'const value: number = 3  \n')
  f.git('add', 'src/value.ts')
  await unchangedOnFailure(f, /trailing whitespace/)
  await fs.writeFile(source, 'const value: number = 3\n')
  f.git('add', 'src/value.ts')
  // 他からimportされない独立ファイルも必ず書き出す。
  await fs.writeFile(path.join(f.root, 'src/independent.ts'), "const independent: number = 'bad'\n")
  f.git('add', 'src/independent.ts')
  f.git('update-index', '--skip-worktree', 'src/independent.ts')
  await unchangedOnFailure(f, /TS2322/)
  f.git('update-index', '--no-skip-worktree', 'src/independent.ts')
  f.git('rm', '-f', 'src/independent.ts')
  // 本体の未stage削除と、indexからの削除の双方を旧版と誤認しない。
  await fs.rm(path.join(f.root, 'scripts/pre-commit.mjs'))
  await unchangedOnFailure(f, /本体がありません/)
  f.git('add', '-u', 'scripts/pre-commit.mjs')
  await unchangedOnFailure(f, /本体がありません/)
})

test('旧worktreeは許容し、導入済みworktreeでは共通hookが働く', { timeout: 60000 }, async t => {
  const f = await fixture(t)
  await installHook(f.root)
  f.git('add', '.gitignore', 'tsconfig.json', 'src/value.ts')
  const old = f.commit()
  assert.equal(old.status, 0, output(old))
  assert.match(output(old), /導入前の版/)
  const second = path.join(f.root, 'scratch/second')
  f.git('worktree', 'add', '-qb', 'second', second)
  await fs.mkdir(path.join(second, 'scripts'))
  for (const name of ['test.sh', 'pre-commit.mjs', 'install-hooks.mjs']) await fs.copyFile(new URL(name, import.meta.url), path.join(second, 'scripts', name))
  await fs.symlink(dependencies, path.join(second, 'node_modules'), 'dir')
  await installHook(second)
  execFileSync('git', ['add', 'scripts'], { cwd: second, env: f.env })
  await fs.writeFile(path.join(second, 'src/value.ts'), "const value: number = 'bad'\n")
  execFileSync('git', ['add', 'src/value.ts'], { cwd: second, env: f.env })
  const failed = spawnSync('git', ['commit', '-qm', 'test'], { cwd: second, env: f.env, encoding: 'utf8' })
  assert.notEqual(failed.status, 0)
  assert.match(output(failed), /TS2322/)
})

test('導入は原子的・冪等で、同時導入と公開前失敗でも既存hookを壊さない', async t => {
  const f = await fixture(t)
  const target = path.join(f.root, '.git/hooks/pre-commit')
  await assert.rejects(installHook(f.root, { beforePublish: async source => {
    assert.equal(await fs.readFile(source, 'utf8'), hook)
    assert.ok((await fs.stat(source)).mode & 0o111)
    assert.equal(await fs.stat(target).catch(() => null), null)
    throw new Error('公開前の中断')
  } }), /公開前の中断/)
  assert.equal(await fs.stat(target).catch(() => null), null)
  assert.deepEqual((await fs.readdir(path.dirname(target))).filter(name => name.startsWith('.ignite-hook-')), [])
  await Promise.all([installHook(f.root), installHook(f.root), installHook(f.root)])
  assert.equal(await fs.readFile(target, 'utf8'), hook)
  await fs.writeFile(target, '#!/bin/sh\nexit 17\n')
  await assert.rejects(installHook(f.root), /既存のpre-commit/)
  assert.equal(await fs.readFile(target, 'utf8'), '#!/bin/sh\nexit 17\n')
  await fs.rm(target)
  f.git('config', 'core.hooksPath', 'custom-hooks')
  await assert.rejects(installHook(f.root), /core.hooksPath/)
  assert.equal(await fs.stat(target).catch(() => null), null)
})

test('本当の公開前中断でも最終パスに書きかけのhookを残さない', async t => {
  const f = await fixture(t)
  const script = `import { installHook } from ${JSON.stringify(new URL('./install-hooks.mjs', import.meta.url).href)};
await installHook(process.argv[1], {beforePublish: async () => { process.send('ready'); await new Promise(() => {}); }});`
  const child = spawn(process.execPath, ['--input-type=module', '-e', script, f.root], { env: f.env, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] })
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL') })
  const exit = once(child, 'exit')
  await once(child, 'message')
  child.kill('SIGTERM')
  await exit
  assert.equal(await fs.stat(path.join(f.root, '.git/hooks/pre-commit')).catch(() => null), null)
  await installHook(f.root)
})

test('指定indexを使い、検査中のindex更新と中断を成功にしない', { timeout: 20000 }, async t => {
  const f = await fixture(t)
  await installHook(f.root)
  f.git('add', '.gitignore', 'tsconfig.json', 'src/value.ts', 'scripts')
  assert.equal(f.commit().status, 0)
  // 実tscのテストとは別に、停止位置を制御して競合とGit環境の分離を確認する。
  await fs.rm(path.join(f.root, 'node_modules'))
  await fs.mkdir(path.join(f.root, 'node_modules/typescript/bin'), { recursive: true })
  const ready = path.join(f.root, 'scratch/ready')
  const release = path.join(f.root, 'scratch/release')
  await fs.writeFile(path.join(f.root, 'node_modules/typescript/bin/tsc'), `
const fs = require('node:fs');
if (Object.keys(process.env).some(name => name.startsWith('GIT_'))) process.exit(19);
fs.writeFileSync(${JSON.stringify(ready)}, process.cwd());
const timer = setInterval(() => { if (fs.existsSync(${JSON.stringify(release)})) { clearInterval(timer); } }, 10);
`)
  const alternate = path.join(f.root, 'scratch/alternate-index')
  await fs.copyFile(path.join(f.root, '.git/index'), alternate)
  const env = { ...f.env, GIT_INDEX_FILE: alternate }
  const originalTree = f.git('write-tree')
  const waitReady = async () => {
    for (let i = 0; i < 200; i++) {
      try { return await fs.readFile(ready, 'utf8') } catch { await new Promise(resolve => setTimeout(resolve, 10)) }
    }
    throw new Error('型検査が始まりませんでした')
  }
  const run = () => {
    const child = spawn(process.execPath, ['scripts/pre-commit.mjs'], { cwd: f.root, env })
    let output = ''
    child.stdout.on('data', chunk => { output += chunk })
    child.stderr.on('data', chunk => { output += chunk })
    const done = once(child, 'close').then(([code]) => ({ code, output }))
    t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL') })
    return { child, done }
  }
  const first = run()
  const snapshot = await waitReady()
  await fs.writeFile(path.join(f.root, 'src/value.ts'), 'const value: number = 8\n')
  execFileSync('git', ['add', 'src/value.ts'], { cwd: f.root, env })
  await fs.writeFile(release, '')
  const changed = await first.done
  assert.equal(changed.code, 1, changed.output)
  assert.match(changed.output, /indexが変わりました/)
  assert.equal(f.git('write-tree'), originalTree)
  assert.equal(await fs.stat(snapshot).catch(() => null), null)
  await fs.rm(ready); await fs.rm(release)
  const second = run()
  const interruptedSnapshot = await waitReady()
  second.child.kill('SIGTERM')
  const stopped = await second.done
  assert.equal(stopped.code, 143, stopped.output)
  assert.equal(await fs.stat(interruptedSnapshot).catch(() => null), null)
})
