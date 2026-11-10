import { test } from 'node:test'
import nativeFs from 'node:fs'
import { syncBuiltinESMExports } from 'node:module'
import { createHash } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { auditInput, openAuditCache, pruneAuditCache, treeFiles, browserFiles, DEPENDENCY_SCRATCH } from './audit-cache.mjs'

const options = (store, extra = {}) => ({ snapshot: async () => ({ key: 'input', store }), ...extra })
async function report(root, text = '成功') {
  const output = path.join(root, 'catalog/test-results-audit')
  await fs.mkdir(output, { recursive: true })
  await fs.writeFile(path.join(output, 'report.md'), text)
  await fs.writeFile(path.join(output, '画面.png'), 'image')
}

test('同一入力の成功だけを復元し、fresh・期限・破損・引数・外部出力は再実行する', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'ignite-cache-'))
  const store = path.join(dir, 'cache')
  const a = path.join(dir, 'a'), b = path.join(dir, 'b')
  let time = 1000
  const opts = (env = {}) => options(store, { now: () => time, env })
  const open = (root = a, args = [], env = {}) => openAuditCache(root, args, () => false, opts(env))
  const save = async () => {
    const session = await open(a, [], { IGNITE_AUDIT_FRESH: '1' })
    assert.equal(session.hit, false)
    await report(a)
    await session.publish(); session.close()
  }
  try {
    await save()
    const expected = await treeFiles(path.join(a, 'catalog/test-results-audit'))
    await report(b, '前回')
    await fs.writeFile(path.join(b, 'catalog/test-results-audit/古い画像.png'), 'old')
    const hit = await open(b)
    assert.equal(hit.hit, true); hit.close()
    assert.deepEqual(await treeFiles(path.join(b, 'catalog/test-results-audit')), expected)
    for (const [args, env] of [[[], { IGNITE_AUDIT_FRESH: '1' }], [['--grep', '一部'], {}], [[], { IGNITE_STEPPER_SCREENSHOT: '/tmp/extra.png' }]]) {
      await save()
      const session = await open(a, args, env)
      assert.equal(session.hit, false)
      await assert.rejects(fs.access(path.join(store, 'input')))
      // 不成功ではpublishを呼ばない。closeだけで成功票は復活しない。
      session.close()
      const next = await open(); assert.equal(next.hit, false); next.close()
    }
    await save(); time += 24 * 60 * 60 * 1000
    const expired = await open(); assert.equal(expired.hit, false); await expired.publish(); expired.close()
    const renewed = await open(); assert.equal(renewed.hit, true); renewed.close()
    await fs.writeFile(path.join(store, 'input/output/画面.png'), '壊れた画像')
    const corrupt = await open(); assert.equal(corrupt.hit, false); corrupt.close()
    await save()
    await fs.rename(path.join(store, 'input/output'), path.join(dir, 'external-output'))
    await fs.symlink(path.join(dir, 'external-output'), path.join(store, 'input/output'))
    const symlink = await open(); assert.equal(symlink.hit, false); symlink.close()
    await save()
    const record = path.join(store, 'input/success.json')
    const json = JSON.parse(await fs.readFile(record, 'utf8')); json.createdAt = time + 1
    await fs.writeFile(record, JSON.stringify(json))
    const future = await open(); assert.equal(future.hit, false); future.close()
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('入力変更・中断・成果物不足は成功を保存しない', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'ignite-cache-input-'))
  let key = 'before', interrupted = false
  const opts = { env: {}, snapshot: async () => ({ key, store: path.join(dir, 'cache') }) }
  try {
    const session = await openAuditCache(dir, [], () => interrupted, opts)
    await report(dir); key = 'after'; await session.publish(); session.close()
    await assert.rejects(fs.access(path.join(dir, 'cache/before')))
    const second = await openAuditCache(dir, [], () => interrupted, opts)
    interrupted = true; await second.publish(); second.close()
    await assert.rejects(fs.access(path.join(dir, 'cache/after')))
    interrupted = false
    await fs.rm(path.join(dir, 'catalog/test-results-audit/report.md'))
    const third = await openAuditCache(dir, [], () => interrupted, opts)
    await third.publish(); third.close()
    await assert.rejects(fs.access(path.join(dir, 'cache/after')))
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('Gitの未保存・未追跡・ツリー・依存実体・環境変更を区別する', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'ignite-cache-key-'))
  const git = (...args) => execFileSync('git', ['-C', dir, ...args], { stdio: 'pipe', env: { ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_'))), GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' } })
  const inspect = () => treeFiles(path.join(dir, 'node_modules'), true, DEPENDENCY_SCRATCH)
  const input = (env = {}) => auditInput(dir, env, inspect)
  try {
    git('init', '-q'); await fs.writeFile(path.join(dir, '.gitignore'), 'node_modules/\n**/test-results-audit/\ntest-results/\n')
    await fs.writeFile(path.join(dir, 'source.ts'), 'a'); git('add', '.gitignore', 'source.ts'); git('commit', '-qm', 'initial')
    await fs.mkdir(path.join(dir, 'node_modules'))
    await fs.writeFile(path.join(dir, 'node_modules/dependency.js'), 'original')
    const first = await input(); assert.ok(first)
    assert.equal((await input()).key, first.key)
    assert.equal((await input({ IGNITE_AUDIT_FRESH: '1' })).key, first.key)
    assert.equal((await input({ DEVBOARD_PROJECT_DIR: '/main', DEVBOARD_BASE_BRANCH: 'main', DEVBOARD_COMMIT: 'commit', DEVBOARD_CHECK_PRIORITY: 'high' })).key, first.key)
    assert.equal((await input({ CODEX_TOOL_CALL_ID: 'another-call', CODEX_THREAD_ID: 'another-thread', CODEX_SESSION_ID: 'another-session', DEVBOARD_COMPUTER_TOKEN: 'not-a-real-token', DEVBOARD_DISTRIBUTED_SOCKET: '/tmp/test-socket', CODEX_VERSION: 'another-executor', CLAUDE_CODE_ENABLE_TODO_TOOLS: '1' })).key, first.key)
    assert.equal((await input({ CLAUDE_CODE_SESSION_ID: 'another-session', CLAUDE_PID: '1', CLAUDE_CODE_MESSAGING_SOCKET: '/tmp/test-socket', CLAUDE_CODE_MESSAGING_TOKEN: 'not-a-real-token', CLAUDE_EFFORT: 'high', CLAUDECODE: '1', LaunchInstanceID: 'another-launch', SECURITYSESSIONID: 'another-login', SSH_AUTH_SOCK: '/tmp/test-agent' })).key, first.key)
    assert.notEqual((await input({ UNKNOWN_RENDER_OPTION: 'new' })).key, first.key)
    // 単体テストの変換キャッシュは照合しない。同じ名前でも、根の直下でなければ依存として照合する
    await fs.mkdir(path.join(dir, 'node_modules/.vitest-cache')); await fs.writeFile(path.join(dir, 'node_modules/.vitest-cache/entry'), 'cache')
    assert.equal((await input()).key, first.key)
    await fs.mkdir(path.join(dir, 'node_modules/package/.vitest-cache'), { recursive: true }); await fs.writeFile(path.join(dir, 'node_modules/package/.vitest-cache/entry'), 'nested')
    assert.notEqual((await input()).key, first.key)
    await fs.rm(path.join(dir, 'node_modules/package'), { recursive: true })
    assert.equal((await input()).key, first.key)
    const cacheOptions = { env: {}, snapshot: () => input() }
    const saved = await openAuditCache(dir, [], () => false, cacheOptions)
    await report(dir); await saved.publish(); saved.close()
    const restored = await openAuditCache(dir, [], () => false, cacheOptions)
    assert.equal(restored.hit, true); restored.close()
    assert.equal((await input()).key, first.key)
    const receipt = path.join(first.store, first.key, 'success.json')
    const originalReceipt = await fs.readFile(receipt, 'utf8')
    for (const flag of ['assume-unchanged', 'skip-worktree']) {
      git('update-index', `--${flag}`, 'source.ts')
      await fs.writeFile(path.join(dir, 'source.ts'), 'hidden change')
      assert.equal(git('status', '--porcelain').toString().trim(), '')
      assert.equal(await input(), null)
      assert.equal(await openAuditCache(dir, [], () => false, { ...cacheOptions, env: { IGNITE_AUDIT_FRESH: '1' } }), null)
      assert.equal(await fs.readFile(receipt, 'utf8'), originalReceipt)
      await fs.writeFile(path.join(dir, 'source.ts'), 'a')
      git('update-index', `--no-${flag}`, 'source.ts')
      assert.equal((await input()).key, first.key)
    }
    const ignored = path.join(dir, 'catalog/e2e/test-results/failure.e2e.ts')
    await fs.mkdir(path.dirname(ignored), { recursive: true })
    await fs.writeFile(ignored, 'throw new Error("ignored input")')
    assert.equal(git('status', '--porcelain').toString().trim(), '')
    assert.equal(await input(), null)
    assert.equal(await openAuditCache(dir, [], () => false, cacheOptions), null)
    assert.equal(await fs.readFile(receipt, 'utf8'), originalReceipt)
    await fs.rm(path.join(dir, 'catalog/e2e'), { recursive: true })
    assert.equal((await input()).key, first.key)
    assert.equal(await auditInput(dir, {}, async () => {
      await fs.mkdir(path.dirname(ignored), { recursive: true })
      await fs.writeFile(ignored, 'input added during fingerprint')
      return inspect()
    }), null)
    await fs.rm(path.join(dir, 'catalog/e2e'), { recursive: true })
    await fs.writeFile(path.join(dir, 'source.ts'), 'b'); assert.equal(await input(), null)
    git('add', 'source.ts'); assert.equal(await input(), null); git('commit', '-qm', 'change')
    assert.notEqual((await input()).key, first.key)
    const beforeDependency = await input()
    await fs.writeFile(path.join(dir, 'node_modules/dependency.js'), 'modified without changing lockfiles')
    assert.notEqual((await input()).key, beforeDependency.key)
    await fs.writeFile(path.join(dir, 'unknown'), 'untracked'); assert.equal(await input(), null)
    await fs.rm(path.join(dir, 'unknown'))
    await fs.mkdir(path.join(dir, 'catalog/e2e/node_modules'), { recursive: true }); assert.equal(await input(), null)
    await fs.rm(path.join(dir, 'catalog'), { recursive: true })
    await fs.symlink('/tmp', path.join(dir, 'node_modules/external'))
    assert.equal(await input(), null)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('入力ロックは別プロセスの再利用を止め、保持元の異常終了で解放される', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'ignite-cache-lock-'))
  const file = path.join(dir, 'input.lock')
  const module = new URL('./audit-cache.mjs', import.meta.url).href
  let holder
  try {
    holder = spawn(process.execPath, ['--input-type=module', '-e', `
      import {openAuditCache} from ${JSON.stringify(module)};
      await openAuditCache(${JSON.stringify(dir)}, [], () => false, {env:{},snapshot:async()=>({key:'input',store:${JSON.stringify(dir)}})});
      console.log('locked'); setInterval(()=>{},1000);
    `], { stdio: ['ignore', 'pipe', 'pipe'] })
    const exited = new Promise(resolve => holder.once('exit', resolve))
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('入力ロックの取得期限')), 10000)
      holder.stdout.on('data', chunk => { if (String(chunk).includes('locked')) { clearTimeout(timer); resolve() } })
    })
    assert.equal(spawnSync('/usr/bin/lockf', ['-s', '-k', '-t', '0', file, '/usr/bin/true']).status, 75)
    holder.kill('SIGKILL'); await exited
    assert.equal(spawnSync('/usr/bin/lockf', ['-s', '-k', '-t', '0', file, '/usr/bin/true']).status, 0)
  } finally { holder?.kill('SIGKILL'); await fs.rm(dir, { recursive: true, force: true }) }
})

// 最終結果が成功したときだけ公開する順序を、実際の監査入口で確認する。
test('監査入口は成功を再利用し、fresh失敗・中断・子群停止失敗の成功票を残さない', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'ignite-cache-runner-'))
  const root = path.join(dir, 'work'), store = path.join(dir, 'cache'), lock = path.join(dir, 'global-lock')
  const calls = path.join(dir, 'calls'), marker = path.join(dir, 'child.pid')
  let child, serverPid
  const source = (await fs.readFile(new URL('./audit-design.mjs', import.meta.url), 'utf8'))
    .replace("'/tmp/ignite-catalog-audit-5198.lock'", JSON.stringify(lock))
    .replace('await openAuditCache(root, process.argv.slice(2), () => interrupted)',
      `await openAuditCache(root, process.argv.slice(2), () => interrupted, { snapshot: async () => ({ key: 'input', store: ${JSON.stringify(store)} }) })`)
  const cli = path.join(root, 'node_modules/@playwright/test/cli.js')
  const success = `const fs=require('node:fs');fs.appendFileSync(${JSON.stringify(calls)}, 'run\\n');fs.mkdirSync('catalog/test-results-audit',{recursive:true});fs.writeFileSync('catalog/test-results-audit/report.md','成功');`
  const run = (fresh = false) => {
    child = spawn(process.execPath, ['scripts/audit-design.mjs'], { cwd: root, env: { ...process.env, IGNITE_AUDIT_FRESH: fresh ? '1' : '' }, stdio: ['ignore', 'pipe', 'pipe'] })
    let output = ''
    child.stdout.on('data', data => { output += data }); child.stderr.on('data', data => { output += data })
    const done = new Promise(resolve => child.once('exit', code => resolve({ code, output })))
    return { process: child, done }
  }
  const saved = () => fs.access(path.join(store, 'input/success.json'))
  try {
    await fs.mkdir(path.join(root, 'scripts'), { recursive: true })
    await fs.mkdir(path.dirname(cli), { recursive: true })
    await fs.copyFile(new URL('./audit-cache.mjs', import.meta.url), path.join(root, 'scripts/audit-cache.mjs'))
    await fs.writeFile(path.join(root, 'scripts/audit-design.mjs'), source)
    await fs.writeFile(path.join(root, 'scripts/audit-server.mjs'), `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(marker)},String(process.pid));process.send({ready:true,port:41234});setInterval(()=>{},1000)`)
    await fs.writeFile(cli, success)
    let result = await run(true).done; assert.equal(result.code, 0, result.output); await saved()
    result = await run().done; assert.equal(result.code, 0, result.output); assert.match(result.output, /再利用/)
    assert.equal(await fs.readFile(calls, 'utf8'), 'run\n')
    await fs.writeFile(cli, 'process.exit(7)')
    result = await run(true).done; assert.equal(result.code, 7, result.output); await assert.rejects(saved())
    result = await run().done; assert.equal(result.code, 7, result.output)
    await fs.writeFile(cli, success)
    assert.equal((await run(true).done).code, 0); await saved()
    await fs.writeFile(cli, `require('node:fs').writeFileSync(${JSON.stringify(calls)},'running');setInterval(()=>{},1000)`)
    const active = run(true)
    for (let i = 0; i < 200 && await fs.readFile(calls, 'utf8') !== 'running'; i++) await new Promise(resolve => setTimeout(resolve, 20))
    active.process.kill('SIGTERM'); result = await active.done
    assert.equal(result.code, 143, result.output); await assert.rejects(saved())
    await fs.writeFile(cli, success)
    assert.equal((await run(true).done).code, 0); await saved()
    const cacheModule = path.join(root, 'scripts/audit-cache.mjs')
    const cacheSource = await fs.readFile(cacheModule, 'utf8')
    await fs.writeFile(cacheModule, cacheSource.replace('await fs.rename(temporary, entry); temporary = undefined',
      "await fs.rename(temporary, entry); temporary = undefined; process.kill(process.pid, 'SIGTERM'); await new Promise(resolve => setTimeout(resolve, 30))"))
    result = await run(true).done
    assert.equal(result.code, 143, result.output); await assert.rejects(saved())
    await fs.writeFile(cacheModule, cacheSource)
    await fs.writeFile(path.join(root, 'scripts/audit-design.mjs'), source.replace('await rm(lock, { recursive: true })', "throw new Error('共通ロックの解放失敗を注入')"))
    result = await run(true).done
    assert.equal(result.code, 1, result.output); assert.match(result.output, /共通ロックの解放失敗/); await assert.rejects(saved())
    await fs.rm(lock, { recursive: true })
    await fs.writeFile(path.join(root, 'scripts/audit-design.mjs'), source)
    assert.equal((await run(true).done).code, 0); await saved()
    const denied = `
const realKill = process.kill.bind(process)
process.kill = (pid, signal) => { if(pid < 0 && signal === 'SIGTERM') throw Object.assign(new Error('停止権限なし'), {code:'EPERM'}); return realKill(pid, signal) }
`
    await fs.writeFile(path.join(root, 'scripts/audit-design.mjs'), denied + source)
    result = await run(true).done
    serverPid = Number(await fs.readFile(marker, 'utf8'))
    assert.equal(result.code, 1, result.output); assert.match(result.output, /停止権限なし/); await assert.rejects(saved())
    await fs.access(lock)
  } finally {
    if (child?.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
    if (serverPid) { try { process.kill(-serverPid, 'SIGKILL') } catch (error) { if (error.code !== 'ESRCH') throw error } }
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('1秒を超える入力競合は待機し、先行の終了後に進み、待機中の中断も受け付ける', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'ignite-cache-wait-'))
  const copied = path.join(dir, 'cache-under-test.mjs')
  await fs.writeFile(copied, (await fs.readFile(new URL('./audit-cache.mjs', import.meta.url), 'utf8')).replace('const heartbeat = 60 * 1000', 'const heartbeat = 200'))
  const module = pathToFileURL(copied).href
  const children = []
  async function run(hold = false) {
    const child = spawn(process.execPath, ['--input-type=module', '-e', `
      import {openAuditCache} from ${JSON.stringify(module)};
      let interrupted=false; process.on('SIGTERM',()=>{interrupted=true});
      try {
        const session=await openAuditCache(${JSON.stringify(dir)}, [], ()=>interrupted, {env:{},snapshot:async()=>({key:'input',store:${JSON.stringify(dir)}})});
        console.log('acquired');
        if(${hold}) setInterval(()=>{},1000); else session.close();
      } catch(error) { console.error(error.message);process.exitCode=interrupted?143:1 }
    `], { stdio: ['ignore', 'pipe', 'pipe'] })
    children.push(child)
    let output = ''
    child.stdout.on('data', data => { output += data }); child.stderr.on('data', data => { output += data })
    const done = new Promise(resolve => child.once('exit', code => resolve({ code, output })))
    async function saw(text) {
      for (let i = 0; i < 500; i++) { if (output.includes(text)) return; await new Promise(resolve => setTimeout(resolve, 20)) }
      throw new Error(`出力が届きません: ${text}: ${output}`)
    }
    return { child, done, saw }
  }
  try {
    const holder = await run(true); await holder.saw('acquired')
    const waiter = await run(); await waiter.saw('同一入力の監査を待機'); await waiter.saw('[audit-cache] 待機中:')
    assert.equal(waiter.child.exitCode, null)
    holder.child.kill('SIGKILL'); await holder.done
    const result = await waiter.done; assert.equal(result.code, 0, result.output); assert.match(result.output, /acquired/)
    const holder2 = await run(true); await holder2.saw('acquired')
    const waiter2 = await run(); await waiter2.saw('同一入力の監査を待機')
    waiter2.child.kill('SIGTERM')
    const stopped = await waiter2.done; assert.equal(stopped.code, 143, stopped.output)
    assert.equal(spawnSync('/usr/bin/lockf', ['-s', '-k', '-t', '0', path.join(dir, 'input.lock'), '/usr/bin/true']).status, 75)
    holder2.child.kill('SIGKILL'); await holder2.done
  } finally { for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); await fs.rm(dir, { recursive: true, force: true }) }
})


test('使用しないブラウザの追加は入力を変えず、使用する描画資源の変更は検出する', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'ignite-browser-input-'))
  const manifest = { browsers: [
    { name: 'chromium', revision: '10' }, { name: 'chromium-headless-shell', revision: '10' }, { name: 'ffmpeg', revision: '20' },
  ] }
  const executable = path.join(dir, 'chromium-10/bin/chrome')
  try {
    for (const name of ['chromium-10', 'chromium_headless_shell-10', 'ffmpeg-20']) {
      await fs.mkdir(path.join(dir, name, 'bin'), { recursive: true })
      await fs.writeFile(path.join(dir, name, 'bin/chrome'), name)
    }
    const before = await browserFiles(executable, manifest)
    await fs.mkdir(path.join(dir, 'chromium-99'))
    await fs.writeFile(path.join(dir, 'chromium-99/unrelated'), '他プロジェクトの版')
    assert.deepEqual(await browserFiles(executable, manifest), before)
    await fs.writeFile(path.join(dir, 'chromium_headless_shell-10/resource'), '描画資源の変更')
    assert.notDeepEqual(await browserFiles(executable, manifest), before)
    await assert.rejects(browserFiles(executable, { browsers: [...manifest.browsers.slice(0, 1), { name: 'chromium-headless-shell', revision: '11' }, manifest.browsers[2]] }))
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('全ファイルの順序・mode・リンク・SHA256を保ち、変更と削除も照合する', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'ignite-hash-files-'))
  const root = path.join(dir, 'input')
  const hash = text => createHash('sha256').update(text).digest('hex')
  try {
    await fs.mkdir(path.join(root, 'nested'), { recursive: true })
    const expected = []
    for (const name of ['00.txt', '01.txt', '02.txt', 'nested/z.txt']) {
      await fs.writeFile(path.join(root, name), name)
      await fs.chmod(path.join(root, name), 0o640)
      expected.push([name, 0o640, hash(name)])
    }
    await fs.symlink('nested/z.txt', path.join(root, 'zz-link'))
    expected.push(['zz-link', 'link', 'nested/z.txt'])
    assert.deepEqual(await treeFiles(root, true), expected)
    await assert.rejects(treeFiles(root), /外部参照/)
    await fs.writeFile(path.join(root, '00.txt'), 'changed')
    expected[0][2] = hash('changed')
    assert.deepEqual(await treeFiles(root, true), expected)
    await fs.rm(path.join(root, '01.txt'))
    expected.splice(1, 1)
    assert.deepEqual(await treeFiles(root, true), expected)
    await fs.writeFile(path.join(dir, 'outside'), 'outside')
    await fs.symlink('../outside', path.join(root, 'external'))
    await assert.rejects(treeFiles(root, true), /外部参照/)
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})

test('ハッシュの読み取りは最大4個で、1件が失敗しても全workerの終了を待つ', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'ignite-hash-workers-'))
  const original = nativeFs.createReadStream
  let active = 0, maximum = 0, failing = false
  try {
    for (let i = 0; i < 12; i++) await fs.writeFile(path.join(dir, `${String(i).padStart(2, '0')}.txt`), String(i))
    // このテストだけストリームを制御する。本番の入口へ注入用APIは足さない。
    nativeFs.createReadStream = file => ({
      async *[Symbol.asyncIterator]() {
        active++; maximum = Math.max(maximum, active)
        try {
          if (failing && path.basename(file) === '00.txt') throw new Error('読み取りエラー')
          await new Promise(resolve => setTimeout(resolve, 20))
          yield await fs.readFile(file)
        } finally { active-- }
      },
    })
    syncBuiltinESMExports()
    const files = await treeFiles(dir)
    assert.equal(files.length, 12)
    assert.ok(files.every(file => typeof file[2] === 'string'))
    assert.ok(maximum > 1 && maximum <= 4, `最大同時数: ${maximum}`)
    assert.equal(active, 0)
    failing = true
    await assert.rejects(treeFiles(dir), /読み取りエラー/)
    assert.equal(active, 0, '他の読み取りが残っている間に失敗を返さない')
  } finally {
    nativeFs.createReadStream = original
    syncBuiltinESMExports()
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('期限切れの成功結果・保存途中の残り・使われていないロックだけを消す', async () => {
  const dir = await fs.mkdtemp(path.join(tmpdir(), 'ignite-prune-'))
  const day = 24 * 60 * 60 * 1000
  const now = Date.now()
  const entry = async (name, createdAt) => {
    await fs.mkdir(path.join(dir, name, 'output'), { recursive: true })
    if (createdAt !== undefined) await fs.writeFile(path.join(dir, name, 'success.json'), JSON.stringify({ key: name, createdAt }))
  }
  const old = async name => { const time = new Date(now - day - 1000); await fs.utimes(path.join(dir, name), time, time) }
  try {
    await entry('expired', now - day)
    await entry('fresh', now - day + 60000)
    await entry('current', now - day * 3)
    await entry('broken'); await old('broken')
    await entry('.audit-save-old'); await old('.audit-save-old')
    await entry('.audit-save-new')
    for (const name of ['expired.lock', 'fresh.lock', 'current.lock', 'orphan.lock', 'recent.lock', 'held.lock']) await fs.writeFile(path.join(dir, name), '')
    for (const name of ['expired.lock', 'fresh.lock', 'current.lock', 'orphan.lock', 'held.lock']) await old(name)
    // 実行中の監査が持っているロックは、古くても消さない
    const holder = spawn('/usr/bin/lockf', ['-k', path.join(dir, 'held.lock'), '/bin/sleep', '30'], { stdio: 'ignore' })
    try {
      for (let i = 0; i < 100 && spawnSync('/usr/bin/lockf', ['-k', '-s', '-t', '0', path.join(dir, 'held.lock'), '/usr/bin/true']).status === 0; i++) await new Promise(resolve => setTimeout(resolve, 20))
      assert.equal(await pruneAuditCache(dir, 'current', now), 5)
      assert.deepEqual((await fs.readdir(dir)).sort(), ['.audit-save-new', 'current', 'current.lock', 'fresh', 'fresh.lock', 'held.lock', 'recent.lock'])
      assert.equal(await pruneAuditCache(dir, 'current', now), 0)
    } finally { holder.kill() }
  } finally { await fs.rm(dir, { recursive: true, force: true }) }
})
